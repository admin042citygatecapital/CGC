import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const auditedFiles = [
  'src/content/pages/home.json',
  'src/pages/wallet.tsx',
  'src/pages/transfers.tsx',
  'src/pages/compliance.tsx',
  'src/pages/contact.tsx',
  'src/pages/terms-of-service.tsx',
  'src/pages/accounts.tsx',
  'src/pages/support.tsx',
  'src/pages/digital-banking.tsx',
  'src/components/AccountOpeningModal.tsx',
  'src/sections/InvestmentsModule.tsx',
  'src/pages/admin/cms.tsx',
  'src/server/lib/cmsExtStore.ts',
  'src/server/lib/emailTemplateStore.ts',
  'src/server/lib/emailService.ts',
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
      'We are registered with the Financial Conduct Authority',
      'We operate in 40+ jurisdictions',
      'certified to ISO 27001 and SOC 2 Type II',
      'certified to PCI DSS Level 1',
      'Global offices in London, New York, Singapore',
      'Our registered address is City Gate Capital Ltd',
      'Open in Under 5 Minutes',
      'AI-powered identity verification means no waiting',
      'Instant global transfers, deposits, and withdrawals',
      'Send money globally, deposit funds, and withdraw to your bank or crypto wallet',
      'Instant virtual card issuance',
      'available 24/7',
      'under 2 minutes',
      'forfeiture of any pending transactions',
      'settlement of any pending transactions and the return of your balance',
      "City Gate Capital's AI banking assistant",
      'Zero FX fees have saved me hundreds of dollars',
      'Start free. Upgrade when you need more power.',
      'complete your KYC identity verification to unlock full banking access',
      'Your deposit has been confirmed and credited to your account',
      'Your withdrawal request has been approved and is being processed',
      'Your transfer has been sent successfully',
      'You have received a transfer to your City Gate Capital account',
      'Your City Gate Capital account balance has been updated by our finance team',
      'A new user has registered and is awaiting KYC review',
    ];

    for (const claim of prohibited) expect(copy).not.toContain(claim);
  });
});
