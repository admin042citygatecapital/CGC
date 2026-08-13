import { isDatabaseConfigured } from '../db/db.js';
import { appendAuditEntry } from './auditLog.js';
import {
  FinancialSandbox,
  FinancialSandboxError,
  type SandboxAccountType,
  type SandboxActor,
} from './financialSandbox.js';
import { databaseFinancialSandbox } from './financialSandboxDatabase.js';

// Production always uses PostgreSQL and fails closed when DATABASE_URL is
// missing. Development can use this process-local simulation so the complete
// administration workflow remains inspectable on a clean workstation without
// connecting a production or third-party financial database.
const localFinancialSandbox = new FinancialSandbox(async event => {
  await appendAuditEntry({
    adminId: event.actor.id,
    adminEmail: event.actor.email,
    action: event.action,
    target: 'financial-sandbox',
    targetId: event.targetId,
    ip: event.actor.ip,
    details: { ...event.details, localDevelopment: true, executionSource: 'SIMULATION' },
  });
});

function databaseRequired(): boolean {
  return process.env.NODE_ENV === 'production' || isDatabaseConfigured();
}

export const financialSandbox = {
  async listAccounts() {
    return databaseRequired() ? databaseFinancialSandbox.listAccounts() : localFinancialSandbox.listAccounts();
  },
  async listTransactions(input: { search?: string; status?: string; asset?: string; page?: number; pageSize?: number } = {}) {
    return databaseRequired() ? databaseFinancialSandbox.listTransactions(input) : localFinancialSandbox.listTransactions(input);
  },
  async getTransaction(id: string) {
    if (databaseRequired()) return databaseFinancialSandbox.getTransaction(id);
    const item = localFinancialSandbox.getTransaction(id);
    if (!item) throw new FinancialSandboxError('Synthetic transaction not found.', 'TRANSACTION_NOT_FOUND');
    return item;
  },
  async getOverview() {
    return databaseRequired() ? databaseFinancialSandbox.getOverview() : localFinancialSandbox.getOverview();
  },
  async createAccount(input: { name: string; type: SandboxAccountType; asset: string; idempotencyKey: string }, actor: SandboxActor) {
    return databaseRequired()
      ? databaseFinancialSandbox.createAccount(input, actor)
      : localFinancialSandbox.createAccount({ name: input.name, type: input.type, asset: input.asset }, actor);
  },
  async transfer(input: { sourceAccountId: string; destinationAccountId: string; amount: string | number; reason: string; idempotencyKey: string; crypto?: boolean }, actor: SandboxActor) {
    return databaseRequired() ? databaseFinancialSandbox.transfer(input, actor) : localFinancialSandbox.transfer(input, actor);
  },
  async adjust(input: { accountId: string; amount: string | number; direction: 'credit' | 'debit'; reason: string; reference: string; confirmed: boolean; idempotencyKey: string }, actor: SandboxActor) {
    return databaseRequired() ? databaseFinancialSandbox.adjust(input, actor) : localFinancialSandbox.adjust(input, actor);
  },
  async mock(input: { sourceAccountId: string; destinationAccountId: string; amount: string | number; reason: string; idempotencyKey: string }, actor: SandboxActor) {
    return databaseRequired() ? databaseFinancialSandbox.mock(input, actor) : localFinancialSandbox.mock(input, actor);
  },
  async reverse(id: string, reason: string, idempotencyKey: string, actor: SandboxActor) {
    return databaseRequired()
      ? databaseFinancialSandbox.reverse(id, reason, idempotencyKey, actor)
      : localFinancialSandbox.reverse(id, reason, idempotencyKey, actor);
  },
  async cancel(id: string, reason: string, idempotencyKey: string, actor: SandboxActor) {
    return databaseRequired()
      ? databaseFinancialSandbox.cancel(id, reason, idempotencyKey, actor)
      : localFinancialSandbox.cancel(id, reason, actor);
  },
};
