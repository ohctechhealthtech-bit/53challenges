// Conflict-of-interest attestation — asked ONCE per judge per category.
// The parent 53 Challenges API has no attestation action (judge-attest /
// judge-attestation / judge-conflict-attestation all return "Unknown action"),
// so the confirmation is stored in this app, keyed by judge email + category.
// Subscribers are notified so every mounted score card updates at once —
// that's what stopped the gate re-appearing on each entry of the same category.
import { useEffect, useState } from 'react';

let judgeEmail = 'me';
const listeners = new Set();

export const setAttestationJudge = (email) => {
  judgeEmail = String(email || 'me').toLowerCase();
};

// Categories arrive in mixed spellings ("visual-arts", "visual_arts",
// "Visual Arts") — normalise so one confirmation covers the whole category.
const norm = (category) => String(category || 'all').toLowerCase().replace(/[\s_-]+/g, '_');
const key = (category) => `judge_attest_${judgeEmail}_${norm(category)}`;

export const isAttested = (category) => {
  try { return localStorage.getItem(key(category)) === 'yes'; } catch { return false; }
};

export const setAttested = (category) => {
  try { localStorage.setItem(key(category), 'yes'); } catch { /* storage full */ }
  listeners.forEach((fn) => fn());
};

// Live per-category attestation flag.
export function useAttested(category) {
  const [attested, setState] = useState(() => isAttested(category));
  useEffect(() => {
    const sync = () => setState(isAttested(category));
    sync();
    listeners.add(sync);
    return () => listeners.delete(sync);
  }, [category]);
  return attested;
}