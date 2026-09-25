// Judging workflow engine — scoring maths, blind assignment, anomalies, ties.
import { base44 } from '@/api/base44Client';

// Write an immutable, timestamped audit entry. Every scoring action calls this.
export async function audit(panelId, actor, action, detail = '') {
  try {
    await base44.entities.JudgingAuditLog.create({
      panel_id: panelId || '',
      actor: actor || 'system',
      action,
      detail,
      at: new Date().toISOString(),
    });
  } catch { /* audit must never block the user action */ }
}

// Build a per-criterion scoring matrix: { entryId: { judgeId: { criterionName: value } } }
export function buildScoreMatrix(scores, criteria) {
  const matrix = {};
  (scores || []).forEach((s) => {
    if (!matrix[s.entry_id]) matrix[s.entry_id] = {};
    matrix[s.entry_id][s.judge_profile_id] = {};
    (s.scores || []).forEach((c) => {
      matrix[s.entry_id][s.judge_profile_id][c.name] = c.value;
    });
  });
  return matrix;
}

// Per-judge mean & std across the entries they scored, per criterion.
export function judgeStats(scores) {
  const byJudge = {};
  (scores || []).forEach((s) => {
    (s.scores || []).forEach((c) => {
      if (!byJudge[s.judge_profile_id]) byJudge[s.judge_profile_id] = {};
      if (!byJudge[s.judge_profile_id][c.name]) byJudge[s.judge_profile_id][c.name] = [];
      byJudge[s.judge_profile_id][c.name].push(c.value);
    });
  });
  const stats = {};
  Object.entries(byJudge).forEach(([jid, crit]) => {
    stats[jid] = {};
    Object.entries(crit).forEach(([name, vals]) => {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
      stats[jid][name] = { mean, std: Math.sqrt(variance) };
    });
  });
  return stats;
}

// Normalised raw: (raw - judgeMean) / judgeStd, guards against std === 0.
// Raw scores are retained on Score records; only the aggregate is derived.
export function normalisedScore(raw, jStat) {
  if (!jStat) return raw;
  if (!jStat.std) return 0; // a judge with no variance contributes nothing
  return (raw - jStat.mean) / jStat.std;
}

// Final per-entry = weighted mean across criteria of the panel-averaged
// normalised scores. Returns { entryId: { weighted, perCriterion, judgeCount } }
export function finalScores(scores, criteria) {
  const matrix = buildScoreMatrix(scores, criteria);
  const stats = judgeStats(scores);
  const totalWeight = criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0) || 1;
  const result = {};
  Object.entries(matrix).forEach(([entryId, judges]) => {
    const judgeIds = Object.keys(judges);
    const perCriterion = {};
    criteria.forEach((c) => {
      const normVals = judgeIds
        .filter((jid) => judges[jid][c.name] !== undefined && stats[jid]?.[c.name])
        .map((jid) => normalisedScore(judges[jid][c.name], stats[jid][c.name]));
      perCriterion[c.name] = normVals.length
        ? normVals.reduce((a, b) => a + b, 0) / normVals.length
        : 0;
    });
    const weighted = criteria.reduce((acc, c) => acc + perCriterion[c.name] * (Number(c.weight) || 0), 0) / totalWeight;
    result[entryId] = { weighted, perCriterion, judgeCount: judgeIds.length };
  });
  return result;
}

// Anomaly flagging:
//  - entry divergence: few judges, large spread on the raw weighted total
//  - outlier judge: whose raw mean sits far from the panel mean
export function flagAnomalies(scores, criteria) {
  const matrix = buildScoreMatrix(scores, criteria);
  const totalWeight = criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0) || 1;
  // raw per-judge weighted average per entry
  const entryJudgeTotals = {};
  Object.entries(matrix).forEach(([entryId, judges]) => {
    entryJudgeTotals[entryId] = {};
    Object.entries(judges).forEach(([jid, critVals]) => {
      const tot = criteria.reduce((acc, c) => acc + (critVals[c.name] ?? 0) * (Number(c.weight) || 0), 0) / totalWeight;
      entryJudgeTotals[entryId][jid] = tot;
    });
  });
  const divergentEntries = [];
  const judgeDeviation = {};
  Object.entries(entryJudgeTotals).forEach(([entryId, byJudge]) => {
    const vals = Object.values(byJudge);
    if (vals.length >= 2) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const spread = Math.max(...vals) - Math.min(...vals);
      if (spread >= 2.5) {
        divergentEntries.push({ entryId, spread, mean, values: byJudge });
      }
      Object.entries(byJudge).forEach(([jid, v]) => {
        judgeDeviation[jid] = (judgeDeviation[jid] || 0) + Math.abs(v - mean);
      });
    }
  });
  // judge scoring far outside panel pattern: average deviation well above others
  const devList = Object.entries(judgeDeviation).map(([jid, sum]) => ({ jid, avg: sum }));
  const panelAvgDev = devList.length ? devList.reduce((a, d) => a + d.avg, 0) / devList.length : 0;
  const outlierJudges = devList.filter((d) => d.avg > panelAvgDev * 1.6 && panelAvgDev > 0);
  return { divergentEntries, outlierJudges };
}

// Tie resolution: highest score on the first-weighted criterion, else head-judge call.
export function rankEntries(finals, criteria) {
  const entries = Object.entries(finals).map(([id, v]) => ({ id, ...v }));
  const sortedByWeight = [...criteria].map((c, i) => ({ ...c, i })).sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0));
  const firstWeighted = sortedByWeight[0];
  entries.sort((a, b) => {
    if (b.weighted !== a.weighted) return b.weighted - a.weighted;
    if (firstWeighted) {
      const av = a.perCriterion?.[firstWeighted.name] ?? 0;
      const bv = b.perCriterion?.[firstWeighted.name] ?? 0;
      if (bv !== av) return bv - av;
    }
    return 0; // head judge decision documented separately when this remains a tie
  });
  return { ranked: entries, firstWeightedCriterion: firstWeighted?.name || null };
}

// Generate an anonymous ID for an entry (stable, not traceable to content).
export function anonymousId(entryId) {
  let h = 0;
  for (let i = 0; i < entryId.length; i++) h = (h * 31 + entryId.charCodeAt(i)) >>> 0;
  return `E-${(h % 100000).toString().padStart(5, '0')}`;
}

// Random assignment: every entry receives >=3 judges, excluding COI matches.
// COI register: [{type, name}]. Exclude a judge if an entry has creator/title
// text overlapping a COI name.
function coiConflict(judge, entry) {
  const names = (judge.conflict_of_interest || []).map((c) => (c.name || '').toLowerCase().trim()).filter(Boolean);
  if (!names.length) return false;
  const haystack = `${entry.creator_name || ''} ${entry.title || ''} ${entry.city || ''}`.toLowerCase();
  return names.some((n) => haystack.includes(n));
}

export function assignJudgesToEntries(entries, judges, perEntry = 3) {
  const out = [];
  const pool = [...judges];
  (entries || []).forEach((entry) => {
    const eligible = pool.filter((j) => !coiConflict(j, entry));
    if (eligible.length < perEntry) {
      out.push({ entry, judges: eligible, short: true });
      return;
    }
    // shuffle and take perEntry
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    out.push({ entry, judges: shuffled.slice(0, perEntry) });
  });
  return out;
}