import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("customer account surfaces", () => {
  it("routes customers and the single admin control plane to the controlled account registry", () => {
    const routes = readFileSync("src/routes.tsx", "utf8");
    expect(routes).toMatch(
      /path: ['"]\/dashboard\/accounts['"][\s\S]{0,120}<DashboardAccounts \/>/,
    );
    expect(routes).toMatch(
      /path: ['"]\/admin\/accounts['"][\s\S]{0,120}<AdminCustomerAccounts \/>/,
    );
    expect(routes).toMatch(
      /path: ['"]\/admin\/banking['"][\s\S]{0,120}<AdminCustomerAccounts \/>/,
    );
    expect(routes).not.toContain("<AdminBanking />");
  });

  it("keeps account balances synthetic, zero-initialized, and outside admin mutation APIs", () => {
    const migration = readFileSync(
      "src/server/db/migrations/0029_customer_account_registry.sql",
      "utf8",
    );
    expect(migration).toMatch(/available_minor bigint NOT NULL DEFAULT 0/i);
    expect(migration).toMatch(/ledger_minor bigint NOT NULL DEFAULT 0/i);
    expect(migration).toMatch(/pending_minor bigint NOT NULL DEFAULT 0/i);
    expect(migration).toMatch(/CHECK \(synthetic IS TRUE\)/i);
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE customer_accounts FROM PUBLIC/i,
    );

    const adminApi = readFileSync(
      "src/server/api/admin/customer-accounts/POST.ts",
      "utf8",
    );
    expect(adminApi).not.toMatch(/availableMinor|ledgerMinor|pendingMinor/);
    expect(adminApi).not.toMatch(/balance\s*:/i);
    expect(adminApi).toContain('action === "update_controls"');
  });

  it("derives customer ownership from the authenticated server session", () => {
    const customerApi = readFileSync(
      "src/server/api/users/accounts/GET.ts",
      "utf8",
    );
    expect(customerApi).toContain("const user = req.customerUser");
    expect(customerApi).toContain("userId: user.id");
    expect(customerApi).not.toContain("req.query.userId");
    expect(customerApi).toContain("balancesAuthoritative: false");
  });
});
