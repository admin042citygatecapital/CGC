/** Create or refresh the single customer account used to review a hosted preview. */
import { closeConnection, isDatabaseConfigured } from '../src/server/db/db.js';
import { hashPassword } from '../src/server/lib/passwordHash.js';
import { isValidEmail, validatePassword } from '../src/server/lib/inputValidator.js';
import { createUser, findUserByEmail, updateUser } from '../src/server/lib/userStore.js';

async function main(): Promise<void> {
  if (process.env.ENABLE_PREVIEW_USER_SEED !== '1') {
    console.log('Preview user seed is disabled; skipping.');
    return;
  }
  if (process.env.NODE_ENV !== 'production' || process.env.PLATFORM_MODE !== 'preview') {
    throw new Error('Preview users may only be seeded in a production preview environment.');
  }
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is required to seed a preview user.');

  const email = (process.env.PREVIEW_USER_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.PREVIEW_USER_PASSWORD ?? '';
  const name = (process.env.PREVIEW_USER_NAME ?? 'City Gate Preview').trim();
  if (!isValidEmail(email)) throw new Error('PREVIEW_USER_EMAIL must be a valid email address.');
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) throw new Error(`PREVIEW_USER_PASSWORD is invalid: ${passwordCheck.reason}`);
  if (name.length < 2 || name.length > 100) throw new Error('PREVIEW_USER_NAME must be 2–100 characters.');

  const now = new Date().toISOString();
  const profile = {
    name,
    country: 'United States',
    status: 'active' as const,
    kycStatus: 'approved' as const,
    emailVerified: true,
    passwordHash: await hashPassword(password),
    balance: 250_000,
    primaryCurrency: 'USD',
    accountTier: 'personal' as const,
    approvedAt: now,
    approvedBy: 'preview-seed',
    kycSubmittedAt: now,
    kycApprovedAt: now,
    locale: 'en-US',
    timezone: 'America/New_York',
  };

  const existing = await findUserByEmail(email);
  const base = existing ?? await createUser({ email, ...profile });
  const user = await updateUser(base.id, profile);
  if (!user) throw new Error('Preview user could not be saved.');
  console.log(JSON.stringify({ ok: true, id: user.id, email: user.email }));
}

main()
  .catch(error => {
    console.error('Preview user seed failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(closeConnection);
