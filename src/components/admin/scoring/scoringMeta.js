export const CRITERIA = [
  { key: 'originality_creativity', label: 'Originality' },
  { key: 'technical_skill', label: 'Technical skill' },
  { key: 'emotional_impact', label: 'Impact' },
  { key: 'theme_interpretation', label: 'Theme' },
];

export const CRITERION_MAX = 25;

export function emptyCriteria() {
  return CRITERIA.reduce((acc, c) => ({ ...acc, [c.key]: '' }), {});
}

export function criteriaFromScore(score) {
  return CRITERIA.reduce((acc, c) => ({ ...acc, [c.key]: String(score?.criteria?.[c.key] ?? '') }), {});
}

// Same rule as the panel: each criterion 0-25, at most one decimal place.
export function validateCriteria(values) {
  for (const c of CRITERIA) {
    const raw = String(values[c.key] ?? '').trim();
    if (raw === '') return `${c.label} needs a score.`;
    if (!/^\d+(\.\d)?$/.test(raw)) return `${c.label} can have at most one decimal place.`;
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0 || n > CRITERION_MAX) return `${c.label} must be between 0 and ${CRITERION_MAX}.`;
  }
  return '';
}

export function criteriaTotal(values) {
  return CRITERIA.reduce((sum, c) => {
    const n = Number(values[c.key]);
    return sum + (Number.isNaN(n) ? 0 : n);
  }, 0);
}

export function numericCriteria(values) {
  return CRITERIA.reduce((acc, c) => ({ ...acc, [c.key]: Number(values[c.key]) }), {});
}

export const num = (v, dp = 1) => (v == null || v === '' ? '—' : Number(v).toFixed(dp));

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}