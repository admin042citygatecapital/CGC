import crypto from 'node:crypto';
import { getSecret } from '#runtime/secrets';

const PREFIX = 'enc:v1';

function encryptionKey(): Buffer {
  const raw = String(getSecret('KYC_FIELD_ENCRYPTION_KEY') ?? '').trim();
  if (!/^[a-f0-9]{64}$/i.test(raw)) {
    throw Object.assign(new Error('KYC field encryption is not configured.'), { code: 'KYC_ENCRYPTION_UNAVAILABLE' });
  }
  return Buffer.from(raw, 'hex');
}

export function encryptKycField(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [PREFIX, iv.toString('hex'), cipher.getAuthTag().toString('hex'), ciphertext.toString('hex')].join(':');
}

export function decryptKycField(value: string): string {
  const [prefix, version, ivHex, tagHex, ciphertextHex] = value.split(':');
  if (`${prefix}:${version}` !== PREFIX || !ivHex || !tagHex || !ciphertextHex) {
    throw new Error('Invalid encrypted KYC field.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]).toString('utf8');
}

export function maskDocumentNumber(value: string): string {
  const compact = value.replace(/[^A-Za-z0-9]/g, '');
  const suffix = compact.slice(-4);
  return suffix ? `•••• ${suffix}` : 'Not provided';
}

export function documentNumberLast4(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(-4);
}
