// Which live challenges a host is allowed to look after.
//
// The main 53 Challenges site owns participant submissions, but it does not
// know about this app's host applications. So host review rights are resolved
// here, from the host's own applications/requests, and the main site is then
// asked on their behalf (delegated through an account it accepts as admin).

const norm = (s) => String(s || '').trim().toLowerCase();

/** Challenge ids + titles this email may review entries for. */
export async function hostOwnedChallenges(sr, email) {
  const ids = new Set<string>();
  const titles = new Set<string>();
  const me = norm(email);
  if (!me) return { ids, titles };

  const drafts = await sr.entities.ChallengeDraft.filter({ origin: 'host_apply' }, '-created_date', 200).catch(() => []);
  for (const d of drafts || []) {
    if (norm(d.answers?.host_email) !== me) continue;
    // Only challenges the host looks after themselves. When the 53 team manages
    // the content, entry review stays with the team.
    if (d.content_type !== 'host_managed') continue;
    if (d.challenge_id) ids.add(String(d.challenge_id));
    if (d.challenge_title) titles.add(norm(d.challenge_title));
  }

  return { ids, titles };
}

/** True when a queue entry from the main site belongs to one of those challenges. */
export function ownsEntry(owned, entry) {
  return (entry.challenge_id && owned.ids.has(String(entry.challenge_id)))
    || owned.titles.has(norm(entry.challenge_title));
}

/**
 * An account the main site treats as an admin, used to act for a host whose
 * rights live in this app. Returns '' when none of our admins are known there.
 */
export async function findDelegateActor(sr, askQueue) {
  const admins = await sr.entities.User.filter({ role: 'admin' }, '-created_date', 5).catch(() => []);
  for (const a of admins || []) {
    if (!a.email) continue;
    const res = await askQueue(a.email).catch(() => null);
    if (res?.is_admin) return { email: a.email, queue: res };
  }
  return { email: '', queue: null };
}