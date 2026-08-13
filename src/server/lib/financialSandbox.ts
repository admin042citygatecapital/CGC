import crypto from 'node:crypto';

export const SANDBOX_ASSETS = ['GBP', 'EUR', 'USD', 'CAD', 'AUD', 'CHF', 'BTC', 'ETH', 'USDT'] as const;
export type SandboxAsset = typeof SANDBOX_ASSETS[number];
export type SandboxAccountType = 'personal' | 'savings' | 'business' | 'fiat_wallet' | 'crypto_wallet';
export type SandboxStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reversed' | 'cancelled';

export interface SandboxActor { id: string; email: string; ip?: string; correlationId: string }
export interface SandboxAccount { id: string; name: string; type: SandboxAccountType; asset: SandboxAsset; balanceMinor: bigint; synthetic: true; createdAt: string }
export interface SandboxLine { accountId: string; debitMinor: bigint; creditMinor: bigint; asset: SandboxAsset }
export interface SandboxTransaction { id: string; reference: string; idempotencyKey: string; kind: 'mock' | 'internal_transfer' | 'crypto_transfer' | 'adjustment' | 'reversal'; status: SandboxStatus; asset: SandboxAsset; amountMinor: bigint; sourceAccountId?: string; destinationAccountId?: string; reason: string; executionSource: 'SIMULATION'; synthetic: true; reversesId?: string; lines: SandboxLine[]; createdAt: string; updatedAt: string }
export interface SandboxAudit { actor: SandboxActor; action: string; targetId: string; details: Record<string, unknown> }

export class FinancialSandboxError extends Error {
  constructor(message: string, public readonly code: string) { super(message); }
}

function amountToMinor(value: string | number): bigint {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new FinancialSandboxError('Amount must be positive with no more than two decimal places.', 'INVALID_AMOUNT');
  const [whole, fraction = ''] = normalized.split('.');
  const minor = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (minor <= 0n) throw new FinancialSandboxError('Amount must be greater than zero.', 'INVALID_AMOUNT');
  return minor;
}

function requireSyntheticId(id: string): void {
  if (!id.startsWith('syn_')) throw new FinancialSandboxError('Only synthetic sandbox references are permitted.', 'SYNTHETIC_REFERENCE_REQUIRED');
}

export class FinancialSandbox {
  private accounts = new Map<string, SandboxAccount>();
  private transactions = new Map<string, SandboxTransaction>();
  private idempotency = new Map<string, { fingerprint: string; transactionId: string }>();

  constructor(private readonly audit: (event: SandboxAudit) => Promise<void> = async () => {}) {}

  resetForTests(): void { this.accounts.clear(); this.transactions.clear(); this.idempotency.clear(); }

  async createAccount(input: { name: string; type: SandboxAccountType; asset: string }, actor: SandboxActor): Promise<SandboxAccount> {
    if (!SANDBOX_ASSETS.includes(input.asset as SandboxAsset)) throw new FinancialSandboxError('Unsupported sandbox asset.', 'INVALID_ASSET');
    if (!input.name.trim()) throw new FinancialSandboxError('Account name is required.', 'INVALID_NAME');
    const id = `syn_account_${crypto.randomUUID()}`;
    const account: SandboxAccount = { id, name: input.name.trim().slice(0, 80), type: input.type, asset: input.asset as SandboxAsset, balanceMinor: 0n, synthetic: true, createdAt: new Date().toISOString() };
    this.accounts.set(id, account);
    await this.audit({ actor, action: 'financial_sandbox_account_created', targetId: id, details: { type: account.type, asset: account.asset, synthetic: true } });
    return account;
  }

  listAccounts(): SandboxAccount[] { return [...this.accounts.values()]; }
  getTransaction(id: string): SandboxTransaction | undefined { return this.transactions.get(id); }

  getOverview() {
    const items = [...this.transactions.values()];
    const integrityBreaks = items.filter(item => {
      const debit = item.lines.reduce((sum, line) => sum + line.debitMinor, 0n);
      const credit = item.lines.reduce((sum, line) => sum + line.creditMinor, 0n);
      return debit !== credit;
    }).length;
    return {
      accounts: this.accounts.size,
      transactions: items.length,
      pending: items.filter(item => ['pending', 'processing'].includes(item.status)).length,
      completed: items.filter(item => item.status === 'completed').length,
      reversed: items.filter(item => item.status === 'reversed').length,
      cancelled: items.filter(item => item.status === 'cancelled').length,
      journalEntries: items.filter(item => item.lines.length > 0).length,
      integrityBreaks,
    };
  }

  listTransactions(input: { search?: string; status?: string; asset?: string; page?: number; pageSize?: number } = {}) {
    const search = input.search?.toLowerCase().trim() ?? '';
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    const page = Math.max(1, input.page ?? 1);
    const filtered = [...this.transactions.values()].filter(item => (!search || item.reference.toLowerCase().includes(search) || item.reason.toLowerCase().includes(search)) && (!input.status || item.status === input.status) && (!input.asset || item.asset === input.asset));
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { data: filtered.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: filtered.length };
  }

  private account(id: string): SandboxAccount {
    requireSyntheticId(id);
    const account = this.accounts.get(id);
    if (!account) throw new FinancialSandboxError('Synthetic account not found.', 'ACCOUNT_NOT_FOUND');
    return account;
  }

  private assertBalanced(lines: SandboxLine[]): void {
    const totals = new Map<string, { debit: bigint; credit: bigint }>();
    for (const line of lines) {
      const total = totals.get(line.asset) ?? { debit: 0n, credit: 0n };
      total.debit += line.debitMinor; total.credit += line.creditMinor; totals.set(line.asset, total);
    }
    if ([...totals.values()].some(total => total.debit !== total.credit)) throw new FinancialSandboxError('Journal entry is not balanced.', 'UNBALANCED_LEDGER');
  }

  private async post(input: { idempotencyKey: string; kind: SandboxTransaction['kind']; asset: SandboxAsset; amountMinor: bigint; source?: SandboxAccount; destination?: SandboxAccount; reason: string; reversesId?: string }, actor: SandboxActor): Promise<SandboxTransaction> {
    if (!input.idempotencyKey.trim()) throw new FinancialSandboxError('Idempotency key is required.', 'IDEMPOTENCY_REQUIRED');
    const fingerprint = JSON.stringify({ kind: input.kind, asset: input.asset, amount: input.amountMinor.toString(), source: input.source?.id, destination: input.destination?.id, reason: input.reason, reversesId: input.reversesId });
    const prior = this.idempotency.get(input.idempotencyKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new FinancialSandboxError('Idempotency key was reused with different input.', 'IDEMPOTENCY_CONFLICT');
      return this.transactions.get(prior.transactionId)!;
    }
    const treasuryId = `syn_treasury_${input.asset.toLowerCase()}`;
    const lines: SandboxLine[] = input.source && input.destination
      ? [{ accountId: input.source.id, debitMinor: input.amountMinor, creditMinor: 0n, asset: input.asset }, { accountId: input.destination.id, debitMinor: 0n, creditMinor: input.amountMinor, asset: input.asset }]
      : input.destination
        ? [{ accountId: treasuryId, debitMinor: input.amountMinor, creditMinor: 0n, asset: input.asset }, { accountId: input.destination.id, debitMinor: 0n, creditMinor: input.amountMinor, asset: input.asset }]
        : [{ accountId: input.source!.id, debitMinor: input.amountMinor, creditMinor: 0n, asset: input.asset }, { accountId: treasuryId, debitMinor: 0n, creditMinor: input.amountMinor, asset: input.asset }];
    this.assertBalanced(lines);
    if (input.source && input.source.balanceMinor < input.amountMinor) throw new FinancialSandboxError('Synthetic account has insufficient balance.', 'INSUFFICIENT_FUNDS');
    const now = new Date().toISOString();
    const id = `syn_tx_${crypto.randomUUID()}`;
    const transaction: SandboxTransaction = { id, reference: `SYN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`, idempotencyKey: input.idempotencyKey, kind: input.kind, status: 'completed', asset: input.asset, amountMinor: input.amountMinor, sourceAccountId: input.source?.id, destinationAccountId: input.destination?.id, reason: input.reason, executionSource: 'SIMULATION', synthetic: true, reversesId: input.reversesId, lines, createdAt: now, updatedAt: now };
    if (input.source) input.source.balanceMinor -= input.amountMinor;
    if (input.destination) input.destination.balanceMinor += input.amountMinor;
    this.transactions.set(id, transaction); this.idempotency.set(input.idempotencyKey, { fingerprint, transactionId: id });
    await this.audit({ actor, action: `financial_sandbox_${input.kind}`, targetId: id, details: { reference: transaction.reference, asset: input.asset, amountMinor: input.amountMinor.toString(), reason: input.reason, correlationId: actor.correlationId, synthetic: true } });
    return transaction;
  }

  async transfer(input: { sourceAccountId: string; destinationAccountId: string; amount: string | number; reason: string; idempotencyKey: string; crypto?: boolean }, actor: SandboxActor) {
    const source = this.account(input.sourceAccountId); const destination = this.account(input.destinationAccountId);
    if (source.asset !== destination.asset) throw new FinancialSandboxError('Source and destination assets must match.', 'ASSET_MISMATCH');
    if (input.crypto && !['BTC', 'ETH', 'USDT'].includes(source.asset)) throw new FinancialSandboxError('Crypto simulation requires a configured crypto asset.', 'CRYPTO_ASSET_REQUIRED');
    return this.post({ idempotencyKey: input.idempotencyKey, kind: input.crypto ? 'crypto_transfer' : 'internal_transfer', asset: source.asset, amountMinor: amountToMinor(input.amount), source, destination, reason: input.reason.trim().slice(0, 240) }, actor);
  }

  async adjust(input: { accountId: string; amount: string | number; direction: 'credit' | 'debit'; reason: string; reference: string; confirmed: boolean; idempotencyKey: string }, actor: SandboxActor) {
    if (!input.confirmed || !input.reason.trim() || !input.reference.trim()) throw new FinancialSandboxError('Confirmed adjustment, reason and reference are required.', 'ADJUSTMENT_CONFIRMATION_REQUIRED');
    const account = this.account(input.accountId);
    return this.post({ idempotencyKey: input.idempotencyKey, kind: 'adjustment', asset: account.asset, amountMinor: amountToMinor(input.amount), source: input.direction === 'debit' ? account : undefined, destination: input.direction === 'credit' ? account : undefined, reason: `${input.reference.trim().slice(0, 80)}: ${input.reason.trim().slice(0, 240)}` }, actor);
  }

  async mock(input: { sourceAccountId: string; destinationAccountId: string; amount: string | number; reason: string; idempotencyKey: string }, actor: SandboxActor): Promise<SandboxTransaction> {
    const source = this.account(input.sourceAccountId);
    const destination = this.account(input.destinationAccountId);
    if (source.id === destination.id) throw new FinancialSandboxError('Source and destination must be different.', 'SAME_ACCOUNT');
    if (source.asset !== destination.asset) throw new FinancialSandboxError('Source and destination assets must match.', 'ASSET_MISMATCH');
    if (!input.idempotencyKey.trim()) throw new FinancialSandboxError('Idempotency key is required.', 'IDEMPOTENCY_REQUIRED');
    const amountMinor = amountToMinor(input.amount);
    const reason = input.reason.trim().slice(0, 240);
    if (!reason) throw new FinancialSandboxError('A reason is required.', 'REASON_REQUIRED');
    const fingerprint = JSON.stringify({ kind: 'mock', asset: source.asset, amount: amountMinor.toString(), source: source.id, destination: destination.id, reason });
    const prior = this.idempotency.get(input.idempotencyKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new FinancialSandboxError('Idempotency key was reused with different input.', 'IDEMPOTENCY_CONFLICT');
      return this.transactions.get(prior.transactionId)!;
    }
    const now = new Date().toISOString();
    const id = `syn_tx_${crypto.randomUUID()}`;
    const transaction: SandboxTransaction = {
      id,
      reference: `SYN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      idempotencyKey: input.idempotencyKey,
      kind: 'mock',
      status: 'pending',
      asset: source.asset,
      amountMinor,
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
      reason,
      executionSource: 'SIMULATION',
      synthetic: true,
      lines: [],
      createdAt: now,
      updatedAt: now,
    };
    this.transactions.set(id, transaction);
    this.idempotency.set(input.idempotencyKey, { fingerprint, transactionId: id });
    await this.audit({ actor, action: 'financial_sandbox_mock', targetId: id, details: { reference: transaction.reference, asset: source.asset, amountMinor: amountMinor.toString(), status: transaction.status, correlationId: actor.correlationId, synthetic: true } });
    return transaction;
  }

  async reverse(id: string, reason: string, idempotencyKey: string, actor: SandboxActor) {
    requireSyntheticId(id); const original = this.transactions.get(id);
    if (!original) throw new FinancialSandboxError('Synthetic transaction not found.', 'TRANSACTION_NOT_FOUND');
    if (original.status !== 'completed' || original.kind === 'reversal') throw new FinancialSandboxError('Transaction is not eligible for reversal.', 'REVERSAL_NOT_ALLOWED');
    const source = original.destinationAccountId ? this.account(original.destinationAccountId) : undefined;
    const destination = original.sourceAccountId ? this.account(original.sourceAccountId) : undefined;
    const reversal = await this.post({ idempotencyKey, kind: 'reversal', asset: original.asset, amountMinor: original.amountMinor, source, destination, reason: reason.trim().slice(0, 240), reversesId: original.id }, actor);
    original.status = 'reversed'; original.updatedAt = new Date().toISOString();
    return reversal;
  }

  async cancel(id: string, reason: string, actor: SandboxActor) {
    requireSyntheticId(id); const item = this.transactions.get(id);
    if (!item) throw new FinancialSandboxError('Synthetic transaction not found.', 'TRANSACTION_NOT_FOUND');
    if (!['pending', 'processing'].includes(item.status)) throw new FinancialSandboxError('Only pending or processing transactions can be cancelled.', 'CANCELLATION_NOT_ALLOWED');
    item.status = 'cancelled'; item.updatedAt = new Date().toISOString();
    await this.audit({ actor, action: 'financial_sandbox_cancelled', targetId: id, details: { reason: reason.trim().slice(0, 240), correlationId: actor.correlationId, synthetic: true } });
    return item;
  }
}
