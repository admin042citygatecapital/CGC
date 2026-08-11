import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/db.js';
import { plaidItems } from '../db/schema.js';
import { getSecret } from './runtimeSecrets.js';

type PlaidAccount = { account_id: string; name: string; mask: string | null; type: string; subtype: string | null };
type PlaidMetadata = { institution?: { institution_id?: string; name?: string }; accounts?: Array<{ id?: string; name?: string; mask?: string; type?: string; subtype?: string }> };

function config() {
  const environment = (process.env.PLAID_ENV ?? 'sandbox').trim().toLowerCase();
  if (environment !== 'sandbox') throw new Error('Plaid is locked to sandbox until production approval is recorded');
  const clientId = getSecret('PLAID_CLIENT_ID')?.trim();
  const secret = getSecret('PLAID_SECRET')?.trim();
  const keyHex = getSecret('PLAID_TOKEN_ENCRYPTION_KEY')?.trim();
  if (!clientId || !secret) throw new Error('Plaid sandbox credentials are not configured');
  if (!keyHex || !/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error('PLAID_TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal key');
  return { clientId, secret, key: Buffer.from(keyHex, 'hex'), baseUrl: 'https://sandbox.plaid.com' };
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const c = config();
  const response = await fetch(`${c.baseUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: c.clientId, secret: c.secret, ...body }),
    signal: AbortSignal.timeout(12_000),
  });
  const data = await response.json() as T & { error_message?: string };
  if (!response.ok) throw new Error(data.error_message || `Plaid request failed (${response.status})`);
  return data;
}

function encrypt(value: string): string {
  const { key } = config();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(value: string): string {
  const { key } = config();
  const [, ivHex, tagHex, dataHex] = value.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Stored Plaid token is malformed');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

export async function createPlaidLinkToken(user: { id: string; email: string }) {
  const redirectUri = (process.env.PLAID_REDIRECT_URI ?? 'https://citygate.capital/plaid/oauth').trim();
  return call<{ link_token: string; expiration: string }>('/link/token/create', {
    user: { client_user_id: user.id }, client_name: 'City Gate Capital',
    products: ['auth'], optional_products: ['identity'], country_codes: ['GB'], language: 'en', redirect_uri: redirectUri,
  });
}

export async function exchangePlaidToken(userId: string, publicToken: string, metadata: PlaidMetadata) {
  const exchanged = await call<{ access_token: string; item_id: string }>('/item/public_token/exchange', { public_token: publicToken });
  const accountResponse = await call<{ accounts: PlaidAccount[] }>('/accounts/get', { access_token: exchanged.access_token });
  const accounts = accountResponse.accounts.map((a) => ({ id: a.account_id, name: a.name, mask: a.mask, type: a.type, subtype: a.subtype }));
  const institutionId = String(metadata.institution?.institution_id ?? '').slice(0, 100) || null;
  const institutionName = String(metadata.institution?.name ?? '').slice(0, 200) || null;
  await getDb().insert(plaidItems).values({
    id: `plaid_${crypto.randomBytes(12).toString('hex')}`, userId, itemId: exchanged.item_id,
    accessTokenEnc: encrypt(exchanged.access_token), institutionId,
    institutionName, accounts,
  }).onConflictDoUpdate({ target: plaidItems.itemId, set: { accessTokenEnc: encrypt(exchanged.access_token), institutionId, institutionName, accounts, status: 'active', updatedAt: new Date() } });
  return { itemId: exchanged.item_id, institutionName: institutionName ?? 'Linked institution', accounts };
}

export async function listPlaidItems(userId: string) {
  return getDb().select({ id: plaidItems.id, itemId: plaidItems.itemId, institutionName: plaidItems.institutionName, accounts: plaidItems.accounts, status: plaidItems.status, createdAt: plaidItems.createdAt })
    .from(plaidItems).where(and(eq(plaidItems.userId, userId), eq(plaidItems.status, 'active'))).orderBy(desc(plaidItems.createdAt));
}

export async function disconnectPlaidItem(userId: string, id: string) {
  const [row] = await getDb().select().from(plaidItems).where(and(eq(plaidItems.id, id), eq(plaidItems.userId, userId))).limit(1);
  if (!row) return false;
  await call('/item/remove', { access_token: decrypt(row.accessTokenEnc) });
  await getDb().update(plaidItems).set({ status: 'disconnected', accessTokenEnc: 'revoked', updatedAt: new Date() }).where(eq(plaidItems.id, id));
  return true;
}
