/**
 * seedFromFlatFiles.ts
 * Populates all /private/* flat-file stores with realistic demo data.
 * Safe to re-run — skips any store that already has data.
 *
 * Usage:  npx tsx src/server/db/seedFromFlatFiles.ts
 */

import fs   from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// ─── helpers ────────────────────────────────────────────────────────────────

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJsonl(filePath: string, rows: object[]) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function fileHasData(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8').trim();
  return content.length > 0 && content !== '[]' && content !== '{}';
}

function uid(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function ref(): string {
  return 'CGC' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ─── 1. USERS ────────────────────────────────────────────────────────────────

const USERS_FILE = '/private/users/users.jsonl';

interface SeedUser { id: string; email: string; name: string; ip: string; status: string; kycStatus: string; }

async function seedUsers(): Promise<SeedUser[]> {
  if (fileHasData(USERS_FILE)) { console.log('  users: already seeded — skipping'); return []; }

  const hash = await bcrypt.hash('Password1!', 10);

  const users = [
    {
      id: uid('usr'), email: 'alice.johnson@example.com', name: 'Alice Johnson',
      phone: '+1-555-0101', country: 'US', status: 'active', kycStatus: 'approved',
      emailVerified: true, passwordHash: hash, loginAttempts: 0,
      createdAt: daysAgo(90), updatedAt: daysAgo(1), approvedAt: daysAgo(85),
      approvedBy: 'admin@citygate.capital', lastLoginAt: daysAgo(1),
      lastLoginIp: '192.168.1.10', ip: '192.168.1.10',
      dateOfBirth: '1990-03-15', address: '123 Main St', city: 'New York',
      postalCode: '10001', idType: 'passport', idNumber: 'US123456789',
      kycSubmittedAt: daysAgo(88), kycApprovedAt: daysAgo(85),
      accountTier: 'personal', primaryCurrency: 'USD',
    },
    {
      id: uid('usr'), email: 'bob.smith@example.com', name: 'Bob Smith',
      phone: '+44-7700-900123', country: 'GB', status: 'active', kycStatus: 'approved',
      emailVerified: true, passwordHash: hash, loginAttempts: 0,
      createdAt: daysAgo(60), updatedAt: daysAgo(3), approvedAt: daysAgo(55),
      approvedBy: 'admin@citygate.capital', lastLoginAt: daysAgo(3),
      lastLoginIp: '10.0.0.5', ip: '10.0.0.5',
      dateOfBirth: '1985-07-22', address: '45 Baker Street', city: 'London',
      postalCode: 'NW1 6XE', idType: 'national_id', idNumber: 'GB987654321',
      kycSubmittedAt: daysAgo(58), kycApprovedAt: daysAgo(55),
      accountTier: 'savings', primaryCurrency: 'GBP',
    },
    {
      id: uid('usr'), email: 'carla.mendes@example.com', name: 'Carla Mendes',
      phone: '+49-30-12345678', country: 'DE', status: 'active', kycStatus: 'approved',
      emailVerified: true, passwordHash: hash, loginAttempts: 0,
      createdAt: daysAgo(45), updatedAt: daysAgo(2), approvedAt: daysAgo(40),
      approvedBy: 'operations@citygate.capital', lastLoginAt: daysAgo(2),
      lastLoginIp: '172.16.0.3', ip: '172.16.0.3',
      dateOfBirth: '1992-11-08', address: 'Unter den Linden 1', city: 'Berlin',
      postalCode: '10117', idType: 'passport', idNumber: 'DE456789012',
      kycSubmittedAt: daysAgo(43), kycApprovedAt: daysAgo(40),
      accountTier: 'business', primaryCurrency: 'EUR',
    },
    {
      id: uid('usr'), email: 'david.okafor@example.com', name: 'David Okafor',
      phone: '+234-801-234-5678', country: 'NG', status: 'pending_kyc', kycStatus: 'submitted',
      emailVerified: true, passwordHash: hash, loginAttempts: 0,
      createdAt: daysAgo(10), updatedAt: daysAgo(8),
      lastLoginAt: daysAgo(8), lastLoginIp: '41.58.0.1', ip: '41.58.0.1',
      dateOfBirth: '1995-05-30', address: '7 Victoria Island', city: 'Lagos',
      postalCode: '101241', idType: 'national_id', idNumber: 'NG112233445',
      kycSubmittedAt: daysAgo(8),
      accountTier: 'personal', primaryCurrency: 'USD',
    },
    {
      id: uid('usr'), email: 'emily.chen@example.com', name: 'Emily Chen',
      phone: '+65-9123-4567', country: 'SG', status: 'pending_approval', kycStatus: 'submitted',
      emailVerified: true, passwordHash: hash, loginAttempts: 0,
      createdAt: daysAgo(5), updatedAt: daysAgo(4),
      lastLoginAt: daysAgo(4), lastLoginIp: '203.0.113.42', ip: '203.0.113.42',
      dateOfBirth: '1998-01-19', address: '1 Raffles Place', city: 'Singapore',
      postalCode: '048616', idType: 'passport', idNumber: 'SG778899001',
      kycSubmittedAt: daysAgo(4),
      accountTier: 'personal', primaryCurrency: 'SGD',
    },
    {
      id: uid('usr'), email: 'frank.mueller@example.com', name: 'Frank Müller',
      phone: '+41-44-123-4567', country: 'CH', status: 'suspended', kycStatus: 'approved',
      emailVerified: true, passwordHash: hash, loginAttempts: 5,
      createdAt: daysAgo(120), updatedAt: daysAgo(7),
      lastLoginAt: daysAgo(7), lastLoginIp: '195.148.127.1', ip: '195.148.127.1',
      dateOfBirth: '1978-09-03', address: 'Bahnhofstrasse 10', city: 'Zurich',
      postalCode: '8001', idType: 'passport', idNumber: 'CH334455667',
      kycSubmittedAt: daysAgo(115), kycApprovedAt: daysAgo(112),
      accountTier: 'business', primaryCurrency: 'CHF',
    },
    {
      id: uid('usr'), email: 'grace.kim@example.com', name: 'Grace Kim',
      phone: '+82-10-1234-5678', country: 'KR', status: 'active', kycStatus: 'approved',
      emailVerified: true, passwordHash: hash, loginAttempts: 0,
      createdAt: daysAgo(30), updatedAt: daysAgo(1), approvedAt: daysAgo(25),
      approvedBy: 'admin@citygate.capital', lastLoginAt: daysAgo(1),
      lastLoginIp: '1.234.56.78', ip: '1.234.56.78',
      dateOfBirth: '1993-12-25', address: '123 Gangnam-daero', city: 'Seoul',
      postalCode: '06000', idType: 'national_id', idNumber: 'KR556677889',
      kycSubmittedAt: daysAgo(28), kycApprovedAt: daysAgo(25),
      accountTier: 'savings', primaryCurrency: 'USD',
    },
    {
      id: uid('usr'), email: 'hassan.al-rashid@example.com', name: 'Hassan Al-Rashid',
      phone: '+971-50-123-4567', country: 'AE', status: 'active', kycStatus: 'approved',
      emailVerified: true, passwordHash: hash, loginAttempts: 0,
      createdAt: daysAgo(20), updatedAt: daysAgo(2), approvedAt: daysAgo(15),
      approvedBy: 'operations@citygate.capital', lastLoginAt: daysAgo(2),
      lastLoginIp: '5.62.0.1', ip: '5.62.0.1',
      dateOfBirth: '1980-06-14', address: 'Sheikh Zayed Road', city: 'Dubai',
      postalCode: '00000', idType: 'passport', idNumber: 'AE998877665',
      kycSubmittedAt: daysAgo(18), kycApprovedAt: daysAgo(15),
      accountTier: 'business', primaryCurrency: 'AED',
    },
  ];

  writeJsonl(USERS_FILE, users);
  console.log(`  users: seeded ${users.length} records`);
  return users;
}

// ─── 2. TRANSACTIONS ─────────────────────────────────────────────────────────

const TX_FILE = '/private/transactions/transactions.jsonl';

function seedTransactions(users: SeedUser[]) {
  if (fileHasData(TX_FILE)) { console.log('  transactions: already seeded — skipping'); return; }
  if (!users.length) { console.log('  transactions: no users — skipping'); return; }

  const active = users.filter(u => u.status === 'active');
  const txs: object[] = [];

  const types: Array<{ type: string; currency: string; amount: number; description: string; status: string }> = [
    { type: 'deposit',      currency: 'USD', amount: 50000,  description: 'Initial account funding',          status: 'completed' },
    { type: 'deposit',      currency: 'USD', amount: 12500,  description: 'Wire transfer from Chase Bank',    status: 'completed' },
    { type: 'withdrawal',   currency: 'USD', amount: 3200,   description: 'Withdrawal to personal account',   status: 'completed' },
    { type: 'transfer',     currency: 'EUR', amount: 8750,   description: 'International transfer to Berlin', status: 'completed' },
    { type: 'crypto_buy',   currency: 'BTC', amount: 0.5,    description: 'Bitcoin purchase',                 status: 'completed' },
    { type: 'crypto_sell',  currency: 'ETH', amount: 2.3,    description: 'Ethereum sale',                    status: 'completed' },
    { type: 'deposit',      currency: 'GBP', amount: 7500,   description: 'SWIFT inbound from Barclays',      status: 'completed' },
    { type: 'wire_transfer',currency: 'USD', amount: 25000,  description: 'Wire to HSBC Hong Kong',           status: 'pending'   },
    { type: 'deposit',      currency: 'USD', amount: 1000,   description: 'Test deposit',                     status: 'pending'   },
    { type: 'withdrawal',   currency: 'EUR', amount: 4500,   description: 'Withdrawal to EU account',         status: 'failed'    },
    { type: 'manual_credit',currency: 'USD', amount: 500,    description: 'Admin adjustment — fee reversal',  status: 'completed' },
    { type: 'fee',          currency: 'USD', amount: 25,     description: 'Monthly account maintenance fee',  status: 'completed' },
    { type: 'crypto_buy',   currency: 'USDT',amount: 5000,   description: 'USDT purchase',                    status: 'completed' },
    { type: 'transfer',     currency: 'USD', amount: 15000,  description: 'Internal transfer',                status: 'flagged'   },
    { type: 'deposit',      currency: 'AED', amount: 100000, description: 'AED deposit from Emirates NBD',    status: 'completed' },
  ];

  active.forEach((user, ui) => {
    const count = 3 + (ui % 4);
    for (let i = 0; i < count; i++) {
      const t = types[(ui * 3 + i) % types.length];
      const daysBack = Math.floor(Math.random() * 60) + 1;
      txs.push({
        id:          uid('tx'),
        type:        t.type,
        status:      t.status,
        userId:      user.id,
        userName:    user.name,
        userEmail:   user.email,
        amount:      t.amount,
        currency:    t.currency,
        reference:   ref(),
        description: t.description,
        flagged:     t.status === 'flagged',
        ip:          user.ip,
        createdAt:   daysAgo(daysBack),
        updatedAt:   daysAgo(daysBack - 1 > 0 ? daysBack - 1 : 0),
        ...(t.status === 'completed' ? { approvedBy: 'admin@citygate.capital', approvedAt: daysAgo(daysBack - 1 > 0 ? daysBack - 1 : 0) } : {}),
      });
    }
  });

  writeJsonl(TX_FILE, txs);
  console.log(`  transactions: seeded ${txs.length} records`);
}

// ─── 3. SUPPORT CONVERSATIONS ─────────────────────────────────────────────────

const SUPPORT_FILE = '/private/support/conversations.jsonl';
const CANNED_FILE  = '/private/support/canned-responses.json';
const ROUTING_FILE = '/private/support/routing-rules.json';

function seedSupport(users: SeedUser[]) {
  if (!fileHasData(SUPPORT_FILE)) {
    const convos: object[] = [];
    const subjects = [
      'Unable to complete wire transfer',
      'KYC document upload failing',
      'Account balance discrepancy',
      'Request to increase withdrawal limit',
      'Two-factor authentication not working',
      'Suspicious login activity on my account',
    ];
    const statuses = ['open', 'in_progress', 'resolved', 'closed'];
    const priorities = ['low', 'medium', 'high', 'urgent'];

    users.slice(0, 6).forEach((user, i) => {
      const convoId = uid('conv');
      const createdDays = 5 + i * 3;
      convos.push({
        id:         convoId,
        userId:     user.id,
        userName:   user.name,
        userEmail:  user.email,
        subject:    subjects[i % subjects.length],
        status:     statuses[i % statuses.length],
        priority:   priorities[i % priorities.length],
        assignedTo: i % 2 === 0 ? 'operations@citygate.capital' : null,
        channel:    i % 3 === 0 ? 'email' : 'chat',
        tags:       i % 2 === 0 ? ['billing'] : ['technical'],
        slaBreached: i === 5,
        messages: [
          {
            id:        uid('msg'),
            role:      'customer',
            content:   `Hello, I need help with: ${subjects[i % subjects.length].toLowerCase()}.`,
            createdAt: daysAgo(createdDays),
            read:      true,
          },
          {
            id:        uid('msg'),
            role:      'agent',
            content:   'Thank you for reaching out. We are looking into this for you and will respond within 24 hours.',
            agentName: 'Support Team',
            createdAt: daysAgo(createdDays - 1),
            read:      true,
          },
        ],
        createdAt:  daysAgo(createdDays),
        updatedAt:  daysAgo(createdDays - 1),
      });
    });

    writeJsonl(SUPPORT_FILE, convos);
    console.log(`  support conversations: seeded ${convos.length} records`);
  } else {
    console.log('  support conversations: already seeded — skipping');
  }

  if (!fileHasData(CANNED_FILE)) {
    const canned = [
      { id: uid('cr'), title: 'Welcome greeting',         category: 'general',   content: 'Thank you for contacting City Gate Capital support. How can we assist you today?', usageCount: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
      { id: uid('cr'), title: 'KYC pending response',     category: 'kyc',       content: 'Your KYC documents are currently under review. This process typically takes 1–3 business days. We will notify you by email once complete.', usageCount: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
      { id: uid('cr'), title: 'Transfer delay explanation',category: 'transfers', content: 'International wire transfers can take 2–5 business days depending on the destination bank and correspondent banking relationships. Your reference number is available in your transaction history.', usageCount: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
      { id: uid('cr'), title: 'Account suspended notice', category: 'compliance',content: 'Your account has been temporarily suspended pending a compliance review. Our team will contact you within 48 hours with further instructions.', usageCount: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
      { id: uid('cr'), title: 'Closing / resolved',       category: 'general',   content: 'We are glad we could assist you today. If you have any further questions, please do not hesitate to contact us. Have a great day!', usageCount: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
    ];
    writeJson(CANNED_FILE, canned);
    console.log(`  canned responses: seeded ${canned.length} records`);
  } else {
    console.log('  canned responses: already seeded — skipping');
  }

  if (!fileHasData(ROUTING_FILE)) {
    const rules = [
      { id: uid('rr'), name: 'KYC issues → Compliance',   condition: 'subject_contains', value: 'kyc',       assignTo: 'operations@citygate.capital', priority: 'high',   active: true, createdAt: daysAgo(30) },
      { id: uid('rr'), name: 'Transfers → Finance',        condition: 'subject_contains', value: 'transfer',  assignTo: 'operations@citygate.capital', priority: 'medium', active: true, createdAt: daysAgo(30) },
      { id: uid('rr'), name: 'Security alerts → Security', condition: 'subject_contains', value: 'suspicious',assignTo: 'admin@citygate.capital',      priority: 'urgent', active: true, createdAt: daysAgo(30) },
    ];
    writeJson(ROUTING_FILE, rules);
    console.log(`  routing rules: seeded ${rules.length} records`);
  } else {
    console.log('  routing rules: already seeded — skipping');
  }
}

// ─── 4. SECURITY FLAGS ────────────────────────────────────────────────────────

const FLAGS_FILE = '/private/security/flags.jsonl';
const IP_FILE    = '/private/security/ip-lists.json';

function seedSecurity(users: SeedUser[]) {
  if (!fileHasData(FLAGS_FILE)) {
    const flags: object[] = [];
    const flagTypes = ['suspicious_login', 'multiple_failed_logins', 'unusual_transfer_amount', 'geo_anomaly', 'velocity_breach'];
    const severities = ['low', 'medium', 'high', 'critical'];

    users.slice(0, 4).forEach((user, i) => {
      flags.push({
        id:          uid('flag'),
        userId:      user.id,
        userName:    user.name,
        userEmail:   user.email,
        type:        flagTypes[i % flagTypes.length],
        severity:    severities[i % severities.length],
        description: `Automated detection: ${flagTypes[i % flagTypes.length].replace(/_/g, ' ')} for user ${user.email}`,
        ip:          user.ip,
        resolved:    i >= 2,
        resolvedBy:  i >= 2 ? 'admin@citygate.capital' : undefined,
        resolvedAt:  i >= 2 ? daysAgo(1) : undefined,
        createdAt:   daysAgo(5 + i),
        updatedAt:   daysAgo(i >= 2 ? 1 : 5 + i),
      });
    });

    writeJsonl(FLAGS_FILE, flags);
    console.log(`  security flags: seeded ${flags.length} records`);
  } else {
    console.log('  security flags: already seeded — skipping');
  }

  if (!fileHasData(IP_FILE)) {
    writeJson(IP_FILE, {
      blocklist: ['185.220.101.1', '45.142.212.100'],
      allowlist: ['127.0.0.1', '::1'],
    });
    console.log('  ip lists: seeded');
  } else {
    console.log('  ip lists: already seeded — skipping');
  }
}

// ─── 5. NEWSLETTER SUBSCRIBERS ───────────────────────────────────────────────

const SUBS_FILE = '/private/newsletter/subscribers.jsonl';

function seedSubscribers() {
  if (fileHasData(SUBS_FILE)) { console.log('  subscribers: already seeded — skipping'); return; }

  const subs = [
    { id: uid('sub'), email: 'alice.johnson@example.com', name: 'Alice Johnson', status: 'active', source: 'website', subscribedAt: daysAgo(90), tags: ['personal'], sequenceStep: 3, lastEmailAt: daysAgo(7) },
    { id: uid('sub'), email: 'bob.smith@example.com',     name: 'Bob Smith',     status: 'active', source: 'website', subscribedAt: daysAgo(60), tags: ['savings'],  sequenceStep: 2, lastEmailAt: daysAgo(14) },
    { id: uid('sub'), email: 'carla.mendes@example.com',  name: 'Carla Mendes',  status: 'active', source: 'import',  subscribedAt: daysAgo(45), tags: ['business'], sequenceStep: 1, lastEmailAt: daysAgo(21) },
    { id: uid('sub'), email: 'grace.kim@example.com',     name: 'Grace Kim',     status: 'active', source: 'website', subscribedAt: daysAgo(30), tags: ['personal'], sequenceStep: 0, lastEmailAt: null },
    { id: uid('sub'), email: 'hassan.al-rashid@example.com', name: 'Hassan Al-Rashid', status: 'active', source: 'referral', subscribedAt: daysAgo(20), tags: ['business'], sequenceStep: 0, lastEmailAt: null },
    { id: uid('sub'), email: 'prospect1@example.com',     name: 'James Walker',  status: 'active', source: 'website', subscribedAt: daysAgo(15), tags: ['personal'], sequenceStep: 0, lastEmailAt: null },
    { id: uid('sub'), email: 'prospect2@example.com',     name: 'Sofia Rossi',   status: 'active', source: 'website', subscribedAt: daysAgo(10), tags: ['savings'],  sequenceStep: 0, lastEmailAt: null },
    { id: uid('sub'), email: 'unsubscribed@example.com',  name: 'Old Contact',   status: 'unsubscribed', source: 'website', subscribedAt: daysAgo(180), unsubscribedAt: daysAgo(30), tags: [], sequenceStep: 0, lastEmailAt: daysAgo(35) },
  ];

  writeJsonl(SUBS_FILE, subs);
  console.log(`  subscribers: seeded ${subs.length} records`);
}

// ─── 6. KYC NOTES ────────────────────────────────────────────────────────────

const KYC_NOTES_FILE = '/private/kyc/notes.jsonl';

function seedKycNotes(users: SeedUser[]) {
  if (fileHasData(KYC_NOTES_FILE)) { console.log('  kyc notes: already seeded — skipping'); return; }

  const notes: object[] = [];
  const pendingUsers = users.filter(u => u.kycStatus === 'submitted');

  pendingUsers.forEach((user, i) => {
    notes.push({
      id:        uid('kn'),
      userId:    user.id,
      userEmail: user.email,
      note:      i === 0
        ? 'Documents appear genuine. Passport photo matches selfie. Awaiting address verification.'
        : 'ID document uploaded. Selfie quality is acceptable. Pending final compliance sign-off.',
      addedBy:   'operations@citygate.capital',
      createdAt: daysAgo(2),
    });
  });

  if (notes.length) {
    writeJsonl(KYC_NOTES_FILE, notes);
    console.log(`  kyc notes: seeded ${notes.length} records`);
  } else {
    console.log('  kyc notes: no pending KYC users — skipping');
  }
}

// ─── 7. WALLET ADDRESSES ─────────────────────────────────────────────────────

const WALLETS_FILE = '/private/wallets/addresses.jsonl';

function seedWallets(users: SeedUser[]) {
  if (fileHasData(WALLETS_FILE)) { console.log('  wallets: already seeded — skipping'); return; }

  const wallets: object[] = [];
  const networks = ['BTC', 'ETH', 'USDT', 'SOL'];
  const sampleAddresses: Record<string, string[]> = {
    BTC:  ['1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'],
    ETH:  ['0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BA'],
    USDT: ['0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BA'],
    SOL:  ['DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm32hy', 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'],
  };

  users.filter(u => u.status === 'active').slice(0, 4).forEach((user, ui) => {
    const net = networks[ui % networks.length];
    const addr = sampleAddresses[net][ui % 2];
    wallets.push({
      id:        uid('wa'),
      userId:    user.id,
      userEmail: user.email,
      network:   net,
      address:   addr,
      label:     `${user.name}'s ${net} wallet`,
      active:    true,
      createdAt: daysAgo(30 - ui * 5),
      updatedAt: daysAgo(30 - ui * 5),
    });
  });

  writeJsonl(WALLETS_FILE, wallets);
  console.log(`  wallets: seeded ${wallets.length} records`);
}

// ─── 8. AUDIT LOG ────────────────────────────────────────────────────────────

const AUDIT_FILE = '/private/audit/log.jsonl';

function seedAuditLog(users: SeedUser[]) {
  if (fileHasData(AUDIT_FILE)) { console.log('  audit log: already seeded — skipping'); return; }

  const entries: object[] = [];
  const actions = [
    { action: 'user.approved',    actor: 'admin@citygate.capital',      detail: 'User account approved after KYC review' },
    { action: 'kyc.approved',     actor: 'operations@citygate.capital', detail: 'KYC documents verified and approved' },
    { action: 'user.suspended',   actor: 'admin@citygate.capital',      detail: 'Account suspended — compliance review' },
    { action: 'tx.approved',      actor: 'operations@citygate.capital', detail: 'Wire transfer approved' },
    { action: 'admin.login',      actor: 'admin@citygate.capital',      detail: 'Admin login from 127.0.0.1' },
    { action: 'rates.updated',    actor: 'operations@citygate.capital', detail: 'FX markup updated for EUR corridor' },
    { action: 'security.flag',    actor: 'system',                      detail: 'Automated security flag raised' },
    { action: 'balance.adjusted', actor: 'admin@citygate.capital',      detail: 'Manual credit applied — fee reversal' },
  ];

  actions.forEach((a, i) => {
    entries.push({
      id:        uid('al'),
      action:    a.action,
      actor:     a.actor,
      targetId:  users[i % users.length]?.id,
      detail:    a.detail,
      ip:        '127.0.0.1',
      createdAt: daysAgo(i + 1),
    });
  });

  writeJsonl(AUDIT_FILE, entries);
  console.log(`  audit log: seeded ${entries.length} records`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  City Gate Capital — flat-file seed\n');

  const users = await seedUsers();
  seedTransactions(users);
  seedSupport(users);
  seedSecurity(users);
  seedSubscribers();
  seedKycNotes(users);
  seedWallets(users);
  seedAuditLog(users);

  console.log('\n✅  Seed complete.\n');
  console.log('  Demo login credentials (all accounts):');
  console.log('  Email:    see above (alice.johnson@example.com, bob.smith@example.com, etc.)');
  console.log('  Password: Password1!\n');
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
