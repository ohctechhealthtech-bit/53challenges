// Resolves whether the caller is an app admin — either via a Base44 platform
// session, or via the custom (Challenge-API) login's signed session token,
// whose role lives on this app's own User record (same rule as sessionRole).
import { verifyCustomSession } from './customSession.ts';

const ADMIN_ROLES = new Set(['admin', 'creator']);

export async function isAdminCaller(base44: any, sessionToken: string, apiKey: string): Promise<boolean> {
  const user = await base44.auth.me().catch(() => null);
  if (user && (ADMIN_ROLES.has(user.role) || user.is_admin === true)) return true;

  if (!sessionToken) return false;
  const session = await verifyCustomSession(String(sessionToken), apiKey).catch(() => null);
  if (!session?.email) return false;
  const users = await base44.asServiceRole.entities.User.filter({ email: session.email }).catch(() => []);
  return ADMIN_ROLES.has(users?.[0]?.role);
}

/**
 * The signed-in caller, from either login: a Base44 platform session or this
 * app's Challenge-API session token. Returns { email, role } shaped like the
 * platform user object so it can be used in its place, or null when neither
 * login is present.
 */
export async function resolveCaller(base44: any, sessionToken: string, apiKey: string) {
  const platform = await base44.auth.me().catch(() => null);
  if (platform?.email) {
    return { email: String(platform.email).toLowerCase().trim(), role: platform.role || 'user' };
  }

  if (!sessionToken) return null;
  const session = await verifyCustomSession(String(sessionToken), apiKey).catch(() => null);
  if (!session?.email) return null;

  const email = String(session.email).toLowerCase().trim();
  const users = await base44.asServiceRole.entities.User.filter({ email }).catch(() => []);
  return { email, role: users?.[0]?.role || 'user' };
}