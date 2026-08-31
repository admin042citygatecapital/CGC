export type HealthComponentState = 'healthy' | 'warning' | 'degraded' | 'not_configured' | 'unknown';

export interface HealthComponent {
  state: HealthComponentState;
  required: boolean;
  detail: string;
}

export type OverallHealthState = 'healthy' | 'warning' | 'degraded';

export interface CoreHealthEvidence {
  databaseHealthy: boolean;
  databaseConfigured?: boolean;
  databaseRequired?: boolean;
  databaseDetail: string;
  storageHealthy: boolean;
  storageDetail: string;
  sessionsHealthy: boolean;
  sessionsDetail: string;
}

export function buildCoreHealthComponents(evidence: CoreHealthEvidence): Record<string, HealthComponent> {
  const databaseRequired = evidence.databaseRequired ?? true;
  const databaseState: HealthComponentState = evidence.databaseHealthy
    ? 'healthy'
    : evidence.databaseConfigured === false && !databaseRequired
      ? 'not_configured'
      : 'degraded';

  return {
    api: { state: 'healthy', required: true, detail: 'Application API is responding.' },
    database: {
      state: databaseState,
      required: databaseRequired,
      detail: evidence.databaseDetail,
    },
    storage: {
      state: evidence.storageHealthy ? 'healthy' : 'degraded',
      required: true,
      detail: evidence.storageDetail,
    },
    sessions: {
      state: evidence.sessionsHealthy ? 'healthy' : 'degraded',
      required: true,
      detail: evidence.sessionsDetail,
    },
  };
}

/**
 * Derive one authoritative platform state from measured server components.
 * Optional integrations that are intentionally not configured do not degrade
 * the application. Unknown or degraded required dependencies always do.
 */
export function deriveOverallHealth(components: Record<string, HealthComponent>): OverallHealthState {
  const required = Object.values(components).filter(component => component.required);
  if (required.some(component => component.state === 'degraded' || component.state === 'unknown' || component.state === 'not_configured')) {
    return 'degraded';
  }
  if (Object.values(components).some(component => component.state === 'warning' ||
      (!component.required && component.state === 'degraded'))) {
    return 'warning';
  }
  return 'healthy';
}

export function legacyCheck(state: HealthComponentState): 'PASS' | 'WARN' | 'FAIL' {
  if (state === 'healthy') return 'PASS';
  if (state === 'warning' || state === 'not_configured') return 'WARN';
  return 'FAIL';
}
