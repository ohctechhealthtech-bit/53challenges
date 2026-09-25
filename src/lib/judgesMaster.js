/**
 * Frontend client for the judges master (proxied through the judgesMaster
 * backend function so the API key stays server-side).
 */
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';

async function call(payload) {
  const res = await base44.functions.invoke('judgesMaster', payload);
  const data = res.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export const judgesMaster = {
  options: () => call({ action: 'options' }),
  list: (params = {}) => call({ action: 'judges', limit: 200, ...params }),
  get: (params) => call({ action: 'judge', ...params }),
  upsert: (judge) => call({ action: 'upsert', ...judge }),
  setActive: (email, active) => call({ action: 'set_active', email, active }),
  saveHostJudges: (judges) => call({ action: 'save_host_judges', judges, session_token: getSessionToken() }),
};