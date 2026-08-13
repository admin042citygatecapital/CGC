import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  findUserById: vi.fn(),
  loadAllUsers: vi.fn(),
  appendAudit: vi.fn(),
  appendCriticalAudit: vi.fn(),
}));

vi.mock("../../server/db/db.js", () => ({
  isDatabaseConfigured: () => false,
  getQueryClient: vi.fn(),
}));
vi.mock("../../server/lib/userStore.js", () => ({
  findUserById: dependencies.findUserById,
  loadAllUsers: dependencies.loadAllUsers,
}));
vi.mock("../../server/lib/auditLog.js", () => ({
  appendAudit: dependencies.appendAudit,
  appendCriticalAudit: dependencies.appendCriticalAudit,
}));

import {
  createCustomerAccount,
  listCustomerAccounts,
  resetCustomerAccountsForTests,
} from "../../server/lib/customerAccountStore.js";
import {
  listLocalCustomerSimulationTransactions,
  postCustomerControlledAdjustment,
  postCustomerInternalTransfer,
  resetCustomerSimulationLedgerForTests,
  reverseCustomerSimulationTransaction,
} from "../../server/lib/customerSimulationLedger.js";

const user = {
  id: "usr_ledger_1",
  name: "Ledger Customer",
  email: "ledger@example.test",
};
const admin = {
  id: "superadmin",
  email: "admin@citygate.capital",
  ip: "127.0.0.1",
  correlationId: "ledger-test",
};

beforeEach(() => {
  resetCustomerAccountsForTests();
  resetCustomerSimulationLedgerForTests();
  dependencies.findUserById.mockReset().mockResolvedValue(user);
  dependencies.loadAllUsers.mockReset().mockResolvedValue([user]);
  dependencies.appendAudit.mockReset();
  dependencies.appendCriticalAudit.mockReset().mockResolvedValue(undefined);
});

async function accounts() {
  const source = await createCustomerAccount(
    {
      userId: user.id,
      label: "Everyday",
      accountType: "personal",
      primaryCurrency: "GBP",
      status: "active",
      idempotencyKey: "account-source",
    },
    admin,
  );
  const destination = await createCustomerAccount(
    {
      userId: user.id,
      label: "Savings",
      accountType: "savings",
      primaryCurrency: "GBP",
      status: "active",
      idempotencyKey: "account-destination",
    },
    admin,
  );
  return { source, destination };
}

describe("customer simulation posting engine", () => {
  it("funds and transfers only through balanced synthetic journals", async () => {
    const { source, destination } = await accounts();
    const opening = await postCustomerControlledAdjustment(
      {
        accountId: source.id,
        direction: "credit",
        amount: "100.00",
        reference: "OPEN-1",
        reason: "Synthetic opening funds",
        opening: true,
        idempotencyKey: "opening-1",
      },
      admin,
    );
    expect(opening.kind).toBe("opening_adjustment");
    expect(opening.lines.reduce((sum, line) => sum + line.debitMinor, 0n)).toBe(
      10_000n,
    );
    expect(
      opening.lines.reduce((sum, line) => sum + line.creditMinor, 0n),
    ).toBe(10_000n);

    const transfer = await postCustomerInternalTransfer(
      {
        ownerUserId: user.id,
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amount: "25.50",
        description: "Move to savings",
        idempotencyKey: "transfer-1",
      },
      { ...admin, id: user.id, email: user.email },
    );
    expect(transfer).toMatchObject({
      kind: "internal_transfer",
      currency: "GBP",
      executionSource: "SIMULATION",
      synthetic: true,
    });
    const projected = await listCustomerAccounts({ userId: user.id });
    expect(projected.find((item) => item.id === source.id)?.ledgerMinor).toBe(
      7_450n,
    );
    expect(
      projected.find((item) => item.id === destination.id)?.ledgerMinor,
    ).toBe(2_550n);
  });

  it("replays identical commands and rejects changed idempotent input", async () => {
    const { source } = await accounts();
    const input = {
      accountId: source.id,
      direction: "credit" as const,
      amount: "10.00",
      reference: "ADJ-1",
      reason: "Controlled simulation credit",
      idempotencyKey: "adjustment-key",
    };
    const first = await postCustomerControlledAdjustment(input, admin);
    const repeated = await postCustomerControlledAdjustment(input, admin);
    expect(repeated.id).toBe(first.id);
    await expect(
      postCustomerControlledAdjustment({ ...input, amount: "11.00" }, admin),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(listLocalCustomerSimulationTransactions()).toHaveLength(1);
  });

  it("rejects overdrafts and cross-currency transfers", async () => {
    const { source } = await accounts();
    const eur = await createCustomerAccount(
      {
        userId: user.id,
        label: "Euro",
        accountType: "business",
        primaryCurrency: "EUR",
        status: "active",
        idempotencyKey: "account-eur",
      },
      admin,
    );
    await expect(
      postCustomerInternalTransfer(
        {
          ownerUserId: user.id,
          sourceAccountId: source.id,
          destinationAccountId: eur.id,
          amount: "1.00",
          description: "Wrong currency",
          idempotencyKey: "wrong-currency",
        },
        { ...admin, id: user.id },
      ),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
    await expect(
      postCustomerControlledAdjustment(
        {
          accountId: source.id,
          direction: "debit",
          amount: "1.00",
          reference: "ADJ-OVER",
          reason: "Attempt overdraft",
          idempotencyKey: "overdraft",
        },
        admin,
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });

  it("posts an idempotent balanced reversal and locks the original", async () => {
    const { source, destination } = await accounts();
    await postCustomerControlledAdjustment(
      {
        accountId: source.id,
        direction: "credit",
        amount: "50.00",
        reference: "OPEN-REV",
        reason: "Synthetic reversal test funds",
        opening: true,
        idempotencyKey: "opening-reversal",
      },
      admin,
    );
    const transfer = await postCustomerInternalTransfer(
      {
        ownerUserId: user.id,
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amount: "12.50",
        description: "Transfer to reverse",
        idempotencyKey: "transfer-reversal",
      },
      { ...admin, id: user.id, email: user.email },
    );
    const reversalInput = {
      transactionId: transfer.id,
      reason: "Customer requested correction",
      idempotencyKey: "reverse-transfer",
    };
    const reversal = await reverseCustomerSimulationTransaction(reversalInput, admin);
    const replay = await reverseCustomerSimulationTransaction(reversalInput, admin);
    expect(replay.id).toBe(reversal.id);
    expect(reversal.kind).toBe("reversal");
    expect(reversal.reversesId).toBe(transfer.id);
    expect(reversal.lines.reduce((sum, line) => sum + line.debitMinor, 0n)).toBe(1_250n);
    expect(reversal.lines.reduce((sum, line) => sum + line.creditMinor, 0n)).toBe(1_250n);
    const projected = await listCustomerAccounts({ userId: user.id });
    expect(projected.find((item) => item.id === source.id)?.ledgerMinor).toBe(5_000n);
    expect(projected.find((item) => item.id === destination.id)?.ledgerMinor).toBe(0n);
    expect(listLocalCustomerSimulationTransactions().find((item) => item.id === transfer.id)?.status).toBe("reversed");
  });
});
