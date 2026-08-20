import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const migration = readFileSync(
  path.resolve(
    process.cwd(),
    "src/server/db/migrations/0031_money_movement_simulation.sql",
  ),
  "utf8",
);
const api = readFileSync(
  path.resolve(
    process.cwd(),
    "src/server/api/admin/financial-sandbox/POST.ts",
  ),
  "utf8",
);
const page = readFileSync(
  path.resolve(process.cwd(), "src/pages/admin/financial-sandbox.tsx"),
  "utf8",
);

describe("money-movement simulation schema", () => {
  it("keeps provider execution disconnected and every record synthetic", () => {
    expect(migration).toContain("provider_adapter_state = 'DISCONNECTED'");
    expect(migration).toContain("execution_source = 'SIMULATION'");
    expect(migration).toContain("synthetic IS TRUE");
    expect(migration).not.toMatch(
      /routing_number|account_number|provider_token|access_token/i,
    );
  });

  it("stores immutable lifecycle events and scoped idempotency commands", () => {
    expect(migration).toContain("money_movement_simulation_events_immutable");
    expect(migration).toContain("PRIMARY KEY (actor_scope, idempotency_key)");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL");
  });

  it("keeps every rail workflow inside the existing super-admin workspace", () => {
    expect(api).toContain("create_rail_instruction");
    expect(api).toContain("transition_rail_instruction");
    expect(page).toContain("Payment-rail instruction control");
    expect(page).toContain("PROVIDER ADAPTER DISCONNECTED");
  });
});
