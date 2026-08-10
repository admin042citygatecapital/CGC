import { readFile } from 'node:fs/promises';

const publicCopyFiles = [
  'src/pages/index.tsx',
  'src/pages/about.tsx',
  'src/pages/accounts.tsx',
  'src/pages/support.tsx',
  'src/pages/digital-banking.tsx',
  'src/pages/wallet.tsx',
  'src/pages/transfers.tsx',
  'src/pages/register.tsx',
  'src/pages/kyc.tsx',
  'src/pages/dashboard/deposits.tsx',
  'src/pages/admin/crypto.tsx',
  'src/components/AccountOpeningModal.tsx',
  'src/components/TawkWidget.tsx',
  'src/content/pages/home.json',
  'src/layouts/parts/Footer.tsx',
  'src/sections/BankingModule.tsx',
  'src/sections/InvestmentsModule.tsx',
  'src/server/lib/homepageContent.ts',
  'src/server/lib/configStore.ts',
  'src/server/lib/supportStore.ts',
  'src/server/lib/smartsuppStore.ts',
  'src/lib/chatbot/chat-config.ts',
  'src/lib/site-meta.ts',
];

const prohibited = [
  /FDIC insured/i,
  /FSCS/i,
  /regulated in 40\+ jurisdictions/i,
  /2M\+ (?:active )?customers/i,
  /\$50B\+ (?:in )?assets/i,
  /5\.2% APY/i,
  /SOC 2 Type II compliant/i,
  /CGCBGB2L/i,
  /City Gate Capital Bank/i,
  /GB29\s+CGCB/i,
  /40-47-84/i,
  /premium digital banking platform offering/i,
  /premier digital banking and investment platform/i,
  /Your funds are secure and being processed/i,
  /platform custody wallets/i,
  /bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh/i,
  /0x742d35Cc6634C0532925a3b8D4C9C2B4E1A2F3D/i,
  /TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE/i,
];

const violations = [];
for (const file of publicCopyFiles) {
  const source = await readFile(file, 'utf8');
  for (const pattern of prohibited) {
    if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
  }
}

if (violations.length) {
  throw new Error(`Unsupported public financial claims detected:\n${violations.join('\n')}`);
}

console.log(JSON.stringify({ ok: true, checkedFiles: publicCopyFiles.length }));
