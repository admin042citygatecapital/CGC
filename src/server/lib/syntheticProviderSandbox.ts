import crypto from 'node:crypto';
import type {
  AccountProvider, Currency, FxProvider, IdentityProvider, KyBProvider, LedgerProvider,
  PaymentProvider, ProviderCommand, ProviderResult, ReconciliationProvider, ScreeningProvider,
  SignedWebhookEnvelope,
} from './providerContracts.js';
import { validateProviderCommand, validateProviderEnvelope } from './providerContracts.js';

export const SYNTHETIC_REF_PATTERN = /^syn_[a-z0-9][a-z0-9_-]{2,80}$/;
export const SANDBOX_CURRENCIES: readonly Currency[] = ['GBP', 'EUR', 'USD', 'CAD', 'AUD', 'CHF'];

export type SyntheticScreeningResult = ProviderResult & {
  sanctions: 'clear';
  pep: 'clear';
  adverseMedia: 'clear';
  synthetic: true;
};

export class ProviderSandboxError extends Error {
  constructor(message: string, public readonly code: string) { super(message); }
}

function assertCommand(command: ProviderCommand): void {
  const gaps = validateProviderCommand(command);
  if (gaps.length) throw new ProviderSandboxError(gaps.join('; '), 'INVALID_PROVIDER_COMMAND');
}

export function assertSyntheticReference(value: string, label = 'reference'): void {
  if (!SYNTHETIC_REF_PATTERN.test(value)) {
    throw new ProviderSandboxError(`${label} must use the syn_ namespace; real customer or provider references are prohibited.`, 'SYNTHETIC_REFERENCE_REQUIRED');
  }
}

function providerId(kind: string, command: ProviderCommand, material: string): string {
  const digest = crypto.createHash('sha256').update(`${kind}:${command.idempotencyKey}:${material}`).digest('hex').slice(0, 24);
  return `syn_${kind}_${digest}`;
}

function accepted(kind: string, command: ProviderCommand, material: string): ProviderResult {
  assertCommand(command);
  return { providerId: providerId(kind, command, material), correlationId: command.correlationId, status: 'accepted' };
}

export class SyntheticProviderAdapter implements IdentityProvider, KyBProvider, ScreeningProvider, AccountProvider, FxProvider, PaymentProvider, LedgerProvider, ReconciliationProvider {
  async verifyIndividual(command: ProviderCommand & { subjectRef: string }): Promise<ProviderResult> {
    assertSyntheticReference(command.subjectRef, 'subjectRef');
    return accepted('identity', command, command.subjectRef);
  }

  async verifyBusiness(command: ProviderCommand & { businessRef: string; beneficialOwnerRefs: string[] }): Promise<ProviderResult> {
    assertSyntheticReference(command.businessRef, 'businessRef');
    if (!command.beneficialOwnerRefs.length) throw new ProviderSandboxError('At least one synthetic beneficial owner is required.', 'OWNER_REQUIRED');
    command.beneficialOwnerRefs.forEach(ref => assertSyntheticReference(ref, 'beneficialOwnerRef'));
    return accepted('kyb', command, `${command.businessRef}:${command.beneficialOwnerRefs.join(',')}`);
  }

  async screen(command: ProviderCommand & { subjectRef: string; reason: 'onboarding' | 'payment' | 'rescreen' }): Promise<SyntheticScreeningResult> {
    assertSyntheticReference(command.subjectRef, 'subjectRef');
    return { ...accepted('screening', command, `${command.subjectRef}:${command.reason}`), sanctions: 'clear', pep: 'clear', adverseMedia: 'clear', synthetic: true };
  }

  async createAccount(command: ProviderCommand & { customerRef: string; currencies: Currency[] }): Promise<ProviderResult> {
    assertSyntheticReference(command.customerRef, 'customerRef');
    if (!command.currencies.length || command.currencies.some(currency => !SANDBOX_CURRENCIES.includes(currency))) {
      throw new ProviderSandboxError('Sandbox account currencies must be from the approved six-currency profile.', 'INVALID_CURRENCY');
    }
    return accepted('account', command, `${command.customerRef}:${[...new Set(command.currencies)].sort().join(',')}`);
  }

  async quote(command: ProviderCommand & { sell: Currency; buy: Currency; amount: string }): Promise<ProviderResult & { quoteId: string; expiresAt: string }> {
    if (command.sell === command.buy || !/^\d+(\.\d{1,2})?$/.test(command.amount) || Number(command.amount) <= 0) {
      throw new ProviderSandboxError('A positive amount and two different currencies are required.', 'INVALID_QUOTE');
    }
    const result = accepted('fxquote', command, `${command.sell}:${command.buy}:${command.amount}`);
    return { ...result, quoteId: result.providerId, expiresAt: new Date(Date.now() + 60_000).toISOString() };
  }

  async convert(command: ProviderCommand & { quoteId: string }): Promise<ProviderResult> {
    assertSyntheticReference(command.quoteId, 'quoteId');
    return accepted('fxconversion', command, command.quoteId);
  }

  async execute(command: ProviderCommand & { paymentRef: string; corridorId: string }): Promise<ProviderResult> {
    assertSyntheticReference(command.paymentRef, 'paymentRef');
    assertSyntheticReference(command.corridorId, 'corridorId');
    return accepted('payment', command, `${command.paymentRef}:${command.corridorId}`);
  }

  async reverse(command: ProviderCommand & { providerPaymentId: string; reason: string }): Promise<ProviderResult> {
    assertSyntheticReference(command.providerPaymentId, 'providerPaymentId');
    if (command.reason.trim().length < 5) throw new ProviderSandboxError('A reversal reason is required.', 'REVERSAL_REASON_REQUIRED');
    return { ...accepted('reversal', command, `${command.providerPaymentId}:${command.reason}`), status: 'reversed' };
  }

  async post(command: ProviderCommand & { postingBatchId: string; entries: Array<{ accountRef: string; debit?: string; credit?: string; currency: Currency }> }): Promise<ProviderResult> {
    assertSyntheticReference(command.postingBatchId, 'postingBatchId');
    if (command.entries.length < 2) throw new ProviderSandboxError('Double-entry posting requires at least two entries.', 'UNBALANCED_LEDGER');
    const totals = new Map<Currency, { debit: number; credit: number }>();
    for (const entry of command.entries) {
      assertSyntheticReference(entry.accountRef, 'accountRef');
      if (!!entry.debit === !!entry.credit) throw new ProviderSandboxError('Each entry must contain exactly one of debit or credit.', 'INVALID_LEDGER_ENTRY');
      const total = totals.get(entry.currency) ?? { debit: 0, credit: 0 };
      total.debit += Number(entry.debit ?? 0); total.credit += Number(entry.credit ?? 0); totals.set(entry.currency, total);
    }
    if ([...totals.values()].some(total => !Number.isFinite(total.debit) || Math.abs(total.debit - total.credit) > 0.000001)) {
      throw new ProviderSandboxError('Ledger postings must balance independently by currency.', 'UNBALANCED_LEDGER');
    }
    return accepted('ledger', command, command.postingBatchId);
  }

  async reconcile(command: ProviderCommand & { reconciliationId: string; businessDate: string; providerStatementRef: string }): Promise<ProviderResult & { breakCount: number }> {
    assertSyntheticReference(command.reconciliationId, 'reconciliationId');
    assertSyntheticReference(command.providerStatementRef, 'providerStatementRef');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(command.businessDate)) throw new ProviderSandboxError('businessDate must use YYYY-MM-DD.', 'INVALID_BUSINESS_DATE');
    return { ...accepted('reconciliation', command, `${command.reconciliationId}:${command.businessDate}`), breakCount: 0 };
  }
}

export function signSyntheticWebhook<T>(payload: T, secret: string, eventId = `syn_event_${crypto.randomUUID()}`, timestamp = new Date().toISOString()): SignedWebhookEnvelope<T> {
  if (secret.length < 32) throw new ProviderSandboxError('Webhook test secret must contain at least 32 characters.', 'WEAK_WEBHOOK_SECRET');
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(`${eventId}.${timestamp}.${body}`).digest('hex');
  return { eventId, timestamp, signature, payload };
}

export function verifySyntheticWebhook<T>(envelope: SignedWebhookEnvelope<T>, secret: string, now = Date.now(), toleranceMs = 300_000): boolean {
  if (validateProviderEnvelope(envelope).length || !SYNTHETIC_REF_PATTERN.test(envelope.eventId)) return false;
  const timestamp = Date.parse(envelope.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > toleranceMs) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${envelope.eventId}.${envelope.timestamp}.${JSON.stringify(envelope.payload)}`).digest('hex');
  const actual = Buffer.from(envelope.signature, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}
