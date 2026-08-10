/**
 * GET /api/admin/users/:id/devices
 * Returns trusted devices registered for a customer.
 * Reads from /private/users/devices.jsonl — each line: { userId, deviceId, ua, ip, createdAt, lastSeenAt }
 */
import type { Request, Response } from 'express';
import fs from 'node:fs';
import { findUserById } from '../../../../../lib/userStore.js';
import { privateSubdirectory } from '../../../../../lib/storagePaths.js';

const DEVICES_FILE = privateSubdirectory('users/devices.jsonl');

interface DeviceRecord {
  userId: string;
  deviceId: string;
  ua?: string;
  ip?: string;
  name?: string;
  createdAt: string;
  lastSeenAt?: string;
}

function loadDevices(): DeviceRecord[] {
  try {
    if (!fs.existsSync(DEVICES_FILE)) return [];
    return fs.readFileSync(DEVICES_FILE, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => JSON.parse(l) as DeviceRecord);
  } catch { return []; }
}

export default async function handler(req: Request, res: Response) {
  const id = String(req.params.id ?? '');
  if (!id) return res.status(400).json({ error: 'User ID required' });

  const user = await findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const devices = loadDevices()
    .filter(d => d.userId === id)
    .sort((a, b) => new Date(b.lastSeenAt ?? b.createdAt).getTime() - new Date(a.lastSeenAt ?? a.createdAt).getTime());

  return res.json({ data: devices, total: devices.length });
}
