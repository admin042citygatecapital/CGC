/**
 * Creates or refreshes the customer used to review the dashboard locally.
 * This script is deliberately disabled in production and requires an
 * explicit opt-in environment flag.
 */
import { hashPassword } from '../src/server/lib/passwordHash.js';
import { createUser, findUserByEmail, updateUser } from '../src/server/lib/userStore.js';

const email = 'demo.user@citygate.local';
const password = 'CGC-Demo-2026!';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Local demo users cannot be created in production.');
}

if (process.env.ENABLE_LOCAL_DEMO_USER !== '1') {
  throw new Error('Set ENABLE_LOCAL_DEMO_USER=1 to create the local demo user.');
}

if (process.env.DATABASE_URL) {
  throw new Error('Refusing to create a demo user while a database connection is configured.');
}

const now = new Date().toISOString();
const passwordHash = await hashPassword(password);
const existing = await findUserByEmail(email);

const demoProfile = {
  name: 'Jordan Demo',
  phone: '+1 202 555 0147',
  country: 'United States',
  status: 'active' as const,
  kycStatus: 'approved' as const,
  emailVerified: true,
  passwordHash,
  balance: 250_000,
  primaryCurrency: 'USD',
  accountTier: 'personal' as const,
  approvedAt: now,
  approvedBy: 'local-development',
  kycSubmittedAt: now,
  kycApprovedAt: now,
  locale: 'en-US',
  timezone: 'America/New_York',
};

const user = existing
  ? await updateUser(existing.id, demoProfile)
  : await createUser({ email, ...demoProfile });

if (!user) throw new Error('The local demo user could not be saved.');

console.log(JSON.stringify({ ok: true, id: user.id, email: user.email }));
