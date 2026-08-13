import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  FinancialSandbox,
  type SandboxAudit,
} from "../../server/lib/financialSandbox.js";
import { allowedRolesForAdminRequest } from "../../server/lib/adminAuthorizationMiddleware.js";

const actor = {
  id: "admin-super",
  email: "admin@citygate.capital",
  correlationId: "corr-test",
};

async function fundedSandbox() {
  const audits: SandboxAudit[] = [];
  const sandbox = new FinancialSandbox(async (event) => {
    audits.push(event);
  });
  const source = await sandbox.createAccount(
    { name: "Treasury rehearsal", type: "business", asset: "GBP" },
    actor,
  );
  const destination = await sandbox.createAccount(
    { name: "Customer rehearsal", type: "personal", asset: "GBP" },
    actor,
  );
  await sandbox.adjust(
    {
      accountId: source.id,
      amount: "100.00",
      direction: "credit",
      reason: "Opening synthetic balance",
      reference: "OPEN-001",
      confirmed: true,
      idempotencyKey: "idem-open",
    },
    actor,
  );
  return { sandbox, audits, source, destination };
}

describe("financial administration sandbox", () => {
  it("keeps the API behind the single super-administrator policy", () => {
    expect(allowedRolesForAdminRequest("/financial-sandbox", "GET")).toEqual(
      [],
    );
    expect(allowedRolesForAdminRequest("/financial-sandbox", "POST")).toEqual(
      [],
    );
  });

  it("persists only synthetic accounts, transactions and balanced immutable journals", () => {
    const migration = readFileSync(
      "src/server/db/migrations/0028_financial_sandbox_ledger.sql",
      "utf8",
    );
    const store = readFileSync(
      "src/server/lib/financialSandboxDatabase.ts",
      "utf8",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS financial_sandbox_accounts",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS financial_sandbox_transactions",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS financial_sandbox_journal_entries",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS financial_sandbox_journal_lines",
    );
    expect(migration).toContain("CHECK (synthetic IS TRUE)");
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(migration).toContain("Synthetic journal records are immutable");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE financial_sandbox_accounts FROM PUBLIC",
    );
    expect(store).toMatch(/executionSource:\s*["']SIMULATION["']/);
    expect(store).not.toContain("UPDATE users");
  });

  it("provides idempotent mock, cancellation, adjustment and reversal commands", () => {
    const migration = readFileSync(
      "src/server/db/migrations/0028_financial_sandbox_ledger.sql",
      "utf8",
    );
    const api = readFileSync(
      "src/server/api/admin/financial-sandbox/POST.ts",
      "utf8",
    );
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS financial_sandbox_commands",
    );
    expect(api).toMatch(/action === ["']mock_transaction["']/);
    expect(api).toMatch(/action === ["']cancel["']/);
    expect(api).toMatch(/action === ["']reverse["']/);
    expect(api).toMatch(/action === ["']adjust["']/);
  });

  it("supports a local simulation without allowing a production database fallback", () => {
    const store = readFileSync(
      "src/server/lib/financialSandboxStore.ts",
      "utf8",
    );
    expect(store).toContain("process.env.NODE_ENV === 'production'");
    expect(store).toContain("databaseFinancialSandbox");
    expect(store).toContain("localFinancialSandbox");
    expect(store).toContain("localDevelopment: true");
    expect(store).not.toContain(
      "process.env.NODE_ENV === 'production' ? localFinancialSandbox",
    );
  });

  it("exposes the final super-admin interface and navigation entry", () => {
    expect(readFileSync("src/layouts/AdminLayout.tsx", "utf8")).toContain(
      "href: '/admin/financial-sandbox'",
    );
    const page = readFileSync("src/pages/admin/financial-sandbox.tsx", "utf8");
    expect(page).toContain("Pending mock transaction");
    expect(page).toContain("Cancel mock transaction");
    expect(page).toContain("Controlled reversal");
    expect(page).toContain("Banking skills map");
    expect(page).toContain("Double-entry journal");
    expect(page).toContain("Journal integrity breaks");
  });

  it("publishes one provider-neutral capability map without enabling external execution", () => {
    const capabilityMap = readFileSync(
      "src/server/lib/financialCapabilityMap.ts",
      "utf8",
    );
    const getRoute = readFileSync(
      "src/server/api/admin/financial-sandbox/GET.ts",
      "utf8",
    );
    expect(capabilityMap).toMatch(/key:\s*["']internal_transfer["']/);
    expect(capabilityMap).toMatch(/key:\s*["']crypto_transfer["']/);
    expect(capabilityMap).toMatch(/key:\s*["']binance_market_data["']/);
    expect(capabilityMap).toMatch(/key:\s*["']alpaca_market_data["']/);
    expect(capabilityMap).toMatch(/key:\s*["']financial_datasets["']/);
    expect(capabilityMap).toMatch(/status:\s*["']adapter_required["']/);
    expect(capabilityMap).not.toContain("placeOrder");
    expect(capabilityMap).not.toMatch(/function\s+withdraw|withdraw\s*\(/);
    expect(getRoute).toContain("FINANCIAL_CAPABILITY_MAP");
    expect(getRoute).toContain("getOverview");
    expect(getRoute).toContain("getTransaction");
  });

  it("creates balanced double-entry lines and moves only synthetic balances", async () => {
    const { sandbox, source, destination } = await fundedSandbox();
    const transaction = await sandbox.transfer(
      {
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amount: "25.50",
        reason: "Synthetic transfer",
        idempotencyKey: "idem-transfer",
      },
      actor,
    );
    expect(transaction.synthetic).toBe(true);
    expect(transaction.executionSource).toBe("SIMULATION");
    expect(
      transaction.lines.reduce((sum, line) => sum + line.debitMinor, 0n),
    ).toBe(transaction.lines.reduce((sum, line) => sum + line.creditMinor, 0n));
    expect(source.balanceMinor).toBe(7450n);
    expect(destination.balanceMinor).toBe(2550n);
  });

  it("returns the same result for an idempotent retry and rejects changed input", async () => {
    const { sandbox, source, destination } = await fundedSandbox();
    const command = {
      sourceAccountId: source.id,
      destinationAccountId: destination.id,
      amount: "10.00",
      reason: "Retry test",
      idempotencyKey: "idem-retry",
    };
    expect(await sandbox.transfer(command, actor)).toEqual(
      await sandbox.transfer(command, actor),
    );
    await expect(
      sandbox.transfer({ ...command, amount: "11.00" }, actor),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("posts a balanced reversal and prevents a second reversal", async () => {
    const { sandbox, source, destination } = await fundedSandbox();
    const transaction = await sandbox.transfer(
      {
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        amount: "20.00",
        reason: "Reverse test",
        idempotencyKey: "idem-original",
      },
      actor,
    );
    const reversal = await sandbox.reverse(
      transaction.id,
      "Approved correction",
      "idem-reversal",
      actor,
    );
    expect(transaction.status).toBe("reversed");
    expect(reversal.kind).toBe("reversal");
    expect(reversal.reversesId).toBe(transaction.id);
    expect(source.balanceMinor).toBe(10000n);
    expect(destination.balanceMinor).toBe(0n);
    await expect(
      sandbox.reverse(transaction.id, "Again", "idem-reversal-two", actor),
    ).rejects.toMatchObject({ code: "REVERSAL_NOT_ALLOWED" });
  });

  it("rejects non-synthetic references and invalid crypto assets", async () => {
    const { sandbox, destination } = await fundedSandbox();
    await expect(
      sandbox.transfer(
        {
          sourceAccountId: "customer-real-1",
          destinationAccountId: destination.id,
          amount: "1.00",
          reason: "Invalid",
          idempotencyKey: "idem-real",
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: "SYNTHETIC_REFERENCE_REQUIRED" });
    const fiat = await sandbox.createAccount(
      { name: "Fiat", type: "fiat_wallet", asset: "GBP" },
      actor,
    );
    await expect(
      sandbox.transfer(
        {
          sourceAccountId: fiat.id,
          destinationAccountId: destination.id,
          amount: "1.00",
          reason: "Invalid crypto",
          idempotencyKey: "idem-crypto",
          crypto: true,
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: "CRYPTO_ASSET_REQUIRED" });
  });

  it("requires controlled adjustment evidence and records immutable audit intents", async () => {
    const audits: SandboxAudit[] = [];
    const sandbox = new FinancialSandbox(async (event) => {
      audits.push(event);
    });
    const account = await sandbox.createAccount(
      { name: "Audit account", type: "savings", asset: "USD" },
      actor,
    );
    await expect(
      sandbox.adjust(
        {
          accountId: account.id,
          amount: "5.00",
          direction: "credit",
          reason: "",
          reference: "",
          confirmed: false,
          idempotencyKey: "idem-invalid-adjust",
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: "ADJUSTMENT_CONFIRMATION_REQUIRED" });
    const adjustment = await sandbox.adjust(
      {
        accountId: account.id,
        amount: "5.00",
        direction: "credit",
        reason: "Approved test credit",
        reference: "ADJ-001",
        confirmed: true,
        idempotencyKey: "idem-valid-adjust",
      },
      actor,
    );
    expect(audits.map((item) => item.action)).toEqual([
      "financial_sandbox_account_created",
      "financial_sandbox_adjustment",
    ]);
    expect(audits[1]).toMatchObject({
      targetId: adjustment.id,
      details: { correlationId: "corr-test", synthetic: true },
    });
  });
});
