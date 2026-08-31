/**
 * ratesStore.ts — Admin-controlled exchange rates, transfer fees, FX markups,
 * tier fees, withdrawal limits, and fee change history.
 * PostgreSQL is authoritative in deployed environments. The legacy private
 * files are read only once to migrate existing installations.
 *
 * Backwards-compatible: existing ExchangeRates + TransferFees shapes are preserved.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { privateSubdirectory } from './storagePaths.js';
import { getQueryClient, isDatabaseConfigured } from '../db/db.js';
import { readConfigDocument } from './durableConfigDocument.js';

const CMS_DIR      = privateSubdirectory('cms');
const RATES_FILE   = path.join(CMS_DIR, 'rates.json');
const LEGACY_FEE_LOG_FILE = path.join(CMS_DIR, 'fee-history.jsonl');
const RATES_CONFIG_KEY = 'financial_rates_config';

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
  CAD_USD:  number;
  AUD_USD:  number;
  SGD_USD:  number;
  AED_USD:  number;
  NGN_USD:  number;
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
    CAD_USD:  0.74,
    AUD_USD:  0.65,
    SGD_USD:  0.74,
    AED_USD:  0.2723,
    NGN_USD:  0.00066,
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
      { pair: 'USD/NGN', markup: 0.8,  enabled: true },
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

// ── Durable configuration helpers ─────────────────────────────────────────────

function normalizeRatesConfig(stored: Partial<RatesConfig>): RatesConfig {
  try {

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

    return structuredClone({
      rates:     { ...DEFAULTS.rates,  ...(stored.rates  ?? {}) },
      fees:      { ...DEFAULTS.fees,   ...(stored.fees   ?? {}) },
      txFees,
      fxMarkups,
      tierFees,
      limits,
    });
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let cachedRatesConfig = structuredClone(DEFAULTS);
let loadedFromDurableStore = false;

/** Load the authoritative rates document before customer traffic is served. */
export async function loadRatesConfigFromDb(): Promise<RatesConfig> {
  const stored = await readConfigDocument<Partial<RatesConfig>>(RATES_CONFIG_KEY, RATES_FILE, DEFAULTS);
  cachedRatesConfig = normalizeRatesConfig(stored);
  await migrateLegacyFeeHistory();
  loadedFromDurableStore = true;
  return readRatesConfig();
}

/** Synchronous read from the startup-loaded, immutable-in-practice process cache. */
export function readRatesConfig(): RatesConfig {
  if (process.env.NODE_ENV === 'production' && !loadedFromDurableStore) {
    throw new Error('RATES_CONFIG_NOT_READY');
  }
  return structuredClone(cachedRatesConfig);
}

// ── Immutable fee history ─────────────────────────────────────────────────────

export type PendingFeeHistoryEntry = Omit<FeeHistoryEntry, 'id' | 'ts'>;

async function migrateLegacyFeeHistory(): Promise<void> {
  if (!isDatabaseConfigured() || !fs.existsSync(LEGACY_FEE_LOG_FILE)) return;
  const validSections = new Set(['rates', 'transfer_fees', 'fx_markup', 'tier_fees', 'limits']);
  const entries = fs.readFileSync(LEGACY_FEE_LOG_FILE, 'utf8')
    .split('\n').filter(Boolean).slice(0, 100_000)
    .flatMap(line => {
      try {
        const entry = JSON.parse(line) as FeeHistoryEntry;
        if (!entry.id || !entry.adminId || !validSections.has(entry.section) || !entry.field || !entry.ts) return [];
        if (!Number.isFinite(new Date(entry.ts).getTime())) return [];
        return [entry];
      } catch { return []; }
    });
  if (entries.length === 0) return;
  const sql = getQueryClient();
  await sql.begin(async transaction => {
    for (const entry of entries) {
      await transaction`
        INSERT INTO rate_fee_history
          (id, ts, admin_id, admin_email, section, field, old_value, new_value, ip)
        VALUES
          (${entry.id.slice(0, 200)}, ${entry.ts}, ${entry.adminId.slice(0, 200)}, ${entry.adminEmail?.slice(0, 320) ?? null},
           ${entry.section}, ${entry.field.slice(0, 200)}, ${String(entry.oldValue)}, ${String(entry.newValue)}, ${String(entry.ip ?? 'unknown').slice(0, 200)})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  });
}

/**
 * Persist a rates change and all history rows in one PostgreSQL transaction.
 * The cache is updated only after the database commit succeeds.
 */
export async function applyRatesConfigChange(
  config: RatesConfig,
  entries: PendingFeeHistoryEntry[],
  updatedBy: string,
): Promise<RatesConfig> {
  const normalized = normalizeRatesConfig(config);
  if (!isDatabaseConfigured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('RATES_DATABASE_UNAVAILABLE');
    fs.mkdirSync(path.dirname(RATES_FILE), { recursive: true });
    fs.writeFileSync(RATES_FILE, JSON.stringify(normalized, null, 2), 'utf8');
    cachedRatesConfig = normalized;
    loadedFromDurableStore = true;
    return readRatesConfig();
  }

  const sql = getQueryClient();
  const jsonDocument = JSON.parse(JSON.stringify({ data: normalized })) as Record<string, unknown>;
  await sql.begin(async transaction => {
    await transaction`
      INSERT INTO config (key, value, updated_at, updated_by)
      VALUES (${RATES_CONFIG_KEY}, ${transaction.json(jsonDocument as never)}, NOW(), ${updatedBy})
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `;
    for (const entry of entries) {
      await transaction`
        INSERT INTO rate_fee_history
          (id, admin_id, admin_email, section, field, old_value, new_value, ip)
        VALUES
          (${'fh_' + crypto.randomBytes(12).toString('hex')}, ${entry.adminId}, ${entry.adminEmail ?? null},
           ${entry.section}, ${entry.field}, ${entry.oldValue}, ${entry.newValue}, ${entry.ip})
      `;
    }
  });
  cachedRatesConfig = normalized;
  loadedFromDurableStore = true;
  return readRatesConfig();
}

export async function readFeeHistory(limit = 200, offset = 0): Promise<{ data: FeeHistoryEntry[]; total: number }> {
  if (!isDatabaseConfigured()) return { data: [], total: 0 };
  const sql = getQueryClient();
  const [rows, counts] = await Promise.all([
    sql<Array<{ id: string; ts: Date | string; admin_id: string; admin_email: string | null; section: string; field: string; old_value: string; new_value: string; ip: string }>>`
      SELECT id, ts, admin_id, admin_email, section, field, old_value, new_value, ip
      FROM rate_fee_history ORDER BY ts DESC, id DESC LIMIT ${limit} OFFSET ${offset}
    `,
    sql<Array<{ total: number }>>`SELECT COUNT(*)::int AS total FROM rate_fee_history`,
  ]);
  return {
    data: rows.map(row => ({
      id: row.id, ts: new Date(row.ts).toISOString(), adminId: row.admin_id,
      adminEmail: row.admin_email ?? undefined, section: row.section, field: row.field,
      oldValue: row.old_value, newValue: row.new_value, ip: row.ip,
    })),
    total: counts[0]?.total ?? 0,
  };
}

export async function feeHistoryCsv(): Promise<string> {
  const history = await readFeeHistory(10_000, 0);
  const header = 'id,ts,adminId,adminEmail,section,field,oldValue,newValue,ip';
  const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = history.data.map(e =>
    [e.id, e.ts, e.adminId, e.adminEmail ?? '', e.section, e.field, e.oldValue, e.newValue, e.ip]
      .map(csv).join(',')
  );
  return [header, ...rows].join('\n');
}

// ── Withdrawal usage helpers ──────────────────────────────────────────────────

/**
 * Compute how much a user has withdrawn today and this month (UTC).
 * Reads from the transaction store — import lazily to avoid circular deps.
 */
export async function getWithdrawalUsage(userId: string): Promise<{ todayUSD: number; monthUSD: number }> {
  const { getWithdrawalTransactionsSince } = await import('./transactionStore.js');
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const transactions = await getWithdrawalTransactionsSince(userId, monthStart);

  // Use live admin-controlled rates from the store (no hardcoded fallbacks).
  const lr = readRatesConfig().rates;
  const TO_USD: Record<string, number> = {
    USD: 1,
    EUR: lr.EUR_USD,
    GBP: lr.GBP_USD,
    CHF: lr.CHF_USD,
    CAD: lr.CAD_USD,
    AUD: lr.AUD_USD,
    JPY: lr.JPY_USD,
    SGD: lr.SGD_USD,
    AED: lr.AED_USD,
    NGN: lr.NGN_USD,
    BTC: lr.BTC_USD,
    ETH: lr.ETH_USD,
    SOL: lr.SOL_USD,
    USDT: lr.USDT_USD,
    BNB: lr.BNB_USD,
  };

  const today = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);

  let todayUSD = 0;
  let monthUSD = 0;
  for (const transaction of transactions) {
    const rate = TO_USD[transaction.currency];
    if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Withdrawal usage rate is unavailable for ${transaction.currency}.`);
    const usd = Number(transaction.amount) * rate;
    if (!Number.isFinite(usd) || usd < 0) throw new Error('Withdrawal usage contains an invalid amount.');
    if (transaction.createdAt.startsWith(today)) todayUSD += usd;
    if (transaction.createdAt.startsWith(month)) monthUSD += usd;
  }

  return { todayUSD, monthUSD };
}
