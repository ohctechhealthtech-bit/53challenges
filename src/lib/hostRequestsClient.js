// Client helper for the hostRequests backend (a host's own enquiries).
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';

export async function hostRequests(action, payload = {}) {
  const res = await base44.functions.invoke('hostRequests', {
    action,
    session_token: getSessionToken(),
    ...payload,
  });
  const data = res?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}