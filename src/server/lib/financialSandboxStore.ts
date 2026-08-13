// The administration API must use the durable, transaction-backed store.
// The in-memory FinancialSandbox class remains available only as a pure unit-test engine.
export { databaseFinancialSandbox as financialSandbox } from './financialSandboxDatabase.js';
