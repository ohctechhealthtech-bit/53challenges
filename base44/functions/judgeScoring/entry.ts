import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { resolveCaller } from '../../shared/adminAuth.ts';

// Protected judging surface.
// Judge identity, panel membership and entry allocation are ALWAYS derived
// server-side from the authenticated session — a client-supplied
// judge_profile_id is never trusted. Judging entities are admin-only under RLS,
// so all judge reads/writes flow through here on the service role.

async function logAudit(sr, panelId, actor, action, detail) {
  await sr.entities.JudgingAuditLog.create({
    panel_id: panelId || '',
    actor: actor || 'system',
    action,
    detail: detail || '',
    at: new Date().toISOString(),
  });
}

// Resolve the judge profile that belongs to the signed-in account.
async function resolveJudge(sr, user) {
  const email = String(user.email || '').toLowerCase().trim();
  if (!email) return null;
  const list = await sr.entities.JudgeProfile.filter({ email }, '-created_date', 5);
  const prof = (list || [])[0];
  if (!prof || prof.status !== 'active') return null;
  return prof;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Judges sign in through the Challenge-API login, so base44.auth.me() alone
    // sees nobody and the whole judging surface was unreachable for them.
    // resolveCaller accepts either login and returns { email, role }.
    const user = await resolveCaller(base44, body.session_token || '', secrets.get('CHALLENGE_API_KEY') || '');
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;
    const action = body.action;
    const isAdmin = user.role === 'admin';
    const actor = String(user.email || '').toLowerCase().trim();

    // ── Lightweight check: does this account have an active judge profile? ──
    if (action === 'is_judge') {
      const judge = await resolveJudge(sr, user);
      return Response.json({ is_judge: !!judge, judge_name: judge?.name || '' });
    }

    // ── Judge workspace: only the caller's own panels and allocated entries ──
    if (action === 'workspace') {
      const judge = await resolveJudge(sr, user);
      if (!judge) return Response.json({ judge: null, panels: [], assignments: [], scores: [] });

      const allPanels = await sr.entities.JudgingPanel.list('-created_date', 200);
      const panels = (allPanels || []).filter((p) => (p.judge_profile_ids || []).includes(judge.id));
      const panelIds = panels.map((p) => p.id);

      const [assignments, scores, calibration] = await Promise.all([
        sr.entities.EntryJudgeAssignment.filter({ judge_profile_id: judge.id }, '-assigned_at', 500),
        sr.entities.Score.filter({ judge_profile_id: judge.id }, '-created_date', 500),
        sr.entities.CalibrationScore.filter({ judge_profile_id: judge.id }, '-created_date', 500),
      ]);

      return Response.json({
        judge: { id: judge.id, name: judge.name, email: judge.email },
        panels: panels.map((p) => ({
          id: p.id,
          competition_title: p.competition_title || p.competition_id,
          competition_id: p.competition_id,
          status: p.status,
          criteria: p.criteria || [],
          scale_max: p.scale_max || 10,
          calibration_entry_ids: p.calibration_entry_ids || [],
          is_head_judge: p.head_judge_profile_id === judge.id,
        })),
        // Blinded projection — no creator identity ever leaves the server.
        assignments: (assignments || [])
          .filter((a) => panelIds.includes(a.panel_id))
          .map((a) => ({
            id: a.id,
            panel_id: a.panel_id,
            entry_id: a.entry_id,
            anonymous_id: a.anonymous_id,
            work_type: a.blind_work_type,
            work_text: a.blind_work_text,
            work_link: a.blind_work_link,
          })),
        scores: (scores || []).map((s) => ({
          id: s.id,
          panel_id: s.panel_id,
          entry_id: s.entry_id,
          status: s.status,
          scores: s.scores || [],
          comments: s.comments || [],
          compliance_flagged: !!s.compliance_flagged,
          compliance_reason: s.compliance_reason || '',
          compliance_note: s.compliance_note || '',
          compliance_status: s.compliance_status || 'none',
        })),
        calibration: (calibration || []).map((c) => ({ id: c.id, panel_id: c.panel_id, entry_id: c.entry_id })),
      });
    }

    // ── Submit or amend the caller's own score for an allocated entry ──
    if (action === 'submit') {
      const judge = await resolveJudge(sr, user);
      if (!judge) return Response.json({ error: 'No active judge profile for this account.' }, { status: 403 });

      const panelId = String(body.panel_id || '');
      const entryId = String(body.entry_id || '');
      if (!panelId || !entryId) return Response.json({ error: 'panel_id and entry_id required' }, { status: 400 });

      const panel = await sr.entities.JudgingPanel.get(panelId).catch(() => null);
      if (!panel) return Response.json({ error: 'Panel not found' }, { status: 404 });
      if (!(panel.judge_profile_ids || []).includes(judge.id)) {
        return Response.json({ error: 'You are not a member of this panel.' }, { status: 403 });
      }
      if (panel.status !== 'scoring') {
        return Response.json({ error: 'This panel is not open for scoring.' }, { status: 403 });
      }

      // The allocation is the authority: no allocation, no score.
      const allocation = await sr.entities.EntryJudgeAssignment.filter(
        { panel_id: panelId, entry_id: entryId, judge_profile_id: judge.id }, '-assigned_at', 1
      );
      const alloc = (allocation || [])[0];
      if (!alloc) return Response.json({ error: 'This entry is not allocated to you.' }, { status: 403 });

      const existing = await sr.entities.Score.filter(
        { panel_id: panelId, entry_id: entryId, judge_profile_id: judge.id }, '-created_date', 1
      );
      const prior = (existing || [])[0];
      if (prior && prior.status === 'submitted') {
        return Response.json({ error: 'You have already scored this entry.' }, { status: 409 });
      }
      if (prior && prior.status === 'locked') {
        return Response.json({ error: 'This score is locked and cannot be changed.' }, { status: 403 });
      }

      const payload = {
        panel_id: panelId,
        entry_id: entryId,
        anonymous_id: alloc.anonymous_id,
        judge_profile_id: judge.id,
        judge_name: judge.name,
        scores: Array.isArray(body.scores) ? body.scores : [],
        comments: Array.isArray(body.comments) ? body.comments : [],
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      };
      if (body.compliance_flagged) {
        payload.compliance_flagged = true;
        payload.compliance_reason = String(body.compliance_reason || 'other');
        payload.compliance_note = String(body.compliance_note || '');
        payload.compliance_status = 'open';
      }

      const saved = prior
        ? await sr.entities.Score.update(prior.id, payload)
        : await sr.entities.Score.create(payload);

      await logAudit(sr, panelId, actor, prior ? 'score_resubmitted' : 'score_submitted', alloc.anonymous_id);
      if (payload.compliance_flagged) {
        await logAudit(sr, panelId, actor, 'compliance_flag_raised', `${alloc.anonymous_id}: ${payload.compliance_reason}`);
      }
      return Response.json({ success: true, score_id: saved.id });
    }

    // ── Calibration round: a sample score, panel membership required ──
    if (action === 'submit_calibration') {
      const judge = await resolveJudge(sr, user);
      if (!judge) return Response.json({ error: 'No active judge profile for this account.' }, { status: 403 });

      const panelId = String(body.panel_id || '');
      const entryId = String(body.entry_id || '');
      const panel = await sr.entities.JudgingPanel.get(panelId).catch(() => null);
      if (!panel) return Response.json({ error: 'Panel not found' }, { status: 404 });
      if (!(panel.judge_profile_ids || []).includes(judge.id)) {
        return Response.json({ error: 'You are not a member of this panel.' }, { status: 403 });
      }
      if (!(panel.calibration_entry_ids || []).includes(entryId)) {
        return Response.json({ error: 'That is not a calibration sample for this panel.' }, { status: 403 });
      }

      await sr.entities.CalibrationScore.create({
        panel_id: panelId,
        judge_profile_id: judge.id,
        judge_name: judge.name,
        entry_id: entryId,
        scores: Array.isArray(body.scores) ? body.scores : [],
        comments: '',
        at: new Date().toISOString(),
      });
      await logAudit(sr, panelId, actor, 'calibration_score_submitted', entryId);
      return Response.json({ success: true });
    }

    // ── Raise a compliance flag on an already-scored entry ──
    if (action === 'flag') {
      const judge = await resolveJudge(sr, user);
      if (!judge) return Response.json({ error: 'No active judge profile for this account.' }, { status: 403 });

      const panelId = String(body.panel_id || '');
      const entryId = String(body.entry_id || '');
      const existing = await sr.entities.Score.filter(
        { panel_id: panelId, entry_id: entryId, judge_profile_id: judge.id }, '-created_date', 1
      );
      const score = (existing || [])[0];
      if (!score) return Response.json({ error: 'Score this entry before flagging it.' }, { status: 404 });

      await sr.entities.Score.update(score.id, {
        compliance_flagged: true,
        compliance_reason: String(body.compliance_reason || 'other'),
        compliance_note: String(body.compliance_note || ''),
        compliance_status: 'open',
      });
      await logAudit(sr, panelId, actor, 'compliance_flag_raised', `${score.anonymous_id}: ${body.compliance_reason || 'other'}`);
      return Response.json({ success: true });
    }

    // ── Admin: every open compliance flag, with panel progress ──
    if (action === 'admin_overview') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

      const panels = await sr.entities.JudgingPanel.list('-created_date', 200);
      const allScores = await sr.entities.Score.list('-created_date', 5000);
      const allAllocations = await sr.entities.EntryJudgeAssignment.list('-assigned_at', 5000);

      const progress = (panels || []).map((p) => {
        const allocated = (allAllocations || []).filter((a) => a.panel_id === p.id).length;
        const done = (allScores || []).filter((s) => s.panel_id === p.id && s.status === 'submitted').length;
        return {
          id: p.id,
          title: p.competition_title || p.competition_id,
          status: p.status,
          judges: (p.judge_profile_ids || []).length,
          allocated,
          done,
        };
      });

      const flags = (allScores || [])
        .filter((s) => s.compliance_flagged && s.compliance_status === 'open')
        .map((s) => ({
          id: s.id,
          panel_id: s.panel_id,
          anonymous_id: s.anonymous_id,
          judge_name: s.judge_name,
          reason: s.compliance_reason,
          note: s.compliance_note,
          raised_at: s.submitted_at || s.created_date,
        }));

      return Response.json({ progress, flags });
    }

    // ── Admin: resolve a compliance flag ──
    if (action === 'resolve_flag') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const scoreId = String(body.score_id || '');
      const decision = body.decision === 'upheld' ? 'upheld' : 'dismissed';
      if (!scoreId) return Response.json({ error: 'score_id required' }, { status: 400 });

      const score = await sr.entities.Score.get(scoreId).catch(() => null);
      if (!score) return Response.json({ error: 'Score not found' }, { status: 404 });

      await sr.entities.Score.update(scoreId, {
        compliance_status: decision,
        compliance_resolved_by: actor,
        compliance_resolved_at: new Date().toISOString(),
      });
      await logAudit(sr, score.panel_id, actor, 'compliance_flag_resolved', `${score.anonymous_id}: ${decision}`);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}