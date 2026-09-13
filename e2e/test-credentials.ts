export const E2E_CUSTOMER = {
  email: 'customer.e2e@example.test',
  password: 'Preview-E2E-Customer-42!',
  name: 'Preview Browser Customer',
} as const;

export const E2E_ROUTE_AUDIT_CUSTOMER = {
  email: 'route-audit.e2e@example.test',
  password: 'Preview-E2E-Route-Audit-42!',
  name: 'Route Audit Browser Customer',
} as const;

export const E2E_ADMIN = {
  email: 'admin@citygate.capital',
  // Local e2e fixture only — deliberately distinct from any real credential
  // (the e2e server seeds its own admin row from this value; see
  // scripts/start-e2e-server.ts).
  password: 'Preview-E2E-Admin-77!',
  otp: '937497',
} as const;

export const E2E_UNVERIFIED_CUSTOMER = {
  email: 'verify.e2e@example.test',
  password: 'Preview-E2E-Verify-42!',
  name: 'Verification Browser Customer',
  token: 'e2e-email-verification-token',
} as const;

export const E2E_RESET_CUSTOMER = {
  email: 'reset.e2e@example.test',
  password: 'Preview-E2E-Reset-42!',
  replacementPassword: 'Replacement-E2E-Reset-84!',
  name: 'Recovery Browser Customer',
  token: 'e2e-password-reset-token',
} as const;

export const E2E_TWO_FACTOR_CUSTOMER = {
  email: 'two-factor.e2e@example.test',
  password: 'Preview-E2E-2FA-42!',
  name: 'Two Factor Browser Customer',
  secret: 'JBSWY3DPEHPK3PXP',
} as const;
