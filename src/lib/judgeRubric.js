// Scoring rubric model for the Judging Control Room.
// Four criteria, 0–25 each in 0.5 steps, 100 total. The parent API's
// judge-rubric action can override labels; keys and limits are fixed.

export const MAX_PER_CRITERION = 25;
export const SCORE_STEP = 0.5;
export const MAX_TOTAL = 100;

export const CRITERIA = [
  { key: 'originality_creativity', label: 'Originality & Creativity' },
  { key: 'technical_skill', label: 'Technical Skill' },
  { key: 'emotional_impact', label: 'Emotional Impact' },
  { key: 'theme_interpretation', label: 'Theme Interpretation' },
];

// Merge a rubric returned by the API onto the fixed criteria keys.
export function mergeRubric(apiRubric) {
  const list = Array.isArray(apiRubric?.criteria) ? apiRubric.criteria : Array.isArray(apiRubric) ? apiRubric : [];
  return CRITERIA.map((c) => {
    const remote = list.find((r) => (r.key || r.slug || '') === c.key);
    return { ...c, label: remote?.label || remote?.name || c.label, description: remote?.description || '' };
  });
}

export function validateScores(values) {
  for (const c of CRITERIA) {
    const v = Number(values[c.key]);
    if (!Number.isFinite(v)) return `Please score every criterion (missing: ${c.label}).`;
    if (v < 0 || v > MAX_PER_CRITERION) return `${c.label} must be between 0 and ${MAX_PER_CRITERION}.`;
    if (Math.round(v * 2) !== v * 2) return `${c.label} must be in steps of ${SCORE_STEP}.`;
  }
  return null;
}

export const totalOf = (values) =>
  CRITERIA.reduce((sum, c) => sum + (Number(values[c.key]) || 0), 0);

// ── Local drafts: entered scores survive a refresh ──────────────────
const draftKey = (entryId) => `judge_draft_${entryId}`;

export function loadDraft(entryId) {
  try {
    const raw = localStorage.getItem(draftKey(entryId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveDraft(entryId, values) {
  try { localStorage.setItem(draftKey(entryId), JSON.stringify(values)); } catch { /* storage full */ }
}

export function clearDraft(entryId) {
  try { localStorage.removeItem(draftKey(entryId)); } catch { /* ignore */ }
}

// ── Conflict-of-interest attestation, per round + category ─────────
const attestKey = (roundId, category) => `judge_attest_${roundId || 'all'}_${category || 'all'}`;

export const isAttested = (roundId, category) => {
  try { return localStorage.getItem(attestKey(roundId, category)) === 'yes'; } catch { return false; }
};

export const setAttested = (roundId, category) => {
  try { localStorage.setItem(attestKey(roundId, category), 'yes'); } catch { /* ignore */ }
};