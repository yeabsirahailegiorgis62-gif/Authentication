// Top most common breached passwords for compromised password checking
export const COMMON_PASSWORDS = new Set([
  'password12345',
  '123456789012',
  'qwertyuiop12',
  'administrator',
  'change_me_now',
  'password1234',
  'iloveyou1234',
  'welcome12345',
  'admin1234567',
  'letmein12345',
]);

/**
 * Checks if a password is among common compromised passwords.
 */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
