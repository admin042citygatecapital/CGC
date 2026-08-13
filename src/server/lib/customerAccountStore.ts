import crypto from "node:crypto";
import { getQueryClient, isDatabaseConfigured } from "../db/db.js";
import { appendAudit, appendCriticalAudit } from "./auditLog.js";
import { findUserById, loadAllUsers } from "./userStore.js";

export const ACCOUNT_TYPES = ["personal", "savings", "business"] as const;
export const ACCOUNT_STATUSES = [
  "pending",
  "active",
  "restricted",
  "closed",
] as const;
export const ACCOUNT_RESTRICTIONS = [
  "debits_disabled",
  "credits_disabled",
  "transfers_disabled",
  "cards_disabled",
  "withdrawals_disabled",
] as const;

export type CustomerAccountType = (typeof ACCOUNT_TYPES)[number];
export type CustomerAccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type CustomerAccountRestriction = (typeof ACCOUNT_RESTRICTIONS)[number];

export interface AccountActor {
  id: string;
  email: string;
  ip?: string;
  correlationId: string;
}

export interface PlatformCurrency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  decimals: number;
  active: boolean;
  displayOrder: number;
}

export interface CustomerAccount {
  id: string;
  userId: string;
  customerName?: string;
  customerEmail?: string;
  label: string;
  accountType: CustomerAccountType;
  status: CustomerAccountStatus;
  primaryCurrency: string;
  availableMinor: bigint;
  ledgerMinor: bigint;
  pendingMinor: bigint;
  restrictions: CustomerAccountRestriction[];
  synthetic: true;
  createdAt: string;
  updatedAt: string;
}

export class CustomerAccountError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

const LOCAL_CURRENCIES: PlatformCurrency[] = [
  {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    flag: "🇬🇧",
    decimals: 2,
    active: true,
    displayOrder: 10,
  },
  {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    flag: "🇪🇺",
    decimals: 2,
    active: true,
    displayOrder: 20,
  },
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    flag: "🇺🇸",
    decimals: 2,
    active: true,
    displayOrder: 30,
  },
  {
    code: "CAD",
    name: "Canadian Dollar",
    symbol: "C$",
    flag: "🇨🇦",
    decimals: 2,
    active: true,
    displayOrder: 40,
  },
  {
    code: "AUD",
    name: "Australian Dollar",
    symbol: "A$",
    flag: "🇦🇺",
    decimals: 2,
    active: true,
    displayOrder: 50,
  },
  {
    code: "CHF",
    name: "Swiss Franc",
    symbol: "CHF",
    flag: "🇨🇭",
    decimals: 2,
    active: true,
    displayOrder: 60,
  },
];
const localAccounts = new Map<string, CustomerAccount>();
const localCommands = new Map<
  string,
  { fingerprint: string; accountId: string }
>();

/** Internal simulation-ledger bridge. Customer/admin HTTP handlers must never
 * call this directly; only the balanced posting service may project journals
 * onto the local account registry. */
export function applyLocalSimulationLedgerProjection(
  updates: Array<{ accountId: string; deltaMinor: bigint }>,
): void {
  if (isDatabaseConfigured())
    throw new CustomerAccountError(
      "Database projections must be applied inside the ledger transaction.",
      "DATABASE_TRANSACTION_REQUIRED",
    );
  const projected = updates.map(({ accountId, deltaMinor }) => {
    const account = localAccounts.get(accountId);
    if (!account)
      throw new CustomerAccountError("Account not found.", "ACCOUNT_NOT_FOUND");
    const next = account.ledgerMinor + deltaMinor;
    if (next < 0n)
      throw new CustomerAccountError(
        "Synthetic account has insufficient funds.",
        "INSUFFICIENT_FUNDS",
      );
    return { account, next };
  });
  const now = new Date().toISOString();
  for (const { account, next } of projected) {
    account.ledgerMinor = next;
    account.availableMinor = next - account.pendingMinor;
    account.updatedAt = now;
  }
}

export function resetCustomerAccountsForTests(): void {
  if (process.env.NODE_ENV !== "test")
    throw new CustomerAccountError(
      "Test reset is unavailable outside the test environment.",
      "TEST_ONLY",
    );
  localAccounts.clear();
  localCommands.clear();
}

type AccountRow = {
  id: string;
  user_id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  label: string;
  account_type: CustomerAccountType;
  status: CustomerAccountStatus;
  primary_currency: string;
  available_minor: string;
  ledger_minor: string;
  pending_minor: string;
  restrictions: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

function rowToAccount(row: AccountRow): CustomerAccount {
  return {
    id: row.id,
    userId: row.user_id,
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    label: row.label,
    accountType: row.account_type,
    status: row.status,
    primaryCurrency: row.primary_currency,
    availableMinor: BigInt(row.available_minor),
    ledgerMinor: BigInt(row.ledger_minor),
    pendingMinor: BigInt(row.pending_minor),
    restrictions: normalizeRestrictions(row.restrictions),
    synthetic: true,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function normalizeRestrictions(value: unknown): CustomerAccountRestriction[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (item): item is CustomerAccountRestriction =>
          typeof item === "string" &&
          ACCOUNT_RESTRICTIONS.includes(item as CustomerAccountRestriction),
      ),
    ),
  ];
}

function normalizeLabel(value: string): string {
  const label = value.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!label)
    throw new CustomerAccountError(
      "Account label is required.",
      "INVALID_LABEL",
    );
  return label;
}

function normalizeKey(value: string): string {
  const key = value.trim();
  if (!key || key.length > 160)
    throw new CustomerAccountError(
      "A valid idempotency key is required.",
      "IDEMPOTENCY_REQUIRED",
    );
  return key;
}

function fingerprint(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function validateType(value: string): CustomerAccountType {
  if (!ACCOUNT_TYPES.includes(value as CustomerAccountType))
    throw new CustomerAccountError(
      "Unsupported account type.",
      "INVALID_ACCOUNT_TYPE",
    );
  return value as CustomerAccountType;
}

function validateStatus(value: string): CustomerAccountStatus {
  if (!ACCOUNT_STATUSES.includes(value as CustomerAccountStatus))
    throw new CustomerAccountError(
      "Unsupported account status.",
      "INVALID_ACCOUNT_STATUS",
    );
  return value as CustomerAccountStatus;
}

export async function listPlatformCurrencies(): Promise<PlatformCurrency[]> {
  if (!isDatabaseConfigured())
    return LOCAL_CURRENCIES.map((item) => ({ ...item }));
  const rows = await getQueryClient()<
    Array<{
      code: string;
      name: string;
      symbol: string;
      flag: string;
      decimals: number;
      active: boolean;
      display_order: number;
    }>
  >`SELECT code, name, symbol, flag, decimals, active, display_order
       FROM platform_currencies WHERE active IS TRUE ORDER BY display_order, code`;
  return rows.map((row) => ({ ...row, displayOrder: row.display_order }));
}

async function validateCurrency(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase();
  const currencies = await listPlatformCurrencies();
  if (!currencies.some((item) => item.active && item.code === normalized)) {
    throw new CustomerAccountError(
      "Currency is not enabled for customer accounts.",
      "CURRENCY_UNAVAILABLE",
    );
  }
  return normalized;
}

export async function listCustomerAccounts(
  input: {
    userId?: string;
    status?: string;
    search?: string;
  } = {},
): Promise<CustomerAccount[]> {
  if (!isDatabaseConfigured()) {
    const users = await loadAllUsers();
    const directory = new Map(users.map((user) => [user.id, user]));
    const search = input.search?.trim().toLowerCase() ?? "";
    return [...localAccounts.values()]
      .filter((item) => !input.userId || item.userId === input.userId)
      .filter((item) => !input.status || item.status === input.status)
      .map((item) => ({
        ...item,
        restrictions: [...item.restrictions],
        customerName: directory.get(item.userId)?.name,
        customerEmail: directory.get(item.userId)?.email,
      }))
      .filter(
        (item) =>
          !search ||
          [
            item.label,
            item.customerName,
            item.customerEmail,
            item.primaryCurrency,
          ].some((value) => value?.toLowerCase().includes(search)),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const rows = await getQueryClient()<AccountRow[]>`
    SELECT a.id, a.user_id, u.name AS customer_name, u.email AS customer_email,
           a.label, a.account_type, a.status, a.primary_currency,
           a.available_minor, a.ledger_minor, a.pending_minor,
           a.restrictions, a.created_at, a.updated_at
      FROM customer_accounts a
      JOIN users u ON u.id = a.user_id
     WHERE (${input.userId ?? null}::text IS NULL OR a.user_id = ${input.userId ?? null})
       AND (${input.status ?? null}::text IS NULL OR a.status = ${input.status ?? null})
       AND (${input.search?.trim() || null}::text IS NULL OR
            a.label ILIKE ${`%${input.search?.trim() ?? ""}%`} OR
            u.name ILIKE ${`%${input.search?.trim() ?? ""}%`} OR
            u.email ILIKE ${`%${input.search?.trim() ?? ""}%`})
     ORDER BY a.updated_at DESC`;
  return rows.map(rowToAccount);
}

export async function createCustomerAccount(
  input: {
    userId: string;
    label: string;
    accountType: string;
    primaryCurrency: string;
    status?: string;
    idempotencyKey: string;
  },
  actor: AccountActor,
): Promise<CustomerAccount> {
  const user = await findUserById(input.userId);
  if (!user)
    throw new CustomerAccountError("Customer not found.", "CUSTOMER_NOT_FOUND");
  const accountType = validateType(input.accountType);
  const status = validateStatus(input.status ?? "pending");
  const primaryCurrency = await validateCurrency(input.primaryCurrency);
  const label = normalizeLabel(input.label);
  const idempotencyKey = normalizeKey(input.idempotencyKey);
  const commandFingerprint = fingerprint({
    userId: user.id,
    label,
    accountType,
    primaryCurrency,
    status,
  });

  await appendCriticalAudit({
    event: "customer_account_create_intent",
    adminId: actor.id,
    email: actor.email,
    ip: actor.ip,
    userId: user.id,
    meta: {
      accountType,
      primaryCurrency,
      status,
      correlationId: actor.correlationId,
      synthetic: true,
    },
  });

  if (!isDatabaseConfigured()) {
    const prior = localCommands.get(idempotencyKey);
    if (prior) {
      if (prior.fingerprint !== commandFingerprint)
        throw new CustomerAccountError(
          "Idempotency key was reused with different input.",
          "IDEMPOTENCY_CONFLICT",
        );
      return localAccounts.get(prior.accountId)!;
    }
    if (
      [...localAccounts.values()].some(
        (item) =>
          item.userId === user.id &&
          item.accountType === accountType &&
          item.primaryCurrency === primaryCurrency,
      )
    ) {
      throw new CustomerAccountError(
        "That customer account already exists.",
        "ACCOUNT_EXISTS",
      );
    }
    const now = new Date().toISOString();
    const account: CustomerAccount = {
      id: `acct_syn_${crypto.randomUUID()}`,
      userId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      label,
      accountType,
      status,
      primaryCurrency,
      availableMinor: 0n,
      ledgerMinor: 0n,
      pendingMinor: 0n,
      restrictions: [],
      synthetic: true,
      createdAt: now,
      updatedAt: now,
    };
    localAccounts.set(account.id, account);
    localCommands.set(idempotencyKey, {
      fingerprint: commandFingerprint,
      accountId: account.id,
    });
    appendAudit({
      event: "customer_account_created",
      adminId: actor.id,
      email: actor.email,
      ip: actor.ip,
      userId: user.id,
      meta: {
        accountId: account.id,
        accountType,
        primaryCurrency,
        status,
        correlationId: actor.correlationId,
        synthetic: true,
      },
    });
    return { ...account, restrictions: [] };
  }

  const sql = getQueryClient();
  const [priorCommand] = await sql<
    Array<AccountRow & { creation_fingerprint: string }>
  >`
    SELECT id, user_id, label, account_type, status, primary_currency,
           available_minor, ledger_minor, pending_minor, restrictions,
           creation_fingerprint, created_at, updated_at
      FROM customer_accounts
     WHERE creation_idempotency_key = ${idempotencyKey}
     LIMIT 1`;
  if (priorCommand) {
    if (priorCommand.creation_fingerprint !== commandFingerprint)
      throw new CustomerAccountError(
        "Idempotency key was reused with different input.",
        "IDEMPOTENCY_CONFLICT",
      );
    return rowToAccount({
      ...priorCommand,
      customer_name: user.name,
      customer_email: user.email,
    });
  }

  try {
    const rows = await sql<AccountRow[]>`
      INSERT INTO customer_accounts
        (id, user_id, label, account_type, status, primary_currency,
         creation_idempotency_key, creation_fingerprint, created_by, last_edited_by)
      VALUES
        (${`acct_syn_${crypto.randomUUID()}`}, ${user.id}, ${label}, ${accountType}, ${status}, ${primaryCurrency},
         ${idempotencyKey}, ${commandFingerprint}, ${actor.id}, ${actor.id})
      RETURNING id, user_id, label, account_type, status, primary_currency,
                available_minor, ledger_minor, pending_minor, restrictions, created_at, updated_at`;
    const account = rowToAccount({
      ...rows[0],
      customer_name: user.name,
      customer_email: user.email,
    });
    appendAudit({
      event: "customer_account_created",
      adminId: actor.id,
      email: actor.email,
      ip: actor.ip,
      userId: user.id,
      meta: {
        accountId: account.id,
        accountType,
        primaryCurrency,
        status,
        correlationId: actor.correlationId,
        synthetic: true,
      },
    });
    return account;
  } catch (error) {
    const message = String(error).toLowerCase();
    if (
      message.includes(
        "customer_accounts_user_id_account_type_primary_currency",
      )
    )
      throw new CustomerAccountError(
        "That customer account already exists.",
        "ACCOUNT_EXISTS",
      );
    if (message.includes("creation_idempotency_key")) {
      const [existing] = await sql<
        Array<AccountRow & { creation_fingerprint: string }>
      >`
        SELECT id, user_id, label, account_type, status, primary_currency,
               available_minor, ledger_minor, pending_minor, restrictions,
               creation_fingerprint, created_at, updated_at
          FROM customer_accounts WHERE creation_idempotency_key = ${idempotencyKey} LIMIT 1`;
      if (existing && existing.creation_fingerprint !== commandFingerprint)
        throw new CustomerAccountError(
          "Idempotency key was reused with different input.",
          "IDEMPOTENCY_CONFLICT",
        );
      if (existing)
        return rowToAccount({
          ...existing,
          customer_name: user.name,
          customer_email: user.email,
        });
    }
    throw error;
  }
}

export async function updateCustomerAccountControls(
  input: {
    accountId: string;
    status: string;
    restrictions: unknown;
    reason: string;
  },
  actor: AccountActor,
): Promise<CustomerAccount> {
  if (!input.accountId.startsWith("acct_syn_"))
    throw new CustomerAccountError(
      "Only synthetic customer accounts may be controlled here.",
      "SYNTHETIC_ACCOUNT_REQUIRED",
    );
  const status = validateStatus(input.status);
  const restrictions = normalizeRestrictions(input.restrictions);
  const reason = input.reason.trim().slice(0, 240);
  if (reason.length < 10)
    throw new CustomerAccountError(
      "A control reason of at least 10 characters is required.",
      "REASON_REQUIRED",
    );
  const current = (await listCustomerAccounts()).find(
    (item) => item.id === input.accountId,
  );
  if (!current)
    throw new CustomerAccountError(
      "Customer account not found.",
      "ACCOUNT_NOT_FOUND",
    );
  if (current.status === "closed" && status !== "closed")
    throw new CustomerAccountError(
      "A closed account cannot be reopened.",
      "CLOSED_ACCOUNT_IMMUTABLE",
    );

  await appendCriticalAudit({
    event: "customer_account_control_intent",
    adminId: actor.id,
    email: actor.email,
    ip: actor.ip,
    userId: current.userId,
    meta: {
      accountId: current.id,
      previousStatus: current.status,
      status,
      restrictions,
      reason,
      correlationId: actor.correlationId,
      synthetic: true,
    },
  });

  let updated: CustomerAccount;
  if (!isDatabaseConfigured()) {
    updated = {
      ...current,
      status,
      restrictions,
      updatedAt: new Date().toISOString(),
    };
    localAccounts.set(updated.id, updated);
  } else {
    const [row] = await getQueryClient()<AccountRow[]>`
      UPDATE customer_accounts
         SET status = ${status}, restrictions = ${JSON.stringify(restrictions)}::jsonb,
             last_edited_by = ${actor.id}, updated_at = NOW()
       WHERE id = ${current.id}
       RETURNING id, user_id, label, account_type, status, primary_currency,
                 available_minor, ledger_minor, pending_minor, restrictions, created_at, updated_at`;
    updated = rowToAccount({
      ...row,
      customer_name: current.customerName,
      customer_email: current.customerEmail,
    });
  }
  appendAudit({
    event: "customer_account_controls_updated",
    adminId: actor.id,
    email: actor.email,
    ip: actor.ip,
    userId: updated.userId,
    meta: {
      accountId: updated.id,
      status,
      restrictions,
      reason,
      correlationId: actor.correlationId,
      synthetic: true,
    },
  });
  return updated;
}
