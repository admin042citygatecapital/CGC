// IANA/special-use domains used only by fixtures, previews, and controlled test
// identities. Keep this rule shared by quarantine and operational reporting so
// legacy test records cannot inflate business metrics before they are formally
// classified or quarantined.
const RESERVED_TEST_EMAIL = /^[^@\s]+@(example\.(com|net|org)|[^@\s]+\.(test|invalid|local)|localhost)$/i;

export function isReservedTestEmail(email: string): boolean {
  return RESERVED_TEST_EMAIL.test(email.trim());
}
