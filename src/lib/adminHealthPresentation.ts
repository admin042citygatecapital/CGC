export type AdminHealthState = 'healthy' | 'warning' | 'degraded' | 'unknown';

export function adminHealthState(value: unknown): AdminHealthState {
  if (!value || typeof value !== 'object') return 'unknown';
  const status = (value as { status?: unknown }).status;
  return status === 'healthy' || status === 'warning' || status === 'degraded' ? status : 'unknown';
}

export function sessionRecentlyActive(lastSeenAt: string, now = Date.now()): boolean {
  const seen = Date.parse(lastSeenAt);
  return Number.isFinite(seen) && seen <= now && now - seen < 60 * 60 * 1000;
}
