# Diagnostic: log why the upstream API refuses the verification token

One file changes: `base44/functions/submitChallengeEntry/entry.ts`.
Apply this ONLY if a submission with a genuinely fresh code still fails.

## Why

The live failure is:

```json
{ "error": "Email verification required — verify your email with the code we sent.", "needs_verification": true }
```

That message is produced by the **upstream Challenge API**, not by this app —
the string exists nowhere in this codebase. So the local gate passed, the token
was forwarded, and upstream refused it. Upstream returns no reason, so there is
nothing to act on.

This adds a log line capturing the full exchange.

## Change

In the `"submit"` action, in the block that relays an upstream error, add the
`console.log` before the `needsVerification` line:

```ts
      const relayed = result?.error || (result?.success === false ? (result?.error || "Submission rejected") : "");
      if (relayed) {
        // The upstream message is all the entrant sees, and it does not say WHY
        // the token was refused. Log the full exchange so a rejection can be
        // diagnosed without another round of guessing.
        console.log("[submit_entry] upstream rejected", JSON.stringify({
          email,
          challenge_id: String(entry.challenge_id || ""),
          token_length: String(body.verification_token || "").length,
          token_prefix: String(body.verification_token || "").slice(0, 8),
          sent_top_level_keys: ["action", "entry", "verification_token"],
          upstream_response: result,
        }));
        const needsVerification = /verif/i.test(String(relayed));
        return Response.json(
          { error: relayed, ...(needsVerification ? { needs_verification: true } : {}) },
          { status: 400 }
        );
      }
```

## What to do with it

Reproduce once, then read the `[submit_entry] upstream rejected` line in the
Base44 function logs and send it over. It answers:

- **`token_length: 0`** — the token never reached this point; the problem is
  local, not upstream.
- **`upstream_response`** — whether upstream returns any code or field beyond
  the message.
- **`token_prefix`** — lets you confirm against the token the browser sent, so
  you can tell a stale token from a fresh one.

## The open question this is meant to settle

This app forwards the token as a **top-level** field:

```ts
fetchChallengeApi("submit_entry", { entry: entryWithTerms, verification_token: "…" }, …)
// → POST { action: "submit_entry", entry: {…}, verification_token: "…" }
```

`public/form-api-field-comparison.md` documents `submit_entry` as
`{ action, entry: {...} }` and does **not** mention `verification_token` at all.
If upstream expects it **inside** `entry`, or expects a different purpose than
the `participation` one `emailOtp` issues it for, every token will be refused no
matter how fresh.

Only the upstream app (`69341410f89d26a8fc73a4d1`) can confirm that. Two
questions for whoever owns it:

1. Where does `submit_entry` expect `verification_token` — top level, or inside
   `entry`?
2. Which OTP `purpose` must the token carry? This app requests
   `participation` for a challenge entry.
