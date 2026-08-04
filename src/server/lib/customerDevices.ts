/**
 * customerDevices.ts — shared type + helpers for a customer's trusted
 * devices, mirroring beneficiaries.ts's pattern.
 *
 * Devices have no dedicated table — they're persisted as a JSON array
 * directly on UserRecord.trustedDevices (userStore.ts / schema.ts), already
 * typed as an opaque `unknown` field for exactly this purpose. Nothing in
 * this codebase currently registers a device at login, so this list is
 * genuinely empty until that's built — returning [] here is the honest
 * result, not a bug.
 */
import crypto from 'node:crypto';

export interface CustomerDevice {
  id:         string;
  label:      string;
  ip?:        string;
  ua?:        string;
  createdAt:  string;
  lastSeenAt: string;
}

export function parseDevices(raw: unknown): CustomerDevice[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((d): d is CustomerDevice =>
    !!d && typeof d === 'object' && typeof (d as CustomerDevice).id === 'string'
  );
}

export function newDeviceId(): string {
  return 'dev_' + crypto.randomBytes(8).toString('hex');
}
