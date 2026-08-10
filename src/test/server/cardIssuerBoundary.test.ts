import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import {
  LIVE_CARD_ISSUER_ADAPTER_IMPLEMENTED,
  requireCardOperations,
} from '../../server/lib/platformMode.js';

function responseMock() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { response: { status } as unknown as Response, status, json };
}

describe('card issuer boundary', () => {
  it('cannot be enabled by environment configuration', () => {
    const { response, status, json } = responseMock();

    expect(LIVE_CARD_ISSUER_ADAPTER_IMPLEMENTED).toBe(false);
    expect(requireCardOperations(response)).toBe(false);
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'CARD_ISSUER_ADAPTER_UNAVAILABLE',
    }));
  });

  it('uses masked metadata queries for administrator and customer card lists', () => {
    const adminRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/server/api/admin/cards/GET.ts'),
      'utf8',
    );
    const customerRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/server/api/users/cards/GET.ts'),
      'utf8',
    );
    const activityRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/server/api/admin/cards/[id]/activity/GET.ts'),
      'utf8',
    );

    expect(adminRoute).toContain('getAllCardSummaries');
    expect(adminRoute).not.toMatch(/getAllCards|findCardById|numberFull|cvv/);
    expect(customerRoute).toContain('getCardSummariesForUser');
    expect(customerRoute).not.toMatch(/getCardsForUser|numberFull|cvv/);
    expect(activityRoute).toContain('findCardSummaryById');
    expect(activityRoute).not.toContain('findCardById');
  });

  it('keeps both card workspaces read-only and accurately labelled', () => {
    const adminPage = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/admin/cards.tsx'),
      'utf8',
    );
    const customerPage = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/dashboard/cards.tsx'),
      'utf8',
    );

    expect(adminPage).toContain('Read-only synthetic records');
    expect(adminPage).toContain('CARD_OPERATIONS_AVAILABLE = false');
    expect(customerPage).toContain('Read-only synthetic card records');
    expect(customerPage).not.toMatch(/numberFull|revealedCvv|handleFreezeToggle|handleRequestCard/);
  });
});
