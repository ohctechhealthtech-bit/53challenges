import { base44 } from '@/api/base44Client';
import { getComplianceStatuses } from '@/lib/complianceStatusCache';
import { cachedCall, clearRequestCache } from '@/lib/requestCache';
import { getSessionToken } from '@/lib/customSession';

// Reads that several components request simultaneously on one page load.
const READ_TTL_MS = 60_000;

function normChallenge(c) {
  if (!c) return null;
  return {
    ...c,
    starts_at: c.start_date || c.starts_at,
    submission_ends_at: c.end_date || c.submission_ends_at,
    voting_ends_at: c.voting_end_date || c.voting_ends_at,
    category: (c.category || '').replace(/_/g, '-'),
    brief: c.brief || c.description || '',
    total_votes: c.total_votes || 0,
    is_featured: c.is_featured === true,
  };
}

// Native challenges (this app's Challenge entity) — mapped into the same shape
// the public UI already consumes. Enter/Vote stay hidden until the lifecycle
// gates have actually opened entries or voting.
const NATIVE_LIVE = ['published', 'entry_open', 'voting_open', 'closed'];

// Hide legacy (main-app) challenges by STATUS only — test challenges are set
// to Draft in the main app, so no title matching is needed.
function isJunkLegacy(c) {
  const t = `${c?.title || ''} ${c?.theme || ''}`;
  if (!String(t).trim()) return true;
  const status = String(c?.status || '').toLowerCase();
  return status === 'draft' || status === 'archived';
}

function normNative(c) {
  const kidsDiv = (c.divisions || []).some((d) => ['children', 'teens'].includes(String(d || '').toLowerCase()));
  return {
    ...c,
    category: (c.category || '').replace(/_/g, '-'),
    brief: c.brief || '',
    total_votes: c.total_votes || 0,
    submission_count: c.submission_count || 0,
    is_featured: false,
    is_native: true,
    // Enter/Vote stay hidden until gates open — and never for kids/teens until guardians exist.
    compliance_blocked: kidsDiv || !['entry_open', 'voting_open'].includes(c.lifecycle_status),
  };
}

async function listNativeChallenges() {
  return cachedCall('native:list', READ_TTL_MS, async () => {
    try {
      const res = await base44.functions.invoke('challengeEngine', { action: 'list' });
      const list = (res.data?.challenges || res.challenges || []).filter((c) => NATIVE_LIVE.includes(c.lifecycle_status));
      return list.map(normNative);
    } catch {
      return [];
    }
  });
}

function divSlugFromName(name) {
  const d = (name || '').toLowerCase();
  if (d.includes('ndi')) return 'ndi';
  if (d.includes('child')) return 'children';
  if (d.includes('teen')) return 'teens';
  return 'adults';
}

function normEntry(e) {
  if (!e) return null;
  return {
    ...e,
    vote_count: e.community_votes ?? e.vote_count ?? 0,
    work_url: e.work_url || e.work_link || '',
    division: e.division || divSlugFromName(e.division_name),
    state: e.state || '',
    city: e.city || '',
    description: e.description || '',
  };
}

function isPubliclyListableEntry(e) {
  if (!e) return false;
  const kids = e.is_minor === true ||
    ['children', 'teens'].includes(String(e.division || e.division_name || '').toLowerCase());
  if (kids && String(e.guardian_approval_status || '') !== 'approved') return false;
  return true;
}

async function call(payload) {
  try {
    const res = await base44.functions.invoke('challengeApi', payload);
    return res.data;
  } catch (err) {
    // Non-2xx: the backend function returns the upstream JSON body (e.g.
    // { error: "Invalid credentials" }) — surface it instead of the raw
    // axios "Request failed with status code N" string.
    const data = err?.response?.data ?? err?.data;
    if (data && (data.error || data.success === false || data.user)) return data;
    throw err;
  }
}

export const challengeApi = {
  async listChallenges(params = {}) {
    const [native, data] = await Promise.all([
      listNativeChallenges(),
      call({ action: 'challenges', ...params }),
    ]);
    const nativeUpstreamIds = new Set(native.map((c) => c.upstream_id).filter(Boolean));
    const legacy = (data.challenges || [])
      .map(normChallenge)
      .filter((c) => !nativeUpstreamIds.has(c.id))
      .filter((c) => !isJunkLegacy(c));
    const statuses = await this.complianceStatuses(legacy.map((c) => c.id).filter(Boolean));
    // Fail-closed: missing status or launch_blocked hides Enter/Vote on upstream cards.
    legacy.forEach((c) => {
      const s = statuses[c.id];
      c.compliance_blocked = !s || s.launch_blocked !== false;
    });
    const challenges = [...native, ...legacy];
    // Override total_votes with live counts from this app's Vote entity so
    // cards/hero/grid match the challenge page (which sums the same entity).
    const ids = challenges.map((c) => c.id).filter(Boolean);
    if (ids.length) {
      const totals = await this.liveVoteTotals(ids);
      challenges.forEach((c) => {
        if (totals[c.id] != null) c.total_votes = totals[c.id];
      });
    }
    return { challenges, count: challenges.length };
  },
  // Master category list from the live Challenge API.
  async listCategories(includeInactive = false) {
    const data = await call({ action: 'categories', include_inactive: includeInactive });
    return data.categories || [];
  },
  async getChallenge(id) {
    // Native challenges first — they are this app's source of truth.
    try {
      const native = await cachedCall(`native:get:${id}`, READ_TTL_MS, async () => {
        const res = await base44.functions.invoke('challengeEngine', { action: 'get', id });
        return res.data?.challenge || res.challenge || null;
      });
      if (native && NATIVE_LIVE.includes(native.lifecycle_status)) {
        const norm = normNative(native);
        const totals = await this.liveVoteTotals([id]);
        if (totals[id] != null) norm.total_votes = totals[id];
        return norm;
      }
    } catch { /* not a native challenge — fall through to the legacy API */ }
    const data = await call({ action: 'challenges', id });
    const ch = Array.isArray(data.challenges) ? data.challenges[0] : data.challenge;
    const norm = normChallenge(ch);
    if (!norm || isJunkLegacy(norm)) return null;
    if (norm.id) {
      const statuses = await this.complianceStatuses([norm.id]);
      const s = statuses[norm.id];
      norm.compliance_blocked = !s || s.launch_blocked !== false;
      const totals = await this.liveVoteTotals([norm.id]);
      if (totals[norm.id] != null) norm.total_votes = totals[norm.id];
    }
    return norm;
  },
  // Live vote totals from this app's Vote entity (same source as the challenge
  // page), cached 60s. Returns { [challenge_id]: number }.
  async liveVoteTotals(ids) {
    const key = ids.filter(Boolean).slice(0, 100).join(',');
    if (!key) return {};
    return cachedCall(`votes:totals:${key}`, READ_TTL_MS, async () => {
      try {
        const res = await base44.functions.invoke('challengeVotes', {
          action: 'totals',
          challenge_ids: ids.filter(Boolean).slice(0, 100),
        });
        return res.data?.totals || {};
      } catch {
        return {};
      }
    });
  },
  async listEntries(challenge_id, params = {}) {
    let entries;
    // Native challenges keep their entries in this app.
    try {
      const native = await cachedCall(`native:entries:${challenge_id}`, READ_TTL_MS, async () => {
        const res = await base44.functions.invoke('challengeEngine', { action: 'entries', challenge_id });
        return res.data?.entries || res.entries || [];
      });
      if (native && native.length) {
        entries = native.map(normEntry).filter(isPubliclyListableEntry);
      }
    } catch { /* fall through to the legacy API */ }
    if (!entries) {
      const data = await call({ action: 'entries', challenge_id, ...params });
      entries = (data.entries || []).map(normEntry).filter(isPubliclyListableEntry);
    }
    // Override with live per-entry vote counts from this app's Vote entity
    // (same source as the challenge detail page) so cards, banners, and the
    // detail page all show the same numbers.
    if (entries && entries.length) {
      const votes = await this.getChallengeVotes(challenge_id).catch(() => null);
      const counts = votes?.counts || {};
      entries.forEach((e) => {
        if (counts[e.id] != null) e.vote_count = counts[e.id];
      });
      // Re-sort by the live vote count so "leading/top" lists are ranked by
      // the same numbers we just overwrote — not the stale upstream order.
      const sortParam = String(params.sort || '').toLowerCase();
      const voteSorts = ['popular', '-community_votes', 'community_votes', '-vote_count', 'vote_count', '-votes', 'votes'];
      if (voteSorts.includes(sortParam)) {
        entries.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
      }
    }
    return entries || [];
  },
  async getVotes(challenge_id) {
    return call({ action: 'votes', challenge_id });
  },
  // Interim compliance gate (Prompt 13) — read-only block status per
  // external challenge_id. Used to annotate challenges so the UI can hide
  // Enter/Vote buttons for launch-blocked challenges.
  async complianceStatuses(ids) {
    try {
      return await getComplianceStatuses(ids);
    } catch {
      return {};
    }
  },
  async castVote(payload) {
    const res = await call({ action: 'cast_vote', ...payload });
    clearRequestCache('votes:');
    return res;
  },
  // Local vote (this app's Vote entity) — server-enforced one vote per user per entry.
  async castVoteLocal(payload) {
    try {
      const res = await base44.functions.invoke('castVote', {
        ...payload,
        // Custom (Challenge-API) logins have no platform session — the signed
        // token is how the server derives their identity.
        session_token: getSessionToken(),
      });
      clearRequestCache('votes:'); // fresh counts on the next read
      return res.data;
    } catch (err) {
      // Surface the backend's message instead of "Request failed with status code N".
      const data = err?.response?.data ?? err?.data;
      if (data?.error) return data;
      throw err;
    }
  },
  // Per-entry vote counts + the entries the current user has already voted.
  async getChallengeVotes(challenge_id, user_email) {
    return cachedCall(`votes:${challenge_id}:${user_email || ''}`, READ_TTL_MS, async () => {
      const res = await base44.functions.invoke('challengeVotes', { challenge_id, user_email: user_email || null });
      return res.data;
    });
  },
  async submitEntry(entry) {
    const res = await call({ action: 'submit_entry', entry });
    clearRequestCache('native:entries'); // a new entry must show immediately
    return res;
  },
  // Most recent entries across ALL challenges (from the external API).
  async latestEntries(limit = 24) {
    const res = await base44.functions.invoke('latestEntries', { limit });
    return res.data;
  },
  async checkEmail(challenge_id, email) {
    return call({ action: 'check_email', challenge_id, email });
  },
  // Public running classes (live, approved) from the upstream Classes API.
  async listClasses(limit = 50) {
    const data = await call({ action: 'classes', limit });
    return data.classes || [];
  },
  // Classes the given student email has booked/enrolled in.
  async myClasses(email) {
    const data = await call({ action: 'my_classes', email });
    return data.classes || [];
  },
  async login({ email, password }) {
    return call({ action: 'login', email, password });
  },
  async forgotPassword(email) {
    return call({ action: 'forgot_password', email });
  },
  async verifyReset(token) {
    return call({ action: 'verify_reset', token });
  },
  async resetPassword({ token, new_password }) {
    return call({ action: 'reset_password', token, new_password });
  },
  async googleConfig() {
    return call({ action: 'google_config' });
  },
  async googleLogin({ access_token }) {
    return call({ action: 'google_login', access_token });
  },
  async submitJudgeApplication(payload) {
    return call({ action: 'submit_judge_application', ...payload });
  },
  async submitSponsorApplication(payload) {
    return call({ action: 'submit_sponsor_application', ...payload });
  },
  // Host-a-Challenge form: calls external API + saves local PartnerInquiry
  // record tagged with the logged-in user's email.
  async hostChallengeRequest(formData, loggedInEmail, verificationToken) {
    const res = await base44.functions.invoke('hostChallengeRequest', {
      form_data: formData,
      logged_in_email: loggedInEmail || '',
      verification_token: verificationToken || '',
    });
    return res.data;
  },
};