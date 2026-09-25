import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Combined weighted scoring.
// Computes the final result per entry from the judging score and the public
// vote, using the per-competition weightings stored on the JudgingPanel
// (judge_weight default 0.7 / public_weight default 0.3). Judge and public
// components are each normalised to 0–100, then combined = jw·judge + pw·public.
// Excluded (fraud-flagged) public votes are skipped. Writes one CombinedResult
// per entry (replacing previous results for the challenge). Optionally locks
// results on the panel.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { panel_id, lock } = body;
    if (!panel_id) return Response.json({ error: 'Missing panel_id' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const panel = await sr.entities.JudgingPanel.get(panel_id);
    const jw = Number(panel.judge_weight ?? 0.7);
    const pw = Number(panel.public_weight ?? 0.3);
    const scaleMax = panel.scale_max || 10;
    const criteria = panel.criteria || [];
    const wTotal = criteria.reduce((s, c) => s + (Number(c.weight) || 1), 0) || 1;
    const challengeId = panel.competition_id;

    // --- Judge scores (submitted/locked only) ---
    const scores = await sr.entities.Score.filter({ panel_id }, '-created_date', 100000);
    const submitted = (scores || []).filter((s) => s.status === 'submitted' || s.status === 'locked');
    const judgePctByEntry = {};      // entry -> array of per-judge percentages
    const judgeCountByEntry = {};
    for (const s of submitted) {
      const sum = (s.scores || []).reduce((acc, sc) => {
        const crit = criteria.find((c) => c.name === sc.name);
        return acc + (Number(sc.value) || 0) * (Number(crit?.weight) || 1);
      }, 0);
      const pct = (sum / (wTotal * scaleMax)) * 100;
      (judgePctByEntry[s.entry_id] ||= []).push(pct);
      judgeCountByEntry[s.entry_id] = (judgeCountByEntry[s.entry_id] || 0) + 1;
    }
    const judgeScoreByEntry = {};
    for (const [eid, arr] of Object.entries(judgePctByEntry)) {
      judgeScoreByEntry[eid] = arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    // --- Public votes (non-excluded) ---
    const votes = await sr.entities.Vote.filter({ challenge_id: challengeId }, '-created_date', 100000);
    const publicByEntry = {};
    for (const v of (votes || [])) {
      if (v.excluded) continue;
      publicByEntry[v.entry_id] = (publicByEntry[v.entry_id] || 0) + 1;
    }
    const maxVotes = Math.max(1, ...Object.values(publicByEntry));
    const publicScoreByEntry = {};
    for (const [eid, cnt] of Object.entries(publicByEntry)) {
      publicScoreByEntry[eid] = (cnt / maxVotes) * 100;
    }

    // --- Combine ---
    const entryIds = new Set([...Object.keys(judgeScoreByEntry), ...Object.keys(publicByEntry)]);
    const results = [];
    for (const eid of entryIds) {
      const hasJ = judgeScoreByEntry[eid] !== undefined;
      const hasP = publicByEntry[eid] !== undefined;
      let j = hasJ ? judgeScoreByEntry[eid] : (hasP ? publicScoreByEntry[eid] : 0);
      let p = hasP ? publicScoreByEntry[eid] : (hasJ ? judgeScoreByEntry[eid] : 0);
      // If only one source exists, collapse the missing weight to the available one.
      let jwEff = jw, pwEff = pw;
      if (hasJ && !hasP) { jwEff = 1; pwEff = 0; }
      if (hasP && !hasJ) { jwEff = 0; pwEff = 1; }
      const combined = jwEff * j + pwEff * p;
      results.push({
        entry_id: eid, challenge_id: challengeId, panel_id,
        judge_score: round(j), public_score: round(p),
        public_votes: publicByEntry[eid] || 0,
        judge_count: judgeCountByEntry[eid] || 0,
        combined_score: round(combined),
        computed_at: new Date().toISOString(),
      });
    }
    results.sort((a, b) => b.combined_score - a.combined_score);
    results.forEach((r, i) => { r.combined_rank = i + 1; });

    // Replace previous results for this challenge.
    await sr.entities.CombinedResult.deleteMany({ challenge_id: challengeId });
    if (results.length) await sr.entities.CombinedResult.bulkCreate(results);

    if (lock) {
      await sr.entities.JudgingPanel.update(panel_id, {
        status: 'complete',
        results_locked: true,
        results_locked_at: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, results, weights: { judge: jw, public: pw } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function round(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }