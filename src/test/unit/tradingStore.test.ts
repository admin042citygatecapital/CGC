/**
 * Trading store (flat-file) unit tests — City Gate Capital
 *
 * Covers the getAllPositions/getAllOrders/getAllTrades fix: these must
 * return real persisted data (not a silent [] fallback) both when the
 * backing file is empty/missing and when it holds records for multiple
 * users, while the existing per-user getPositions/getOrders/getTrades
 * must keep filtering correctly.
 *
 * Tests tradingStore.flatfile.ts directly rather than tradingStore.ts's
 * DB/flat-file wrapper: tradingStore.ts imports src/server/db/db.ts and
 * db/schema.ts, which don't exist yet in this repo (a separate, pre-existing
 * gap — see AUDIT_REPORT notes), so importing it fails module resolution
 * before any test code runs. tradingStore.flatfile.ts has no such
 * dependency and is the actual implementation under test here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory JSONL files keyed by filename (positions.jsonl, orders.jsonl, trades.jsonl)
const mockFiles: Record<string, string> = {};

function keyFor(p: string): string | null {
  const s = String(p);
  if (s.endsWith('positions.jsonl')) return 'positions.jsonl';
  if (s.endsWith('orders.jsonl')) return 'orders.jsonl';
  if (s.endsWith('trades.jsonl')) return 'trades.jsonl';
  return null;
}

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn((p: string) => {
        const key = keyFor(p);
        if (key) return mockFiles[key] !== undefined;
        return true; // directory checks
      }),
      readFileSync: vi.fn((p: string) => {
        const key = keyFor(p);
        if (key) return mockFiles[key] ?? '';
        return '';
      }),
      writeFileSync: vi.fn((p: string, data: string) => {
        const key = keyFor(p);
        if (key) mockFiles[key] = String(data);
      }),
      appendFileSync: vi.fn((p: string, data: string) => {
        const key = keyFor(p);
        if (key) mockFiles[key] = (mockFiles[key] ?? '') + String(data);
      }),
      mkdirSync: vi.fn(),
    },
    existsSync: vi.fn((p: string) => {
      const key = keyFor(p);
      if (key) return mockFiles[key] !== undefined;
      return true;
    }),
    readFileSync: vi.fn((p: string) => {
      const key = keyFor(p);
      if (key) return mockFiles[key] ?? '';
      return '';
    }),
    writeFileSync: vi.fn((p: string, data: string) => {
      const key = keyFor(p);
      if (key) mockFiles[key] = String(data);
    }),
    appendFileSync: vi.fn((p: string, data: string) => {
      const key = keyFor(p);
      if (key) mockFiles[key] = (mockFiles[key] ?? '') + String(data);
    }),
    mkdirSync: vi.fn(),
  };
});

function jsonl(records: unknown[]): string {
  return records.map(r => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
}

const POSITION_A = {
  id: 'pos_a', userId: 'user_a', symbol: 'BTC/USD', assetClass: 'crypto', side: 'buy',
  quantity: 0.5, avgEntryPrice: 60000, currentPrice: 61000, unrealisedPnl: 500, realisedPnl: 0,
  status: 'open', openedAt: '2026-01-01T00:00:00.000Z', currency: 'USD', leverage: 1,
};
const POSITION_B = {
  id: 'pos_b', userId: 'user_b', symbol: 'ETH/USD', assetClass: 'crypto', side: 'sell',
  quantity: 2, avgEntryPrice: 3000, currentPrice: 2900, unrealisedPnl: 200, realisedPnl: 0,
  status: 'open', openedAt: '2026-01-02T00:00:00.000Z', currency: 'USD', leverage: 1,
};

const ORDER_A = {
  id: 'ord_a', userId: 'user_a', symbol: 'BTC/USD', assetClass: 'crypto', side: 'buy', type: 'market',
  quantity: 0.5, filledQty: 0.5, status: 'filled', currency: 'USD', leverage: 1,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};
const ORDER_B = {
  id: 'ord_b', userId: 'user_b', symbol: 'ETH/USD', assetClass: 'crypto', side: 'sell', type: 'limit',
  quantity: 2, filledQty: 2, status: 'filled', currency: 'USD', leverage: 1,
  createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
};

const TRADE_A = {
  id: 'trd_a', userId: 'user_a', orderId: 'ord_a', positionId: 'pos_a', symbol: 'BTC/USD',
  assetClass: 'crypto', side: 'buy', quantity: 0.5, price: 60000, fee: 12, currency: 'USD',
  executedAt: '2026-01-01T00:00:00.000Z', pnl: 500,
};
const TRADE_B = {
  id: 'trd_b', userId: 'user_b', orderId: 'ord_b', positionId: 'pos_b', symbol: 'ETH/USD',
  assetClass: 'crypto', side: 'sell', quantity: 2, price: 2900, fee: 6, currency: 'USD',
  executedAt: '2026-01-02T00:00:00.000Z', pnl: -200,
};

describe('tradingStore.flatfile', () => {
  beforeEach(() => {
    Object.keys(mockFiles).forEach(k => delete mockFiles[k]);
    vi.resetModules();
  });

  describe('empty dataset', () => {
    it('getAllPositions returns [] when no positions file exists', async () => {
      const { getAllPositions } = await import('../../server/lib/tradingStore.flatfile.js');
      expect(getAllPositions()).toEqual([]);
    });

    it('getAllOrders returns [] when no orders file exists', async () => {
      const { getAllOrders } = await import('../../server/lib/tradingStore.flatfile.js');
      expect(getAllOrders()).toEqual([]);
    });

    it('getAllTrades returns [] when no trades file exists', async () => {
      const { getAllTrades } = await import('../../server/lib/tradingStore.flatfile.js');
      expect(getAllTrades()).toEqual([]);
    });
  });

  describe('populated dataset', () => {
    beforeEach(() => {
      mockFiles['positions.jsonl'] = jsonl([POSITION_A, POSITION_B]);
      mockFiles['orders.jsonl'] = jsonl([ORDER_A, ORDER_B]);
      mockFiles['trades.jsonl'] = jsonl([TRADE_A, TRADE_B]);
    });

    it('getAllPositions returns every persisted position across all users', async () => {
      const { getAllPositions } = await import('../../server/lib/tradingStore.flatfile.js');
      const all = getAllPositions();
      expect(all).toHaveLength(2);
      expect(all.map(p => p.id).sort()).toEqual(['pos_a', 'pos_b']);
      expect(all.map(p => p.userId).sort()).toEqual(['user_a', 'user_b']);
    });

    it('getAllOrders returns every persisted order across all users', async () => {
      const { getAllOrders } = await import('../../server/lib/tradingStore.flatfile.js');
      const all = getAllOrders();
      expect(all).toHaveLength(2);
      expect(all.map(o => o.id).sort()).toEqual(['ord_a', 'ord_b']);
    });

    it('getAllTrades returns every persisted trade across all users', async () => {
      const { getAllTrades } = await import('../../server/lib/tradingStore.flatfile.js');
      const all = getAllTrades();
      expect(all).toHaveLength(2);
      expect(all.map(t => t.id).sort()).toEqual(['trd_a', 'trd_b']);
      const totalPnl = all.reduce((s, t) => s + (t.pnl ?? 0), 0);
      expect(totalPnl).toBe(300); // 500 + (-200), matches admin/trading overview's aggregation
    });

    it('getPositions(userId) still filters to a single user (no regression)', async () => {
      const { getPositions } = await import('../../server/lib/tradingStore.flatfile.js');
      expect(getPositions('user_a')).toEqual([POSITION_A]);
      expect(getPositions('user_b')).toEqual([POSITION_B]);
      expect(getPositions('nonexistent_user')).toEqual([]);
    });

    it('getOrders(userId) still filters to a single user (no regression)', async () => {
      const { getOrders } = await import('../../server/lib/tradingStore.flatfile.js');
      expect(getOrders('user_a')).toEqual([ORDER_A]);
      expect(getOrders('user_b')).toEqual([ORDER_B]);
    });

    it('getTrades(userId) still filters to a single user (no regression)', async () => {
      const { getTrades } = await import('../../server/lib/tradingStore.flatfile.js');
      expect(getTrades('user_a')).toEqual([TRADE_A]);
      expect(getTrades('user_b')).toEqual([TRADE_B]);
    });

    it('getAllPositions and getPositions read from the same underlying data (no drift)', async () => {
      const { getAllPositions, getPositions } = await import('../../server/lib/tradingStore.flatfile.js');
      const all = getAllPositions();
      const perUser = [...getPositions('user_a'), ...getPositions('user_b')];
      expect(perUser.sort((a, b) => a.id.localeCompare(b.id)))
        .toEqual(all.sort((a, b) => a.id.localeCompare(b.id)));
    });
  });
});
