import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getSecret } from '../../shared/secretsEnv.ts';
import { isAdminCaller } from '../../shared/adminAuth.ts';
import { fetchChallengeApi } from '../../shared/challengeApiHelper.ts';

// Read side of /domain-management.
//
// The page cannot query these entities from the browser: ChallengeDomain's RLS
// read rule is `user_condition: { role: 'admin' }`, which resolves against a
// Base44 platform user. Admins who signed in through this app's Challenge-API
// login have no platform user, so a direct base44.entities call returns
// nothing and the table looks permanently empty. Reading through a function
// with isAdminCaller + asServiceRole is the pattern the other admin pages use.
//
//   action: 'resolve'    -> { challenge_id } host -> challenge          (public)
//   action: 'map'        -> { map } challenge_id -> full_domain         (public)
//   action: 'list'       -> { domains: [] }     every subdomain record  (admin)
//   action: 'challenges' -> { challenges: [] }  picker options          (admin)

// 'resolve' must be public: every visitor arriving at limit.53challenges.com is
// anonymous, and the page cannot render until the host is mapped to a challenge.
// It reveals only what the hostname already reveals.
const PUBLIC_ACTIONS = new Set(['resolve', 'map']);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;

    if (action === 'resolve') {
      const host = String(body.host || '').trim().toLowerCase().replace(/\.$/, '');
      if (!host) return Response.json({ challenge_id: null });

      // Match on the stored full_domain rather than the slug, so the mapping
      // stays correct if the app is ever served from more than one base domain.
      // Status is filtered in code rather than in the query because a record
      // can legitimately be live under several status values.
      const rows = await sr.entities.ChallengeDomain
        .filter({ full_domain: host }, '-created_date', 20)
        .catch(() => []);

      const LIVE = new Set(['active', 'deployed', 'ssl_pending', 'dns_pending']);
      const row = (rows || []).find((r: any) => LIVE.has(String(r?.status || '')));

      return Response.json({
        challenge_id: row?.challenge_id || null,
        challenge_name: row?.challenge_name || '',
      });
    }

    if (action === 'map') {
      // Reverse of 'resolve': challenge_id -> full_domain, so the main site can
      // send a visitor straight to a challenge's own domain instead of routing
      // to /challenges/<id> in place. Public for the same reason resolve is —
      // it only exposes hostnames that are already publicly reachable.
      const rows = await sr.entities.ChallengeDomain
        .list('-created_date', 500)
        .catch(() => []);

      const LIVE = new Set(['active', 'deployed', 'ssl_pending', 'dns_pending']);
      const map: Record<string, string> = {};
      for (const r of (rows || [])) {
        const cid = String(r?.challenge_id || '');
        const host = String(r?.full_domain || '').trim().toLowerCase();
        if (!cid || !host) continue;
        if (!LIVE.has(String(r?.status || ''))) continue;
        // Rows are newest-first, so the first live row per challenge wins.
        if (!(cid in map)) map[cid] = host;
      }
      return Response.json({ map });
    }

    if (!PUBLIC_ACTIONS.has(action)) {
      const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
      if (!isAdmin) return Response.json({ error: 'Admins only' }, { status: 403 });
    }

    if (action === 'list') {
      const domains = await sr.entities.ChallengeDomain.list('-created_date', 200).catch(() => []);
      return Response.json({ domains: domains || [] });
    }

    if (action === 'challenges') {
      // Pull from the external Challenge API (source of truth), not the local
      // Challenge entity — the local entity only has template-generated records,
      // while real challenges like "Photo of the Day" live in the external API.
      const apiKey = getSecret('CHALLENGE_API_KEY');
      const apiBase = getSecret('CHALLENGE_API_BASE_URL');
      const result = await fetchChallengeApi('challenges', { status: 'active', limit: 500 }, apiKey, apiBase).catch(() => null);
      const challenges = result?.data || result?.challenges || [];
      const slim = (challenges || []).map((c: any) => ({ id: c.id, title: c.title || c.theme || c.id }));
      return Response.json({ challenges: slim });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}