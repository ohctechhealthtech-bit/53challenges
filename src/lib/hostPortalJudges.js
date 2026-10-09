/**
 * Public judge panel data from the main 53 site — no session token needed.
 *
 * Fetched through this app's own hostPortal function, which proxies the
 * parent. It used to fetch the parent directly from the browser, at a
 * hard-coded 53-classes-….base44.app address. That stopped working the day
 * the Content-Security-Policy arrived: connect-src names 'self' and a few
 * hosts, not that one, so the browser refused the call and the wizard read
 * "We could not load our judge list" ever since. Going through our backend
 * keeps the API key server-side, drops the parent's address from client
 * code, and is how every other parent read already travels.
 */
import { base44 } from '@/api/base44Client';

async function post(body) {
  const res = await base44.functions.invoke('hostPortal', body);
  const data = res?.data || {};
  // The SDK throws on a non-2xx; a 200 carrying `error` is the other way the
  // parent says no, and the caller's catch handles both the same.
  if (data.error) throw new Error(data.error);
  return data;
}

export const prettyWords = (s) =>
  String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Dedup judges by id (or email as fallback) — the 53 Classes hostPortal
// join can fan-out and return each judge twice.
function dedupJudges(judges) {
  const seen = new Set();
  return (judges || []).filter((j) => {
    const id = j.id || (j.email || '').toLowerCase();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export const hostPortalJudges = {
  panel: async () => {
    const res = await post({ action: 'judge_panel' });
    return { ...res, judges: dedupJudges(res.judges) };
  },
  details: async (judgeId) => {
    const res = await post({ action: 'judge_details', judge_id: judgeId });
    if (res.judges) return { ...res, judges: dedupJudges(res.judges) };
    return res;
  },
};
