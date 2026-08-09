import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const auditedFiles = [
  'src/content/pages/home.json',
  'src/pages/wallet.tsx',
  'src/pages/transfers.tsx',
  'src/pages/compliance.tsx',
  'src/pages/admin/cms.tsx',
  'src/server/lib/cmsExtStore.ts',
  'src/server/lib/nurtureSequence.ts',
];

function auditedCopy(): string {
  return auditedFiles
    .map((file) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'))
    .join('\n');
}

describe('public financial claims', () => {
  it('does not publish unsupported live-service claims in audited defaults', () => {
    const copy = auditedCopy();
    const prohibited = [
      'funds are FDIC insured up to $250,000',
      'Trusted by Thousands',
      'Your money is always safe',
      'No foreign transaction fees, ever',
      'KYC verification takes 1–2 business days',
      'Instant global money transfers, deposits, and withdrawals',
      'Exchange between crypto and fiat currencies instantly at the real mid-market rate',
    ];

    for (const claim of prohibited) expect(copy).not.toContain(claim);
  });
});
