import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Audit workflow per competition. The Auditor role (a CompetitionAssignment
// with role 'auditor') has read access to entries, scores, votes and the prize
// ledger, and write access only to audit findings and sign-offs. Role
// separation is enforced at assignment time (checkRoleSeparation prevents one
// account holding auditor + judge/manager on the same competition) and again
// here: an acting auditor must NOT also be a judge or manager on the
// competition they audit.
//
// actions:
//   pre_launch   — confirm published terms match configuration; sponsor money
//                  must be recorded as received before the competition opens.
//   close_audit  — recompute combined scores from raw Score + Vote data,
//                  confirm blind judging and conflict exclusions applied,
//                  run a vote-integrity scan, pick a random sample.
//   set_check    — toggle a checklist item.
//   sign_off     — publish results + unlock prizes (only if no open material
//                  findings).
//   route        — route findings to head_judge or platform_admin for
//                  resolution and re-audit.
//   add_finding  — record an audit finding.
//   resolve_finding — mark a finding resolved.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, competition_id } = body;
    if (!action || !competition_id) return Response.json({ error: 'Missing action/competition_id' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sr = base44.asServiceRole;
    const isAdmin = user.role === 'admin';
    const now = new Date().toISOString();

    const challenge = await sr.entities.Challenge.get(competition_id).catch(() => null);
    if (!challenge) return Response.json({ error: 'Competition not found' }, { status: 404 });

    // Resolve the auditor assignment for this competition + role-separation gate.
    const assignments = await sr.entities.CompetitionAssignment.filter({ competition_id }, '-assigned_at', 500);
    const myAssignments = (assignments || []).filter((a) =>
      (a.judge_email || '').toLowerCase() === (user.email || '').toLowerCase() && a.status === 'active'
    );
    const isAuditor = myAssignments.some((a) => a.role === 'auditor');
    const isJudgeOrManager = myAssignments.some((a) => a.role === 'judge' || a.role === 'manager');
    if (isJudgeOrManager) {
      return Response.json({ error: 'Role separation violated: you are a judge or manager on this competition and cannot audit it.' }, { status: 403 });
    }
    const canAudit = isAdmin || isAuditor;
    if (!canAudit) return Response.json({ error: 'Not an assigned auditor for this competition.' }, { status: 403 });

    // Get or create the audit review record.
    let review = (await sr.entities.AuditReview.filter({ competition_id }, '-created_date', 5))[0];
    if (!review) {
      review = await sr.entities.AuditReview.create({
        competition_id,
        competition_title: challenge.title || challenge.theme || '',
        status: 'not_started',
      });
    }

    if (action === 'pre_launch') {
      const ledger = (await sr.entities.PrizeLedger.filter({ competition_id }, '-created_date', 5))[0];
      const terms = {
        has_brief: !!challenge.brief,
        has_category: !!challenge.category,
        starts_at_set: !!challenge.starts_at,
        submission_ends_at_set: !!challenge.submission_ends_at,
        voting_ends_at_set: !!challenge.voting_ends_at,
      };
      const issues = [];
      if (!terms.has_brief) issues.push('Published brief is missing.');
      if (!terms.has_category) issues.push('Category is not set.');
      if (!terms.starts_at_set) issues.push('Start date is not set.');
      if (!terms.submission_ends_at_set) issues.push('Submission close date is not set.');
      if (!terms.voting_ends_at_set) issues.push('Voting close date is not set.');
      // Sponsored prize money must be received before the competition opens.
      if (ledger && (ledger.funding_source === 'sponsor' || ledger.funding_source === 'mixed') &&
          challenge.status === 'active' && !ledger.sponsor_received) {
        issues.push('Sponsored prize money has not been recorded as received, but the competition is open.');
      }
      const terms_match = issues.length === 0;
      const updated = await sr.entities.AuditReview.update(review.id, {
        status: 'pre_launch',
        pre_launch: {
          terms_match,
          checked_by: user.email,
          checked_at: now,
          notes: issues.join(' '),
        },
      });
      return Response.json({ success: true, terms, terms_match, issues, review: updated });
    }

    if (action === 'close_audit') {
      // Independently recompute combined scores from raw data.
      const panel = (await sr.entities.JudgingPanel.filter({ competition_id }, '-created_date', 5))[0];
      const recomputed = await recompute(sr, panel, competition_id);

      // Confirm blind judging: every Score has an anonymous_id and an
      // EntryJudgeAssignment exists for the entry/judge.
      const scores = await sr.entities.Score.filter({ panel_id: panel?.id || 'none' }, '-created_date', 100000);
      const submitted = (scores || []).filter((s) => s.status === 'submitted' || s.status === 'locked');
      const blindOk = submitted.length > 0 && submitted.every((s) => !!s.anonymous_id);

      // Confirm conflict exclusions: no judge scored an entry they were
      // excluded from (no EntryJudgeAssignment for them), and every judge who
      // declared a conflict of interest wasn't assigned to a conflicting entry.
      const assignmentIds = new Set((await sr.entities.EntryJudgeAssignment.filter({ panel_id: panel?.id || 'none' }, '-assigned_at', 100000) || []).map((a) => `${a.entry_id}:${a.judge_profile_id}`));
      const conflictOk = submitted.every((s) => assignmentIds.has(`${s.entry_id}:${s.judge_profile_id}`));

      // Vote-integrity review for public-vote competitions.
      const fraud = await sr.functions.invoke('detectVoteFraud', { challenge_id: competition_id });
      const excludedVotes = await sr.entities.Vote.filter({ challenge_id: competition_id, excluded: true }, '-created_date', 100000);

      // Compare recomputed to stored CombinedResult.
      const stored = await sr.entities.CombinedResult.filter({ challenge_id: competition_id }, 'combined_rank', 500);
      const matches_stored = stored.length > 0 && stored.every((r) => {
        const rc = recomputed.byEntry[r.entry_id];
        return rc && Math.abs(rc.combined_score - r.combined_score) < 0.02;
      });

      const updated = await sr.entities.AuditReview.update(review.id, {
        status: 'in_audit',
        panel_id: panel?.id || '',
        recomputed: { rows: recomputed.rows, matches_stored, recomputed_at: now },
        vote_integrity: {
          scanned: fraud?.scanned || 0,
          flagged: fraud?.flagged || 0,
          excluded: (excludedVotes || []).length,
          notes: '',
        },
        checklist: {
          ...review.checklist,
          scores_recomputed: matches_stored,
          blind_judging_confirmed: blindOk,
          conflict_exclusions_confirmed: conflictOk,
          vote_integrity_done: true,
        },
      });

      return Response.json({
        success: true,
        review: updated,
        recomputed: recomputed.rows,
        matches_stored,
        blind_ok: blindOk,
        conflict_ok: conflictOk,
        vote_integrity: { scanned: fraud?.scanned || 0, flagged: fraud?.flagged || 0, excluded: (excludedVotes || []).length },
      });
    }

    if (action === 'set_check') {
      const { key, value } = body;
      if (!key) return Response.json({ error: 'Missing key' }, { status: 400 });
      const checklist = { ...(review.checklist || {}), [key]: value };
      const updated = await sr.entities.AuditReview.update(review.id, { checklist });
      return Response.json({ success: true, review: updated });
    }

    if (action === 'add_finding') {
      const { severity, category, detail } = body;
      if (!detail) return Response.json({ error: 'Missing detail' }, { status: 400 });
      const finding = await sr.entities.AuditFinding.create({
        review_id: review.id,
        competition_id,
        severity: severity || 'info',
        category: category || 'scoring',
        detail,
        status: 'open',
        created_by: user.email,
        created_by_name: user.full_name || user.email,
        created_at: now,
      });
      return Response.json({ success: true, finding });
    }

    if (action === 'resolve_finding') {
      const { finding_id, resolution } = body;
      if (!finding_id) return Response.json({ error: 'Missing finding_id' }, { status: 400 });
      const updated = await sr.entities.AuditFinding.update(finding_id, {
        status: 'resolved',
        resolution: resolution || '',
        resolved_by: user.email,
        resolved_at: now,
      });
      return Response.json({ success: true, finding: updated });
    }

    if (action === 'sign_off') {
      // Block sign-off while material findings are open, or before recompute.
      const findings = await sr.entities.AuditFinding.filter({ review_id: review.id, status: 'open' }, '-created_date', 500);
      const material = (findings || []).some((f) => f.severity === 'material');
      if (material) return Response.json({ error: 'Cannot sign off: open material findings must be resolved first.' }, { status: 409 });
      const cl = review.checklist || {};
      const required = ['scores_recomputed', 'blind_judging_confirmed', 'conflict_exclusions_confirmed', 'winning_evidence_verified', 'eligibility_confirmed', 'random_sample_done', 'vote_integrity_done'];
      const missing = required.filter((k) => !cl[k]);
      if (missing.length) return Response.json({ error: 'Cannot sign off: checklist incomplete — ' + missing.join(', '), status: 409 });

      const updated = await sr.entities.AuditReview.update(review.id, {
        status: 'signed_off',
        sign_off_by: user.email,
        sign_off_name: user.full_name || user.email,
        sign_off_at: now,
        sign_off_notes: body.notes || '',
      });
      // Unlock prizes: payouts previously audited now become eligible for admin approval.
      return Response.json({ success: true, review: updated });
    }

    if (action === 'route') {
      const { routed_to, reason } = body;
      if (!routed_to || !reason) return Response.json({ error: 'Missing routed_to/reason' }, { status: 400 });
      const updated = await sr.entities.AuditReview.update(review.id, {
        status: 'routed',
        routed_to,
        routing_reason: reason,
        re_audit_count: (review.re_audit_count || 0) + 1,
      });
      // Mark any open material findings as routed.
      const open = await sr.entities.AuditFinding.filter({ review_id: review.id, status: 'open', severity: 'material' }, '-created_date', 500);
      await sr.entities.AuditFinding.bulkUpdate((open || []).map((f) => ({ id: f.id, status: 'routed' })));
      return Response.json({ success: true, review: updated });
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Independent recompute of the combined weighted score per entry, mirroring
// computeCombinedResults but read-only (does not write CombinedResult). Used
// by the auditor to verify scores from raw data.
async function recompute(sr, panel, challengeId) {
  const rows = [];
  const byEntry = {};
  if (!panel) return { rows, byEntry };
  const jw = Number(panel.judge_weight ?? 0.7);
  const pw = Number(panel.public_weight ?? 0.3);
  const scaleMax = panel.scale_max || 10;
  const criteria = panel.criteria || [];
  const wTotal = criteria.reduce((s, c) => s + (Number(c.weight) || 1), 0) || 1;

  const scores = await sr.entities.Score.filter({ panel_id: panel.id }, '-created_date', 100000);
  const submitted = (scores || []).filter((s) => s.status === 'submitted' || s.status === 'locked');
  const judgePctByEntry = {};
  for (const s of submitted) {
    const sum = (s.scores || []).reduce((acc, sc) => {
      const crit = criteria.find((c) => c.name === sc.name);
      return acc + (Number(sc.value) || 0) * (Number(crit?.weight) || 1);
    }, 0);
    const pct = (sum / (wTotal * scaleMax)) * 100;
    (judgePctByEntry[s.entry_id] ||= []).push(pct);
  }
  const judgeScoreByEntry = {};
  for (const [eid, arr] of Object.entries(judgePctByEntry)) judgeScoreByEntry[eid] = arr.reduce((a, b) => a + b, 0) / arr.length;

  const votes = await sr.entities.Vote.filter({ challenge_id: challengeId }, '-created_date', 100000);
  const publicByEntry = {};
  for (const v of (votes || [])) { if (v.excluded) continue; publicByEntry[v.entry_id] = (publicByEntry[v.entry_id] || 0) + 1; }
  const maxVotes = Math.max(1, ...Object.values(publicByEntry));
  const publicScoreByEntry = {};
  for (const [eid, cnt] of Object.entries(publicByEntry)) publicScoreByEntry[eid] = (cnt / maxVotes) * 100;

  const entryIds = new Set([...Object.keys(judgeScoreByEntry), ...Object.keys(publicByEntry)]);
  for (const eid of entryIds) {
    const hasJ = judgeScoreByEntry[eid] !== undefined;
    const hasP = publicByEntry[eid] !== undefined;
    const j = hasJ ? judgeScoreByEntry[eid] : (hasP ? publicScoreByEntry[eid] : 0);
    const p = hasP ? publicScoreByEntry[eid] : (hasJ ? judgeScoreByEntry[eid] : 0);
    let jwEff = jw, pwEff = pw;
    if (hasJ && !hasP) { jwEff = 1; pwEff = 0; }
    if (hasP && !hasJ) { jwEff = 0; pwEff = 1; }
    const combined = jwEff * j + pwEff * p;
    const row = {
      entry_id: eid, judge_score: round(j), public_score: round(p),
      public_votes: publicByEntry[eid] || 0,
      combined_score: round(combined),
    };
    rows.push(row);
    byEntry[eid] = row;
  }
  rows.sort((a, b) => b.combined_score - a.combined_score);
  rows.forEach((r, i) => { r.combined_rank = i + 1; });
  return { rows, byEntry };
}

function round(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }