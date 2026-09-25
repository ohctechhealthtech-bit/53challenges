import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/customSession';

// Backend calls return either the raw payload or an axios-style { data } wrapper.
function unwrap(res) {
  const payload = res && res.data !== undefined ? res.data : res;
  if (payload && payload.error) throw new Error(payload.error);
  return payload || {};
}

// The Challenge-API session token goes with every call. The admin actions
// (create, moderate_entry, moderate_entries) identify the caller from it; the
// public ones ignore it. Base44's version read identity from a platform
// session instead, which app admins signing in through the Challenge-API login
// never had — so sending it here is what lets moderation keep working once the
// route is served by the Java API. Harmless before the cutover: the Base44
// function ignores the extra field.
async function callEngine(action, payload = {}) {
  return unwrap(await base44.functions.invoke('challengeEngine', {
    action,
    session_token: getSessionToken(),
    ...payload,
  }));
}

export const challengeEngine = {
  list: () => callEngine('list'),
  get: (id) => callEngine('get', { id }),
  create: (data) => callEngine('create', { data }),
  entries: (challenge_id) => callEngine('entries', { challenge_id }),
  moderateEntry: (entry_id, status) => callEngine('moderate_entry', { entry_id, status }),
  moderateEntries: (entry_ids, status) => callEngine('moderate_entries', { entry_ids, status }),
};

// Statuses used by the main app's Challenge API.
export const STATUS_OPTIONS = ['draft', 'active', 'voting', 'completed', 'archived'];

export const STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  voting: 'Voting',
  completed: 'Completed',
  archived: 'Archived',
};