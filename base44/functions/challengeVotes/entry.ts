import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Returns, for a single challenge, the per-entry vote counts (source of truth
// from the Vote entity) and the list of entry IDs the requesting user has
// already voted on — so the UI can show the "Voted" state accurately.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { challenge_id, user_email } = body;

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    // Per-challenge live totals from this app's Vote entity — public, so the
    // challenge list/cards can show the same counts as the challenge page.
    // Accepts { action: 'totals', challenge_ids: [...] } (max 100 ids) and
    // returns { totals: { [challenge_id]: number } } counting only valid
    // (non-excluded) votes — the same filter the per-challenge 'counts' path uses.
    if (body.action === "totals") {
      const rawIds = Array.isArray(body.challenge_ids) ? body.challenge_ids : [];
      const ids = [...new Set(rawIds.filter(Boolean))].slice(0, 100);
      if (rawIds.length > 0) {
        const totals = {};
        await Promise.all(ids.map(async (cid) => {
          const all = await sr.entities.Vote.filter({ challenge_id: cid }, '-created_date', 100000);
          totals[cid] = (all || []).filter((v) => !v.excluded).length;
        }));
        return Response.json({ totals });
      }
      // Backward-compatible admin-only global aggregate (no challenge_ids).
      const me = await base44.auth.me().catch(() => null);
      const isAdmin = me && (me.role === "admin" || me.is_admin === true);
      if (!isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
      const all = await sr.entities.Vote.list('-created_date', 100000);
      const rows = all || [];
      return Response.json({
        total: rows.filter((v) => !v.excluded).length,
        excluded: rows.filter((v) => v.excluded).length,
      });
    }

    if (!challenge_id) return Response.json({ error: "Missing challenge_id" }, { status: 400 });
    const all = await sr.entities.Vote.filter({ challenge_id }, '-created_date', 100000);

    const email = (user_email || '').trim().toLowerCase();
    const votedEntryIds = [];
    const counts = {};
    let excludedCount = 0;
    for (const v of (all || [])) {
      // Flagged/disqualified votes are excluded from all totals.
      if (v.excluded) { excludedCount++; continue; }
      counts[v.entry_id] = (counts[v.entry_id] || 0) + 1;
      if (email && (v.user_email || '').toLowerCase() === email) {
        votedEntryIds.push(v.entry_id);
      }
    }
    return Response.json({ votedEntryIds, counts, excludedCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}