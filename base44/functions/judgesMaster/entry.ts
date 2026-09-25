import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import {
  judgesMasterBase, judgesMasterGet, judgesMasterPost, upsertHostJudges,
} from '../../shared/judgesMaster.ts';
import { verifyCustomSession } from '../../shared/customSession.ts';

const READ_ACTIONS = new Set(['options', 'judges', 'judge']);
const ADMIN_ACTIONS = new Set(['upsert', 'set_active']);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get('action') || 'judges';

    // Read actions are public — visitors browsing the host wizard see the
    // judge panel before they sign in. Everything else requires a session.
    const apiKey = secrets.get('CHALLENGE_API_KEY');

    let user = null;
    if (READ_ACTIONS.has(action)) {
      user = await base44.auth.me().catch(() => null);
    } else {
      user = await base44.auth.me().catch(() => null);
      // Hosts signed in through the challenge portal have no platform
      // session — their signed session token identifies them instead.
      if (!user && action === 'save_host_judges' && body.session_token) {
        const session = await verifyCustomSession(body.session_token, apiKey);
        if (session) user = { email: session.email, full_name: session.name, role: 'user' };
      }
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const isAdmin = user?.role === 'admin';
    const base = judgesMasterBase(secrets.get('CHALLENGE_API_BASE_URL'));

    if (READ_ACTIONS.has(action)) {
      const params = { ...Object.fromEntries(url.searchParams.entries()), ...body };
      const data = await judgesMasterGet(action, params, apiKey, base);

      // The judges list must also include judges approved locally in this
      // app (JudgeProfile status approved/active) that were never pushed to
      // the external master — otherwise they silently vanish from the admin list.
      if (action === 'judges') {
        const external = Array.isArray(data.judges) ? data.judges : [];
        const known = new Set(external.map((j) => (j.email || '').toLowerCase()));
        const profiles = await base44.asServiceRole.entities.JudgeProfile.filter({
          status: { $in: ['approved', 'active'] },
        });
        const locals = profiles
          .filter((p) => p.email && !known.has(p.email.toLowerCase()))
          .map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            disciplines: p.approved_categories?.length ? p.approved_categories : (p.applied_categories || []),
            level: 'state',
            active: true,
          }))
          // Respect the same filters the external list was queried with.
          .filter((j) => {
            if (params.active === 'false') return false; // locals are always active
            if (params.level && params.level !== j.level) return false;
            if (params.discipline && !j.disciplines.includes(params.discipline)) return false;
            return true;
          });
        let judges = [...external, ...locals];
        // Dedupe by judge id — the same record can appear twice if the
        // external master returns it in both the list and a filtered query.
        const seenIds = new Set();
        judges = judges.filter((j) => {
          if (!j.id || seenIds.has(j.id)) return false;
          seenIds.add(j.id);
          return true;
        });
        // Judge emails stay admin-only — public/host callers only need
        // names, levels and disciplines to pick a panel.
        if (!isAdmin) judges = judges.map(({ email: _e, ...j }) => j);
        return Response.json({ ...data, judges, count: judges.length });
      }

      return Response.json(data);
    }

    if (ADMIN_ACTIONS.has(action)) {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { action: _a, ...rest } = body;
      const data = await judgesMasterPost({ action, ...rest }, apiKey, base);
      return Response.json(data);
    }

    if (action === 'save_host_judges') {
      const saved = await upsertHostJudges(body.judges || [], apiKey, base);
      return Response.json({ success: true, judges: saved });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}