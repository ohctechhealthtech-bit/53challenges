import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { fetchChallengeApi } from "../../shared/challengeApiHelper.ts";
import { logEvent } from "../../shared/complianceGateHelper.ts";
import { isEntryBlocked } from "../../shared/lifecycleGateHelper.ts";
import { resolveEntryFeeCents } from "../../shared/entryFeeHelper.ts";
import { verifyCustomSession } from "../../shared/customSession.ts";
import { upsertGuardian, linkChild, createApprovalRequest, normEmail } from "../../shared/guardianHelper.ts";
import { checkEmailVerified, consumeEmailVerification } from "../../shared/emailVerification.ts";

// Server-side entry submission wrapper. Centralises validation, the duplicate
// guard, the exclusion guard and the push to the external Challenge API.
//   action: 'check'  -> { challenge_id, email } -> { duplicate }
//   action: 'submit' -> { entry }              -> { success, entry }
// Native challenges (this app's Challenge entity) store entries locally in the
// Entry entity instead of pushing them to the upstream Challenge API.
async function getNativeChallenge(sr, id) {
  try {
    const c = await sr.entities.Challenge.get(String(id));
    return c && c.source === "native" ? c : null;
  } catch {
    return null;
  }
}

function maskEmail(email) {
  const [local, domain] = String(email).split("@");
  if (!domain) return "";
  return `${local.slice(0, 1)}***@${domain}`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const apiKey = secrets.get("CHALLENGE_API_KEY");
    const baseUrl = secrets.get("CHALLENGE_API_BASE_URL");
    if (!apiKey) return Response.json({ error: "CHALLENGE_API_KEY secret not set" }, { status: 500 });

    // ── Identity ──────────────────────────────────────────────────────────
    // Either a Base44 platform session, or a server-signed token issued by
    // this app's custom (Challenge-API) login. Both are verified server-side;
    // a client-supplied email alone is never trusted.
    // Anonymous / expired sessions: auth.me() throws — that's a 401, not a 500.
    const platformUser = await base44.auth.me().catch(() => null);
    let user = platformUser?.email ? platformUser : null;
    if (!user) {
      const session = await verifyCustomSession(String(body.session_token || ""), apiKey);
      if (session) user = { id: session.uid, email: session.email, full_name: session.name };
    }
    if (!user?.email) {
      return Response.json({ error: "Please sign in to submit an entry." }, { status: 401 });
    }

    if (action === "check") {
      const challenge_id = String(body.challenge_id || "");
      // Always the verified account — the duplicate check can't be probed
      // against someone else's address.
      const email = String(user.email || "").toLowerCase().trim();
      if (!challenge_id || !email) {
        return Response.json({ error: "challenge_id and email required" }, { status: 400 });
      }
      const native = await getNativeChallenge(base44.asServiceRole, challenge_id);
      if (native) {
        const existing = await base44.asServiceRole.entities.Entry.filter(
          { challenge_id, creator_email: email }, "-created_date", 1
        ).catch(() => []);
        return Response.json({ duplicate: !!(existing && existing.length) });
      }
      const data = await fetchChallengeApi("check_email", { challenge_id, email }, apiKey, baseUrl);
      const duplicate = !!(data?.duplicate || data?.exists || data?.already_entered);
      return Response.json({ duplicate });
    }

    if (action === "submit") {
      const entry = body.entry;
      if (!entry || !entry.challenge_id || !entry.creator_email || !entry.title || !(entry.work_url || entry.work_link || entry.work_text)) {
        return Response.json({ error: "Missing required entry fields" }, { status: 400 });
      }
      // ── Identity: the entrant is the authenticated account, always ──
      // A supplied creator_email that isn't the signed-in account is rejected
      // rather than silently trusted.
      const email = String(user.email || "").toLowerCase().trim();
      const claimed = String(entry.creator_email || "").toLowerCase().trim();
      if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (claimed && claimed !== email) {
        return Response.json(
          { error: "Entries must be submitted from your own signed-in account." },
          { status: 403 }
        );
      }

      // Two-factor: the entry only goes through if a code emailed to this
      // address was confirmed. The token is CHECKED here but consumed only once
      // the entry is actually created — everything below (compliance gate,
      // exclusion guard, duplicate guard, entry fee, upstream push) can still
      // reject the submission, and a token burned here would leave the entrant
      // unable to retry.
      let verificationRow;
      try {
        verificationRow = await checkEmailVerified(base44, email, "challenge_entry", body.verification_token);
      } catch (e) {
        return Response.json({ error: e.message, needs_verification: true }, { status: 400 });
      }

      // ── Interim compliance gate (Prompt 13) ──
      // Block entry submission for a launch-blocked challenge BEFORE the
      // duplicate guard and BEFORE the upstream push.
      const sr = base44.asServiceRole;
      const blocked = await isEntryBlocked(sr, String(entry.challenge_id));
      if (blocked) {
        try {
          await logEvent(sr, {
            gate_id: "", challenge_id: String(entry.challenge_id),
            action: "enforcement_block",
            field_name: "submit_entry",
            note: "submitChallengeEntry blocked an entry for a launch-blocked challenge.",
          });
        } catch {}
        try {
          await sr.entities.ComplianceAuditEvent.create({
            event_type: "participation_denied",
            challenge_id: String(entry.challenge_id),
            actor_id: user.id || "",
            actor_email: email,
            detail: "submitChallengeEntry rejected: entry gate is not open for this challenge.",
          });
        } catch {}
        return Response.json(
          { error: "This challenge is not open for entries." },
          { status: 403 }
        );
      }

      // ── Lifecycle enforcement ──
      // Independent of the gate: a native challenge must actually be in the
      // entry_open lifecycle state before it can accept an entry.
      const lifecycleCh = await getNativeChallenge(sr, entry.challenge_id);
      if (lifecycleCh && lifecycleCh.lifecycle_status !== "entry_open") {
        try {
          await sr.entities.ComplianceAuditEvent.create({
            event_type: "participation_denied",
            challenge_id: String(entry.challenge_id),
            actor_id: user.id || "",
            actor_email: email,
            detail: `submitChallengeEntry rejected: challenge lifecycle_status is '${lifecycleCh.lifecycle_status}', not 'entry_open'.`,
          });
        } catch {}
        return Response.json(
          { error: "This challenge is not open for entries." },
          { status: 403 }
        );
      }

      // ── Division must be one the challenge was opened to ──
      if (lifecycleCh?.divisions?.length) {
        const div = String(entry.division_id || entry.division || "");
        if (!lifecycleCh.divisions.includes(div)) {
          return Response.json(
            { error: "This challenge is not open to your division." },
            { status: 403 }
          );
        }
      }

      // ── Kids freeze: native challenges with children/teens stay closed
      // until at least one GuardianConsent record exists on the platform.
      if (lifecycleCh) {
        const kidsDivs = (lifecycleCh.divisions || []).some((d) =>
          ["children", "teens"].includes(String(d || "").toLowerCase())
        );
        const entryKids = ["children", "teens"].includes(
          String(entry.division_id || entry.division || "").toLowerCase()
        );
        if (kidsDivs || entryKids) {
          const consents = await sr.entities.GuardianConsent.filter({}, "-created_date", 1).catch(() => []);
          if (!consents?.length) {
            try {
              await sr.entities.ComplianceAuditEvent.create({
                event_type: "participation_denied",
                challenge_id: String(entry.challenge_id),
                actor_id: user.id || "",
                actor_email: email,
                detail: "submitChallengeEntry rejected: children/teens blocked until GuardianConsent exists.",
              });
            } catch {}
            return Response.json(
              { error: "Entries for children and teens are not open yet. A parent or guardian must complete consent first." },
              { status: 403 }
            );
          }
        }
      }

      // ── Entry fee is derived server-side, never trusted from the client ──
      // A challenge with a payable fee can only be entered through the paid
      // flow (challengeFunds), which verifies the Stripe payment first.
      try {
        const feeCents = await resolveEntryFeeCents(sr, entry.challenge_id, entry.division_id, apiKey, baseUrl);
        if (feeCents > 0) {
          return Response.json(
            { error: "This challenge has an entry fee — the entry must be submitted through the payment step." },
            { status: 402 }
          );
        }
      } catch {
        /* fee lookup unavailable — treat as free, upstream still validates */
      }

      // Exclusion guard — never silent: a blocked email stops submission.
      try {
        const ex = await base44.functions.invoke("exclusionGuard", { email });
        if (ex?.data?.blocked) {
          return Response.json({ error: ex.data.reason || "This email cannot enter this season" }, { status: 403 });
        }
      } catch {
        /* guard unavailable — allow */
      }

      // Duplicate guard — locally for native challenges, upstream otherwise.
      const native = await getNativeChallenge(sr, entry.challenge_id);
      if (native) {
        const existing = await sr.entities.Entry.filter(
          { challenge_id: String(entry.challenge_id), creator_email: email }, "-created_date", 1
        ).catch(() => []);
        if (existing && existing.length) {
          return Response.json({ error: "This email has already entered this challenge" }, { status: 409 });
        }
      } else {
        try {
          const dup = await fetchChallengeApi("check_email", { challenge_id: entry.challenge_id, email }, apiKey, baseUrl);
          if (dup?.duplicate || dup?.exists || dup?.already_entered) {
            return Response.json({ error: "This email has already entered this challenge" }, { status: 409 });
          }
        } catch {
          /* allow through; upstream will reject if duplicate */
        }
      }

      // Prompt 19: Attach terms acceptance to entry data.
      // Entrants accept published terms at entry; acceptance is timestamped per entry.
      const publishedTerms = await sr.entities.TermsDocument.filter(
        { challenge_id: String(entry.challenge_id), status: "published" },
        "-created_date", 1
      ).catch(() => []);
      let entryWithTerms = entry;
      if (publishedTerms?.length) {
        entryWithTerms = {
          ...entry,
          terms_accepted_at: new Date().toISOString(),
          terms_document_id: publishedTerms[0].id,
        };
      }

      // Prompt 20: Minor entries save as pending_consent; consent_status set
      // so downstream visibility/judging checks can gate on it.
      // Guardian Verification: an entrant under 18 is a minor — guardian
      // details are MANDATORY and the entry is gated behind guardian approval.
      const derivedAge = Number(entry.derived_age);
      const isMinor = !!entry.is_minor ||
        (Number.isFinite(derivedAge) && derivedAge < 18) ||
        ["children", "teens"].includes(String(entry.division_id || entry.division || ""));
      if (isMinor) {
        const g = {
          name: String(entry.guardian_full_name || "").trim(),
          relationship: String(entry.guardian_relationship || "").trim(),
          email: normEmail(entry.guardian_email),
          mobile: String(entry.guardian_mobile || "").trim(),
          address: String(entry.guardian_address || "").trim(),
        };
        if (!g.name || !g.email || !g.relationship || !g.mobile || !g.address) {
          return Response.json(
            { error: "Guardian name, relationship, email, mobile and address are required for entrants under 18." },
            { status: 400 }
          );
        }
        if (g.email === email) {
          return Response.json(
            { error: "Guardian email must be different from the entrant's email." },
            { status: 400 }
          );
        }
        entryWithTerms = {
          ...entryWithTerms,
          is_minor: true,
          consent_status: "pending_consent",
        };
      }

      // Guardian Verification: upsert the guardian + child link and open an
      // approval request. The entry stays gated (guardian_approval_status =
      // 'pending') until the guardian approves via guardianPortal.
      const attachGuardianRecords = async (createdEntry) => {
        const guardian = await upsertGuardian(sr, {
          email: entry.guardian_email,
          name: entry.guardian_full_name,
          relationship: entry.guardian_relationship,
          mobile: entry.guardian_mobile,
          address: entry.guardian_address,
        });
        await linkChild(sr, guardian, createdEntry.creator_name || entry.creator_name, email);
        const request = await createApprovalRequest(sr, {
          guardian,
          entry: {
            id: createdEntry.id,
            title: createdEntry.title || entry.title,
            challenge_id: entry.challenge_id,
            challenge_title: createdEntry.challenge_title || entry.challenge_title || "",
            division: createdEntry.division || entry.division || entry.division_id || "",
          },
          child: { name: createdEntry.creator_name || entry.creator_name, email },
        });
        // Best-effort notification — never blocks submission.
        await base44.functions.invoke("guardianStatusNotify", {
          action: "notify_request", request_id: request.id,
        }).catch(() => {});
        return guardian;
      };

      const nowIso = new Date().toISOString();
      const isMinorEntry = entryWithTerms.consent_status === "pending_consent" && entryWithTerms.is_minor === true;

      // Native challenge → store the entry in this app.
      if (native) {
        const created = await sr.entities.Entry.create({
          challenge_id: String(entry.challenge_id),
          title: entry.title,
          description: entry.description || "",
          creator_name: entry.creator_name || user.full_name || email,
          creator_email: email,
          creator_email_masked: maskEmail(email),
          state: entry.state || "",
          city: entry.city || "",
          division: entry.division || entry.division_id || "adults",
          work_type: entry.work_type === "text" ? "text" : "link",
          work_text: entry.work_text || "",
          work_link: entry.work_url || entry.work_link || "",
          is_minor: isMinorEntry,
          source: "native",
          category: native.category || "",
          challenge_title: native.title || "",
          submitted_at: nowIso,
          status: "pending",
          terms_accepted_at: entryWithTerms.terms_accepted_at,
          terms_document_id: entryWithTerms.terms_document_id || "",
          consent_status: isMinorEntry ? "pending_consent" : "valid",
          guardian_approval_status: isMinorEntry ? "pending" : "not_required",
          guardian_name: isMinorEntry ? String(entry.guardian_full_name || "") : "",
          guardian_relationship: isMinorEntry ? String(entry.guardian_relationship || "") : "",
          guardian_email: isMinorEntry ? normEmail(entry.guardian_email) : "",
          guardian_mobile: isMinorEntry ? String(entry.guardian_mobile || "") : "",
          guardian_address: isMinorEntry ? String(entry.guardian_address || "") : "",
        });
        if (isMinorEntry) {
          const guardian = await attachGuardianRecords(created).catch(() => null);
          if (guardian) await sr.entities.Entry.update(created.id, { guardian_id: guardian.id }).catch(() => {});
        }
        // The entry exists now, so the one-time token can be retired.
        await consumeEmailVerification(base44, verificationRow);
        return Response.json({
          success: true,
          entry: created,
          guardian_approval_required: isMinorEntry,
        });
      }

      const result = await fetchChallengeApi(
        "submit_entry",
        { entry: entryWithTerms, verification_token: String(body.verification_token || "") },
        apiKey,
        baseUrl,
      );
      // The upstream API validates the forwarded verification_token itself and
      // can reject a token this app still considers valid — its window is
      // shorter than our hour, and an entry with a large upload can outlive it.
      // Flag those relayed errors as needs_verification so the entrant is sent
      // back to request a fresh code, instead of being shown "Email verified"
      // above an error telling them their email is not verified.
      const relayed = result?.error || (result?.success === false ? (result?.error || "Submission rejected") : "");
      if (relayed) {
        const needsVerification = /verif/i.test(String(relayed));
        return Response.json(
          { error: relayed, ...(needsVerification ? { needs_verification: true } : {}) },
          { status: 400 }
        );
      }
      const upstreamEntry = result?.entry || result;
      // Upstream entries: still record the guardian + approval request locally
      // so the Guardian Dashboard covers them too.
      if (isMinorEntry) {
        await attachGuardianRecords({
          id: upstreamEntry?.id || "",
          title: entry.title,
          creator_name: entry.creator_name,
          challenge_title: entry.challenge_title || "",
          division: entry.division_id || entry.division || "",
        }).catch(() => {});
      }
      await consumeEmailVerification(base44, verificationRow);
      return Response.json({ success: true, entry: upstreamEntry, guardian_approval_required: isMinorEntry });
    }

    // ── Edit an existing entry in place (native entries only) ────────────
    // Refusals are enforced here, not in the UI: someone else's entry, an
    // approved (locked) entry, or a challenge that has closed for entries.
    if (action === "update") {
      const sr = base44.asServiceRole;
      const email = String(user.email || "").toLowerCase().trim();
      const id = String(body.entry_id || "");
      if (!id) return Response.json({ error: "entry_id is required" }, { status: 400 });

      const entry = await sr.entities.Entry.get(id).catch(() => null);
      // Not stored here → it's a main-site entry: push the edit to that site,
      // which enforces ownership and the "not yet reviewed" rule itself.
      if (!entry) {
        const p = body.patch || {};
        const result = await fetchChallengeApi("update_entry", {
          entry_id: id,
          email,
          patch: {
            title: p.title,
            description: p.description,
            work_text: p.work_text,
            work_link: p.work_link,
          },
        }, apiKey, baseUrl).catch(() => null);
        if (!result || result.error || result.success === false) {
          return Response.json(
            { error: result?.error || "This entry could not be updated on the main 53 Challenges site." },
            { status: 400 }
          );
        }
        return Response.json({ success: true, entry: { ...(result.entry || {}), id, main_site: true, editable: true } });
      }
      if (String(entry.creator_email || "").toLowerCase() !== email) {
        return Response.json({ error: "You can only edit your own entries." }, { status: 403 });
      }
      if (entry.status === "approved") {
        return Response.json(
          { error: "This entry has been approved and is locked — it can no longer be edited." },
          { status: 403 }
        );
      }

      // Deadline + compliance gate: both must still allow entries.
      const ch = await getNativeChallenge(sr, entry.challenge_id);
      const subEnd = ch?.submission_ends_at ? new Date(ch.submission_ends_at).getTime() : null;
      const gateBlocked = await isEntryBlocked(sr, String(entry.challenge_id));
      const closed = gateBlocked ||
        (!!subEnd && subEnd <= Date.now()) ||
        (!!ch && ch.lifecycle_status !== "entry_open");
      if (closed) {
        try {
          await sr.entities.ComplianceAuditEvent.create({
            event_type: "participation_denied",
            challenge_id: String(entry.challenge_id),
            actor_id: user.id || "",
            actor_email: email,
            detail: "submitChallengeEntry update rejected: this challenge is closed for entries.",
          });
        } catch {}
        return Response.json(
          { error: "This challenge has closed — entries can no longer be edited." },
          { status: 403 }
        );
      }

      const patch: any = {};
      const p = body.patch || {};
      if (p.title !== undefined) patch.title = String(p.title).trim();
      if (p.description !== undefined) patch.description = String(p.description).trim();
      if (p.work_text !== undefined) patch.work_text = String(p.work_text).trim();
      if (p.work_link !== undefined) patch.work_link = String(p.work_link).trim();
      const title = patch.title ?? entry.title;
      const workText = patch.work_text ?? entry.work_text;
      const workLink = patch.work_link ?? entry.work_link;
      if (!title) return Response.json({ error: "Please give your entry a title." }, { status: 400 });
      if (!workText && !workLink) {
        return Response.json({ error: "Please add your work — text content or a link." }, { status: 400 });
      }
      patch.work_type = workLink ? "link" : "text";
      // Any edit goes back into the moderation queue for a fresh review.
      patch.status = "pending";
      patch.review_note = "";
      patch.reviewer_id = "";
      patch.reviewer_email = "";

      await sr.entities.Entry.update(id, patch);
      const { creator_email, ...safe } = { ...entry, ...patch };
      return Response.json({ success: true, entry: safe });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}