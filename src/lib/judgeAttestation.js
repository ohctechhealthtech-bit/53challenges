// Conflict-of-interest attestation — asked ONCE per judge per category.
//
// These used to live in localStorage. That made them a per-browser
// convenience rather than a record: clearing site data erased the
// declaration, and nothing on the server could show a judge had ever made
// one. A declaration exists to be relied on afterwards, so it is now stored
// against the judge in the database, through judgeApi.
//
// The set is held in memory for the session so the gate does not re-ask on
// every entry of the same category, and subscribers are notified so every
// mounted score card updates at once. localStorage is still written as a
// fallback for the one case the server cannot cover: an offline or failed
// load, where re-asking a judge who already declared is worse than trusting
// what that browser last saw.
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/customSession';

let judgeEmail = 'me';
let attested = new Set();
let loaded = false;
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

// Categories arrive in mixed spellings ("visual-arts", "visual_arts",
// "Visual Arts") — normalise so one confirmation covers the whole category.
// The server normalises the same way; this keeps the local check in step.
const norm = (category) => String(category || 'all').toLowerCase().replace(/[\s_-]+/g, '_');

const cacheKey = (category) => `judge_attest_${judgeEmail}_${norm(category)}`;

export const setAttestationJudge = (email) => {
  const next = String(email || 'me').toLowerCase();
  if (next === judgeEmail) return;
  judgeEmail = next;
  attested = new Set();
  loaded = false;
  load();
};

/** Pulls this judge's declarations once per session. */
async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const res = await base44.functions.invoke('judgeApi', {
      action: 'attestations',
      session_token: getSessionToken(),
    });
    for (const c of res?.data?.categories || []) attested.add(norm(c));
    notify();
  } catch {
    // Left to the localStorage fallback below: a judge who already declared
    // should not be asked again because a request failed.
    loaded = false;
  }
}

export const isAttested = (category) => {
  if (attested.has(norm(category))) return true;
  try {
    return localStorage.getItem(cacheKey(category)) === 'yes';
  } catch {
    return false;
  }
};

/** Records the declaration server-side, then reflects it locally. */
export const setAttested = async (category) => {
  const scope = norm(category);
  attested.add(scope);
  try {
    localStorage.setItem(cacheKey(category), 'yes');
  } catch { /* storage full */ }
  notify();

  try {
    await base44.functions.invoke('judgeApi', {
      action: 'attest',
      category: scope,
      session_token: getSessionToken(),
    });
  } catch {
    // The judge has declared and the UI has moved on; a failed write must not
    // send them back through the gate. It will be re-sent on the next
    // declaration, and the local copy carries them in the meantime.
    loaded = false;
  }
};

// Live per-category attestation flag.
export function useAttested(category) {
  const [state, setState] = useState(() => isAttested(category));
  useEffect(() => {
    load();
    const sync = () => setState(isAttested(category));
    sync();
    listeners.add(sync);
    return () => listeners.delete(sync);
  }, [category]);
  return state;
}
