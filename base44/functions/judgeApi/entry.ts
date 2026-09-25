import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { verifyCustomSession } from '../../shared/customSession.ts';

// Judging Control Room proxy — every read/write goes to the parent
// 53 Challenges Judge API; the API key never reaches the browser.
// The judge is always identified by the AUTHENTICATED user's email
// (admins may pass judge_email to view on a judge's behalf).

const DEFAULT_BASE = 'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/publicChallengeApi';

const GET_ACTIONS = new Set([
  'judge-profile', 'judge-overview', 'judge-assignments', 'judge-entries',
  'judge-queue', 'judge-rubric', 'judge-panel-progress',
  'judge-variance-alerts', 'judge-results', 'judge-policies',
]);
const GET_PARAMS = ['round_id', 'category', 'scored', 'page', 'limit', 'entry_id'];
const POST_ACTIONS = new Set(['judge-score', 'judge-assignment-respond']);

const CRITERIA_KEYS = ['originality_creativity', 'technical_skill', 'emotional_impact', 'theme_interpretation'];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    const apiKey = secrets.get('CHALLENGE_API_KEY');
    if (!apiKey) {
      return Response.json({
        error: 'The judging service is not connected yet. Add the CHALLENGE_API_KEY secret in the app settings to enable judging.',
        setup_required: true,
      });
    }
    const base = secrets.get('CHALLENGE_API_BASE_URL') || DEFAULT_BASE;

    // ── Identity: platform session first, signed portal session second ──
    let user = await base44.auth.me().catch(() => null);
    if (!user && body.session_token) {
      const session = await verifyCustomSession(String(body.session_token), apiKey).catch(() => null);
      if (session) user = { email: session.email, full_name: session.name || '', role: 'user' };
    }
    if (!user?.email) return Response.json({ error: 'Please sign in to open the judging workspace.' }, { status: 401 });

    let judgeEmail = String(user.email).toLowerCase();
    if (user.role === 'admin' && body.judge_email) judgeEmail = String(body.judge_email).toLowerCase();

    if (GET_ACTIONS.has(action)) {
      const params = new URLSearchParams({ action, judge_email: judgeEmail });
      for (const k of GET_PARAMS) {
        if (body[k] !== undefined && body[k] !== null && body[k] !== '') params.set(k, String(body[k]));
      }
      const res = await fetch(`${base}?${params.toString()}`, { headers: { 'x-api-key': apiKey } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The parent app hasn't published this judge action yet — say so
        // plainly instead of leaking a raw "Unknown action" message.
        if (/unknown action/i.test(String(data?.error || ''))) {
          return Response.json({
            error: 'The 53 Challenges judging service does not offer this yet — the judge endpoints are still being switched on. Please check back soon.',
            upstream_status: res.status,
          });
        }
        return Response.json({ error: data?.error || `The judging service returned an error (${res.status}).`, upstream_status: res.status });
      }
      return Response.json(data);
    }

    if (POST_ACTIONS.has(action)) {
      const payload: any = { action, judge_email: judgeEmail };

      if (action === 'judge-score') {
        const criteria = body.criteria || {};
        const clean: any = {};
        for (const key of CRITERIA_KEYS) {
          const v = Number(criteria[key]);
          if (!Number.isFinite(v) || v < 0 || v > 25 || Math.round(v * 2) !== v * 2) {
            return Response.json({ error: 'Each score must be between 0 and 25, in steps of 0.5.' });
          }
          clean[key] = v;
        }
        if (!body.entry_id || !body.round_id) {
          return Response.json({ error: 'entry_id and round_id are required to submit a score.' });
        }
        payload.entry_id = String(body.entry_id);
        payload.round_id = String(body.round_id);
        payload.criteria = clean;
      }

      if (action === 'judge-assignment-respond') {
        if (!body.assignment_id || !['accepted', 'declined'].includes(body.response)) {
          return Response.json({ error: 'A valid assignment and response are required.' });
        }
        payload.assignment_id = String(body.assignment_id);
        payload.response = body.response;
        if (body.round_id) payload.round_id = String(body.round_id);
      }

      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        return Response.json({ error: data?.error || `The judging service could not save this (${res.status}).`, upstream_status: res.status });
      }
      return Response.json(data);
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}