// Single client helper for the hostPortal backend:
// hostPortal(action, payload) → response data (throws on error).
// Every call carries the signed session_token so the backend can resolve
// the user even without a platform session.
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';
import { functionErrorMessage } from '@/lib/functionErrors';

export async function hostPortal(action, payload = {}) {
  let res;
  try {
    res = await base44.functions.invoke('hostPortal', {
      action,
      session_token: getSessionToken(),
      ...payload,
    });
  } catch (err) {
    // The SDK throws on non-2xx before we can read our own message —
    // surface the server's explanation instead of "status code 502".
    throw new Error(functionErrorMessage(err));
  }
  const data = res?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}