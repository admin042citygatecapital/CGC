import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("customer transfer simulation surface", () => {
  it("uses only authenticated customer ownership and the simulation posting engine", () => {
    const post = readFileSync("src/server/api/users/transfers/POST.ts", "utf8");
    expect(post).toContain("const user = req.customerUser");
    expect(post).toContain("ownerUserId: user.id");
    expect(post).toContain("postCustomerInternalTransfer");
    expect(post).toContain('executionSource: "SIMULATION"');
    expect(post).not.toMatch(/executeDebitOperation|createTransaction|requireFinancialOperations/);
    const executable = post.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(executable).not.toMatch(/recipientAccount|recipientBank|provider|iban|routing/i);
  });

  it("reads only the authenticated customer's simulation history", () => {
    const get = readFileSync("src/server/api/users/transfers/GET.ts", "utf8");
    expect(get).toContain("ownerUserId: user.id");
    expect(get).toContain("listCustomerSimulationTransactions");
    expect(get).not.toContain("getTransactionsForUser");
  });

  it("exposes controlled journal adjustments only through the single admin account route", () => {
    const admin = readFileSync("src/server/api/admin/customer-accounts/POST.ts", "utf8");
    const page = readFileSync("src/pages/admin/customer-accounts.tsx", "utf8");
    expect(admin).toContain('action === "adjust"');
    expect(admin).toContain("postCustomerControlledAdjustment");
    expect(page).toContain("Controlled ledger adjustment");
    expect(page).toContain("balanced simulation");
  });
});
