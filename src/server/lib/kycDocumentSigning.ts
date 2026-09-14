/**
 * Short-lived signed-URL issuance for KYC case documents held in the private
 * bucket. Deliberately separate from kycStorage.ts — the customer-facing
 * write/validation surface, which is guarded by kycPrivateSchema.test.ts to
 * never mint storage URLs. Only the admin review panel signs URLs.
 */
import { KYC_BUCKET, storageClient } from './kycStorage.js';

/** Short-lived signed URL for an object in the private KYC bucket (15–300s). */
export async function createKycDocumentSignedUrl(key: string, expiresIn = 60): Promise<{ signedUrl: string; expiresAt: Date }> {
  if (!Number.isInteger(expiresIn) || expiresIn < 15 || expiresIn > 300) {
    throw new Error('Signed URL lifetime must be between 15 and 300 seconds.');
  }
  const { data, error } = await storageClient().storage.from(KYC_BUCKET).createSignedUrl(key, expiresIn);
  if (error || !data) {
    throw Object.assign(new Error('KYC document is unavailable.'), { code: 'KYC_DOCUMENT_UNAVAILABLE' });
  }
  return { signedUrl: data.signedUrl, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}
