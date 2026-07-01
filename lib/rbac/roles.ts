export type UserRole = 'client' | 'provider' | 'admin';

// Where each role lands after login.
export const ROLE_HOME: Record<UserRole, string> = {
  client: '/client',
  provider: '/provider',
  admin: '/admin',
};

export function homeForRole(role: UserRole | null | undefined): string {
  if (role && role in ROLE_HOME) return ROLE_HOME[role];
  return '/';
}
