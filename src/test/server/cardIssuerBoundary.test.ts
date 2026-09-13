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
    const digitalBankingPage = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/digital-banking.tsx'),
      'utf8',
    );

    expect(adminPage).toContain('Read-only synthetic records');
    expect(adminPage).toContain('CARD_PROVIDER_NOT_CONFIGURED');
    expect(customerPage).toContain('Read-only synthetic card records');
    expect(customerPage).not.toMatch(/numberFull|revealedCvv|handleFreezeToggle|handleRequestCard/);
    expect(digitalBankingPage).toContain('Virtual Card Experience');
    expect(digitalBankingPage).toContain('Physical Card Experience');
    expect(digitalBankingPage).toContain('approved issuer or programme');
    expect(digitalBankingPage).not.toMatch(/generateCard|freezeCard|deleteCard|\/api\/users\/cards\/generate/);
  });

  it('refuses every administrator card mutation with a structured provider-not-configured response', () => {
    for (const route of [
      'src/server/api/admin/cards/issue/POST.ts',
      'src/server/api/admin/cards/freeze/POST.ts',
      'src/server/api/admin/cards/pin/POST.ts',
      'src/server/api/admin/cards/replace/POST.ts',
      'src/server/api/admin/cards/spending-limit/POST.ts',
    ]) {
      const source = fs.readFileSync(path.resolve(process.cwd(), route), 'utf8');
      expect(source).toContain('LIVE_CARD_ISSUER_ADAPTER_IMPLEMENTED');
      expect(source).toMatch(/res\.status\(501\)\.json\(\{\s*error:/);
      expect(source).toContain("code: 'CARD_PROVIDER_NOT_CONFIGURED'");
      expect(source).toContain('issuer-processor is contracted');
    }
  });

  it('maps every issuer-controlled capability without pretending an adapter exists', () => {
    const map = fs.readFileSync(
      path.resolve(process.cwd(), 'src/server/lib/financialCapabilityMap.ts'),
      'utf8',
    );
    for (const key of [
      'card_issuer_processor',
      'card_controls',
      'card_authentication_tokenisation',
      'card_disputes',
      'crypto_custody',
      'crypto_execution',
      'blockchain_screening',
      'strong_authentication',
      'fraud_monitoring',
      'security_assurance',
    ]) expect(map).toContain(`key: "${key}"`);
    expect(map).toContain('does not generate PAN, CVV or PIN values');
    expect(map).toContain('does not create or retain private keys');
  });
});
