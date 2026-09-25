/**
 * Public judge panel data from the main 53 site — no session token needed.
 */
const HOST_PORTAL_URL = 'https://53-classes-fc73a4d1.base44.app/functions/hostPortal';

async function post(body) {
  const res = await fetch(HOST_PORTAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
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