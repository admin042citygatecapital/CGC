/**
 * GET /api/users/wallet-overview
 * Aggregated wallet overview: banking balances + trading portfolio + P&L
 * Auth: Bearer token (inline customer auth)
 */
import type { Request, Response } from 'express';
import { findUserBySessionToken } from '../../../lib/userStore.js';
import { getTransactionsForUser } from '../../../lib/transactionStore.js';
import { readRatesConfig } from '../../../lib/ratesStore.js';
import { getPortfolioSummary, getPositions, getTrades, getOrders } from '../../../lib/tradingStore.js';

function buildToUsdMap(): Record<string, number> {
  const cfg = readRatesConfig();
  const r = cfg.rates;
  return {
    USD: 1, EUR: r.EUR_USD, GBP: r.GBP_USD, CHF: r.CHF_USD,
    CAD: 0.74, AUD: 0.65, JPY: r.JPY_USD, SGD: 0.74, AED: 0.27,
    BTC: r.BTC_USD, ETH: r.ETH_USD, SOL: r.SOL_USD,
    USDT: r.USDT_USD, BNB: r.BNB_USD,
  };
}

const CREDIT_TYPES = new Set(['deposit', 'manual_credit', 'refund', 'crypto_sell']);
const DEBIT_TYPES  = new Set(['withdrawal', 'manual_debit', 'fee', 'transfer', 'wire_transfer', 'crypto_buy']);
const CRYPTO_SET   = new Set(['BTC', 'ETH', 'USDT', 'BNB', 'SOL']);

export default async function handler(req: Request, res: Response) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const user = await findUserBySessionToken(token);
  if (!user) { res.status(401).json({ error: 'Invalid or expired session' }); return; }

  const toUsdMap = buildToUsdMap();

  // ── Banking balances (same logic as /api/users/balance) ────────────────────
  const { transactions } = await getTransactionsForUser(user.id, { limit: 10000, offset: 0 });
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    if (!['completed', 'approved'].includes(tx.status)) continue;
    const cur = tx.currency ?? 'USD';
    if (totals[cur] === undefined) totals[cur] = 0;
    if (CREDIT_TYPES.has(tx.type))      totals[cur] += Number(tx.amount ?? 0);
    else if (DEBIT_TYPES.has(tx.type))  totals[cur] -= Number(tx.amount ?? 0);
  }

  const currencies = Object.entries(totals)
    .map(([currency, amount]) => ({
      currency,
      amount:        Math.max(0, amount),
      usdEquivalent: Math.max(0, amount) * (toUsdMap[currency] ?? 1),
    }))
    .filter(c => c.amount > 0)
    .sort((a, b) => b.usdEquivalent - a.usdEquivalent);

  const txDerivedUsd = currencies.reduce((s, c) => s + c.usdEquivalent, 0);
  const storedBalanceUsd = user.balance ?? 0;
  const bankingTotal = txDerivedUsd > 0 ? txDerivedUsd : storedBalanceUsd;

  if (currencies.length === 0 && storedBalanceUsd > 0) {
    currencies.push({ currency: 'USD', amount: storedBalanceUsd, usdEquivalent: storedBalanceUsd });
  }

  // ── Trading portfolio ───────────────────────────────────────────────────────
  const [portfolio, allPositions, allTrades, allOrders] = await Promise.all([
    getPortfolioSummary(user.id),
    getPositions(user.id),
    getTrades(user.id),
    getOrders(user.id),
  ]);
  const positions = allPositions.filter(p => p.status === 'open');

  // ── Asset allocation ────────────────────────────────────────────────────────
  const allocMap: Record<string, number> = {};
  for (const p of positions) {
    const cat = p.assetClass ?? 'other';
    allocMap[cat] = (allocMap[cat] ?? 0) + p.currentPrice * p.quantity;
  }
  for (const c of currencies) {
    const cat = CRYPTO_SET.has(c.currency) ? 'crypto' : 'fiat';
    allocMap[cat] = (allocMap[cat] ?? 0) + c.usdEquivalent;
  }
  const allocTotal = Object.values(allocMap).reduce((s, v) => s + v, 0);
  const allocation = Object.entries(allocMap)
    .map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
      pct:   allocTotal > 0 ? parseFloat(((value / allocTotal) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // ── Recent trades ───────────────────────────────────────────────────────────
  const recentTrades = allTrades
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
    .slice(0, 10)
    .map(t => ({
      id: t.id, symbol: t.symbol, side: t.side,
      quantity: t.quantity, price: t.price,
      pnl: t.pnl ?? 0, executedAt: t.executedAt,
    }));

  const totalPortfolioValue = bankingTotal + portfolio.totalValue;
  const totalPnl = portfolio.unrealisedPnl + portfolio.realisedPnl;
  const pnlPct = portfolio.totalCost > 0 ? (totalPnl / portfolio.totalCost) * 100 : 0;
  const closedPositions = allPositions.filter(p => p.status === 'closed');
  const winningPositions = closedPositions.filter(p => p.realisedPnl > 0).length;

  res.json({
    totalPortfolioValue: parseFloat(totalPortfolioValue.toFixed(2)),
    bankingBalance:      parseFloat(bankingTotal.toFixed(2)),
    tradingBalance:      portfolio.totalValue,
    investmentBalance:   0,
    todayPnl:            0,
    todayPnlPct:         0,
    totalPnl,
    unrealisedPnl:       portfolio.unrealisedPnl,
    realisedPnl:         portfolio.realisedPnl,
    openPositions:       portfolio.openPositions,
    openOrders:          allOrders.filter(o => o.status === 'open' || o.status === 'pending').length,
    winRate:             closedPositions.length > 0 ? (winningPositions / closedPositions.length) * 100 : 0,
    pnlPct,
    currencies,
    allocation,
    recentTrades,
    positions: positions.slice(0, 8).map(p => ({
      id: p.id, symbol: p.symbol, side: p.side,
      quantity: p.quantity, avgEntry: p.avgEntryPrice,
      currentPrice: p.currentPrice,
      unrealisedPnl: p.unrealisedPnl,
      pnlPct: p.avgEntryPrice > 0
        ? parseFloat(((p.unrealisedPnl / (p.avgEntryPrice * p.quantity)) * 100).toFixed(2))
        : 0,
    })),
  });
}
