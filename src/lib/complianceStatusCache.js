import { base44 } from '@/api/base44Client';

// Shared cache for compliance gate statuses.
//
// A catalogue load mounts several components that each list challenges, so the
// same status lookup was firing a dozen times per page and tripping the API
// rate limit. Statuses are cached per challenge id for a short TTL, and
// concurrent requests share one in-flight call instead of racing.

const TTL_MS = 60_000;
const cache = new Map();    // id -> { value, at }
const inFlight = new Map(); // id -> Promise (per-id, so overlapping id sets dedupe)

// Fail-closed: missing/failed status must block Enter/Vote (matches complianceGate statuses default).
const DEFAULT_STATUS = { launch_blocked: true, legal_review_status: 'not_started', grandfathered_live: false };

function fresh(id) {
  const hit = cache.get(id);
  return hit && Date.now() - hit.at < TTL_MS ? hit.value : null;
}

async function fetchStatuses(ids) {
  const res = await base44.functions.invoke('complianceGate', { action: 'statuses', challenge_ids: ids });
  const statuses = res.data?.statuses || {};
  const at = Date.now();
  for (const id of ids) cache.set(id, { value: statuses[id] || DEFAULT_STATUS, at });
  return statuses;
}

export async function getComplianceStatuses(ids) {
  const clean = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!clean.length) return {};

  const missing = clean.filter((id) => !fresh(id));

  if (missing.length) {
    // Ids already being fetched by another caller are awaited, never refetched —
    // so two components asking for overlapping (not identical) id sets result in
    // one request each for their genuinely new ids only.
    const waitFor = [];
    const toFetch = [];
    for (const id of missing) {
      const pending = inFlight.get(id);
      if (pending) waitFor.push(pending);
      else toFetch.push(id);
    }

    if (toFetch.length) {
      const promise = fetchStatuses(toFetch)
        .catch(() => ({}))
        .finally(() => { for (const id of toFetch) inFlight.delete(id); });
      for (const id of toFetch) inFlight.set(id, promise);
      waitFor.push(promise);
    }

    await Promise.all(waitFor.map((p) => p.catch(() => {})));
  }

  const out = {};
  for (const id of clean) out[id] = fresh(id) || DEFAULT_STATUS;
  return out;
}

/** Drop cached statuses — call after an admin changes a gate. */
export function clearComplianceStatusCache() {
  cache.clear();
  inFlight.clear();
}