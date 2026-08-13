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
  CustomerAccountError,
  listCustomerAccounts,
  listPlatformCurrencies,
  resetCustomerAccountsForTests,
  updateCustomerAccountControls,
} from "../../server/lib/customerAccountStore.js";

const user = {
  id: "usr_customer_1",
  name: "Customer One",
  email: "one@example.test",
};
const actor = {
  id: "superadmin",
  email: "admin@citygate.capital",
  ip: "127.0.0.1",
  correlationId: "test-correlation",
};

beforeEach(() => {
  resetCustomerAccountsForTests();
  dependencies.findUserById.mockReset().mockResolvedValue(user);
  dependencies.loadAllUsers.mockReset().mockResolvedValue([user]);
  dependencies.appendAudit.mockReset();
  dependencies.appendCriticalAudit.mockReset().mockResolvedValue(undefined);
});

describe("customer account registry", () => {
  it("serves account currencies from a single configured catalogue", async () => {
    const currencies = await listPlatformCurrencies();
    expect(currencies.map((item) => item.code)).toEqual([
      "GBP",
      "EUR",
      "USD",
      "CAD",
      "AUD",
      "CHF",
    ]);
    expect(currencies.every((item) => item.active)).toBe(true);
  });

  it("creates an owned synthetic account with immutable zero balances and audit events", async () => {
    const account = await createCustomerAccount(
      {
        userId: user.id,
        label: "Everyday GBP",
        accountType: "personal",
        primaryCurrency: "GBP",
        status: "active",
        idempotencyKey: "create-account-1",
      },
      actor,
    );
    expect(account).toMatchObject({
      userId: user.id,
      primaryCurrency: "GBP",
      status: "active",
      synthetic: true,
    });
    expect(account.id).toMatch(/^acct_syn_/);
    expect([
      account.availableMinor,
      account.ledgerMinor,
      account.pendingMinor,
    ]).toEqual([0n, 0n, 0n]);
    expect(dependencies.appendCriticalAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "customer_account_create_intent",
        userId: user.id,
      }),
    );
    expect(dependencies.appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "customer_account_created",
        userId: user.id,
      }),
    );
  });

  it("returns the original result for the same idempotent command and rejects a changed command", async () => {
    const first = await createCustomerAccount(
      {
        userId: user.id,
        label: "Savings GBP",
        accountType: "savings",
        primaryCurrency: "GBP",
        idempotencyKey: "same-key",
      },
      actor,
    );
    const repeated = await createCustomerAccount(
      {
        userId: user.id,
        label: "Savings GBP",
        accountType: "savings",
        primaryCurrency: "GBP",
        idempotencyKey: "same-key",
      },
      actor,
    );
    expect(repeated.id).toBe(first.id);
    await expect(
      createCustomerAccount(
        {
          userId: user.id,
          label: "Changed label",
          accountType: "savings",
          primaryCurrency: "GBP",
          idempotencyKey: "same-key",
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("filters strictly by authenticated customer ownership", async () => {
    await createCustomerAccount(
      {
        userId: user.id,
        label: "Customer One",
        accountType: "personal",
        primaryCurrency: "USD",
        idempotencyKey: "owner-one",
      },
      actor,
    );
    dependencies.findUserById.mockResolvedValue({
      id: "usr_customer_2",
      name: "Customer Two",
      email: "two@example.test",
    });
    dependencies.loadAllUsers.mockResolvedValue([
      user,
      { id: "usr_customer_2", name: "Customer Two", email: "two@example.test" },
    ]);
    await createCustomerAccount(
      {
        userId: "usr_customer_2",
        label: "Customer Two",
        accountType: "personal",
        primaryCurrency: "EUR",
        idempotencyKey: "owner-two",
      },
      actor,
    );
    const firstCustomer = await listCustomerAccounts({ userId: user.id });
    expect(firstCustomer).toHaveLength(1);
    expect(firstCustomer[0].userId).toBe(user.id);
  });

  it("requires a reason for restrictions and prevents reopening a closed account", async () => {
    const account = await createCustomerAccount(
      {
        userId: user.id,
        label: "Controlled",
        accountType: "business",
        primaryCurrency: "CHF",
        idempotencyKey: "controlled-account",
      },
      actor,
    );
    await expect(
      updateCustomerAccountControls(
        {
          accountId: account.id,
          status: "restricted",
          restrictions: ["transfers_disabled"],
          reason: "short",
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    const closed = await updateCustomerAccountControls(
      {
        accountId: account.id,
        status: "closed",
        restrictions: ["transfers_disabled"],
        reason: "Customer requested account closure",
      },
      actor,
    );
    expect(closed.status).toBe("closed");
    await expect(
      updateCustomerAccountControls(
        {
          accountId: account.id,
          status: "active",
          restrictions: [],
          reason: "Attempt to reopen closed account",
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: "CLOSED_ACCOUNT_IMMUTABLE" });
  });

  it("rejects currencies outside the configured database catalogue", async () => {
    await expect(
      createCustomerAccount(
        {
          userId: user.id,
          label: "Unsupported",
          accountType: "personal",
          primaryCurrency: "XYZ",
          idempotencyKey: "bad-currency",
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(CustomerAccountError);
  });
});
