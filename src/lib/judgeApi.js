// Client for the Judging Control Room backend proxy (judgeApi function).
// judgeApi(action, params) → response data; throws Error (err.setup = true
// when the parent API key still needs to be configured).
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/appSession';
import { functionErrorMessage } from '@/lib/functionErrors';

export async function judgeApi(action, params = {}) {
  let res;
  try {
    res = await base44.functions.invoke('judgeApi', {
      action,
      session_token: getSessionToken(),
      ...params,
    });
  } catch (err) {
    throw new Error(functionErrorMessage(err));
  }
  const data = res?.data || {};
  if (data.error) {
    const e = new Error(data.error);
    e.setup = !!data.setup_required;
    throw e;
  }
  return data;
}

// API responses come from the parent app — read fields tolerantly.
export const pickNum = (obj, keys, fallback = null) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return fallback;
};

export const pickList = (obj, keys) => {
  for (const k of keys) {
    if (Array.isArray(obj?.[k])) return obj[k];
  }
  return [];
};