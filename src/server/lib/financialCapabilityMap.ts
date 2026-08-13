export type FinancialCapabilityStatus = "implemented" | "adapter_required";

export interface FinancialCapability {
  key: string;
  label: string;
  category: "transaction" | "control" | "market_data";
  status: FinancialCapabilityStatus;
  description: string;
  executionBoundary: "SIMULATION" | "READ_ONLY";
}

/**
 * The administration skills map is deliberately provider-neutral. Codex app
 * connectors and browser sessions are not application credentials and never
 * become an execution path merely because they are available to a developer.
 */
export const FINANCIAL_CAPABILITY_MAP: readonly FinancialCapability[] = [
  {
    key: "internal_transfer",
    label: "Internal transfer",
    category: "transaction",
    status: "implemented",
    description:
      "Posts a completed synthetic transfer with balanced debit and credit journal lines.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "crypto_transfer",
    label: "Crypto transfer model",
    category: "transaction",
    status: "implemented",
    description:
      "Models BTC, ETH and USDT transfers between synthetic wallets without blockchain execution.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "pending_instruction",
    label: "Pending payment instruction",
    category: "transaction",
    status: "implemented",
    description:
      "Creates a pending instruction that can be inspected and cancelled before posting.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "controlled_adjustment",
    label: "Controlled ledger adjustment",
    category: "transaction",
    status: "implemented",
    description:
      "Requires confirmation, reference, reason, idempotency and an immutable administration audit event.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "reversal",
    label: "Balanced reversal",
    category: "control",
    status: "implemented",
    description:
      "Reverses an eligible completed synthetic transaction with a new immutable journal entry.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "journal_integrity",
    label: "Journal integrity monitoring",
    category: "control",
    status: "implemented",
    description:
      "Reports double-entry totals and any integrity breaks from the database-backed sandbox ledger.",
    executionBoundary: "READ_ONLY",
  },
  {
    key: "ach",
    label: "ACH origination and receipt",
    category: "transaction",
    status: "adapter_required",
    description:
      "Models ACH instructions, returns, settlement references and reconciliation states; execution requires a chartered-bank or licensed-provider adapter.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "wire_transfer",
    label: "Domestic and international wires",
    category: "transaction",
    status: "adapter_required",
    description:
      "Models reviewed wire instructions, fees, screening and provider references without transmitting a live wire.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "real_time_rails",
    label: "RTP and FedNow",
    category: "transaction",
    status: "adapter_required",
    description:
      "Models immediate-payment lifecycle and irrevocability controls; direct rail access is unavailable without an eligible sponsor institution.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "external_account_linking",
    label: "External account linking",
    category: "control",
    status: "adapter_required",
    description:
      "Models consent, ownership and token-reference states. Bank credentials and provider access tokens are never stored in the simulation ledger.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "deposit_withdrawal",
    label: "Deposits and withdrawals",
    category: "transaction",
    status: "adapter_required",
    description:
      "Models direct-deposit, check-deposit and withdrawal instructions; no check image, routing credential or real fund is accepted locally.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "scheduled_payments",
    label: "Scheduled and recurring payments",
    category: "transaction",
    status: "adapter_required",
    description:
      "Models schedules, retries, cancellations and idempotent occurrences before a provider-backed execution adapter exists.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "card_network",
    label: "Card network posting",
    category: "transaction",
    status: "adapter_required",
    description:
      "Models authorisation, clearing, reversal and dispute states. Issuance and network execution require an authorised issuer-processor.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "card_issuer_processor",
    label: "Issuer-processor and BIN sponsorship",
    category: "control",
    status: "adapter_required",
    description:
      "Requires a contracted issuer-processor and BIN-sponsor bank. The platform may retain only opaque provider references and masked card metadata; it does not generate PAN, CVV or PIN values.",
    executionBoundary: "READ_ONLY",
  },
  {
    key: "card_controls",
    label: "Card controls and fulfilment",
    category: "control",
    status: "adapter_required",
    description:
      "Models freeze, spend and merchant-category limits, physical-card fulfilment and replacement requests. Each live control requires step-up authentication and provider confirmation.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "card_authentication_tokenisation",
    label: "3-D Secure and wallet tokenisation",
    category: "control",
    status: "adapter_required",
    description:
      "3-D Secure, network tokens and Apple/Google Pay provisioning remain issuer-controlled capabilities; no token provisioning credential is stored locally.",
    executionBoundary: "READ_ONLY",
  },
  {
    key: "card_disputes",
    label: "Disputes and chargebacks",
    category: "control",
    status: "adapter_required",
    description:
      "Models case intake, evidence references, deadlines and outcomes. Network submission and provisional-credit decisions require the issuer-processor.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "crypto_custody",
    label: "Licensed digital-asset custody",
    category: "control",
    status: "adapter_required",
    description:
      "Requires a licensed custodian with MPC/HSM key governance and segregated hot, warm and cold controls. City Gate Capital does not create or retain private keys.",
    executionBoundary: "READ_ONLY",
  },
  {
    key: "crypto_execution",
    label: "Digital-asset execution and liquidity",
    category: "transaction",
    status: "adapter_required",
    description:
      "Buy and sell execution requires an approved exchange or liquidity partner. Displayed market data cannot be treated as an executable quote.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "blockchain_screening",
    label: "Wallet and sanctions screening",
    category: "control",
    status: "adapter_required",
    description:
      "Requires a contracted blockchain-analytics provider, documented risk policy, rescreening and case review before any external wallet instruction.",
    executionBoundary: "READ_ONLY",
  },
  {
    key: "strong_authentication",
    label: "MFA, device and session controls",
    category: "control",
    status: "implemented",
    description:
      "Administrator and customer security centres provide MFA policy, secure server sessions, timeouts, device history and revocation. Biometric authentication requires a future WebAuthn device ceremony.",
    executionBoundary: "READ_ONLY",
  },
  {
    key: "fraud_monitoring",
    label: "Velocity, limits and fraud monitoring",
    category: "control",
    status: "adapter_required",
    description:
      "Rate limits and security alerts are available locally; production transaction velocity, device intelligence, fraud scoring and suspicious-activity case management require reviewed rules and provider signals.",
    executionBoundary: "READ_ONLY",
  },
  {
    key: "security_assurance",
    label: "Independent security assurance",
    category: "control",
    status: "adapter_required",
    description:
      "TLS and application security controls do not replace an independent penetration test, SOC 2 evidence or PCI-DSS scope validation before card launch.",
    executionBoundary: "READ_ONLY",
  },
  {
    key: "bill_pay",
    label: "Bill pay",
    category: "transaction",
    status: "adapter_required",
    description:
      "Models biller, approval, schedule and settlement states; no live bill payment is transmitted.",
    executionBoundary: "SIMULATION",
  },
  {
    key: "binance_market_data",
    label: "Binance market data",
    category: "market_data",
    status: "adapter_required",
    description:
      "Reserved for read-only crypto symbols and quotes; trading, custody and withdrawals remain disconnected.",
    executionBoundary: "READ_ONLY",
  },
  {
    key: "alpaca_market_data",
    label: "Alpaca market data",
    category: "market_data",
    status: "adapter_required",
    description:
      "Reserved for read-only equity market data; order execution is not part of the local banking simulation.",
    executionBoundary: "READ_ONLY",
  },
  {
    key: "financial_datasets",
    label: "Financial datasets",
    category: "market_data",
    status: "adapter_required",
    description:
      "Reserved for read-only company fundamentals and research data with source timestamps.",
    executionBoundary: "READ_ONLY",
  },
] as const;
