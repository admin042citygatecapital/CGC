/**
 * ratesStore.ts — Admin-controlled exchange rates, transfer fees, FX markups,
 * tier fees, withdrawal limits, and fee change history.
 * Backed by /private/cms/rates.json
 *
 * Backwards-compatible: existing ExchangeRates + TransferFees shapes are preserved.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RATES_FILE   = '/private/cms/rates.json';
const FEE_LOG_FILE = '/private/cms/fee-history.jsonl';

// ── Existing types (preserved for backwards compat) ───────────────────────────

export interface ExchangeRates {
  BTC_USD:  number;
  ETH_USD:  number;
  SOL_USD:  number;
  BNB_USD:  number;
  USDT_USD: number;
  EUR_USD:  number;
  GBP_USD:  number;
  JPY_USD:  number;
  CHF_USD:  number;
  updatedAt: string;
}

export interface TransferFees {
  flatFeeUSD:              number;
  percentageFee:           number;
  minFeeUSD:               number;
  maxFeeUSD:               number;
  withdrawalFlatFeeUSD:    number;
  withdrawalPercentageFee: number;
  updatedAt: string;
}

// ── New: per-transaction-type fee config ──────────────────────────────────────

export type FeeMode = 'flat' | 'percentage';

export interface FeeRule {
  mode:       FeeMode;   // 'flat' | 'percentage'
  flat:       number;    // USD amount when mode = 'flat'
  percentage: number;    // e.g. 0.5 = 0.5% when mode = 'percentage'
  minFee:     number;    // minimum fee (0 = no minimum)
  maxFee:     number;    // maximum fee cap (0 = no cap)
  enabled:    boolean;
}

export interface TransactionTypeFees {
  domestic_transfer:   FeeRule;
  international_wire:  FeeRule;
  crypto_send:         FeeRule;
  currency_exchange:   FeeRule;
  updatedAt: string;
}

// ── New: per-currency-pair FX markup ─────────────────────────────────────────

export interface FxMarkup {
  pair:      string;   // e.g. 'USD/EUR'
  markup:    number;   // percentage, e.g. 1.5 = 1.5%
  enabled:   boolean;
}

export interface FxMarkups {
  pairs:     FxMarkup[];
  updatedAt: string;
}

// ── New: per-account-tier fee schedule ───────────────────────────────────────

export type AccountTier = 'personal' | 'savings' | 'business';

export interface TierFeeRule {
  tier:               AccountTier;
  label:              string;
  transferFeeMode:    FeeMode;
  transferFlat:       number;
  transferPct:        number;
  wireFeeMode:        FeeMode;
  wireFlat:           number;
  wirePct:            number;
  cryptoFeeMode:      FeeMode;
  cryptoFlat:         number;
  cryptoPct:          number;
  exchangeFeeMode:    FeeMode;
  exchangeFlat:       number;
  exchangePct:        number;
  volumeDiscountPct:  number;   // additional % discount for business tier
  enabled:            boolean;
}

export interface TierFees {
  tiers:     TierFeeRule[];
  updatedAt: string;
}

// ── New: withdrawal limits ────────────────────────────────────────────────────

export interface WithdrawalLimitRule {
  tier:           AccountTier | 'default';
  dailyLimitUSD:  number;   // 0 = unlimited
  monthlyLimitUSD: number;  // 0 = unlimited
}

export interface WithdrawalLimits {
  tierLimits:  WithdrawalLimitRule[];
  // Per-user overrides: { [userId]: { dailyLimitUSD, monthlyLimitUSD } }
  userOverrides: Record<string, { dailyLimitUSD: number; monthlyLimitUSD: number; note?: string; updatedAt: string }>;
  updatedAt: string;
}

// ── Fee history log entry ─────────────────────────────────────────────────────

export interface FeeHistoryEntry {
  id:        string;
  ts:        string;
  adminId:   string;
  adminEmail?: string;
  section:   string;   // 'transfer_fees' | 'fx_markup' | 'tier_fees' | 'rates' | 'limits'
  field:     string;   // human-readable field name
  oldValue:  string;
  newValue:  string;
  ip:        string;
}

// ── Full config ───────────────────────────────────────────────────────────────

export interface RatesConfig {
  rates:        ExchangeRates;
  fees:         TransferFees;
  txFees:       TransactionTypeFees;
  fxMarkups:    FxMarkups;
  tierFees:     TierFees;
  limits:       WithdrawalLimits;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS: RatesConfig = {
  rates: {
    BTC_USD:  67420,
    ETH_USD:  3840,
    SOL_USD:  182.5,
    BNB_USD:  598,
    USDT_USD: 1,
    EUR_USD:  1.086,
    GBP_USD:  1.262,
    JPY_USD:  0.0065,
    CHF_USD:  1.11,
    updatedAt: new Date().toISOString(),
  },
  fees: {
    flatFeeUSD:              0.99,
    percentageFee:           0,
    minFeeUSD:               0.99,
    maxFeeUSD:               0,
    withdrawalFlatFeeUSD:    1.99,
    withdrawalPercentageFee: 0.5,
    updatedAt: new Date().toISOString(),
  },
  txFees: {
    domestic_transfer:  { mode: 'flat', flat: 0.99, percentage: 0,   minFee: 0.50, maxFee: 0,   enabled: true },
    international_wire: { mode: 'flat', flat: 15,   percentage: 0,   minFee: 10,   maxFee: 0,   enabled: true },
    crypto_send:        { mode: 'percentage', flat: 0, percentage: 0.5, minFee: 1, maxFee: 50,  enabled: true },
    currency_exchange:  { mode: 'percentage', flat: 0, percentage: 0.3, minFee: 0, maxFee: 0,   enabled: true },
    updatedAt: new Date().toISOString(),
  },
  fxMarkups: {
    pairs: [
      { pair: 'USD/EUR', markup: 0.5,  enabled: true },
      { pair: 'USD/GBP', markup: 0.5,  enabled: true },
      { pair: 'USD/JPY', markup: 0.5,  enabled: true },
      { pair: 'USD/CHF', markup: 0.3,  enabled: true },
      { pair: 'USD/CAD', markup: 0.4,  enabled: true },
      { pair: 'USD/AUD', markup: 0.4,  enabled: true },
      { pair: 'USD/SGD', markup: 0.5,  enabled: true },
      { pair: 'USD/AED', markup: 0.3,  enabled: true },
      { pair: 'EUR/GBP', markup: 0.5,  enabled: true },
      { pair: 'BTC/USD', markup: 1.5,  enabled: true },
      { pair: 'ETH/USD', markup: 1.5,  enabled: true },
      { pair: 'SOL/USD', markup: 2.0,  enabled: true },
      { pair: 'BNB/USD', markup: 1.5,  enabled: true },
      { pair: 'USDT/USD', markup: 0.1, enabled: true },
    ],
    updatedAt: new Date().toISOString(),
  },
  tierFees: {
    tiers: [
      {
        tier: 'personal', label: 'Personal',
        transferFeeMode: 'flat',       transferFlat: 0.99, transferPct: 0,
        wireFeeMode:     'flat',       wireFlat: 15,       wirePct: 0,
        cryptoFeeMode:   'percentage', cryptoFlat: 0,      cryptoPct: 0.5,
        exchangeFeeMode: 'percentage', exchangeFlat: 0,    exchangePct: 0.3,
        volumeDiscountPct: 0, enabled: true,
      },
      {
        tier: 'savings', label: 'Savings',
        transferFeeMode: 'flat',       transferFlat: 0.49, transferPct: 0,
        wireFeeMode:     'flat',       wireFlat: 10,       wirePct: 0,
        cryptoFeeMode:   'percentage', cryptoFlat: 0,      cryptoPct: 0.25,
        exchangeFeeMode: 'percentage', exchangeFlat: 0,    exchangePct: 0.15,
        volumeDiscountPct: 0, enabled: true,
      },
      {
        tier: 'business', label: 'Business',
        transferFeeMode: 'flat',       transferFlat: 0.25, transferPct: 0,
        wireFeeMode:     'flat',       wireFlat: 8,        wirePct: 0,
        cryptoFeeMode:   'percentage', cryptoFlat: 0,      cryptoPct: 0.2,
        exchangeFeeMode: 'percentage', exchangeFlat: 0,    exchangePct: 0.1,
        volumeDiscountPct: 10, enabled: true,
      },
    ],
    updatedAt: new Date().toISOString(),
  },
  limits: {
    tierLimits: [
      { tier: 'default',  dailyLimitUSD: 10_000,  monthlyLimitUSD: 50_000  },
      { tier: 'personal', dailyLimitUSD: 10_000,  monthlyLimitUSD: 50_000  },
      { tier: 'savings',  dailyLimitUSD: 25_000,  monthlyLimitUSD: 100_000 },
      { tier: 'business', dailyLimitUSD: 100_000, monthlyLimitUSD: 500_000 },
    ],
    userOverrides: {},
    updatedAt: new Date().toISOString(),
  },
};

// ── File helpers ──────────────────────────────────────────────────────────────

function ensureDir(file: string) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readRatesConfig(): RatesConfig {
  try {
    ensureDir(RATES_FILE);
    if (!fs.existsSync(RATES_FILE)) return DEFAULTS;
    const stored = JSON.parse(fs.readFileSync(RATES_FILE, 'utf8')) as Partial<RatesConfig>;

    // Deep-merge txFees: each FeeRule is merged individually so new sub-fields
    // (e.g. a newly added `minFee`) always get their default value even if the
    // stored file pre-dates that field.
    const storedTx: Partial<TransactionTypeFees> = stored.txFees ?? {};
    const txFees: TransactionTypeFees = {
      domestic_transfer:  { ...DEFAULTS.txFees.domestic_transfer,  ...(storedTx.domestic_transfer  ?? {}) },
      international_wire: { ...DEFAULTS.txFees.international_wire, ...(storedTx.international_wire ?? {}) },
      crypto_send:        { ...DEFAULTS.txFees.crypto_send,        ...(storedTx.crypto_send        ?? {}) },
      currency_exchange:  { ...DEFAULTS.txFees.currency_exchange,  ...(storedTx.currency_exchange  ?? {}) },
      updatedAt: storedTx.updatedAt ?? DEFAULTS.txFees.updatedAt,
    };

    // Deep-merge fxMarkups: merge stored pairs over defaults by pair name so
    // newly added default pairs always appear even in old stored configs.
    const storedFx = stored.fxMarkups ?? DEFAULTS.fxMarkups;
    const mergedPairs = DEFAULTS.fxMarkups.pairs.map(def => {
      const override = storedFx.pairs.find(p => p.pair === def.pair);
      return override ? { ...def, ...override } : def;
    });
    // Append any admin-added pairs not in defaults
    for (const p of storedFx.pairs) {
      if (!mergedPairs.find(m => m.pair === p.pair)) mergedPairs.push(p);
    }
    const fxMarkups: FxMarkups = { pairs: mergedPairs, updatedAt: storedFx.updatedAt };

    // Deep-merge tierFees: merge stored tiers over defaults by tier name
    const storedTf = stored.tierFees ?? DEFAULTS.tierFees;
    const mergedTiers = DEFAULTS.tierFees.tiers.map(def => {
      const override = storedTf.tiers.find(t => t.tier === def.tier);
      return override ? { ...def, ...override } : def;
    });
    const tierFees: TierFees = { tiers: mergedTiers, updatedAt: storedTf.updatedAt };

    // Deep-merge limits: merge stored tierLimits over defaults by tier name
    const storedLim = stored.limits ?? DEFAULTS.limits;
    const mergedLimits = DEFAULTS.limits.tierLimits.map(def => {
      const override = storedLim.tierLimits.find(t => t.tier === def.tier);
      return override ? { ...def, ...override } : def;
    });
    const limits: WithdrawalLimits = {
      tierLimits:    mergedLimits,
      userOverrides: storedLim.userOverrides ?? {},
      updatedAt:     storedLim.updatedAt,
    };

    return {
      rates:     { ...DEFAULTS.rates,  ...(stored.rates  ?? {}) },
      fees:      { ...DEFAULTS.fees,   ...(stored.fees   ?? {}) },
      txFees,
      fxMarkups,
      tierFees,
      limits,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeRatesConfig(config: RatesConfig): void {
  ensureDir(RATES_FILE);
  fs.writeFileSync(RATES_FILE, JSON.stringify(config, null, 2));
}

// ── Fee history log ───────────────────────────────────────────────────────────

export function appendFeeHistory(entry: Omit<FeeHistoryEntry, 'id' | 'ts'>): FeeHistoryEntry {
  ensureDir(FEE_LOG_FILE);
  const full: FeeHistoryEntry = {
    ...entry,
    id: 'fh_' + crypto.randomBytes(6).toString('hex'),
    ts: new Date().toISOString(),
  };
  fs.appendFileSync(FEE_LOG_FILE, JSON.stringify(full) + '\n');
  return full;
}

export function readFeeHistory(limit = 200, offset = 0): { data: FeeHistoryEntry[]; total: number } {
  try {
    if (!fs.existsSync(FEE_LOG_FILE)) return { data: [], total: 0 };
    const lines = fs.readFileSync(FEE_LOG_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as FeeHistoryEntry)
      .reverse();
    return { data: lines.slice(offset, offset + limit), total: lines.length };
  } catch { return { data: [], total: 0 }; }
}

export function feeHistoryCsv(): string {
  try {
    if (!fs.existsSync(FEE_LOG_FILE)) return 'id,ts,adminId,adminEmail,section,field,oldValue,newValue,ip\n';
    const lines = fs.readFileSync(FEE_LOG_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as FeeHistoryEntry)
      .reverse();
    const header = 'id,ts,adminId,adminEmail,section,field,oldValue,newValue,ip';
    const rows = lines.map(e =>
      [e.id, e.ts, e.adminId, e.adminEmail ?? '', e.section, e.field,
       `"${String(e.oldValue).replace(/"/g, '""')}"`,
       `"${String(e.newValue).replace(/"/g, '""')}"`,
       e.ip].join(',')
    );
    return [header, ...rows].join('\n');
  } catch { return 'id,ts,adminId,adminEmail,section,field,oldValue,newValue,ip\n'; }
}

// ── Currency conversion helpers ────────────────────────────────────────────────
//
// Single canonical currency→USD table shared by every route that needs to
// compare a client-supplied amount/currency against a USD-denominated
// balance or fee (withdraw, transfer, swap, withdrawal-limit usage). BTC/ETH/
// SOL/USDT/BNB/EUR/GBP/JPY/CHF use admin-configured live rates; CAD/AUD/SGD/AED
// have no admin-configurable rate anywhere in this system yet, so they keep
// the fixed approximate rates this table already used for limit-usage
// calculations — not invented here, just centralized so every caller (not
// just getWithdrawalUsage) applies the same numbers instead of silently
// skipping conversion.

export function currencyToUsdRate(currency: string, rates: ExchangeRates): number | null {
  const c = currency.toUpperCase();
  if (c === 'USD') return 1;
  const TO_USD: Record<string, number> = {
    EUR: rates.EUR_USD,
    GBP: rates.GBP_USD,
    CHF: rates.CHF_USD,
    JPY: rates.JPY_USD,
    BTC:  rates.BTC_USD,
    ETH:  rates.ETH_USD,
    SOL:  rates.SOL_USD,
    USDT: rates.USDT_USD,
    BNB:  rates.BNB_USD,
    CAD: 0.74,
    AUD: 0.65,
    SGD: 0.74,
    AED: 0.27,
  };
  return TO_USD[c] ?? null;
}

/** Converts an amount in `currency` to USD. Returns null for an unsupported/unknown currency. */
export function toUsd(amount: number, currency: string, rates: ExchangeRates): number | null {
  const rate = currencyToUsdRate(currency, rates);
  return rate === null ? null : amount * rate;
}

/** Converts a USD amount into `currency`. Returns null for an unsupported/unknown currency. */
export function fromUsd(usdAmount: number, currency: string, rates: ExchangeRates): number | null {
  const rate = currencyToUsdRate(currency, rates);
  return rate === null ? null : usdAmount / rate;
}

/** Converts an amount from one currency to another via USD. Returns null if either currency is unsupported. */
export function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: ExchangeRates): number | null {
  const usd = toUsd(amount, fromCurrency, rates);
  if (usd === null) return null;
  return fromUsd(usd, toCurrency, rates);
}

// ── Withdrawal usage helpers ──────────────────────────────────────────────────

/**
 * Compute how much a user has withdrawn today and this month (UTC).
 * Reads from the transaction store — import lazily to avoid circular deps.
 */
export function getWithdrawalUsage(userId: string): { todayUSD: number; monthUSD: number } {
  try {
    const txFile = '/private/transactions/transactions.jsonl';
    if (!fs.existsSync(txFile)) return { todayUSD: 0, monthUSD: 0 };

    const liveCfg = readRatesConfig();

    const now   = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const month = now.toISOString().slice(0, 7);  // YYYY-MM

    const WITHDRAWAL_TYPES = new Set(['withdrawal', 'wire_transfer', 'manual_debit']);

    const lines = fs.readFileSync(txFile, 'utf8').split('\n').filter(Boolean);
    let todayUSD = 0;
    let monthUSD = 0;

    for (const line of lines) {
      try {
        const tx = JSON.parse(line);
        if (tx.userId !== userId) continue;
        if (!WITHDRAWAL_TYPES.has(tx.type)) continue;
        if (!['completed', 'approved', 'pending'].includes(tx.status)) continue;
        const usd = toUsd(Number(tx.amount ?? 0), String(tx.currency ?? 'USD'), liveCfg.rates) ?? Number(tx.amount ?? 0);
        if (tx.createdAt?.startsWith(today)) todayUSD += usd;
        if (tx.createdAt?.startsWith(month)) monthUSD += usd;
      } catch { /* skip malformed */ }
    }

    return { todayUSD, monthUSD };
  } catch { return { todayUSD: 0, monthUSD: 0 }; }
}
