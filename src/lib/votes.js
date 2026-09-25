// Frontend helpers for verified voting, fraud detection, and combined results.
import { base44 } from '@/api/base44Client';

// Run server-side fraud detection (optionally scoped to a challenge).
export async function detectVoteFraud(challengeId = null) {
  const res = await base44.functions.invoke('detectVoteFraud', { challenge_id: challengeId });
  return res.data;
}

// Compute combined weighted results for a judging panel; optionally lock.
export async function computeCombinedResults(panelId, lock = false) {
  const res = await base44.functions.invoke('computeCombinedResults', { panel_id: panelId, lock });
  return res.data;
}

// Look up the judging panel configured for a competition (if any), so the
// competition page can show the public weighting and any locked combined results.
export async function getPanelForCompetition(competitionId) {
  try {
    const panels = await base44.entities.JudgingPanel.filter({ competition_id: competitionId }, '-created_date', 5);
    return (panels || [])[0] || null;
  } catch { return null; }
}

// Locked combined results for a competition, keyed by entry id.
export async function getCombinedResults(competitionId) {
  try {
    const rows = await base44.entities.CombinedResult.filter({ challenge_id: competitionId }, 'combined_rank', 500);
    const map = {};
    (rows || []).forEach((r) => { map[r.entry_id] = r; });
    return { rows: rows || [], map };
  } catch { return { rows: [], map: {} }; }
}

// Audit log for a single vote's exclusion/restore history.
export async function voteAuditFor(voteId) {
  try {
    return await base44.entities.VoteAuditLog.filter({ vote_id: voteId }, '-at', 50);
  } catch { return []; }
}

export async function logVoteAudit(entry) {
  return base44.entities.VoteAuditLog.create({ ...entry, at: new Date().toISOString() });
}

// Gmail-style normalisation (matches the backend detector) for preview labels.
export function normalizeEmail(email) {
  const e = (email || '').trim().toLowerCase();
  const at = e.indexOf('@');
  if (at < 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') return `${local.replace(/\./g, '').split('+')[0]}@${domain}`;
  return `${local.split('+')[0]}@${domain}`;
}