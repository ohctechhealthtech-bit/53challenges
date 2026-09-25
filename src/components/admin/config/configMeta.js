export const STEP_TONE = {
  done: 'bg-success text-white',
  current: 'bg-primary text-primary-foreground',
  upcoming: 'bg-muted text-muted-foreground',
};

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Client-side mirror of the parent's influence validation, for live feedback.
export function validateInfluence(values) {
  const n = (k) => Number(values[k]) || 0;
  const weightsTotal = n('judge_weight') + n('public_weight');
  const positionsTotal =
    n('judge_qualifier_positions') + n('combined_qualifier_positions') + n('public_wildcard_positions');
  const messages = [];
  if (weightsTotal !== 100) messages.push(`Judge + public weighting must total 100% (currently ${weightsTotal}%).`);
  if (positionsTotal !== n('finalist_positions')) {
    messages.push(`Qualifier positions must add up to the ${n('finalist_positions')} finalist positions (currently ${positionsTotal}).`);
  }
  return { valid: messages.length === 0, messages };
}