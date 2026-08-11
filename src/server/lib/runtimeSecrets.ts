/**
 * Environment-neutral runtime secret access.
 *
 * Secrets are supplied by the deployment environment (Vercel, local tooling,
 * CI, or another Node host). This module deliberately has no provider SDK or
 * AIRO container dependency and must never expose values to browser code.
 */

export function getSecret(secretName: string): string | null {
  return process.env[secretName] ?? null;
}

/** Names only; values are never returned by diagnostics. */
export function listSecretNames(): string[] {
  return Object.keys(process.env).filter(
    key => !key.startsWith('npm_') && !key.startsWith('NODE_') && key !== 'PATH',
  );
}
