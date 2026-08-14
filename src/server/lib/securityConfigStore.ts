import { isIP } from 'node:net';
import { privateSubdirectory } from './storagePaths.js';
import { readConfigDocument, writeConfigDocument } from './durableConfigDocument.js';

export interface IpEntry {
  ip: string;
  note?: string;
  addedBy?: string;
  addedAt: string;
}

export interface CountryBlock {
  code: string;
  name: string;
  blockedAt: string;
  addedBy?: string;
}

export interface IpLists {
  blacklist: IpEntry[];
  whitelist: IpEntry[];
  countryBlocks: CountryBlock[];
  vpnDetection: 'off' | 'flag' | 'block';
  updatedAt: string;
}

export interface TwoFAPolicy {
  mandatoryForAll: boolean;
  mandatoryForWithdrawals: boolean;
  withdrawalThreshold: number;
  mandatoryForWires: boolean;
  updatedAt: string;
  updatedBy?: string;
}

const IP_LISTS_KEY = 'security_ip_lists';
const TWO_FACTOR_KEY = 'security_two_factor_policy';
const IP_LISTS_FILE = privateSubdirectory('security/ip-lists.json');
const TWO_FACTOR_FILE = privateSubdirectory('security/2fa-policy.json');
const CACHE_TTL_MS = 5_000;
let ipListsCache: { value: IpLists; expiresAt: number } | null = null;
let twoFactorCache: { value: TwoFAPolicy; expiresAt: number } | null = null;

const defaultIpLists = (): IpLists => ({
  blacklist: [],
  whitelist: [],
  countryBlocks: [],
  vpnDetection: 'flag',
  updatedAt: new Date(0).toISOString(),
});

const defaultTwoFactorPolicy = (): TwoFAPolicy => ({
  mandatoryForAll: false,
  mandatoryForWithdrawals: true,
  withdrawalThreshold: 5_000,
  mandatoryForWires: true,
  updatedAt: new Date(0).toISOString(),
});

function normaliseIp(value: string): string {
  const candidate = value.trim().replace(/^::ffff:/i, '');
  if (!isIP(candidate)) throw new Error('INVALID_IP_ADDRESS');
  return candidate;
}

function normaliseIpLists(value: IpLists): IpLists {
  if (!value || typeof value !== 'object') value = defaultIpLists();
  const uniqueEntries = (entries: IpEntry[]) => {
    const seen = new Set<string>();
    return entries.slice(0, 1_000).flatMap(entry => {
      try {
        const ip = normaliseIp(String(entry.ip ?? ''));
        if (seen.has(ip)) return [];
        seen.add(ip);
        return [{
          ip,
          note: String(entry.note ?? '').trim().slice(0, 200) || undefined,
          addedBy: String(entry.addedBy ?? '').trim().slice(0, 254) || undefined,
          addedAt: Number.isFinite(Date.parse(entry.addedAt)) ? new Date(entry.addedAt).toISOString() : new Date().toISOString(),
        }];
      } catch {
        return [];
      }
    });
  };
  const validModes = new Set(['off', 'flag', 'block']);
  const countryBlocks = (Array.isArray(value.countryBlocks) ? value.countryBlocks : []).slice(0, 250).flatMap(entry => {
    const code = String(entry.code ?? '').trim().toUpperCase();
    const name = String(entry.name ?? '').trim();
    if (!/^[A-Z]{2}$/.test(code) || name.length < 2 || name.length > 80) return [];
    return [{
      code,
      name,
      blockedAt: Number.isFinite(Date.parse(entry.blockedAt)) ? new Date(entry.blockedAt).toISOString() : new Date().toISOString(),
      addedBy: String(entry.addedBy ?? '').trim().slice(0, 254) || undefined,
    }];
  });
  return {
    blacklist: uniqueEntries(Array.isArray(value.blacklist) ? value.blacklist : []),
    whitelist: uniqueEntries(Array.isArray(value.whitelist) ? value.whitelist : []),
    countryBlocks: [...new Map(countryBlocks.map(entry => [entry.code, entry])).values()],
    vpnDetection: validModes.has(value.vpnDetection) ? value.vpnDetection : 'flag',
    updatedAt: Number.isFinite(Date.parse(value.updatedAt)) ? new Date(value.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export async function readSecurityIpLists(): Promise<IpLists> {
  if (ipListsCache && ipListsCache.expiresAt > Date.now()) return structuredClone(ipListsCache.value);
  const stored = await readConfigDocument<IpLists>(IP_LISTS_KEY, IP_LISTS_FILE, defaultIpLists());
  const normalised = normaliseIpLists(stored);
  ipListsCache = { value: normalised, expiresAt: Date.now() + CACHE_TTL_MS };
  return structuredClone(normalised);
}

export async function writeSecurityIpLists(value: IpLists, updatedBy: string): Promise<IpLists> {
  const normalised = normaliseIpLists({ ...value, updatedAt: new Date().toISOString() });
  await writeConfigDocument(IP_LISTS_KEY, IP_LISTS_FILE, normalised, updatedBy);
  ipListsCache = { value: normalised, expiresAt: Date.now() + CACHE_TTL_MS };
  return structuredClone(normalised);
}

export function validateIpAddress(value: unknown): string {
  return normaliseIp(String(value ?? ''));
}

export async function readTwoFactorPolicy(): Promise<TwoFAPolicy> {
  if (twoFactorCache && twoFactorCache.expiresAt > Date.now()) return { ...twoFactorCache.value };
  const loaded = await readConfigDocument<TwoFAPolicy>(TWO_FACTOR_KEY, TWO_FACTOR_FILE, defaultTwoFactorPolicy());
  const stored = loaded && typeof loaded === 'object' ? loaded : defaultTwoFactorPolicy();
  const threshold = Number(stored.withdrawalThreshold);
  const normalised = {
    mandatoryForAll: stored.mandatoryForAll === true,
    mandatoryForWithdrawals: stored.mandatoryForWithdrawals !== false,
    withdrawalThreshold: Number.isFinite(threshold) && threshold >= 0 && threshold <= 10_000_000 ? threshold : 5_000,
    mandatoryForWires: stored.mandatoryForWires !== false,
    updatedAt: Number.isFinite(Date.parse(stored.updatedAt)) ? new Date(stored.updatedAt).toISOString() : new Date().toISOString(),
    updatedBy: String(stored.updatedBy ?? '').trim().slice(0, 254) || undefined,
  };
  twoFactorCache = { value: normalised, expiresAt: Date.now() + CACHE_TTL_MS };
  return { ...normalised };
}

export async function writeTwoFactorPolicy(value: TwoFAPolicy, updatedBy: string): Promise<TwoFAPolicy> {
  const threshold = Number(value.withdrawalThreshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 10_000_000) throw new Error('INVALID_WITHDRAWAL_THRESHOLD');
  const policy: TwoFAPolicy = {
    mandatoryForAll: value.mandatoryForAll === true,
    mandatoryForWithdrawals: value.mandatoryForWithdrawals === true,
    withdrawalThreshold: threshold,
    mandatoryForWires: value.mandatoryForWires === true,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await writeConfigDocument(TWO_FACTOR_KEY, TWO_FACTOR_FILE, policy, updatedBy);
  twoFactorCache = { value: policy, expiresAt: Date.now() + CACHE_TTL_MS };
  return { ...policy };
}
