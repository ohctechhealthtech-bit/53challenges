import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { fetchChallengeApi } from "../../shared/challengeApiHelper.ts";
import { resolveEntryFeeCents } from "../../shared/entryFeeHelper.ts";

// Entry-fee payment handling for paid challenges.
//   action: 'create_intent'        -> { challenge_id, division_id, email, amount } -> { client_secret, payment_intent_id, publishable_key }
//   action: 'record_entry_payment' -> { payment_intent_id, entry }                  -> { success, entry }
// Entries for paid challenges are only created server-side AFTER Stripe confirms.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const secretKey = secrets.get("STRIPE_SECRET_KEY");
    const publishableKey = secrets.get("STRIPE_PUBLISHABLE_KEY");
    if (!secretKey || !publishableKey) {
      return Response.json({ error: "Stripe keys not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "create_intent") {
      // The fee is ALWAYS derived server-side from the challenge record —
      // any amount supplied by the browser is ignored.
      const feeApiKey = secrets.get("CHALLENGE_API_KEY");
      const feeBaseUrl = secrets.get("CHALLENGE_API_BASE_URL");
      if (!feeApiKey) return Response.json({ error: "CHALLENGE_API_KEY secret not set" }, { status: 500 });
      let amount;
      try {
        amount = await resolveEntryFeeCents(
          base44.asServiceRole, body.challenge_id, body.division_id, feeApiKey, feeBaseUrl
        );
      } catch (e) {
        return Response.json({ error: e.message || "Could not read the entry fee" }, { status: 400 });
      }
      if (!amount || amount < 100) {
        return Response.json({ error: "This challenge does not have a payable entry fee." }, { status: 400 });
      }

      // Kids freeze: do not start payment for children/teens until GuardianConsent exists.
      const intentKidsDiv = ["children", "teens"].includes(String(body.division_id || "").toLowerCase());
      let intentChallengeKids = false;
      try {
        const ch = await base44.asServiceRole.entities.Challenge.get(String(body.challenge_id || "")).catch(() => null);
        intentChallengeKids = !!(ch?.divisions || []).some((d) =>
          ["children", "teens"].includes(String(d || "").toLowerCase())
        );
      } catch {}
      if (intentKidsDiv || intentChallengeKids) {
        const consents = await base44.asServiceRole.entities.GuardianConsent.filter({}, "-created_date", 1).catch(() => []);
        if (!consents?.length) {
          return Response.json({
            error: "Entries for children and teens are not open yet. A parent or guardian must complete consent first.",
          }, { status: 403 });
        }
      }

      const params = new URLSearchParams();
      params.append("amount", String(Math.round(amount)));
      params.append("currency", "aud");
      params.append("automatic_payment_methods[enabled]", "true");
      params.append("metadata[challenge_id]", String(body.challenge_id || ""));
      params.append("metadata[division_id]", String(body.division_id || ""));
      params.append("metadata[email]", String(user.email || ""));
      params.append("metadata[user_id]", String(user.id || ""));

      const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const intent = await stripeRes.json();
      if (!stripeRes.ok) {
        return Response.json({ error: intent.error?.message || "Could not start payment" }, { status: 400 });
      }
      return Response.json({
        client_secret: intent.client_secret,
        payment_intent_id: intent.id,
        publishable_key: publishableKey,
      });
    }

    if (action === "record_entry_payment") {
      const paymentIntentId = String(body.payment_intent_id || "");
      const rawEntry = body.entry;
      if (!paymentIntentId || !rawEntry || !rawEntry.challenge_id || !rawEntry.title || !rawEntry.work_url) {
        return Response.json({ error: "Missing payment or entry details" }, { status: 400 });
      }
      // Identity: the entrant is the signed-in account, always. A different
      // creator_email is rejected rather than silently trusted.
      const sessionEmail = String(user.email || "").toLowerCase().trim();
      const claimedEmail = String(rawEntry.creator_email || "").toLowerCase().trim();
      if (!sessionEmail) return Response.json({ error: "Unauthorized" }, { status: 401 });
      if (claimedEmail && claimedEmail !== sessionEmail) {
        return Response.json({ error: "Entries must be submitted from your own signed-in account." }, { status: 403 });
      }
      const entry = { ...rawEntry, creator_email: sessionEmail, user_id: sessionEmail };

      // Verify the payment actually succeeded before recording the entry.
      const verifyRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const intent = await verifyRes.json();
      if (!verifyRes.ok) {
        return Response.json({ error: intent.error?.message || "Could not verify payment" }, { status: 400 });
      }
      if (intent.status !== "succeeded") {
        return Response.json({ error: "Payment has not succeeded" }, { status: 402 });
      }
      // The payment must belong to this user and this challenge, and must not
      // already have been redeemed for an entry.
      if (String(intent.metadata?.user_id || "") !== String(user.id || "")) {
        return Response.json({ error: "This payment does not belong to your account." }, { status: 403 });
      }
      if (String(intent.metadata?.challenge_id || "") !== String(entry.challenge_id)) {
        return Response.json({ error: "This payment was not made for this challenge." }, { status: 403 });
      }
      if (intent.metadata?.entry_recorded === "1") {
        return Response.json({ error: "This payment has already been used to record an entry." }, { status: 409 });
      }
      // The paid amount must match the fee derived server-side from the challenge.
      const expectedCents = await resolveEntryFeeCents(
        base44.asServiceRole, entry.challenge_id, entry.division_id, secrets.get("CHALLENGE_API_KEY"), secrets.get("CHALLENGE_API_BASE_URL")
      ).catch(() => null);
      if (expectedCents === null || Number(intent.amount_received || intent.amount) !== expectedCents) {
        return Response.json({ error: "Paid amount does not match this challenge's entry fee." }, { status: 402 });
      }

      // Kids freeze: refuse children/teens / minor paid submits until GuardianConsent exists.
      // Check BEFORE burning the payment so the fee is not lost on a blocked entry.
      const sr = base44.asServiceRole;
      const derivedAge = Number(entry.derived_age);
      const entryKids = ["children", "teens"].includes(String(entry.division_id || entry.division || "").toLowerCase());
      const isMinor = !!entry.is_minor ||
        (Number.isFinite(derivedAge) && derivedAge < 18) ||
        entryKids;
      let challengeKids = false;
      try {
        const ch = await sr.entities.Challenge.get(String(entry.challenge_id)).catch(() => null);
        challengeKids = !!(ch?.divisions || []).some((d) =>
          ["children", "teens"].includes(String(d || "").toLowerCase())
        );
      } catch {}
      if (isMinor || challengeKids) {
        const consents = await sr.entities.GuardianConsent.filter({}, "-created_date", 1).catch(() => []);
        if (!consents?.length) {
          return Response.json({
            error: "Entries for children and teens are not open yet. A parent or guardian must complete consent first.",
          }, { status: 403 });
        }
      }

      // Re-run the exclusion + duplicate guards before creating the entry.
      try {
        const ex = await base44.functions.invoke("exclusionGuard", { email: entry.creator_email });
        if (ex?.data?.blocked) {
          return Response.json({ error: ex.data.reason || "This email cannot enter this season" }, { status: 403 });
        }
      } catch {
        /* guard unavailable — allow */
      }

      const apiKey = secrets.get("CHALLENGE_API_KEY");
      const baseUrl = secrets.get("CHALLENGE_API_BASE_URL");
      if (!apiKey) return Response.json({ error: "CHALLENGE_API_KEY secret not set" }, { status: 500 });

      try {
        const dup = await fetchChallengeApi("check_email", { challenge_id: entry.challenge_id, email: entry.creator_email }, apiKey, baseUrl);
        if (dup?.duplicate || dup?.exists || dup?.already_entered) {
          return Response.json({ error: "This email has already entered this challenge" }, { status: 409 });
        }
      } catch {
        /* allow through; upstream will reject if duplicate */
      }

      // Burn the payment before recording so it can never be replayed.
      const burn = new URLSearchParams();
      burn.append("metadata[entry_recorded]", "1");
      const burnRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: burn.toString(),
      });
      if (!burnRes.ok) {
        return Response.json({ error: "Could not secure this payment against re-use — entry not recorded." }, { status: 502 });
      }

      const result = await fetchChallengeApi("submit_entry", { entry }, apiKey, baseUrl);
      if (result?.error) return Response.json({ error: result.error }, { status: 400 });
      if (result?.success === false) return Response.json({ error: result.error || "Submission rejected" }, { status: 400 });
      return Response.json({ success: true, entry: result?.entry || result });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}