import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { verifyCustomSession } from '../../shared/customSession.ts';
import { ideaApiGet, fromIdeaRecord } from '../../shared/hostIdeas.ts';
import { listMyRequests } from '../../shared/hostRequestApi.ts';

// Every request/application this person has ever sent us, in one list, so they
// can always see where each one is up to:
//   • challenge requests (enquiry form)
//   • challenge ideas ("Tell us your idea")
//   • host applications (paid application wizard)
//   • judge applications
//
// Identity is always derived server-side from the session, so nobody can read
// somebody else's applications.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    const platformUser = await base44.auth.me().catch(() => null);
    let email = platformUser?.email ? String(platformUser.email).toLowerCase().trim() : '';
    if (!email && body.session_token) {
      const payload = await verifyCustomSession(
        String(body.session_token), secrets.get('CHALLENGE_API_KEY') || ''
      ).catch(() => null);
      email = payload?.email ? String(payload.email).toLowerCase() : '';
    }
    if (!email) return Response.json({ error: 'Please sign in to see your requests.' }, { status: 401 });

    const items: any[] = [];

    // ── Challenge requests AND host applications — pulled from the parent ──
    // No local copy is kept; the parent's request API is the single source of
    // truth, so deletions there are reflected here immediately. The parent
    // groups a host's submissions as 'enquiries' (enquiry form) and 'proposals'
    // (paid application wizard); both come from the one list call.
    const mirroredUpstreamIds = new Set<string>();
    try {
      const mine = await listMyRequests(secrets.get('CHALLENGE_API_KEY') || '', email);
      for (const r of mine) {
        if (r.id) mirroredUpstreamIds.add(String(r.id));
        const group = r.group || '';
        if (group === 'proposals') {
          items.push({
            id: r.id,
            kind: 'application',
            title: r.challenge_title || 'Challenge application',
            subtitle: r.company_name || '',
            status: r.status || 'intake_received',
            submitted_at: r.submitted_at || '',
            feedback: '',
          });
        } else {
          // Enquiries (and any ungrouped request) show as a request.
          items.push({
            id: r.id,
            kind: 'request',
            title: r.challenge_title || 'Challenge request',
            subtitle: r.company_name || '',
            status: r.status || 'new',
            submitted_at: r.submitted_at || '',
          });
        }
      }
    } catch {
      // Parent unavailable — skip rather than failing the whole list.
    }

    // ── Challenge ideas ("Tell us your idea") ──────────────────────────
    const ideaRes = await ideaApiGet({ action: 'ideas', limit: '200' }).catch(() => ({}));
    for (const rec of Array.isArray(ideaRes?.ideas) ? ideaRes.ideas : []) {
      const idea = fromIdeaRecord(rec);
      if (String(idea.answers?.email || '').toLowerCase() !== email) continue;
      // Only genuine "Tell us your idea" submissions — host applications and
      // enquiries also land on the main site and are already listed above.
      if (idea.answers?.source !== 'tell_us_your_idea') continue;
      if (mirroredUpstreamIds.has(String(idea.id))) continue;
      items.push({
        id: idea.id,
        kind: 'idea',
        title: idea.challenge_title || 'Challenge idea',
        subtitle: idea.answers?.organisation_name || '',
        status: idea.review_status || 'new',
        submitted_at: idea.created_date,
      });
    }

    // ── Judge applications ────────────────────────────────────────────
    const judges = await sr.entities.JudgeProfile.filter({ email }, '-created_date', 20).catch(() => []);
    for (const j of judges || []) {
      items.push({
        id: j.id,
        kind: 'judge',
        title: 'Judge application',
        subtitle: (j.applied_categories || []).join(', '),
        status: j.status || 'applicant',
        submitted_at: j.created_date,
      });
    }

    items.sort((a, b) => String(b.submitted_at || '').localeCompare(String(a.submitted_at || '')));
    return Response.json({ items, count: items.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}