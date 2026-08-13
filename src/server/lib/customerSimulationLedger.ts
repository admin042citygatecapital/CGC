import crypto from "node:crypto";
import type postgres from "postgres";
import { getQueryClient, isDatabaseConfigured } from "../db/db.js";
import { appendAudit, appendCriticalAudit } from "./auditLog.js";
import {
  applyLocalSimulationLedgerProjection,
  listCustomerAccounts,
  type AccountActor,
  type CustomerAccount,
} from "./customerAccountStore.js";

type TxSql = postgres.TransactionSql<Record<string, never>>;

export type CustomerSimulationKind =
  | "opening_adjustment"
  | "internal_transfer"
  | "controlled_adjustment"
  | "reversal";

export interface CustomerSimulationLine {
  accountId: string;
  debitMinor: bigint;
  creditMinor: bigint;
  currency: string;
}

export interface CustomerSimulationTransaction {
  id: string;
  ownerUserId: string;
  reference: string;
  kind: CustomerSimulationKind;
  status: "completed" | "reversed";
  currency: string;
  amountMinor: bigint;
  sourceAccountId?: string;
  destinationAccountId?: string;
  description: string;
  executionSource: "SIMULATION";
  synthetic: true;
  reversesId?: string;
  lines: CustomerSimulationLine[];
  createdAt: string;
  updatedAt: string;
}

export class CustomerSimulationLedgerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

const localTransactions = new Map<string, CustomerSimulationTransaction>();
const localCommands = new Map<
  string,
  { fingerprint: string; transactionId: string }
>();

function amountToMinor(value: string | number): bigint {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized))
    throw new CustomerSimulationLedgerError(
      "Amount must be positive with no more than two decimal places.",
      "INVALID_AMOUNT",
    );
  const [whole, fraction = ""] = normalized.split(".");
  const minor = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  if (minor <= 0n)
    throw new CustomerSimulationLedgerError(
      "Amount must be greater than zero.",
      "INVALID_AMOUNT",
    );
  return minor;
}

function normalizeKey(value: string): string {
  const key = value.trim();
  if (!key || key.length > 160)
    throw new CustomerSimulationLedgerError(
      "A valid idempotency key is required.",
      "IDEMPOTENCY_REQUIRED",
    );
  return key;
}

function normalizeDescription(value: string): string {
  const description = value.trim().replace(/\s+/g, " ").slice(0, 240);
  if (description.length < 3)
    throw new CustomerSimulationLedgerError(
      "A description is required.",
      "DESCRIPTION_REQUIRED",
    );
  return description;
}

function hash(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function commandScope(
  actorType: "customer" | "admin",
  actorId: string,
): string {
  return `${actorType}:${actorId}`;
}

function accountForPosting(
  accounts: CustomerAccount[],
  id: string,
): CustomerAccount {
  const account = accounts.find((item) => item.id === id);
  if (!account)
    throw new CustomerSimulationLedgerError(
      "Synthetic customer account not found.",
      "ACCOUNT_NOT_FOUND",
    );
  return account;
}

function assertAccountUsable(account: CustomerAccount, debit: boolean): void {
  if (account.status !== "active")
    throw new CustomerSimulationLedgerError(
      "Account is not active.",
      "ACCOUNT_NOT_ACTIVE",
    );
  if (account.restrictions.includes("transfers_disabled"))
    throw new CustomerSimulationLedgerError(
      "Transfers are disabled for this account.",
      "TRANSFERS_DISABLED",
    );
  if (
    debit &&
    (account.restrictions.includes("debits_disabled") ||
      account.restrictions.includes("withdrawals_disabled"))
  )
    throw new CustomerSimulationLedgerError(
      "Debits are disabled for this account.",
      "DEBITS_DISABLED",
    );
  if (!debit && account.restrictions.includes("credits_disabled"))
    throw new CustomerSimulationLedgerError(
      "Credits are disabled for this account.",
      "CREDITS_DISABLED",
    );
}

function assertBalanced(lines: CustomerSimulationLine[]): void {
  const debit = lines.reduce((sum, line) => sum + line.debitMinor, 0n);
  const credit = lines.reduce((sum, line) => sum + line.creditMinor, 0n);
  const currencies = new Set(lines.map((line) => line.currency));
  if (debit !== credit || currencies.size !== 1)
    throw new CustomerSimulationLedgerError(
      "Customer simulation journal is not balanced.",
      "UNBALANCED_JOURNAL",
    );
}

async function postLocal(
  input: {
    actorType: "customer" | "admin";
    actorId: string;
    ownerUserId: string;
    idempotencyKey: string;
    kind: CustomerSimulationKind;
    source?: CustomerAccount;
    destination?: CustomerAccount;
    amountMinor: bigint;
    description: string;
    reversesId?: string;
  },
  actor: AccountActor,
): Promise<CustomerSimulationTransaction> {
  const key = normalizeKey(input.idempotencyKey);
  const scope = commandScope(input.actorType, input.actorId);
  const commandKey = `${scope}:${key}`;
  const fingerprint = hash({
    kind: input.kind,
    ownerUserId: input.ownerUserId,
    source: input.source?.id,
    destination: input.destination?.id,
    amountMinor: input.amountMinor.toString(),
    description: input.description,
    reversesId: input.reversesId,
  });
  const prior = localCommands.get(commandKey);
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      throw new CustomerSimulationLedgerError(
        "Idempotency key was reused with different input.",
        "IDEMPOTENCY_CONFLICT",
      );
    return localTransactions.get(prior.transactionId)!;
  }

  const original = input.reversesId
    ? localTransactions.get(input.reversesId)
    : undefined;
  if (input.reversesId && (!original || original.status !== "completed"))
    throw new CustomerSimulationLedgerError(
      "Only a completed, unreversed simulation transaction can be reversed.",
      "REVERSAL_NOT_ALLOWED",
    );
  if (input.source && input.source.availableMinor < input.amountMinor)
    throw new CustomerSimulationLedgerError(
      "Synthetic account has insufficient funds.",
      "INSUFFICIENT_FUNDS",
    );

  const currency = (input.source ?? input.destination)!.primaryCurrency;
  const treasury = `cl_treasury_${currency.toLowerCase()}`;
  const lines: CustomerSimulationLine[] =
    input.source && input.destination
      ? [
          {
            accountId: input.source.id,
            debitMinor: input.amountMinor,
            creditMinor: 0n,
            currency,
          },
          {
            accountId: input.destination.id,
            debitMinor: 0n,
            creditMinor: input.amountMinor,
            currency,
          },
        ]
      : input.destination
        ? [
            {
              accountId: treasury,
              debitMinor: input.amountMinor,
              creditMinor: 0n,
              currency,
            },
            {
              accountId: input.destination.id,
              debitMinor: 0n,
              creditMinor: input.amountMinor,
              currency,
            },
          ]
        : [
            {
              accountId: input.source!.id,
              debitMinor: input.amountMinor,
              creditMinor: 0n,
              currency,
            },
            {
              accountId: treasury,
              debitMinor: 0n,
              creditMinor: input.amountMinor,
              currency,
            },
          ];
  assertBalanced(lines);

  const projection: Array<{ accountId: string; deltaMinor: bigint }> = [];
  if (input.source)
    projection.push({
      accountId: input.source.id,
      deltaMinor: -input.amountMinor,
    });
  if (input.destination)
    projection.push({
      accountId: input.destination.id,
      deltaMinor: input.amountMinor,
    });
  applyLocalSimulationLedgerProjection(projection);

  const now = new Date().toISOString();
  const transaction: CustomerSimulationTransaction = {
    id: `ctx_syn_${crypto.randomUUID()}`,
    ownerUserId: input.ownerUserId,
    reference: `CGC-SIM-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
    kind: input.kind,
    status: "completed",
    currency,
    amountMinor: input.amountMinor,
    sourceAccountId: input.source?.id,
    destinationAccountId: input.destination?.id,
    description: input.description,
    executionSource: "SIMULATION",
    synthetic: true,
    reversesId: input.reversesId,
    lines,
    createdAt: now,
    updatedAt: now,
  };
  localTransactions.set(transaction.id, transaction);
  if (original) {
    original.status = "reversed";
    original.updatedAt = now;
  }
  localCommands.set(commandKey, { fingerprint, transactionId: transaction.id });
  appendAudit({
    event: `customer_simulation_${input.kind}`,
    adminId: input.actorType === "admin" ? actor.id : undefined,
    userId: input.ownerUserId,
    email: actor.email,
    ip: actor.ip,
    meta: {
      transactionId: transaction.id,
      reference: transaction.reference,
      amountMinor: input.amountMinor.toString(),
      currency,
      correlationId: actor.correlationId,
      executionSource: "SIMULATION",
      synthetic: true,
    },
  });
  return transaction;
}

function requireLocalMode(): void {
  if (isDatabaseConfigured())
    throw new CustomerSimulationLedgerError(
      "The database posting adapter is not active yet.",
      "DATABASE_ADAPTER_REQUIRED",
    );
}

type DatabaseAccountRow = {
  id: string;
  customer_account_id: string;
  owner_user_id: string;
  label: string;
  status: CustomerAccount["status"];
  primary_currency: string;
  available_minor: string;
  ledger_minor: string;
  pending_minor: string;
  restrictions: unknown;
};

type DatabaseTransactionRow = {
  id: string;
  owner_user_id: string;
  reference: string;
  kind: CustomerSimulationKind;
  status: "completed" | "reversed";
  currency: string;
  amount_minor: string;
  source_customer_account_id: string | null;
  destination_customer_account_id: string | null;
  description: string;
  reverses_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function databaseRowToAccount(row: DatabaseAccountRow): CustomerAccount {
  return {
    id: row.customer_account_id,
    userId: row.owner_user_id,
    label: row.label,
    accountType: "personal",
    status: row.status,
    primaryCurrency: row.primary_currency,
    availableMinor: BigInt(row.available_minor),
    ledgerMinor: BigInt(row.ledger_minor),
    pendingMinor: BigInt(row.pending_minor),
    restrictions: Array.isArray(row.restrictions)
      ? (row.restrictions as CustomerAccount["restrictions"])
      : [],
    synthetic: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

async function databaseTransactionById(
  sql: ReturnType<typeof getQueryClient>,
  id: string,
): Promise<CustomerSimulationTransaction> {
  const [row] = await sql<DatabaseTransactionRow[]>`
    SELECT t.id, t.owner_user_id, t.reference, t.kind, t.status, t.currency,
           t.amount_minor::text, source.customer_account_id AS source_customer_account_id,
           destination.customer_account_id AS destination_customer_account_id,
           t.description, t.reverses_id, t.created_at, t.updated_at
      FROM customer_simulation_transactions t
      LEFT JOIN customer_ledger_accounts source ON source.id = t.source_ledger_account_id
      LEFT JOIN customer_ledger_accounts destination ON destination.id = t.destination_ledger_account_id
     WHERE t.id = ${id} AND t.synthetic IS TRUE
     LIMIT 1`;
  if (!row)
    throw new CustomerSimulationLedgerError(
      "Customer simulation transaction not found.",
      "TRANSACTION_NOT_FOUND",
    );
  const lines = await sql<
    Array<{
      customer_account_id: string | null;
      ledger_account_id: string;
      debit_minor: string;
      credit_minor: string;
      currency: string;
    }>
  >`
    SELECT account.customer_account_id, line.ledger_account_id,
           line.debit_minor::text, line.credit_minor::text, line.currency
      FROM customer_simulation_journal_lines line
      JOIN customer_simulation_journal_entries entry ON entry.id = line.journal_entry_id
      JOIN customer_ledger_accounts account ON account.id = line.ledger_account_id
     WHERE entry.transaction_id = ${id}
     ORDER BY line.created_at, line.id`;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    reference: row.reference,
    kind: row.kind,
    status: row.status,
    currency: row.currency,
    amountMinor: BigInt(row.amount_minor),
    sourceAccountId: row.source_customer_account_id ?? undefined,
    destinationAccountId: row.destination_customer_account_id ?? undefined,
    description: row.description,
    executionSource: "SIMULATION",
    synthetic: true,
    reversesId: row.reverses_id ?? undefined,
    lines: lines.map((line) => ({
      accountId: line.customer_account_id ?? line.ledger_account_id,
      debitMinor: BigInt(line.debit_minor),
      creditMinor: BigInt(line.credit_minor),
      currency: line.currency,
    })),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function ensureDatabaseLedgerAccount(
  tx: TxSql,
  customerAccountId: string,
): Promise<DatabaseAccountRow> {
  await tx`
    INSERT INTO customer_ledger_accounts
      (id, customer_account_id, owner_user_id, name, account_class, currency, balance_minor)
    SELECT ${`cl_acct_${customerAccountId.replace(/^acct_syn_/, "")}`}, id, user_id,
           label, 'customer', primary_currency, ledger_minor
      FROM customer_accounts WHERE id = ${customerAccountId}
    ON CONFLICT (customer_account_id) DO NOTHING`;
  const [row] = await tx<DatabaseAccountRow[]>`
    SELECT ledger.id, ledger.customer_account_id, ledger.owner_user_id,
           account.label, account.status, account.primary_currency,
           account.available_minor::text, account.ledger_minor::text,
           account.pending_minor::text, account.restrictions
      FROM customer_ledger_accounts ledger
      JOIN customer_accounts account ON account.id = ledger.customer_account_id
     WHERE account.id = ${customerAccountId} AND account.synthetic IS TRUE
     FOR UPDATE OF ledger, account`;
  if (!row)
    throw new CustomerSimulationLedgerError(
      "Synthetic customer account not found.",
      "ACCOUNT_NOT_FOUND",
    );
  return row;
}

async function postDatabase(
  input: {
    actorType: "customer" | "admin";
    actorId: string;
    ownerUserId: string;
    idempotencyKey: string;
    kind: CustomerSimulationKind;
    sourceAccountId?: string;
    destinationAccountId?: string;
    amountMinor: bigint;
    description: string;
    reversesId?: string;
  },
  actor: AccountActor,
): Promise<CustomerSimulationTransaction> {
  const sql = getQueryClient();
  const key = normalizeKey(input.idempotencyKey);
  const scope = commandScope(input.actorType, input.actorId);
  const fingerprint = hash({
    kind: input.kind,
    ownerUserId: input.ownerUserId,
    source: input.sourceAccountId,
    destination: input.destinationAccountId,
    amountMinor: input.amountMinor.toString(),
    description: input.description,
    reversesId: input.reversesId,
  });

  if (
    input.sourceAccountId &&
    input.destinationAccountId &&
    input.sourceAccountId === input.destinationAccountId
  )
    throw new CustomerSimulationLedgerError(
      "Source and destination accounts must be different.",
      "SAME_ACCOUNT",
    );

  const transactionId = await sql.begin(async (tx) => {
    // Serialize commands with the same actor/key before checking the command
    // table. This closes the concurrent first-write race without broad locks.
    await tx`SELECT pg_advisory_xact_lock(hashtext(${scope}), hashtext(${key}))`;
    const [prior] = await tx<
      Array<{ fingerprint: string; transaction_id: string }>
    >`
      SELECT fingerprint, transaction_id
        FROM customer_simulation_commands
       WHERE actor_scope = ${scope} AND idempotency_key = ${key}
       FOR UPDATE`;
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new CustomerSimulationLedgerError(
          "Idempotency key was reused with different input.",
          "IDEMPOTENCY_CONFLICT",
        );
      return prior.transaction_id;
    }

    if (input.reversesId) {
      const [original] = await tx<Array<{ status: string }>>`
        SELECT status FROM customer_simulation_transactions
         WHERE id = ${input.reversesId} AND synthetic IS TRUE
         FOR UPDATE`;
      if (!original || original.status !== "completed")
        throw new CustomerSimulationLedgerError(
          "Only a completed, unreversed simulation transaction can be reversed.",
          "REVERSAL_NOT_ALLOWED",
        );
    }

    const sourceRow = input.sourceAccountId
      ? await ensureDatabaseLedgerAccount(tx, input.sourceAccountId)
      : undefined;
    const destinationRow = input.destinationAccountId
      ? await ensureDatabaseLedgerAccount(tx, input.destinationAccountId)
      : undefined;
    const source = sourceRow ? databaseRowToAccount(sourceRow) : undefined;
    const destination = destinationRow
      ? databaseRowToAccount(destinationRow)
      : undefined;
    if (source && source.userId !== input.ownerUserId)
      throw new CustomerSimulationLedgerError(
        "Account ownership mismatch.",
        "ACCOUNT_OWNERSHIP_MISMATCH",
      );
    if (destination && destination.userId !== input.ownerUserId)
      throw new CustomerSimulationLedgerError(
        "Account ownership mismatch.",
        "ACCOUNT_OWNERSHIP_MISMATCH",
      );
    if (
      source &&
      destination &&
      source.primaryCurrency !== destination.primaryCurrency
    )
      throw new CustomerSimulationLedgerError(
        "Internal transfers require matching currencies.",
        "CURRENCY_MISMATCH",
      );
    if (input.kind !== "reversal") {
      if (source) assertAccountUsable(source, true);
      if (destination) assertAccountUsable(destination, false);
    }
    if (source && source.availableMinor < input.amountMinor)
      throw new CustomerSimulationLedgerError(
        "Synthetic account has insufficient funds.",
        "INSUFFICIENT_FUNDS",
      );

    const currency = (source ?? destination)!.primaryCurrency;
    await tx`
      INSERT INTO customer_ledger_accounts
        (id, name, account_class, currency, balance_minor)
      VALUES (${`cl_treasury_${currency.toLowerCase()}`}, ${`${currency} simulation treasury`},
              'simulation_treasury', ${currency}, 0)
      ON CONFLICT (id) DO NOTHING`;
    const treasuryId = `cl_treasury_${currency.toLowerCase()}`;
    const amountValue = input.amountMinor.toString();
    const sourceLedgerId = sourceRow?.id ?? treasuryId;
    const destinationLedgerId = destinationRow?.id ?? treasuryId;
    const id = `ctx_syn_${crypto.randomUUID()}`;
    const reference = `CGC-SIM-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const journalId = `cje_syn_${crypto.randomUUID()}`;
    await tx`
      INSERT INTO customer_simulation_transactions
        (id, owner_user_id, reference, kind, status, currency, amount_minor,
         source_ledger_account_id, destination_ledger_account_id, description,
         execution_source, synthetic, reverses_id, created_by)
      VALUES (${id}, ${input.ownerUserId}, ${reference}, ${input.kind}, 'completed',
              ${currency}, ${amountValue}, ${sourceLedgerId}, ${destinationLedgerId},
              ${input.description}, 'SIMULATION', TRUE, ${input.reversesId ?? null}, ${actor.id})`;
    await tx`
      INSERT INTO customer_simulation_journal_entries
        (id, transaction_id, reference, currency, synthetic, posted_by)
      VALUES (${journalId}, ${id},
              ${`CGC-SIM-JE-${crypto.randomBytes(6).toString("hex").toUpperCase()}`},
              ${currency}, TRUE, ${actor.id})`;
    await tx`
      INSERT INTO customer_simulation_journal_lines
        (id, journal_entry_id, ledger_account_id, currency, debit_minor, credit_minor, synthetic)
      VALUES
        (${`cjl_syn_${crypto.randomUUID()}`}, ${journalId}, ${sourceLedgerId}, ${currency}, ${amountValue}, 0, TRUE),
        (${`cjl_syn_${crypto.randomUUID()}`}, ${journalId}, ${destinationLedgerId}, ${currency}, 0, ${amountValue}, TRUE)`;
    if (sourceRow) {
      await tx`UPDATE customer_ledger_accounts SET balance_minor = balance_minor - ${amountValue}, updated_at = NOW() WHERE id = ${sourceRow.id}`;
      await tx`UPDATE customer_accounts SET ledger_minor = ledger_minor - ${amountValue}, available_minor = available_minor - ${amountValue}, updated_at = NOW() WHERE id = ${sourceRow.customer_account_id}`;
    }
    if (destinationRow) {
      await tx`UPDATE customer_ledger_accounts SET balance_minor = balance_minor + ${amountValue}, updated_at = NOW() WHERE id = ${destinationRow.id}`;
      await tx`UPDATE customer_accounts SET ledger_minor = ledger_minor + ${amountValue}, available_minor = available_minor + ${amountValue}, updated_at = NOW() WHERE id = ${destinationRow.customer_account_id}`;
    }
    await tx`
      INSERT INTO customer_simulation_commands
        (actor_scope, idempotency_key, fingerprint, action, transaction_id)
      VALUES (${scope}, ${key}, ${fingerprint}, ${input.kind}, ${id})`;
    if (input.reversesId)
      await tx`UPDATE customer_simulation_transactions SET status = 'reversed', updated_at = NOW() WHERE id = ${input.reversesId}`;
    return id;
  });

  const result = await databaseTransactionById(sql, transactionId);
  appendAudit({
    event: `customer_simulation_${input.kind}`,
    adminId: input.actorType === "admin" ? actor.id : undefined,
    userId: input.ownerUserId,
    email: actor.email,
    ip: actor.ip,
    meta: {
      transactionId: result.id,
      reference: result.reference,
      amountMinor: result.amountMinor.toString(),
      currency: result.currency,
      correlationId: actor.correlationId,
      executionSource: "SIMULATION",
      synthetic: true,
    },
  });
  return result;
}

export async function postCustomerInternalTransfer(
  input: {
    ownerUserId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: string | number;
    description: string;
    idempotencyKey: string;
  },
  actor: AccountActor,
): Promise<CustomerSimulationTransaction> {
  const amountMinor = amountToMinor(input.amount);
  const description = normalizeDescription(input.description);
  if (isDatabaseConfigured())
    return postDatabase(
      {
        actorType: "customer",
        actorId: input.ownerUserId,
        ownerUserId: input.ownerUserId,
        idempotencyKey: input.idempotencyKey,
        kind: "internal_transfer",
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        amountMinor,
        description,
      },
      actor,
    );
  const accounts = await listCustomerAccounts({ userId: input.ownerUserId });
  const source = accountForPosting(accounts, input.sourceAccountId);
  const destination = accountForPosting(accounts, input.destinationAccountId);
  if (source.id === destination.id)
    throw new CustomerSimulationLedgerError(
      "Source and destination accounts must be different.",
      "SAME_ACCOUNT",
    );
  if (source.primaryCurrency !== destination.primaryCurrency)
    throw new CustomerSimulationLedgerError(
      "Internal transfers require matching currencies.",
      "CURRENCY_MISMATCH",
    );
  assertAccountUsable(source, true);
  assertAccountUsable(destination, false);
  if (source.availableMinor < amountMinor)
    throw new CustomerSimulationLedgerError(
      "Synthetic account has insufficient funds.",
      "INSUFFICIENT_FUNDS",
    );
  return postLocal(
    {
      actorType: "customer",
      actorId: input.ownerUserId,
      ownerUserId: input.ownerUserId,
      idempotencyKey: input.idempotencyKey,
      kind: "internal_transfer",
      source,
      destination,
      amountMinor,
      description,
    },
    actor,
  );
}

export async function postCustomerControlledAdjustment(
  input: {
    accountId: string;
    direction: "credit" | "debit";
    amount: string | number;
    reference: string;
    reason: string;
    opening?: boolean;
    idempotencyKey: string;
  },
  actor: AccountActor,
): Promise<CustomerSimulationTransaction> {
  const accounts = await listCustomerAccounts();
  const account = accountForPosting(accounts, input.accountId);
  const reason = normalizeDescription(`${input.reference}: ${input.reason}`);
  const amountMinor = amountToMinor(input.amount);
  if (input.direction === "debit" && account.availableMinor < amountMinor)
    throw new CustomerSimulationLedgerError(
      "Synthetic account has insufficient funds.",
      "INSUFFICIENT_FUNDS",
    );
  await appendCriticalAudit({
    event: "customer_simulation_adjustment_intent",
    adminId: actor.id,
    email: actor.email,
    ip: actor.ip,
    userId: account.userId,
    meta: {
      accountId: account.id,
      direction: input.direction,
      amountMinor: amountMinor.toString(),
      currency: account.primaryCurrency,
      reason,
      correlationId: actor.correlationId,
      synthetic: true,
    },
  });
  if (isDatabaseConfigured())
    return postDatabase(
      {
        actorType: "admin",
        actorId: actor.id,
        ownerUserId: account.userId,
        idempotencyKey: input.idempotencyKey,
        kind: input.opening ? "opening_adjustment" : "controlled_adjustment",
        sourceAccountId: input.direction === "debit" ? account.id : undefined,
        destinationAccountId:
          input.direction === "credit" ? account.id : undefined,
        amountMinor,
        description: reason,
      },
      actor,
    );
  return postLocal(
    {
      actorType: "admin",
      actorId: actor.id,
      ownerUserId: account.userId,
      idempotencyKey: input.idempotencyKey,
      kind: input.opening ? "opening_adjustment" : "controlled_adjustment",
      source: input.direction === "debit" ? account : undefined,
      destination: input.direction === "credit" ? account : undefined,
      amountMinor,
      description: reason,
    },
    actor,
  );
}

export function listLocalCustomerSimulationTransactions(
  input: {
    ownerUserId?: string;
    accountId?: string;
  } = {},
): CustomerSimulationTransaction[] {
  requireLocalMode();
  return [...localTransactions.values()]
    .filter(
      (item) => !input.ownerUserId || item.ownerUserId === input.ownerUserId,
    )
    .filter(
      (item) =>
        !input.accountId ||
        item.sourceAccountId === input.accountId ||
        item.destinationAccountId === input.accountId,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listCustomerSimulationTransactions(
  input: {
    ownerUserId?: string;
    accountId?: string;
    limit?: number;
  } = {},
): Promise<CustomerSimulationTransaction[]> {
  if (!isDatabaseConfigured())
    return listLocalCustomerSimulationTransactions(input).slice(
      0,
      input.limit ?? 100,
    );
  const sql = getQueryClient();
  const limit = Math.min(500, Math.max(1, input.limit ?? 100));
  const ownerUserId = input.ownerUserId ?? "";
  const accountId = input.accountId ?? "";
  const rows = await sql<Array<{ id: string; created_at: Date | string }>>`
    SELECT DISTINCT transaction.id, transaction.created_at
      FROM customer_simulation_transactions transaction
      LEFT JOIN customer_ledger_accounts source ON source.id = transaction.source_ledger_account_id
      LEFT JOIN customer_ledger_accounts destination ON destination.id = transaction.destination_ledger_account_id
     WHERE transaction.synthetic IS TRUE
       AND (${ownerUserId} = '' OR transaction.owner_user_id = ${ownerUserId})
       AND (${accountId} = '' OR source.customer_account_id = ${accountId} OR destination.customer_account_id = ${accountId})
     ORDER BY transaction.created_at DESC
     LIMIT ${limit}`;
  return Promise.all(rows.map((row) => databaseTransactionById(sql, row.id)));
}

export async function reverseCustomerSimulationTransaction(
  input: {
    transactionId: string;
    reason: string;
    idempotencyKey: string;
  },
  actor: AccountActor,
): Promise<CustomerSimulationTransaction> {
  const reason = normalizeDescription(input.reason);
  const original = isDatabaseConfigured()
    ? await databaseTransactionById(getQueryClient(), input.transactionId)
    : localTransactions.get(input.transactionId);
  if (!original)
    throw new CustomerSimulationLedgerError(
      "Customer simulation transaction not found.",
      "TRANSACTION_NOT_FOUND",
    );
  const accounts = await listCustomerAccounts({ userId: original.ownerUserId });
  const source = original.destinationAccountId
    ? accountForPosting(accounts, original.destinationAccountId)
    : undefined;
  const destination = original.sourceAccountId
    ? accountForPosting(accounts, original.sourceAccountId)
    : undefined;
  if (isDatabaseConfigured())
    return postDatabase(
      {
        actorType: "admin",
        actorId: actor.id,
        ownerUserId: original.ownerUserId,
        idempotencyKey: input.idempotencyKey,
        kind: "reversal",
        sourceAccountId: source?.id,
        destinationAccountId: destination?.id,
        amountMinor: original.amountMinor,
        description: `Reversal: ${reason}`,
        reversesId: original.id,
      },
      actor,
    );
  return postLocal(
    {
      actorType: "admin",
      actorId: actor.id,
      ownerUserId: original.ownerUserId,
      idempotencyKey: input.idempotencyKey,
      kind: "reversal",
      source,
      destination,
      amountMinor: original.amountMinor,
      description: `Reversal: ${reason}`,
      reversesId: original.id,
    },
    actor,
  );
}

export function resetCustomerSimulationLedgerForTests(): void {
  if (process.env.NODE_ENV !== "test")
    throw new CustomerSimulationLedgerError(
      "Test reset is unavailable outside the test environment.",
      "TEST_ONLY",
    );
  localTransactions.clear();
  localCommands.clear();
}
