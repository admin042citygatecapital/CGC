import { beforeEach, describe, expect, it, vi } from "vitest";

const audit = vi.hoisted(() => ({
  appendAuditEntry: vi.fn(),
  appendCriticalAudit: vi.fn(),
}));
vi.mock("../../server/db/db.js", () => ({
  isDatabaseConfigured: () => false,
  getQueryClient: vi.fn(),
}));
vi.mock("../../server/lib/auditLog.js", () => audit);

import {
  moneyMovementSimulation,
  MoneyMovementSimulationError,
} from "../../server/lib/moneyMovementSimulation.js";

const actor = {
  id: "superadmin",
  email: "admin@citygate.capital",
  ip: "127.0.0.1",
  correlationId: "rail-test",
};

beforeEach(() => {
  moneyMovementSimulation.resetForTests();
  audit.appendAuditEntry.mockReset().mockResolvedValue(undefined);
  audit.appendCriticalAudit.mockReset().mockResolvedValue(undefined);
});

describe("provider-neutral money-movement simulation", () => {
  it("creates an idempotent disconnected ACH instruction", async () => {
    const input = {
      rail: "ach",
      direction: "outbound",
      asset: "USD",
      amount: "125.50",
      sourceReference: "syn_customer_001",
      destinationReference: "syn_counterparty_001",
      memo: "Synthetic supplier payment",
      idempotencyKey: "ach-command-1",
    };
    const first = await moneyMovementSimulation.create(input, actor);
    const replay = await moneyMovementSimulation.create(input, actor);
    expect(replay.id).toBe(first.id);
    expect(first).toMatchObject({
      rail: "ach",
      status: "pending_approval",
      amountMinor: 12_550n,
      providerAdapterState: "DISCONNECTED",
      executionSource: "SIMULATION",
      synthetic: true,
    });
    expect(moneyMovementSimulation.listLocalEvents()).toHaveLength(1);
    expect(audit.appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ target: "money-movement-simulation" }),
    );
  });

  it("enforces the instruction lifecycle and records immutable events", async () => {
    const item = await moneyMovementSimulation.create(
      {
        rail: "fednow",
        direction: "outbound",
        asset: "USD",
        amount: "10.00",
        sourceReference: "syn_source_001",
        destinationReference: "syn_destination_001",
        memo: "Synthetic immediate payment",
        idempotencyKey: "fednow-create",
      },
      actor,
    );
    for (const [toStatus, idempotencyKey] of [
      ["queued", "fednow-queue"],
      ["processing", "fednow-process"],
      ["settled", "fednow-settle"],
      ["returned", "fednow-return"],
    ] as const) {
      await moneyMovementSimulation.transition(
        {
          instructionId: item.id,
          toStatus,
          reason: `Move to ${toStatus}`,
          idempotencyKey,
        },
        actor,
      );
    }
    expect((await moneyMovementSimulation.list())[0]?.status).toBe("returned");
    expect(
      moneyMovementSimulation.listLocalEvents().map((event) => event.toStatus),
    ).toEqual([
      "pending_approval",
      "queued",
      "processing",
      "settled",
      "returned",
    ]);
    await expect(
      moneyMovementSimulation.transition(
        {
          instructionId: item.id,
          toStatus: "processing",
          reason: "Invalid restart",
          idempotencyKey: "invalid-restart",
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("rejects real-looking references and incomplete recurring instructions", async () => {
    const base = {
      rail: "recurring_payment",
      direction: "outbound",
      asset: "GBP",
      amount: "20.00",
      sourceReference: "12345678",
      destinationReference: "syn_biller_001",
      memo: "Monthly synthetic bill",
      idempotencyKey: "recurring-invalid",
    };
    await expect(
      moneyMovementSimulation.create(base, actor),
    ).rejects.toBeInstanceOf(MoneyMovementSimulationError);
    await expect(
      moneyMovementSimulation.create(
        { ...base, sourceReference: "syn_source_001" },
        actor,
      ),
    ).rejects.toMatchObject({ code: "INVALID_RECURRENCE" });
  });
});
