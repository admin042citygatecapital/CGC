import crypto from "node:crypto";
import { getQueryClient, isDatabaseConfigured } from "../db/db.js";
import { appendAuditEntry, appendCriticalAudit } from "./auditLog.js";
import {
  SANDBOX_ASSETS,
  type SandboxActor,
  type SandboxAsset,
} from "./financialSandbox.js";

export const MONEY_MOVEMENT_RAILS = [
  "p2p",
  "ach",
  "wire",
  "rtp",
  "fednow",
  "mobile_check_deposit",
  "direct_deposit",
  "withdrawal",
  "scheduled_payment",
  "recurring_payment",
  "card",
  "bill_pay",
] as const;

export type MoneyMovementRail = (typeof MONEY_MOVEMENT_RAILS)[number];
export type MoneyMovementDirection = "inbound" | "outbound" | "internal";
export type MoneyMovementStatus =
  | "pending_approval"
  | "scheduled"
  | "queued"
  | "processing"
  | "settled"
  | "returned"
  | "failed"
  | "cancelled";

export interface MoneyMovementInstruction {
  id: string;
  reference: string;
  rail: MoneyMovementRail;
  direction: MoneyMovementDirection;
  status: MoneyMovementStatus;
  asset: SandboxAsset;
  amountMinor: bigint;
  sourceReference: string;
  destinationReference: string;
  memo: string;
  scheduledFor?: string;
  recurrence?: "daily" | "weekly" | "monthly";
  providerAdapterState: "DISCONNECTED";
  executionSource: "SIMULATION";
  synthetic: true;
  createdAt: string;
  updatedAt: string;
}

export interface MoneyMovementEvent {
  id: string;
  instructionId: string;
  fromStatus?: MoneyMovementStatus;
  toStatus: MoneyMovementStatus;
  reason: string;
  correlationId: string;
  actorId: string;
  createdAt: string;
}

export class MoneyMovementSimulationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

const TRANSITIONS: Readonly<
  Record<MoneyMovementStatus, readonly MoneyMovementStatus[]>
> = {
  pending_approval: ["scheduled", "queued", "cancelled"],
  scheduled: ["queued", "cancelled"],
  queued: ["processing", "cancelled", "failed"],
  processing: ["settled", "returned", "failed"],
  settled: ["returned"],
  returned: [],
  failed: [],
  cancelled: [],
};

const localInstructions = new Map<string, MoneyMovementInstruction>();
const localEvents: MoneyMovementEvent[] = [];
const localCommands = new Map<
  string,
  { fingerprint: string; resultId: string }
>();
const CRYPTO_ASSETS = new Set<SandboxAsset>(["BTC", "ETH", "USDT"]);

function databaseRequired(): boolean {
  return process.env.NODE_ENV === "production" || isDatabaseConfigured();
}

function requireKey(value: string): string {
  const key = value.trim();
  if (!key || key.length > 160)
    throw new MoneyMovementSimulationError(
      "A valid idempotency key is required.",
      "IDEMPOTENCY_REQUIRED",
    );
  return key;
}

function requireText(value: string, label: string, max = 240): string {
  const text = value.trim().replace(/\s+/g, " ").slice(0, max);
  if (text.length < 3)
    throw new MoneyMovementSimulationError(
      `${label} is required.`,
      "INVALID_INPUT",
    );
  return text;
}

function requireSyntheticReference(value: string, label: string): string {
  const reference = value.trim().slice(0, 80);
  if (!/^(syn|sim)_[a-zA-Z0-9:_-]{3,76}$/.test(reference))
    throw new MoneyMovementSimulationError(
      `${label} must be an opaque synthetic reference beginning with syn_ or sim_.`,
      "SYNTHETIC_REFERENCE_REQUIRED",
    );
  return reference;
}

function amountToMinor(value: string | number, asset: SandboxAsset): bigint {
  const normalized = String(value).trim();
  const decimals = CRYPTO_ASSETS.has(asset) ? 8 : 2;
  if (!new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(normalized))
    throw new MoneyMovementSimulationError(
      `Amount must be positive with no more than ${decimals} decimal places.`,
      "INVALID_AMOUNT",
    );
  const [whole, fraction = ""] = normalized.split(".");
  const minor =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals));
  if (minor <= 0n)
    throw new MoneyMovementSimulationError(
      "Amount must be greater than zero.",
      "INVALID_AMOUNT",
    );
  return minor;
}

function digest(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function initialStatus(scheduledFor?: string): MoneyMovementStatus {
  return scheduledFor ? "scheduled" : "pending_approval";
}

function normalizeScheduledFor(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
    throw new MoneyMovementSimulationError(
      "Scheduled time must be a valid future date.",
      "INVALID_SCHEDULE",
    );
  return date.toISOString();
}

function normalizeCreate(input: {
  rail: string;
  direction: string;
  asset: string;
  amount: string | number;
  sourceReference: string;
  destinationReference: string;
  memo: string;
  scheduledFor?: string;
  recurrence?: string;
}) {
  if (!MONEY_MOVEMENT_RAILS.includes(input.rail as MoneyMovementRail))
    throw new MoneyMovementSimulationError(
      "Unsupported simulated payment rail.",
      "INVALID_RAIL",
    );
  if (!["inbound", "outbound", "internal"].includes(input.direction))
    throw new MoneyMovementSimulationError(
      "Invalid instruction direction.",
      "INVALID_DIRECTION",
    );
  if (!SANDBOX_ASSETS.includes(input.asset as SandboxAsset))
    throw new MoneyMovementSimulationError(
      "Unsupported instruction asset.",
      "INVALID_ASSET",
    );
  const rail = input.rail as MoneyMovementRail;
  const recurrence = input.recurrence?.trim() || undefined;
  if (recurrence && !["daily", "weekly", "monthly"].includes(recurrence))
    throw new MoneyMovementSimulationError(
      "Invalid recurrence interval.",
      "INVALID_RECURRENCE",
    );
  if (rail === "recurring_payment" && !recurrence)
    throw new MoneyMovementSimulationError(
      "Recurring payments require an interval.",
      "INVALID_RECURRENCE",
    );
  return {
    rail,
    direction: input.direction as MoneyMovementDirection,
    asset: input.asset as SandboxAsset,
    amountMinor: amountToMinor(input.amount, input.asset as SandboxAsset),
    sourceReference: requireSyntheticReference(
      input.sourceReference,
      "Source reference",
    ),
    destinationReference: requireSyntheticReference(
      input.destinationReference,
      "Destination reference",
    ),
    memo: requireText(input.memo, "Instruction memo"),
    scheduledFor: normalizeScheduledFor(input.scheduledFor),
    recurrence: recurrence as "daily" | "weekly" | "monthly" | undefined,
  };
}

type InstructionRow = {
  id: string;
  reference: string;
  rail: MoneyMovementRail;
  direction: MoneyMovementDirection;
  status: MoneyMovementStatus;
  asset: SandboxAsset;
  amount_minor: string;
  source_reference: string;
  destination_reference: string;
  memo: string;
  scheduled_for: Date | string | null;
  recurrence: "daily" | "weekly" | "monthly" | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function fromRow(row: InstructionRow): MoneyMovementInstruction {
  return {
    id: row.id,
    reference: row.reference,
    rail: row.rail,
    direction: row.direction,
    status: row.status,
    asset: row.asset,
    amountMinor: BigInt(row.amount_minor),
    sourceReference: row.source_reference,
    destinationReference: row.destination_reference,
    memo: row.memo,
    scheduledFor: row.scheduled_for
      ? new Date(row.scheduled_for).toISOString()
      : undefined,
    recurrence: row.recurrence ?? undefined,
    providerAdapterState: "DISCONNECTED",
    executionSource: "SIMULATION",
    synthetic: true,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function audit(
  actor: SandboxActor,
  action: string,
  item: MoneyMovementInstruction,
  details: Record<string, unknown>,
) {
  await appendAuditEntry({
    adminId: actor.id,
    adminEmail: actor.email,
    action,
    target: "money-movement-simulation",
    targetId: item.id,
    ip: actor.ip,
    details: {
      ...details,
      reference: item.reference,
      rail: item.rail,
      synthetic: true,
      executionSource: "SIMULATION",
      providerAdapterState: "DISCONNECTED",
      correlationId: actor.correlationId,
    },
  });
}

async function listDatabase(input: {
  status?: string;
  rail?: string;
  limit?: number;
}) {
  const status = input.status?.trim() ?? "";
  const rail = input.rail?.trim() ?? "";
  const limit = Math.min(500, Math.max(1, input.limit ?? 100));
  const rows = await getQueryClient()<InstructionRow[]>`
    SELECT id, reference, rail, direction, status, asset, amount_minor::text,
           source_reference, destination_reference, memo, scheduled_for, recurrence,
           created_at, updated_at
      FROM money_movement_simulation_instructions
     WHERE synthetic IS TRUE
       AND (${status} = '' OR status = ${status})
       AND (${rail} = '' OR rail = ${rail})
     ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map(fromRow);
}

export const moneyMovementSimulation = {
  async list(
    input: { status?: string; rail?: string; limit?: number } = {},
  ): Promise<MoneyMovementInstruction[]> {
    if (databaseRequired()) return listDatabase(input);
    return [...localInstructions.values()]
      .filter((item) => !input.status || item.status === input.status)
      .filter((item) => !input.rail || item.rail === input.rail)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, input.limit ?? 100);
  },

  async create(
    input: {
      rail: string;
      direction: string;
      asset: string;
      amount: string | number;
      sourceReference: string;
      destinationReference: string;
      memo: string;
      scheduledFor?: string;
      recurrence?: string;
      idempotencyKey: string;
    },
    actor: SandboxActor,
  ): Promise<MoneyMovementInstruction> {
    const normalized = normalizeCreate(input);
    const key = requireKey(input.idempotencyKey);
    const scope = `admin:${actor.id}`;
    const fingerprint = digest({
      action: "create",
      ...normalized,
      amountMinor: normalized.amountMinor.toString(),
    });
    await appendCriticalAudit({
      event: "money_movement_simulation_create_intent",
      adminId: actor.id,
      email: actor.email,
      ip: actor.ip,
      meta: {
        rail: normalized.rail,
        asset: normalized.asset,
        amountMinor: normalized.amountMinor.toString(),
        synthetic: true,
        correlationId: actor.correlationId,
      },
    });
    if (!databaseRequired()) {
      const commandKey = `${scope}:${key}`;
      const prior = localCommands.get(commandKey);
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new MoneyMovementSimulationError(
            "Idempotency key was reused with different input.",
            "IDEMPOTENCY_CONFLICT",
          );
        return localInstructions.get(prior.resultId)!;
      }
      const now = new Date().toISOString();
      const item: MoneyMovementInstruction = {
        id: `syn_rail_${crypto.randomUUID()}`,
        reference: `SYN-RAIL-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        ...normalized,
        status: initialStatus(normalized.scheduledFor),
        providerAdapterState: "DISCONNECTED",
        executionSource: "SIMULATION",
        synthetic: true,
        createdAt: now,
        updatedAt: now,
      };
      localInstructions.set(item.id, item);
      localCommands.set(commandKey, { fingerprint, resultId: item.id });
      localEvents.push({
        id: `syn_rail_event_${crypto.randomUUID()}`,
        instructionId: item.id,
        toStatus: item.status,
        reason: "Instruction created",
        correlationId: actor.correlationId,
        actorId: actor.id,
        createdAt: now,
      });
      await audit(actor, "money_movement_simulation_created", item, {
        status: item.status,
      });
      return item;
    }
    const sql = getQueryClient();
    const resultId = await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${scope}), hashtext(${key}))`;
      const [prior] = await tx<
        Array<{ fingerprint: string; result_id: string }>
      >`SELECT fingerprint, result_id FROM money_movement_simulation_commands WHERE actor_scope = ${scope} AND idempotency_key = ${key}`;
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new MoneyMovementSimulationError(
            "Idempotency key was reused with different input.",
            "IDEMPOTENCY_CONFLICT",
          );
        return prior.result_id;
      }
      const id = `syn_rail_${crypto.randomUUID()}`;
      const reference = `SYN-RAIL-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
      const status = initialStatus(normalized.scheduledFor);
      await tx`INSERT INTO money_movement_simulation_instructions
        (id, reference, rail, direction, status, asset, amount_minor, source_reference,
         destination_reference, memo, scheduled_for, recurrence, created_by)
        VALUES (${id}, ${reference}, ${normalized.rail}, ${normalized.direction}, ${status},
          ${normalized.asset}, ${normalized.amountMinor.toString()}, ${normalized.sourceReference},
          ${normalized.destinationReference}, ${normalized.memo}, ${normalized.scheduledFor ?? null},
          ${normalized.recurrence ?? null}, ${actor.id})`;
      await tx`INSERT INTO money_movement_simulation_events
        (id, instruction_id, from_status, to_status, reason, request_correlation_id, actor_id)
        VALUES (${`syn_rail_event_${crypto.randomUUID()}`}, ${id}, NULL, ${status},
          'Instruction created', ${actor.correlationId}, ${actor.id})`;
      await tx`INSERT INTO money_movement_simulation_commands
        (actor_scope, idempotency_key, fingerprint, action, result_id)
        VALUES (${scope}, ${key}, ${fingerprint}, 'create', ${id})`;
      return id;
    });
    const [item] = (await listDatabase({ limit: 500 })).filter(
      (value) => value.id === resultId,
    );
    if (!item)
      throw new MoneyMovementSimulationError(
        "Simulation instruction was not found after creation.",
        "INSTRUCTION_NOT_FOUND",
      );
    await audit(actor, "money_movement_simulation_created", item, {
      status: item.status,
    });
    return item;
  },

  async transition(
    input: {
      instructionId: string;
      toStatus: string;
      reason: string;
      idempotencyKey: string;
    },
    actor: SandboxActor,
  ): Promise<MoneyMovementInstruction> {
    if (!input.instructionId.startsWith("syn_rail_"))
      throw new MoneyMovementSimulationError(
        "Only synthetic rail instructions are permitted.",
        "SYNTHETIC_REFERENCE_REQUIRED",
      );
    const toStatus = input.toStatus as MoneyMovementStatus;
    if (!(toStatus in TRANSITIONS))
      throw new MoneyMovementSimulationError(
        "Unsupported instruction status.",
        "INVALID_STATUS",
      );
    const reason = requireText(input.reason, "Transition reason");
    const key = requireKey(input.idempotencyKey);
    const scope = `admin:${actor.id}`;
    const fingerprint = digest({
      action: "transition",
      instructionId: input.instructionId,
      toStatus,
      reason,
    });
    await appendCriticalAudit({
      event: "money_movement_simulation_transition_intent",
      adminId: actor.id,
      email: actor.email,
      ip: actor.ip,
      meta: {
        instructionId: input.instructionId,
        toStatus,
        reason,
        synthetic: true,
        correlationId: actor.correlationId,
      },
    });
    if (!databaseRequired()) {
      const commandKey = `${scope}:${key}`;
      const prior = localCommands.get(commandKey);
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new MoneyMovementSimulationError(
            "Idempotency key was reused with different input.",
            "IDEMPOTENCY_CONFLICT",
          );
        return localInstructions.get(prior.resultId)!;
      }
      const item = localInstructions.get(input.instructionId);
      if (!item)
        throw new MoneyMovementSimulationError(
          "Synthetic rail instruction not found.",
          "INSTRUCTION_NOT_FOUND",
        );
      if (!TRANSITIONS[item.status].includes(toStatus))
        throw new MoneyMovementSimulationError(
          `Transition from ${item.status} to ${toStatus} is not allowed.`,
          "INVALID_TRANSITION",
        );
      const fromStatus = item.status;
      item.status = toStatus;
      item.updatedAt = new Date().toISOString();
      localCommands.set(commandKey, { fingerprint, resultId: item.id });
      localEvents.push({
        id: `syn_rail_event_${crypto.randomUUID()}`,
        instructionId: item.id,
        fromStatus,
        toStatus,
        reason,
        correlationId: actor.correlationId,
        actorId: actor.id,
        createdAt: item.updatedAt,
      });
      await audit(actor, "money_movement_simulation_transitioned", item, {
        fromStatus,
        toStatus,
        reason,
      });
      return item;
    }
    const sql = getQueryClient();
    const resultId = await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${scope}), hashtext(${key}))`;
      const [prior] = await tx<
        Array<{ fingerprint: string; result_id: string }>
      >`SELECT fingerprint, result_id FROM money_movement_simulation_commands WHERE actor_scope = ${scope} AND idempotency_key = ${key}`;
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new MoneyMovementSimulationError(
            "Idempotency key was reused with different input.",
            "IDEMPOTENCY_CONFLICT",
          );
        return prior.result_id;
      }
      const [row] = await tx<
        Array<{ status: MoneyMovementStatus }>
      >`SELECT status FROM money_movement_simulation_instructions WHERE id = ${input.instructionId} AND synthetic IS TRUE FOR UPDATE`;
      if (!row)
        throw new MoneyMovementSimulationError(
          "Synthetic rail instruction not found.",
          "INSTRUCTION_NOT_FOUND",
        );
      if (!TRANSITIONS[row.status].includes(toStatus))
        throw new MoneyMovementSimulationError(
          `Transition from ${row.status} to ${toStatus} is not allowed.`,
          "INVALID_TRANSITION",
        );
      await tx`UPDATE money_movement_simulation_instructions SET status = ${toStatus}, updated_at = NOW() WHERE id = ${input.instructionId}`;
      await tx`INSERT INTO money_movement_simulation_events
        (id, instruction_id, from_status, to_status, reason, request_correlation_id, actor_id)
        VALUES (${`syn_rail_event_${crypto.randomUUID()}`}, ${input.instructionId}, ${row.status}, ${toStatus}, ${reason}, ${actor.correlationId}, ${actor.id})`;
      await tx`INSERT INTO money_movement_simulation_commands
        (actor_scope, idempotency_key, fingerprint, action, result_id)
        VALUES (${scope}, ${key}, ${fingerprint}, 'transition', ${input.instructionId})`;
      return input.instructionId;
    });
    const [item] = (await listDatabase({ limit: 500 })).filter(
      (value) => value.id === resultId,
    );
    if (!item)
      throw new MoneyMovementSimulationError(
        "Simulation instruction was not found after transition.",
        "INSTRUCTION_NOT_FOUND",
      );
    await audit(actor, "money_movement_simulation_transitioned", item, {
      toStatus,
      reason,
    });
    return item;
  },

  listLocalEvents(): MoneyMovementEvent[] {
    if (databaseRequired())
      throw new MoneyMovementSimulationError(
        "Local events are unavailable in database mode.",
        "LOCAL_ONLY",
      );
    return [...localEvents];
  },

  resetForTests(): void {
    if (process.env.NODE_ENV !== "test")
      throw new MoneyMovementSimulationError(
        "Test reset is unavailable outside test mode.",
        "TEST_ONLY",
      );
    localInstructions.clear();
    localEvents.length = 0;
    localCommands.clear();
  },
};
