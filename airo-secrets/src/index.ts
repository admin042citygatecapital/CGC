export function getSecret(key: string): string | undefined {
  return process.env[key] || undefined;
}

export function requireSecret(key: string): string {
  const value = process.env[key];
  if (!value) {
    const msg = `[airo-secrets] FATAL: Required secret "${key}" is not set in Airo Secrets. Admin login is disabled until this is configured.`;
    console.error(msg);
    throw new Error(msg);
  }
  return value;
}
