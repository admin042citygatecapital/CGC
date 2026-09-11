import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const customerSources = [
  "src/pages/dashboard/transfers.tsx",
  "src/components/PlaidLinkCard.tsx",
  "src/pages/wallet.tsx",
  "src/pages/accounts.tsx",
  "src/pages/transfers.tsx",
  "src/lib/chatbot/chat-config.ts",
  "src/server/lib/emailTemplateStore.ts",
  "src/server/lib/emailService.ts",
  "src/server/lib/nurtureSequence.ts",
  "src/pages/admin/cms.tsx",
];

const retiredCustomerPhrases = [
  "Customer-owned simulation ledger",
  "Balanced simulation only",
  "· simulation",
  "Sandbox institution connected",
  ">Sandbox<",
  "Illustrative market pricing",
  "Prototype trading pairs",
  "Illustrative return",
  "Illustrative only",
  "Prototype Currencies",
  "Illustrative Transfer Scenarios",
  "using sample data",
  "paper-trading",
  "none are live in this environment",
  "illustrative interface features",
  "pre-deployment platform",
];

describe("customer language standard", () => {
  it.each(customerSources)("keeps retired development labels out of %s", (path) => {
    const source = readFileSync(path, "utf8");

    for (const phrase of retiredCustomerPhrases) {
      expect(source).not.toContain(phrase);
    }
  });
});
