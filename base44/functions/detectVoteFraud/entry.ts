import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Verified-voting fraud detection.
// Scans votes and flags (excludes) fraudulent votes with a logged justification:
//   1. Duplicate-account detection — multiple accounts on one entry that
//      normalise to the same inbox (gmail dots/plus-aliases ignored).
//   2. Vote-spike anomalies — an hour window holding >SPIKE_RATIO of an
//      entry's total votes with at least SPIKE_HOUR_THRESHOLD votes.
// Flagged votes are excluded from totals (excluded=true) with a reason, and an
// immutable VoteAuditLog entry records the justification. Admin can restore a
// false flag from the fraud dashboard.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { challenge_id } = body;
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    const isAdmin = me && (me.role === "admin" || me.is_admin === true);
    if (!isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const sr = base44.asServiceRole;

    // Never trust client-supplied thresholds. Fixed conservative defaults.
    const SPIKE_HOUR_THRESHOLD = 10;
    const SPIKE_RATIO = 0.5;

    const votes = challenge_id
      ? await sr.entities.Vote.filter({ challenge_id }, '-created_date', 100000)
      : await sr.entities.Vote.list('-created_date', 100000);

    let flagged = 0;
    const byReason = { duplicate_account: 0, vote_spike: 0 };
    const now = new Date().toISOString();
    const auditBatch = [];

    const byEntry = {};
    for (const v of (votes || [])) (byEntry[v.entry_id] ||= []).push(v);

    for (const [entryId, evs] of Object.entries(byEntry)) {
      // --- Duplicate-account detection ---
      const byNorm = {};
      for (const v of evs) {
        const k = normalizeEmail(v.user_email);
        (byNorm[k] ||= []).push(v);
      }
      for (const [k, group] of Object.entries(byNorm)) {
        if (group.length > 1) {
          for (const v of group) {
            if (v.excluded) continue;
            await sr.entities.Vote.update(v.id, {
              excluded: true,
              excluded_reason: `Duplicate account: ${group.length} accounts on entry ${entryId} share inbox ${k}`,
              excluded_at: now,
              excluded_by: 'system',
              flag_type: 'duplicate_account',
            });
            auditBatch.push({
              vote_id: v.id, challenge_id: v.challenge_id || challenge_id || '', entry_id: entryId,
              actor: 'system', action: 'duplicate_detected',
              reason: `Inbox ${k} used by ${group.length} accounts on entry ${entryId}`, at: now,
            });
            flagged++; byReason.duplicate_account++;
          }
        }
      }

      // --- Vote-spike detection by hour ---
      if (evs.length >= SPIKE_HOUR_THRESHOLD) {
        const hours = {};
        for (const v of evs) (hours[hourKey(v.created_date)] ||= []).push(v);
        for (const [hk, group] of Object.entries(hours)) {
          const ratio = group.length / evs.length;
          if (group.length >= SPIKE_HOUR_THRESHOLD && ratio > SPIKE_RATIO) {
            for (const v of group) {
              if (v.excluded) continue;
              await sr.entities.Vote.update(v.id, {
                excluded: true,
                excluded_reason: `Vote spike: ${group.length} votes in hour ${hk} (${Math.round(ratio * 100)}% of entry total)`,
                excluded_at: now,
                excluded_by: 'system',
                flag_type: 'vote_spike',
              });
              auditBatch.push({
                vote_id: v.id, challenge_id: v.challenge_id || challenge_id || '', entry_id: entryId,
                actor: 'system', action: 'spike_detected',
                reason: `${group.length} votes in hour ${hk} on entry ${entryId} (${Math.round(ratio * 100)}% of total)`, at: now,
              });
              flagged++; byReason.vote_spike++;
            }
          }
        }
      }
    }

    if (auditBatch.length) await sr.entities.VoteAuditLog.bulkCreate(auditBatch);

    return Response.json({ success: true, scanned: (votes || []).length, flagged, byReason });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function normalizeEmail(email) {
  const e = (email || '').trim().toLowerCase();
  const at = e.indexOf('@');
  if (at < 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return `${local.replace(/\./g, '').split('+')[0]}@${domain}`;
  }
  return `${local.split('+')[0]}@${domain}`;
}

function pad(n) { return String(n).padStart(2, '0'); }
function hourKey(iso) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}`;
}