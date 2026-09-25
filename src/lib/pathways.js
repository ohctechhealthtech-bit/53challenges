// Frontend helpers for competition pathways, series & rankings.
import { base44 } from '@/api/base44Client';

function invoke(action, payload = {}) {
  return base44.functions.invoke('pathways', { action, ...payload }).then((r) => r.data);
}

export const PATHWAY_TYPES = [
  { value: 'national_state_ranking', label: 'National with State Rankings', desc: 'One entry pool with automatic state + national leaderboards and state title-holders.' },
  { value: 'state_to_national', label: 'State → National', desc: 'Per-state qualifiers whose winners auto-promote into a national final.' },
  { value: 'local_to_state_to_national', label: 'Local → State → National', desc: 'Linked local and state qualifiers feeding a national final.' },
  { value: 'series_championship', label: 'Series Championship', desc: 'Multiple competitions accumulate points toward a season leaderboard and champion.' },
  { value: 'private_organisation', label: 'Private Organisation', desc: 'Entry restricted to approved organisations (access code or approved list).' },
  { value: 'invitational', label: 'Invitational', desc: 'Entry restricted to invited entrants (email list or access code).' },
];

export const MEMBER_KINDS = [
  { value: 'anchor', label: 'Anchor (national final / single pool)' },
  { value: 'state_qualifier', label: 'State qualifier' },
  { value: 'local_qualifier', label: 'Local qualifier' },
  { value: 'qualifier', label: 'Qualifier' },
  { value: 'series_event', label: 'Series event' },
];

export function listPathwaysAdmin() { return invoke('list'); }
export function savePathway(pathway) { return invoke('save_pathway', { pathway }); }
export function deletePathway(pathway_id) { return invoke('delete_pathway', { pathway_id }); }
export function saveMember(member) { return invoke('save_member', { member }); }
export function removeMember(member_id) { return invoke('remove_member', { member_id }); }
export function computeStandings(pathway_id) { return invoke('compute_standings', { pathway_id }); }
export function promoteWinners(from_challenge_id) { return invoke('promote_winners', { from_challenge_id }); }

// Public gating config for the submit form (no secrets exposed).
export function publicPathwayConfig(challenge_id) {
  return invoke('public_config', { challenge_id });
}

// Eligibility check before submitting an entry.
export function checkPathwayEntry(challenge_id, { email, organisation, access_code } = {}) {
  return invoke('entry_check', { challenge_id, email, organisation, access_code });
}

// Read helpers.
export async function getPathwayForChallenge(challengeId) {
  const [members, pathways] = await Promise.all([
    base44.entities.PathwayMember.filter({ challenge_id: challengeId, status: 'active' }, '-created_date', 20).catch(() => []),
    base44.entities.Pathway.list('-created_date', 200).catch(() => []),
  ]);
  const ids = new Set((members || []).map((m) => m.pathway_id));
  const anchor = (pathways || []).find((p) => p.anchor_challenge_id === challengeId && p.status !== 'archived');
  if (anchor) ids.add(anchor.id);
  if (!ids.size) return { pathway: null, member: null, isAnchor: false, isQualifier: false };
  const ps = (pathways || []).filter((p) => ids.has(p.id) && p.status !== 'archived');
  // Prefer the most specific: a qualifier member first, else anchor.
  const qualifierMember = (members || []).find((m) => m.promotion_to_challenge_id);
  const anchorPathway = (pathways || []).find((p) => p.anchor_challenge_id === challengeId && p.status !== 'archived');
  const pathway = qualifierMember
    ? (ps.find((p) => p.id === qualifierMember.pathway_id) || ps[0])
    : (anchorPathway || ps[0]);
  return {
    pathway,
    member: qualifierMember || (members || [])[0] || null,
    members: members || [],
    isAnchor: !!anchorPathway,
    isQualifier: !!qualifierMember,
  };
}

export function getSeriesStandings(pathwayId) {
  return base44.entities.SeriesStanding.filter({ pathway_id: pathwayId }, '-total_points', 200).catch(() => []);
}

export function getPromotionsTo(challengeId) {
  return base44.entities.Promotion.filter({ to_challenge_id: challengeId }, '-promoted_at', 200).catch(() => []);
}

export function getPromotedEntries(challengeId) {
  return base44.entities.Entry.filter({ challenge_id: challengeId }, '-created_date', 500).catch(() => []);
}

// Compute national + state leaderboards and state title-holders from an entry pool.
export function computeStateNationalBoards(entries, rankBy = 'votes') {
  const countFor = (e) => (rankBy === 'votes' ? (e.community_votes ?? e.vote_count ?? 0) : (e.combined_score ?? 0));
  const national = [...entries].sort((a, b) => countFor(b) - countFor(a));
  const byState = {};
  for (const e of entries) {
    const s = e.state || 'Unknown';
    if (!byState[s]) byState[s] = [];
    byState[s].push(e);
  }
  const stateBoards = Object.entries(byState).map(([state, list]) => ({
    state,
    rows: [...list].sort((a, b) => countFor(b) - countFor(a)),
  })).sort((a, b) => b.rows.length - a.rows.length);
  const titleHolders = stateBoards
    .map((b) => ({ state: b.state, entry: b.rows[0] }))
    .filter((t) => t.entry);
  return { national, stateBoards, titleHolders };
}