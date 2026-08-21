const MIN_PASSWORD_LENGTH = 16;
const MAX_PASSWORD_LENGTH = 128;

const COMMON_PASSWORD_FRAGMENTS = [
  'password',
  'admin123',
  'citygatecapital',
  'letmein',
  'qwerty',
  'welcome',
];

export interface PasswordPolicyResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validate a newly chosen administrator password without retaining or logging
 * it. These checks complement Argon2id; they are not a substitute for hashing.
 */
export function validateAdminPassword(password: string): PasswordPolicyResult {
  const errors: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Use no more than ${MAX_PASSWORD_LENGTH} characters.`);
  }
  if (!/[a-z]/.test(password)) errors.push('Include a lowercase letter.');
  if (!/[A-Z]/.test(password)) errors.push('Include an uppercase letter.');
  if (!/[0-9]/.test(password)) errors.push('Include a number.');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Include a symbol.');

  const normalized = password.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (COMMON_PASSWORD_FRAGMENTS.some(fragment => normalized.includes(fragment))) {
    errors.push('Avoid common or organisation-specific password phrases.');
  }

  return { ok: errors.length === 0, errors };
}
