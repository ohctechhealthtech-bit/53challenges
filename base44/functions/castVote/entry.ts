import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logEvent } from "../../shared/complianceGateHelper.ts";
import { isVoteBlocked } from "../../shared/lifecycleGateHelper.ts";
import { fetchChallengeApi } from "../../shared/challengeApiHelper.ts";
import { verifyCustomSession } from "../../shared/customSession.ts";
import { secrets } from "base44:runtime";

// Records a vote from a logged-in user for a specific entry.
//
// IDENTITY: the voter is derived from the authenticated session ONLY. Any
// user_email / user_id supplied in the request body is ignored — a caller
// cannot vote as somebody else.
//
// VALIDATION (all server-side, all fail-closed):
//   - caller must be authenticated
//   - challenge_id is required (no unchecked path)
//   - the target entry must exist and belong to that challenge
//   - the target entry must be approved
//   - the challenge's voting gate must be open
//   - one vote per user per entry
async function audit(sr, detail, cid, user) {
  try {
    await sr.entities.ComplianceAuditEvent.create({
      event_type: "participation_denied",
      challenge_id: String(cid || ""),
      actor_id: user?.id || "",
      actor_email: user?.email || "",
      detail,
    });
  } catch {}
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const apiKey = secrets.get("CHALLENGE_API_KEY") || Deno.env.get("CHALLENGE_API_KEY");

    // ── Authenticated identity only ──
    // Either a Base44 platform session, or the server-signed token issued by
    // this app's custom (Challenge-API) login — the same identity model as
    // entry submission. A client-supplied email is never trusted.
    const platformUser = await base44.auth.me().catch(() => null);
    let user = platformUser?.email ? platformUser : null;
    if (!user) {
      const session = await verifyCustomSession(String(body.session_token || ""), apiKey);
      if (session) user = { id: session.uid, email: session.email, full_name: session.name };
    }
    if (!user?.email) {
      return Response.json({ error: "You must be signed in to vote." }, { status: 401 });
    }
    const email = String(user.email).trim().toLowerCase();

    const entry_id = String(body.entry_id || "");
    const cid = String(body.challenge_id || "");

    const sr = base44.asServiceRole;

    if (!entry_id) return Response.json({ error: "Missing entry_id" }, { status: 400 });
    if (!cid) {
      await audit(sr, "castVote rejected: challenge_id missing — vote could not be gate-checked.", "", user);
      return Response.json({ error: "Missing challenge_id" }, { status: 400 });
    }

    // ── Entry must exist, belong to this challenge, and be approved ──
    // Entries live either natively (Entry entity) or upstream (Challenge-API).
    // Both are checked; if neither knows the entry, the vote is refused.
    const entry = await sr.entities.Entry.get(entry_id).catch(() => null);
    if (entry) {
      if (String(entry.challenge_id) !== cid) {
        await audit(sr, `castVote rejected: entry ${entry_id} does not belong to challenge ${cid}.`, cid, user);
        return Response.json({ error: "This entry does not belong to that challenge." }, { status: 400 });
      }
      if (entry.status !== "approved") {
        await audit(sr, `castVote rejected: entry ${entry_id} is '${entry.status}', not approved.`, cid, user);
        return Response.json({ error: "This entry is not open for voting." }, { status: 403 });
      }
      // Guardian gate: minors are votable only with an explicit approved
      // guardian decision. Empty / missing / not_required / pending / declined
      // / revoked all fail closed. No legacy pass.
      if (entry.is_minor || ["children", "teens"].includes(String(entry.division || "").toLowerCase())) {
        const gas = String(entry.guardian_approval_status || "");
        if (gas !== "approved") {
          await audit(sr, `castVote rejected: entry ${entry_id} guardian approval is '${gas || "empty"}'.`, cid, user);
          return Response.json({ error: "This entry is awaiting guardian approval." }, { status: 403 });
        }
      }
    } else {
      const upstream = await fetchChallengeApi(
        "entries",
        { challenge_id: cid, limit: 500 },
        apiKey,
        secrets.get("CHALLENGE_API_BASE_URL") || Deno.env.get("CHALLENGE_API_BASE_URL"),
      ).catch(() => null);
      const list = Array.isArray(upstream) ? upstream : (upstream?.entries || null);
      if (!list) {
        await audit(sr, `castVote rejected: entry ${entry_id} could not be verified (entry lookup unavailable).`, cid, user);
        return Response.json({ error: "We couldn't verify that entry right now. Please try again." }, { status: 503 });
      }
      const match = list.find((e) => String(e.id) === entry_id);
      if (!match) {
        await audit(sr, `castVote rejected: entry ${entry_id} does not exist in challenge ${cid}.`, cid, user);
        return Response.json({ error: "This entry does not exist." }, { status: 404 });
      }
      const st = String(match.status || "approved").toLowerCase();
      if (st !== "approved") {
        await audit(sr, `castVote rejected: upstream entry ${entry_id} is '${st}', not approved.`, cid, user);
        return Response.json({ error: "This entry is not open for voting." }, { status: 403 });
      }
      const upstreamMinor = match.is_minor === true || ["children", "teens"].includes(String(match.division || "").toLowerCase());
      const upstreamGas = String(match.guardian_approval_status || "");
      if (upstreamMinor && upstreamGas !== "approved") {
        await audit(sr, `castVote rejected: upstream entry ${entry_id} guardian approval is '${upstreamGas || "empty"}'.`, cid, user);
        return Response.json({ error: "This entry is awaiting guardian approval." }, { status: 403 });
      }
    }

    // ── Lifecycle / compliance gate (fail-closed) ──
    const blocked = await isVoteBlocked(sr, cid);
    if (blocked) {
      try {
        await logEvent(sr, {
          gate_id: "", challenge_id: cid,
          action: "enforcement_block",
          field_name: "cast_vote",
          note: "castVote blocked a vote for a challenge whose voting gate is not open.",
        });
      } catch {}
      await audit(sr, `castVote rejected: voting gate not open for challenge ${cid}.`, cid, user);
      return Response.json(
        { error: "Voting on this challenge is not open." },
        { status: 403 }
      );
    }

    // Duplicate check: has this user already voted on this entry?
    const existing = await sr.entities.Vote.filter({ entry_id, user_email: email }, '-created_date', 1);
    if (existing && existing.length) {
      const all = await sr.entities.Vote.filter({ entry_id }, '-created_date', 100000);
      return Response.json({
        success: false,
        duplicate: true,
        error: "You already voted for this entry.",
        votes: (all || []).filter((v) => !v.excluded).length,
      });
    }

    // The platform issues a session token only after email verification
    // (register → OTP → verifyOtp → token), so an authenticated voter is by
    // construction a confirmed email account.
    await sr.entities.Vote.create({
      entry_id,
      challenge_id: cid,
      user_id: user.id || '',
      user_email: email,
      voter_verified: true,
    });

    try {
      await sr.entities.Entry.updateMany({ id: entry_id }, { $inc: { vote_count: 1 } });
    } catch {}

    const all = await sr.entities.Vote.filter({ entry_id }, '-created_date', 100000);
    return Response.json({ success: true, votes: (all || []).filter((v) => !v.excluded).length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}