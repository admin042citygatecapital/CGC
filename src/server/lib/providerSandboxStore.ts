import crypto from 'node:crypto';
import { asc, desc, eq } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { providerSandboxEvents, providerSandboxRuns } from '../db/schema.js';
import { appendAuditEntry } from './auditLog.js';
import type { Currency } from './providerContracts.js';
import {
  ProviderSandboxError, SANDBOX_CURRENCIES, SyntheticProviderAdapter,
  signSyntheticWebhook, SyntheticWebhookReplayGuard,
} from './syntheticProviderSandbox.js';

export interface ProviderSandboxActor { id: string; email: string; ip?: string; }
export interface ProviderSandboxInput { idempotencyKey: string; subjectType: 'individual' | 'business'; currencies?: Currency[]; }

function requireDatabase(): void {
  if (!isDatabaseConfigured()) throw new ProviderSandboxError('Provider sandbox requires PostgreSQL.', 'DATABASE_REQUIRED');
}

function cleanIdempotencyKey(value: string): string {
  const key = String(value ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) throw new ProviderSandboxError('A valid 8-128 character idempotency key is required.', 'INVALID_IDEMPOTENCY_KEY');
  return key;
}

function command(runId: string, step: string) {
  return { idempotencyKey: `${runId}:${step}`, correlationId: runId };
}

export async function listProviderSandboxRuns(limit = 25) {
  requireDatabase();
  return getDb().select().from(providerSandboxRuns).orderBy(desc(providerSandboxRuns.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}

export async function getProviderSandboxRun(id: string) {
  requireDatabase();
  const [runs, events] = await Promise.all([
    getDb().select().from(providerSandboxRuns).where(eq(providerSandboxRuns.id, id)).limit(1),
    getDb().select().from(providerSandboxEvents).where(eq(providerSandboxEvents.runId, id)).orderBy(asc(providerSandboxEvents.sequence)),
  ]);
  return runs[0] ? { ...runs[0], events, syntheticOnly: true, financialOperationsLocked: true } : null;
}

export async function runProviderSandbox(input: ProviderSandboxInput, actor: ProviderSandboxActor) {
  requireDatabase();
  const idempotencyKey = cleanIdempotencyKey(input.idempotencyKey);
  if (input.subjectType !== 'individual' && input.subjectType !== 'business') throw new ProviderSandboxError('subjectType must be individual or business.', 'INVALID_SUBJECT_TYPE');
  const currencies = [...new Set(input.currencies?.length ? input.currencies : SANDBOX_CURRENCIES)];
  if (currencies.some(currency => !SANDBOX_CURRENCIES.includes(currency))) throw new ProviderSandboxError('Unsupported sandbox currency.', 'INVALID_CURRENCY');

  const existing = await getDb().select().from(providerSandboxRuns).where(eq(providerSandboxRuns.idempotencyKey, idempotencyKey)).limit(1);
  if (existing[0]) return getProviderSandboxRun(existing[0].id);

  const id = `syn_run_${crypto.randomUUID()}`;
  const subjectRef = `syn_${input.subjectType}_${crypto.randomUUID()}`;
  await getDb().insert(providerSandboxRuns).values({ id, idempotencyKey, subjectType: input.subjectType, subjectRef, currencies, initiatedBy: actor.id });

  const adapter = new SyntheticProviderAdapter();
  const events: Array<{ eventType: string; providerRef?: string; details?: Record<string, unknown> }> = [];
  const add = <T extends { providerId: string }>(eventType: string, result: T): T => {
    const { providerId, ...details } = result;
    events.push({ eventType, providerRef: providerId, details: details as Record<string, unknown> });
    return result;
  };
  try {
    const verification = input.subjectType === 'individual'
      ? await adapter.verifyIndividual({ ...command(id, 'identity'), subjectRef })
      : await adapter.verifyBusiness({ ...command(id, 'kyb'), businessRef: subjectRef, beneficialOwnerRefs: [`syn_owner_${crypto.randomUUID()}`] });
    add(input.subjectType === 'individual' ? 'identity_verified' : 'kyb_verified', verification);
    const screening = await adapter.screen({ ...command(id, 'screening'), subjectRef, reason: 'onboarding' }); add('screening_completed', screening);
    const account = await adapter.createAccount({ ...command(id, 'account'), customerRef: subjectRef, currencies }); add('account_created', account);
    const quote = await adapter.quote({ ...command(id, 'quote'), sell: 'GBP', buy: 'EUR', amount: '100.00' }); add('fx_quote_created', quote);
    const conversion = await adapter.convert({ ...command(id, 'convert'), quoteId: quote.quoteId }); add('fx_conversion_completed', conversion);
    const payment = await adapter.execute({ ...command(id, 'payment'), paymentRef: `syn_payment_${crypto.randomUUID()}`, corridorId: 'syn_corridor_uk_sepa' }); add('payment_executed', payment);
    const reversal = await adapter.reverse({ ...command(id, 'reversal'), providerPaymentId: payment.providerId, reason: 'Synthetic reversal rehearsal' }); add('payment_reversed', reversal);
    const posting = await adapter.post({ ...command(id, 'ledger'), postingBatchId: `syn_batch_${crypto.randomUUID()}`, entries: [
      { accountRef: 'syn_ledger_customer', debit: '100.00', currency: 'GBP' },
      { accountRef: 'syn_ledger_safeguarding', credit: '100.00', currency: 'GBP' },
    ] }); add('ledger_posted', posting);
    const businessDate = new Date().toISOString().slice(0, 10);
    const reconciliation = await adapter.reconcile({ ...command(id, 'reconciliation'), reconciliationId: `syn_recon_${crypto.randomUUID()}`, businessDate, providerStatementRef: `syn_statement_${crypto.randomUUID()}` }); add('reconciliation_completed', reconciliation);
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const envelope = signSyntheticWebhook({ runId: id, status: 'passed' }, webhookSecret);
    const replayGuard = new SyntheticWebhookReplayGuard();
    if (!replayGuard.verify(envelope, webhookSecret) || replayGuard.verify(envelope, webhookSecret)) {
      throw new ProviderSandboxError('Synthetic signed-webhook verification or replay protection failed.', 'WEBHOOK_VERIFICATION_FAILED');
    }
    events.push({ eventType: 'signed_webhook_verified', providerRef: envelope.eventId, details: { timestamp: envelope.timestamp, replayWindowSeconds: 300 } });

    await getDb().transaction(async tx => {
      await tx.insert(providerSandboxEvents).values(events.map((event, index) => ({ id: `syn_evt_${crypto.randomUUID()}`, runId: id, sequence: index + 1, ...event })));
      await tx.update(providerSandboxRuns).set({ status: 'passed', results: { steps: events.length, breakCount: reconciliation.breakCount, screening: { sanctions: screening.sanctions, pep: screening.pep, adverseMedia: screening.adverseMedia }, realFunds: false }, completedAt: new Date() }).where(eq(providerSandboxRuns.id, id));
    });
    await appendAuditEntry({ adminId: actor.id, adminEmail: actor.email, action: 'provider_sandbox_passed', target: 'provider-sandbox', targetId: id, details: { subjectType: input.subjectType, currencies, syntheticOnly: true }, ip: actor.ip });
  } catch (error) {
    const code = error instanceof ProviderSandboxError ? error.code : 'SANDBOX_RUN_FAILED';
    await getDb().update(providerSandboxRuns).set({ status: 'failed', failureCode: code, results: { message: error instanceof Error ? error.message : 'Unknown sandbox failure' }, completedAt: new Date() }).where(eq(providerSandboxRuns.id, id));
    await appendAuditEntry({ adminId: actor.id, adminEmail: actor.email, action: 'provider_sandbox_failed', target: 'provider-sandbox', targetId: id, details: { code, syntheticOnly: true }, ip: actor.ip });
  }
  return getProviderSandboxRun(id);
}
