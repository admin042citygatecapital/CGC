import crypto from "node:crypto";
import type postgres from "postgres";
import { getQueryClient, isDatabaseConfigured } from "../db/db.js";
import { appendAuditEntry, appendCriticalAudit } from "./auditLog.js";
import {
  FinancialSandboxError,
  SANDBOX_ASSETS,
  type SandboxAccount,
  type SandboxAccountType,
  type SandboxActor,
  type SandboxAsset,
  type SandboxLine,
  type SandboxStatus,
  type SandboxTransaction,
} from "./financialSandbox.js";

type TxSql = postgres.TransactionSql<Record<string, never>>;
type AccountRow = {
  id: string;
  name: string;
  account_type: SandboxAccountType | "treasury";
  asset: SandboxAsset;
  balance_minor: string;
  created_at: Date | string;
};
type TransactionRow = {
  id: string;
  reference: string;
  idempotency_key: string;
  kind: SandboxTransaction["kind"];
  status: SandboxStatus;
  asset: SandboxAsset;
  amount_minor: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  reason: string;
  reverses_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};
type LineRow = {
  account_id: string;
  debit_minor: string;
  credit_minor: string;
  asset: SandboxAsset;
};
type CommandRow = {
  fingerprint: string;
  result_type: "account" | "transaction";
  result_id: string;
};

const ACCOUNT_TYPES = new Set<SandboxAccountType>([
  "personal",
  "savings",
  "business",
  "fiat_wallet",
  "crypto_wallet",
]);
const CRYPTO_ASSETS = new Set<SandboxAsset>(["BTC", "ETH", "USDT"]);

function requireDatabase(): void {
  if (!isDatabaseConfigured())
    throw new FinancialSandboxError(
      "The database-backed financial sandbox is unavailable.",
      "DATABASE_REQUIRED",
    );
}

function requireKey(value: string): string {
  const key = value.trim();
  if (!key || key.length > 160)
    throw new FinancialSandboxError(
      "A valid idempotency key is required.",
      "IDEMPOTENCY_REQUIRED",
    );
  return key;
}

function requireReason(value: string): string {
  const reason = value.trim();
  if (!reason)
    throw new FinancialSandboxError("A reason is required.", "REASON_REQUIRED");
  return reason.slice(0, 240);
}

function amountToMinor(value: string | number, asset: SandboxAsset): bigint {
  const normalized = String(value).trim();
  const decimals = CRYPTO_ASSETS.has(asset) ? 8 : 2;
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  if (!pattern.test(normalized))
    throw new FinancialSandboxError(
      `Amount must be positive with no more than ${decimals} decimal places.`,
      "INVALID_AMOUNT",
    );
  const [whole, fraction = ""] = normalized.split(".");
  const minor =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals));
  if (minor <= 0n)
    throw new FinancialSandboxError(
      "Amount must be greater than zero.",
      "INVALID_AMOUNT",
    );
  return minor;
}

function hash(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function accountFromRow(row: AccountRow): SandboxAccount {
  return {
    id: row.id,
    name: row.name,
    type: row.account_type as SandboxAccountType,
    asset: row.asset,
    balanceMinor: BigInt(row.balance_minor),
    synthetic: true,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function transactionFromRow(
  row: TransactionRow,
  lines: SandboxLine[] = [],
): SandboxTransaction {
  return {
    id: row.id,
    reference: row.reference,
    idempotencyKey: row.idempotency_key,
    kind: row.kind,
    status: row.status,
    asset: row.asset,
    amountMinor: BigInt(row.amount_minor),
    sourceAccountId: row.source_account_id ?? undefined,
    destinationAccountId: row.destination_account_id ?? undefined,
    reason: row.reason,
    executionSource: "SIMULATION",
    synthetic: true,
    reversesId: row.reverses_id ?? undefined,
    lines,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function critical(
  actor: SandboxActor,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  await appendCriticalAudit({
    event: `${action}_intent`,
    adminId: actor.id,
    email: actor.email,
    ip: actor.ip,
    meta: {
      ...details,
      correlationId: actor.correlationId,
      synthetic: true,
      executionSource: "SIMULATION",
    },
  });
}

async function completed(
  actor: SandboxActor,
  action: string,
  targetId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await appendAuditEntry({
    adminId: actor.id,
    adminEmail: actor.email,
    action,
    target: "financial-sandbox",
    targetId,
    ip: actor.ip,
    details: {
      ...details,
      correlationId: actor.correlationId,
      synthetic: true,
      executionSource: "SIMULATION",
    },
  });
}

async function command(
  tx: TxSql,
  key: string,
  fingerprint: string,
): Promise<CommandRow | undefined> {
  await tx`SELECT pg_advisory_xact_lock(hashtext(${`financial-sandbox:${key}`}))`;
  const rows = await tx<
    CommandRow[]
  >`SELECT fingerprint, result_type, result_id FROM financial_sandbox_commands WHERE idempotency_key = ${key}`;
  const prior = rows[0];
  if (prior && prior.fingerprint !== fingerprint)
    throw new FinancialSandboxError(
      "Idempotency key was reused with different input.",
      "IDEMPOTENCY_CONFLICT",
    );
  return prior;
}

async function loadAccount(
  tx: TxSql,
  id: string,
  lock = false,
): Promise<AccountRow> {
  if (!id.startsWith("syn_account_") && !id.startsWith("syn_treasury_"))
    throw new FinancialSandboxError(
      "Only synthetic sandbox references are permitted.",
      "SYNTHETIC_REFERENCE_REQUIRED",
    );
  const rows = lock
    ? await tx<
        AccountRow[]
      >`SELECT id, name, account_type, asset, balance_minor::text, created_at FROM financial_sandbox_accounts WHERE id = ${id} FOR UPDATE`
    : await tx<
        AccountRow[]
      >`SELECT id, name, account_type, asset, balance_minor::text, created_at FROM financial_sandbox_accounts WHERE id = ${id}`;
  if (!rows[0])
    throw new FinancialSandboxError(
      "Synthetic account not found.",
      "ACCOUNT_NOT_FOUND",
    );
  return rows[0];
}

async function loadTransaction(
  tx: TxSql,
  id: string,
  lock = false,
): Promise<TransactionRow> {
  if (!id.startsWith("syn_tx_"))
    throw new FinancialSandboxError(
      "Only synthetic sandbox references are permitted.",
      "SYNTHETIC_REFERENCE_REQUIRED",
    );
  const rows = lock
    ? await tx<
        TransactionRow[]
      >`SELECT id, reference, idempotency_key, kind, status, asset, amount_minor::text, source_account_id, destination_account_id, reason, reverses_id, created_at, updated_at FROM financial_sandbox_transactions WHERE id = ${id} FOR UPDATE`
    : await tx<
        TransactionRow[]
      >`SELECT id, reference, idempotency_key, kind, status, asset, amount_minor::text, source_account_id, destination_account_id, reason, reverses_id, created_at, updated_at FROM financial_sandbox_transactions WHERE id = ${id}`;
  if (!rows[0])
    throw new FinancialSandboxError(
      "Synthetic transaction not found.",
      "TRANSACTION_NOT_FOUND",
    );
  return rows[0];
}

async function loadTransactionResult(
  tx: TxSql,
  id: string,
): Promise<SandboxTransaction> {
  const row = await loadTransaction(tx, id);
  const lineRows = await tx<
    LineRow[]
  >`SELECT l.account_id, l.debit_minor::text, l.credit_minor::text, l.asset FROM financial_sandbox_journal_lines l JOIN financial_sandbox_journal_entries e ON e.id = l.journal_entry_id WHERE e.transaction_id = ${id} ORDER BY l.created_at, l.id`;
  return transactionFromRow(
    row,
    lineRows.map((line) => ({
      accountId: line.account_id,
      debitMinor: BigInt(line.debit_minor),
      creditMinor: BigInt(line.credit_minor),
      asset: line.asset,
    })),
  );
}

async function ensureTreasury(
  tx: TxSql,
  asset: SandboxAsset,
  actorId: string,
): Promise<string> {
  const id = `syn_treasury_${asset.toLowerCase()}`;
  await tx`INSERT INTO financial_sandbox_accounts (id, name, account_type, asset, balance_minor, synthetic, creation_idempotency_key, creation_fingerprint, created_by) VALUES (${id}, ${`${asset} simulation treasury`}, 'treasury', ${asset}, 0, TRUE, ${`system:treasury:${asset}`}, ${hash({ asset, treasury: true })}, ${actorId}) ON CONFLICT (id) DO NOTHING`;
  return id;
}

export class DatabaseFinancialSandbox {
  async listAccounts(): Promise<SandboxAccount[]> {
    requireDatabase();
    const rows = await getQueryClient()<
      AccountRow[]
    >`SELECT id, name, account_type, asset, balance_minor::text, created_at FROM financial_sandbox_accounts WHERE synthetic IS TRUE AND account_type <> 'treasury' ORDER BY created_at DESC`;
    return rows.map(accountFromRow);
  }

  async listTransactions(
    input: {
      search?: string;
      status?: string;
      asset?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    requireDatabase();
    const sql = getQueryClient();
    const search = input.search?.trim().toLowerCase() ?? "";
    const like = `%${search}%`;
    const status = input.status?.trim() ?? "";
    const asset = input.asset?.trim() ?? "";
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    const page = Math.max(1, input.page ?? 1);
    const offset = (page - 1) * pageSize;
    const countRows = await sql<
      { count: string }[]
    >`SELECT COUNT(*)::text AS count FROM financial_sandbox_transactions WHERE synthetic IS TRUE AND (${search} = '' OR LOWER(reference) LIKE ${like} OR LOWER(reason) LIKE ${like}) AND (${status} = '' OR status = ${status}) AND (${asset} = '' OR asset = ${asset})`;
    const rows = await sql<
      TransactionRow[]
    >`SELECT id, reference, idempotency_key, kind, status, asset, amount_minor::text, source_account_id, destination_account_id, reason, reverses_id, created_at, updated_at FROM financial_sandbox_transactions WHERE synthetic IS TRUE AND (${search} = '' OR LOWER(reference) LIKE ${like} OR LOWER(reason) LIKE ${like}) AND (${status} = '' OR status = ${status}) AND (${asset} = '' OR asset = ${asset}) ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
    return {
      data: rows.map((row) => transactionFromRow(row)),
      page,
      pageSize,
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async getTransaction(id: string): Promise<SandboxTransaction> {
    requireDatabase();
    return getQueryClient().begin((tx) => loadTransactionResult(tx, id));
  }

  async getOverview(): Promise<{
    accounts: number;
    transactions: number;
    pending: number;
    completed: number;
    reversed: number;
    cancelled: number;
    journalEntries: number;
    integrityBreaks: number;
  }> {
    requireDatabase();
    const sql = getQueryClient();
    const [accountRows, transactionRows, journalRows, integrityRows] =
      await Promise.all([
        sql<
          { count: string }[]
        >`SELECT COUNT(*)::text AS count FROM financial_sandbox_accounts WHERE synthetic IS TRUE AND account_type <> 'treasury'`,
        sql<
          {
            total: string;
            pending: string;
            completed: string;
            reversed: string;
            cancelled: string;
          }[]
        >`
        SELECT
          COUNT(*)::text AS total,
          COUNT(*) FILTER (WHERE status IN ('pending', 'processing'))::text AS pending,
          COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
          COUNT(*) FILTER (WHERE status = 'reversed')::text AS reversed,
          COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled
        FROM financial_sandbox_transactions
        WHERE synthetic IS TRUE`,
        sql<
          { count: string }[]
        >`SELECT COUNT(*)::text AS count FROM financial_sandbox_journal_entries WHERE synthetic IS TRUE`,
        sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM (
          SELECT entry.id
          FROM financial_sandbox_journal_entries entry
          JOIN financial_sandbox_journal_lines line ON line.journal_entry_id = entry.id
          WHERE entry.synthetic IS TRUE AND line.synthetic IS TRUE
          GROUP BY entry.id
          HAVING COALESCE(SUM(line.debit_minor), 0) <> COALESCE(SUM(line.credit_minor), 0)
        ) integrity_breaks`,
      ]);
    const totals = transactionRows[0];
    return {
      accounts: Number(accountRows[0]?.count ?? 0),
      transactions: Number(totals?.total ?? 0),
      pending: Number(totals?.pending ?? 0),
      completed: Number(totals?.completed ?? 0),
      reversed: Number(totals?.reversed ?? 0),
      cancelled: Number(totals?.cancelled ?? 0),
      journalEntries: Number(journalRows[0]?.count ?? 0),
      integrityBreaks: Number(integrityRows[0]?.count ?? 0),
    };
  }

  async createAccount(
    input: {
      name: string;
      type: SandboxAccountType;
      asset: string;
      idempotencyKey: string;
    },
    actor: SandboxActor,
  ): Promise<SandboxAccount> {
    requireDatabase();
    const key = requireKey(input.idempotencyKey);
    const name = input.name.trim().slice(0, 80);
    if (!name)
      throw new FinancialSandboxError(
        "Account name is required.",
        "INVALID_NAME",
      );
    if (!ACCOUNT_TYPES.has(input.type))
      throw new FinancialSandboxError(
        "Unsupported synthetic account type.",
        "INVALID_ACCOUNT_TYPE",
      );
    if (!SANDBOX_ASSETS.includes(input.asset as SandboxAsset))
      throw new FinancialSandboxError(
        "Unsupported sandbox asset.",
        "INVALID_ASSET",
      );
    const asset = input.asset as SandboxAsset;
    const fingerprint = hash({
      action: "create_account",
      name,
      type: input.type,
      asset,
    });
    await critical(actor, "financial_sandbox_account_create", {
      name,
      type: input.type,
      asset,
      idempotencyKey: key,
    });
    const result = await getQueryClient().begin(async (tx) => {
      const prior = await command(tx, key, fingerprint);
      if (prior) {
        if (prior.result_type !== "account")
          throw new FinancialSandboxError(
            "Idempotency result type conflict.",
            "IDEMPOTENCY_CONFLICT",
          );
        return accountFromRow(await loadAccount(tx, prior.result_id));
      }
      const id = `syn_account_${crypto.randomUUID()}`;
      const rows = await tx<
        AccountRow[]
      >`INSERT INTO financial_sandbox_accounts (id, name, account_type, asset, balance_minor, synthetic, creation_idempotency_key, creation_fingerprint, created_by) VALUES (${id}, ${name}, ${input.type}, ${asset}, 0, TRUE, ${key}, ${fingerprint}, ${actor.id}) RETURNING id, name, account_type, asset, balance_minor::text, created_at`;
      await tx`INSERT INTO financial_sandbox_commands (idempotency_key, fingerprint, action, result_type, result_id, created_by) VALUES (${key}, ${fingerprint}, 'create_account', 'account', ${id}, ${actor.id})`;
      return accountFromRow(rows[0]);
    });
    await completed(actor, "financial_sandbox_account_created", result.id, {
      type: result.type,
      asset: result.asset,
    });
    return result;
  }

  private async post(
    input: {
      key: string;
      kind: SandboxTransaction["kind"];
      sourceId: string;
      destinationId: string;
      amount: string | number;
      reason: string;
      reversesId?: string;
      ensureTreasuryAsset?: SandboxAsset;
    },
    actor: SandboxActor,
  ): Promise<SandboxTransaction> {
    const key = requireKey(input.key);
    const reason = requireReason(input.reason);
    const fingerprint = hash({
      action: input.kind,
      sourceId: input.sourceId,
      destinationId: input.destinationId,
      amount: String(input.amount),
      reason,
      reversesId: input.reversesId,
    });
    await critical(actor, `financial_sandbox_${input.kind}`, {
      sourceId: input.sourceId,
      destinationId: input.destinationId,
      reason,
      idempotencyKey: key,
      reversesId: input.reversesId,
    });
    const result = await getQueryClient().begin(async (tx) => {
      const prior = await command(tx, key, fingerprint);
      if (prior) return loadTransactionResult(tx, prior.result_id);
      if (input.ensureTreasuryAsset)
        await ensureTreasury(tx, input.ensureTreasuryAsset, actor.id);
      if (input.reversesId) {
        const original = await loadTransaction(tx, input.reversesId, true);
        if (original.status !== "completed" || original.kind === "reversal")
          throw new FinancialSandboxError(
            "Transaction is not eligible for reversal.",
            "REVERSAL_NOT_ALLOWED",
          );
        if (
          original.source_account_id !== input.destinationId ||
          original.destination_account_id !== input.sourceId
        )
          throw new FinancialSandboxError(
            "Reversal journal does not match the original transaction.",
            "REVERSAL_NOT_ALLOWED",
          );
      }
      const source = await loadAccount(tx, input.sourceId, true);
      const destination = await loadAccount(tx, input.destinationId, true);
      if (source.id === destination.id)
        throw new FinancialSandboxError(
          "Source and destination must be different.",
          "SAME_ACCOUNT",
        );
      if (source.asset !== destination.asset)
        throw new FinancialSandboxError(
          "Source and destination assets must match.",
          "ASSET_MISMATCH",
        );
      if (input.kind === "crypto_transfer" && !CRYPTO_ASSETS.has(source.asset))
        throw new FinancialSandboxError(
          "Crypto simulation requires a configured crypto asset.",
          "CRYPTO_ASSET_REQUIRED",
        );
      const amountMinor = amountToMinor(input.amount, source.asset);
      const amountValue = amountMinor.toString();
      if (
        source.account_type !== "treasury" &&
        BigInt(source.balance_minor) < amountMinor
      )
        throw new FinancialSandboxError(
          "Synthetic account has insufficient balance.",
          "INSUFFICIENT_FUNDS",
        );
      const id = `syn_tx_${crypto.randomUUID()}`;
      const reference = `SYN-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
      const journalId = `syn_je_${crypto.randomUUID()}`;
      await tx`INSERT INTO financial_sandbox_transactions (id, reference, idempotency_key, idempotency_fingerprint, kind, status, asset, amount_minor, source_account_id, destination_account_id, reason, execution_source, synthetic, reverses_id, created_by) VALUES (${id}, ${reference}, ${key}, ${fingerprint}, ${input.kind}, 'completed', ${source.asset}, ${amountValue}, ${source.id}, ${destination.id}, ${reason}, 'SIMULATION', TRUE, ${input.reversesId ?? null}, ${actor.id})`;
      await tx`INSERT INTO financial_sandbox_journal_entries (id, transaction_id, reference, asset, synthetic, posted_by) VALUES (${journalId}, ${id}, ${`SYN-JE-${crypto.randomBytes(6).toString("hex").toUpperCase()}`}, ${source.asset}, TRUE, ${actor.id})`;
      await tx`INSERT INTO financial_sandbox_journal_lines (id, journal_entry_id, account_id, asset, debit_minor, credit_minor, synthetic) VALUES (${`syn_jl_${crypto.randomUUID()}`}, ${journalId}, ${source.id}, ${source.asset}, ${amountValue}, 0, TRUE), (${`syn_jl_${crypto.randomUUID()}`}, ${journalId}, ${destination.id}, ${source.asset}, 0, ${amountValue}, TRUE)`;
      await tx`UPDATE financial_sandbox_accounts SET balance_minor = balance_minor - ${amountValue}, updated_at = NOW() WHERE id = ${source.id}`;
      await tx`UPDATE financial_sandbox_accounts SET balance_minor = balance_minor + ${amountValue}, updated_at = NOW() WHERE id = ${destination.id}`;
      if (input.reversesId)
        await tx`UPDATE financial_sandbox_transactions SET status = 'reversed', updated_at = NOW() WHERE id = ${input.reversesId}`;
      await tx`INSERT INTO financial_sandbox_commands (idempotency_key, fingerprint, action, result_type, result_id, created_by) VALUES (${key}, ${fingerprint}, ${input.kind}, 'transaction', ${id}, ${actor.id})`;
      return loadTransactionResult(tx, id);
    });
    await completed(actor, `financial_sandbox_${input.kind}`, result.id, {
      reference: result.reference,
      asset: result.asset,
      amountMinor: result.amountMinor.toString(),
      reason,
    });
    return result;
  }

  async transfer(
    input: {
      sourceAccountId: string;
      destinationAccountId: string;
      amount: string | number;
      reason: string;
      idempotencyKey: string;
      crypto?: boolean;
    },
    actor: SandboxActor,
  ) {
    requireDatabase();
    return this.post(
      {
        key: input.idempotencyKey,
        kind: input.crypto ? "crypto_transfer" : "internal_transfer",
        sourceId: input.sourceAccountId,
        destinationId: input.destinationAccountId,
        amount: input.amount,
        reason: input.reason,
      },
      actor,
    );
  }

  async adjust(
    input: {
      accountId: string;
      amount: string | number;
      direction: "credit" | "debit";
      reason: string;
      reference: string;
      confirmed: boolean;
      idempotencyKey: string;
    },
    actor: SandboxActor,
  ) {
    requireDatabase();
    if (!input.confirmed || !input.reference.trim())
      throw new FinancialSandboxError(
        "Confirmed adjustment and reference are required.",
        "ADJUSTMENT_CONFIRMATION_REQUIRED",
      );
    const rows = await getQueryClient()<
      AccountRow[]
    >`SELECT id, name, account_type, asset, balance_minor::text, created_at FROM financial_sandbox_accounts WHERE id = ${input.accountId} AND synthetic IS TRUE`;
    if (!rows[0] || rows[0].account_type === "treasury")
      throw new FinancialSandboxError(
        "Synthetic account not found.",
        "ACCOUNT_NOT_FOUND",
      );
    const treasuryId = `syn_treasury_${rows[0].asset.toLowerCase()}`;
    return this.post(
      {
        key: input.idempotencyKey,
        kind: "adjustment",
        sourceId: input.direction === "debit" ? input.accountId : treasuryId,
        destinationId:
          input.direction === "credit" ? input.accountId : treasuryId,
        amount: input.amount,
        reason: `${input.reference.trim().slice(0, 80)}: ${requireReason(input.reason)}`,
        ensureTreasuryAsset: rows[0].asset,
      },
      actor,
    );
  }

  async mock(
    input: {
      sourceAccountId: string;
      destinationAccountId: string;
      amount: string | number;
      reason: string;
      idempotencyKey: string;
    },
    actor: SandboxActor,
  ): Promise<SandboxTransaction> {
    requireDatabase();
    const key = requireKey(input.idempotencyKey);
    const reason = requireReason(input.reason);
    const fingerprint = hash({
      action: "mock",
      ...input,
      idempotencyKey: undefined,
      reason,
    });
    await critical(actor, "financial_sandbox_mock", {
      sourceId: input.sourceAccountId,
      destinationId: input.destinationAccountId,
      reason,
      idempotencyKey: key,
    });
    const result = await getQueryClient().begin(async (tx) => {
      const prior = await command(tx, key, fingerprint);
      if (prior) return loadTransactionResult(tx, prior.result_id);
      const source = await loadAccount(tx, input.sourceAccountId);
      const destination = await loadAccount(tx, input.destinationAccountId);
      if (source.id === destination.id)
        throw new FinancialSandboxError(
          "Source and destination must be different.",
          "SAME_ACCOUNT",
        );
      if (source.asset !== destination.asset)
        throw new FinancialSandboxError(
          "Source and destination assets must match.",
          "ASSET_MISMATCH",
        );
      const amountMinor = amountToMinor(input.amount, source.asset);
      const amountValue = amountMinor.toString();
      const id = `syn_tx_${crypto.randomUUID()}`;
      const reference = `SYN-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
      const rows = await tx<
        TransactionRow[]
      >`INSERT INTO financial_sandbox_transactions (id, reference, idempotency_key, idempotency_fingerprint, kind, status, asset, amount_minor, source_account_id, destination_account_id, reason, execution_source, synthetic, created_by) VALUES (${id}, ${reference}, ${key}, ${fingerprint}, 'mock', 'pending', ${source.asset}, ${amountValue}, ${source.id}, ${destination.id}, ${reason}, 'SIMULATION', TRUE, ${actor.id}) RETURNING id, reference, idempotency_key, kind, status, asset, amount_minor::text, source_account_id, destination_account_id, reason, reverses_id, created_at, updated_at`;
      await tx`INSERT INTO financial_sandbox_commands (idempotency_key, fingerprint, action, result_type, result_id, created_by) VALUES (${key}, ${fingerprint}, 'mock', 'transaction', ${id}, ${actor.id})`;
      return transactionFromRow(rows[0]);
    });
    await completed(actor, "financial_sandbox_mock", result.id, {
      reference: result.reference,
      asset: result.asset,
      amountMinor: result.amountMinor.toString(),
      status: result.status,
    });
    return result;
  }

  async reverse(
    id: string,
    reasonInput: string,
    idempotencyKey: string,
    actor: SandboxActor,
  ): Promise<SandboxTransaction> {
    requireDatabase();
    const reason = requireReason(reasonInput);
    const sql = getQueryClient();
    const key=requireKey(idempotencyKey);
    const prior=await sql.begin(async tx=>{const candidate=await loadTransaction(tx,id,false);return command(tx,key,hash({action:'reversal',sourceId:candidate.destination_account_id,destinationId:candidate.source_account_id,amount:this.minorToAmount(BigInt(candidate.amount_minor),candidate.asset),reason,reversesId:id}));});
    if(prior)return sql.begin(tx=>loadTransactionResult(tx,prior.result_id));
    const original = await sql.begin((tx) => loadTransaction(tx, id, true));
    if (original.status !== "completed" || original.kind === "reversal")
      throw new FinancialSandboxError(
        "Transaction is not eligible for reversal.",
        "REVERSAL_NOT_ALLOWED",
      );
    if (!original.source_account_id || !original.destination_account_id)
      throw new FinancialSandboxError(
        "Transaction has no reversible journal.",
        "REVERSAL_NOT_ALLOWED",
      );
    return this.post(
      {
        key: idempotencyKey,
        kind: "reversal",
        sourceId: original.destination_account_id,
        destinationId: original.source_account_id,
        amount: this.minorToAmount(
          BigInt(original.amount_minor),
          original.asset,
        ),
        reason,
        reversesId: original.id,
      },
      actor,
    );
  }

  async cancel(
    id: string,
    reasonInput: string,
    idempotencyKey: string,
    actor: SandboxActor,
  ): Promise<SandboxTransaction> {
    requireDatabase();
    const key = requireKey(idempotencyKey);
    const reason = requireReason(reasonInput);
    const fingerprint = hash({ action: "cancel", id, reason });
    await critical(actor, "financial_sandbox_cancel", {
      transactionId: id,
      reason,
      idempotencyKey: key,
    });
    const result = await getQueryClient().begin(async (tx) => {
      const prior = await command(tx, key, fingerprint);
      if (prior) return loadTransactionResult(tx, prior.result_id);
      const item = await loadTransaction(tx, id, true);
      if (!["pending", "processing"].includes(item.status))
        throw new FinancialSandboxError(
          "Only pending or processing transactions can be cancelled.",
          "CANCELLATION_NOT_ALLOWED",
        );
      await tx`UPDATE financial_sandbox_transactions SET status = 'cancelled', cancellation_reason = ${reason}, updated_at = NOW() WHERE id = ${id}`;
      await tx`INSERT INTO financial_sandbox_commands (idempotency_key, fingerprint, action, result_type, result_id, created_by) VALUES (${key}, ${fingerprint}, 'cancel', 'transaction', ${id}, ${actor.id})`;
      return loadTransactionResult(tx, id);
    });
    await completed(actor, "financial_sandbox_cancelled", result.id, {
      reason,
      status: result.status,
    });
    return result;
  }

  private minorToAmount(minor: bigint, asset: SandboxAsset): string {
    const decimals = CRYPTO_ASSETS.has(asset) ? 8 : 2;
    const factor = 10n ** BigInt(decimals);
    return `${minor / factor}.${(minor % factor).toString().padStart(decimals, "0")}`;
  }
}

export const databaseFinancialSandbox = new DatabaseFinancialSandbox();
