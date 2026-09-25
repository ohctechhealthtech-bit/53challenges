import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { fetchChallengeApi } from '../../shared/challengeApiHelper.ts';

// Patterns that identify seeded / QA / test / demo data that should never
// appear on the public homepage.
const BAD_PATTERNS = [
  /\bqa\b/i,
  /\btest\b/i,
  /\bseed/i,
  /\bdemo\b/i,
  /\bmock\b/i,
  /\bplaceholder\b/i,
  /\bsample\b/i,
  /dannce/i,
  /cod kill master/i,
  /warzone/i,
  /biggest loser/i,
  /endless ideas/i,
];

// "Creator 1", "Creator 2" etc. — seeded finalist data from the upstream API.
const CREATOR_N = /\bcreator\s*\d/i;
// "Entry 1", "Entry 2" etc. — seeded entry titles.
const ENTRY_N = /entry\s*\d/i;

function isBadText(...parts) {
  const text = parts.filter(Boolean).join(' ');
  if (!text.trim()) return true;
  if (BAD_PATTERNS.some((re) => re.test(text))) return true;
  if (CREATOR_N.test(text) || ENTRY_N.test(text)) return true;
  return false;
}

function isBadChallenge(ch) {
  if (!ch) return true;
  if (isBadText(ch.title, ch.theme, ch.description)) return true;
  // Seeded demo challenges have null titles and generic category-only names.
  if (!ch.title && !ch.theme) return true;
  return false;
}

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(parseInt(body.limit, 10) || 24, 100);

    const apiKey = secrets.get("CHALLENGE_API_KEY");
    const baseUrl = secrets.get("CHALLENGE_API_BASE_URL");

    const challengesData = await fetchChallengeApi('challenges', {}, apiKey, baseUrl);
    const allChallenges = challengesData.challenges || [];

    // Exclude QA / test / seeded challenges before fetching their entries.
    const challenges = allChallenges.filter((c) => !isBadChallenge(c));

    const entriesPromises = challenges.map((ch) =>
      fetchChallengeApi('entries', { challenge_id: ch.id, limit: 100 }, apiKey, baseUrl)
        .then((data) => (data.entries || []).map((e) => ({
          ...e,
          challenge_id: ch.id,
          challenge_title: ch.title || ch.theme || '',
          challenge_voting_ends_at: ch.voting_end_date || ch.voting_ends_at || '',
          challenge_category: ch.category || '',
        })))
        .catch(() => [])
    );
    const allEntries = (await Promise.all(entriesPromises)).flat();

    // Filter: only approved entries from real challenges, excluding seeded /
    // QA / test records.
    const validEntries = allEntries.filter((e) => {
      if (!e) return false;
      if (e.status !== 'approved') return false;
      if (isBadText(e.title, e.creator_name, e.challenge_title)) return false;
      const minor = e.is_minor === true || ['children', 'teens'].includes(String(e.division || e.division_name || '').toLowerCase());
      if (minor && String(e.guardian_approval_status || '') !== 'approved') return false;
      return true;
    });

    // Sort by submitted_at descending (newest first).
    validEntries.sort((a, b) => {
      const da = new Date(a.submitted_at || a.created_date || 0).getTime();
      const db = new Date(b.submitted_at || b.created_date || 0).getTime();
      return db - da;
    });

    const recent = validEntries.slice(0, limit);

    // Enrich with real vote counts from the local Vote entity.
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const entryIds = recent.map((e) => e.id);
    let voteCounts = {};
    if (entryIds.length) {
      const allVotes = await sr.entities.Vote.filter({}, '-created_date', 100000);
      for (const v of (allVotes || [])) {
        if (entryIds.includes(v.entry_id)) {
          voteCounts[v.entry_id] = (voteCounts[v.entry_id] || 0) + 1;
        }
      }
    }
    const enriched = recent.map((e) => ({
      ...e,
      community_votes: voteCounts[e.id] ?? e.community_votes ?? e.vote_count ?? 0,
    }));

    // Finalists: pull from local Entry records marked by admins via the
    // dashboard.  Sorted by finalist_week descending (most recently marked
    // first), limited to 5.
    let finalists = [];
    try {
      const finalistRecords = await sr.entities.Entry.filter(
        { is_finalist: true, status: 'approved' },
        '-finalist_week',
        5
      );
      // Enrich finalist vote counts from local Vote entity.
      const fEntryIds = (finalistRecords || []).map((f) => f.upstream_entry_id).filter(Boolean);
      if (fEntryIds.length && !entryIds.length) {
        const allVotes = await sr.entities.Vote.filter({}, '-created_date', 100000);
        for (const v of (allVotes || [])) {
          if (fEntryIds.includes(v.entry_id)) {
            voteCounts[v.entry_id] = (voteCounts[v.entry_id] || 0) + 1;
          }
        }
      }
      finalists = (finalistRecords || []).map((f) => ({
        id: f.upstream_entry_id || f.id,
        challenge_id: f.challenge_id,
        challenge_title: f.challenge_title || '',
        title: f.title,
        creator_name: f.creator_name,
        state: f.state,
        category: f.category || '',
        work_url: f.work_link || '',
        community_votes: voteCounts[f.upstream_entry_id] ?? f.vote_count ?? 0,
        is_finalist: true,
      }));
    } catch (e) {
      // If Entry entity isn't accessible, return empty finalists.
    }

    return Response.json({
      entries: enriched,
      finalists,
      count: enriched.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}