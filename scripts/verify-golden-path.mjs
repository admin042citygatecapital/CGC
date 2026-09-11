import { getDb, closeConnection } from '../src/server/db/db.js';
import { users, customerAccounts, platformCurrencies } from '../src/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const email = 'golden-path-test-1@example.test';
  console.log(`Verifying Golden Path for ${email}...`);

  try {
    // 1. Find the user
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      console.error('User not found. Did registration fail?');
      process.exit(1);
    }
    console.log(`User found: ${user.id}`);

    // 2. Manually verify email and set status to active
    await db.update(users).set({
      emailVerified: true,
      status: 'active',
      amlStatus: 'cleared',
    }).where(eq(users.id, user.id));
    console.log('User verified and activated.');

    // 3. Ensure a currency exists for the account
    const [gbp] = await db.select().from(platformCurrencies).where(eq(platformCurrencies.code, 'GBP'));
    if (!gbp) {
      console.error('GBP currency not found in platform_currencies.');
      process.exit(1);
    }

    // 4. Create a synthetic account with balance
    const accountId = `acc_${Math.random().toString(36).slice(2, 11)}`;
    await db.insert(customerAccounts).values({
      id: accountId,
      userId: user.id,
      label: 'Golden Path Account',
      accountType: 'personal',
      status: 'active',
      primaryCurrency: 'GBP',
      availableMinor: 100000n, // 1,000.00 GBP
      ledgerMinor: 100000n,
      synthetic: true,
      creationIdempotencyKey: `golden-path-acc-${Date.now()}`,
      creationFingerprint: 'golden-path-fingerprint',
      createdBy: 'GOLDEN_PATH_VERIFIER',
      lastEditedBy: 'GOLDEN_PATH_VERIFIER',
    });
    console.log(`Created account ${accountId} with 1,000 GBP balance.`);

    console.log('\nGolden Path setup complete.');
    console.log(`User: ${email}`);
    console.log(`Account: ${accountId}`);
    console.log('You can now attempt to login and transfer funds on production.');

  } catch (err) {
    console.error('Error during verification:', err);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
