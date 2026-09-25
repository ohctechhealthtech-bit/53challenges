import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { fetchChallengeApi } from '../../shared/challengeApiHelper.ts';

// Returns all entries the given user has voted on (from the local Vote entity),
// enriched with challenge title and entry details from the external Challenge API.
export default async function(req) {
  try {
    // Identity comes from the authenticated session only — a user_email in the
    // request body is ignored, so nobody can read another person's vote history.
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const email = String(user.email).trim().toLowerCase();

    const sr = base44.asServiceRole;

    const votes = await sr.entities.Vote.filter({ user_email: email }, '-created_date', 100000);
    if (!votes || votes.length === 0) return Response.json({ entries: [], count: 0 });

    // Group voted entry_ids by challenge_id, plus vote metadata
    const byChallenge = {};
    const voteMeta = {};
    for (const v of votes) {
      const cid = v.challenge_id;
      if (!byChallenge[cid]) byChallenge[cid] = new Set();
      byChallenge[cid].add(v.entry_id);
      voteMeta[v.entry_id] = { voted_at: v.created_date };
    }

    // Native entries (stored in this app) resolve locally.
    const votedIdsAll = votes.map((v) => v.entry_id).filter(Boolean);
    const nativeEntries = await sr.entities.Entry.filter({ id: { $in: votedIdsAll } }, '-created_date', 1000).catch(() => []);
    const nativeVoted = (nativeEntries || []).map(({ creator_email, ...e }) => ({
      ...e,
      voted_at: voteMeta[e.id]?.voted_at || null,
    }));
    const nativeIds = new Set(nativeVoted.map((e) => e.id));

    // Fetch all challenges to get titles
    const apiKey = secrets.get("CHALLENGE_API_KEY");
    const baseUrl = secrets.get("CHALLENGE_API_BASE_URL");
    const challengesData = await fetchChallengeApi('challenges', {}, apiKey, baseUrl).catch(() => ({}));
    const challenges = challengesData.challenges || [];
    const chMap = {};
    for (const ch of challenges) chMap[ch.id] = ch;

    // For each challenge with votes, fetch entries and match
    const entryPromises = Object.entries(byChallenge).map(([cid, votedIds]) =>
      fetchChallengeApi('entries', { challenge_id: cid }, apiKey, baseUrl)
        .then(data => {
          const entries = data.entries || [];
          const ch = chMap[cid] || {};
          return entries
            .filter(e => votedIds.has(e.id) && !nativeIds.has(e.id))
            .map(e => ({
              ...e,
              challenge_title: ch.title || ch.theme || '',
              challenge_id: cid,
              voted_at: voteMeta[e.id]?.voted_at || null,
            }));
        })
        .catch(() => [])
    );
    const results = await Promise.all(entryPromises);
    const votedEntries = [...nativeVoted, ...results.flat()];

    return Response.json({ entries: votedEntries, count: votedEntries.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}