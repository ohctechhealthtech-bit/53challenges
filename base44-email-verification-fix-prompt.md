# Email verification on entry submission — fix + diagnostic

Two files change:
- `base44/shared/emailVerification.ts`
- `base44/functions/submitChallengeEntry/entry.ts`

Replace whatever is currently in these two — this supersedes the earlier
version of this prompt. Change nothing else. `hostChallengeRequest` and
`sponsorApplication` keep using `assertEmailVerified` unchanged.

## Why this version

The previous fix stopped a *failed* submission from burning the entrant's
one-time token. That was real, but a fresh token is still being rejected on its
**first** use, so something else is also wrong. The message is identical for
five different causes, which makes it impossible to tell which:

- no verification row exists for that address
- the token was issued for a **different** address
- the token was already used
- the row exists but was never marked verified
- it expired

This version keeps the fix and adds a reason code to the error and the logs, so
the next failure identifies itself instead of needing another round of guessing.

---

## Change 1 — `base44/shared/emailVerification.ts`

### 1a. Use the shared secrets accessor

At the very top of the file add:

```ts
import { getSecret } from './secretsEnv.ts';
```

Then replace the two `Deno.env.get` reads:

```ts
function otpUrl() {
  const base = getSecret('CHALLENGE_API_BASE_URL')
    || 'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/publicChallengeApi';
  return base.replace(/\/[^/]*$/, '/emailOtp');
}
```

```ts
async function callOtp(body) {
  const apiKey = getSecret('CHALLENGE_API_KEY');
```

`getSecret` reads the Base44 secret store first and falls back to `Deno.env`.
`Deno.env.get` alone returns nothing when a value is set only in the secret
store, which would silently point the OTP calls at the hardcoded fallback URL.

### 1b. Add `checkEmailVerified` and `consumeEmailVerification`

Add these **above** the existing `assertEmailVerified`, which stays exactly as
it is:

```ts
// Checks the token WITHOUT consuming it, returning the row so the caller can
// consume it later. Use this when work can still fail after the check — a
// consumed token cannot be reused, so burning it up front leaves the entrant
// unable to retry and with no way to request a new code.
export async function checkEmailVerified(base44, email, purpose, token) {
  const to = norm(email);
  const tok = String(token || '').trim();
  if (!tok) throw new Error('Please verify your email address first.');

  const rows = await base44.asServiceRole.entities.EmailVerification.filter({
    email: to, purpose, token: tok, verified: true, consumed: false,
  }, '-created_date', 1);

  if (rows.length) {
    const row = rows[0];
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error('That verification has expired. Please request a new code.');
    }
    return row;
  }

  // Nothing matched. Work out WHICH condition failed rather than returning the
  // same opaque message for five different causes — "request a new code" is
  // wrong advice when the real problem is a token issued for another address.
  const forEmail = await base44.asServiceRole.entities.EmailVerification
    .filter({ email: to, purpose }, '-created_date', 10).catch(() => []);
  const byToken = (forEmail || []).filter((r) => String(r.token || '').trim() === tok);

  let reason = 'unknown';
  if (!forEmail.length) reason = 'no_verification_for_this_email';
  else if (!byToken.length) reason = 'token_belongs_to_a_different_address';
  else if (byToken.every((r) => r.consumed)) reason = 'token_already_used';
  else if (byToken.every((r) => !r.verified)) reason = 'code_never_confirmed';

  console.log('[checkEmailVerified] miss', JSON.stringify({
    email: to, purpose, reason,
    rows_for_email: (forEmail || []).length,
    rows_for_token: byToken.length,
  }));

  throw new Error(`Email verification could not be confirmed. Please request a new code. [${reason}]`);
}

/** Marks a row returned by checkEmailVerified as used. Call only once the work succeeded. */
export async function consumeEmailVerification(base44, row) {
  if (!row?.id) return false;
  await base44.asServiceRole.entities.EmailVerification.update(row.id, {
    consumed: true,
  }).catch(() => {});
  return true;
}
```

---

## Change 2 — `base44/functions/submitChallengeEntry/entry.ts`

### 2a. Import

Replace:

```ts
import { assertEmailVerified } from "../../shared/emailVerification.ts";
```

with:

```ts
import { checkEmailVerified, consumeEmailVerification } from "../../shared/emailVerification.ts";
```

### 2b. Check instead of consume

Inside `if (action === "submit")`, replace:

```ts
      // Two-factor: the entry only goes through if a code emailed to this
      // address was confirmed.
      try {
        await assertEmailVerified(base44, email, "challenge_entry", body.verification_token);
      } catch (e) {
        return Response.json({ error: e.message, needs_verification: true }, { status: 400 });
      }
```

with:

```ts
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
```

### 2c. Consume only on success

Two success returns exist in the `"submit"` action. Add the consume before each.

Native challenge (the one returning `entry: created`):

```ts
        // The entry exists now, so the one-time token can be retired.
        await consumeEmailVerification(base44, verificationRow);
        return Response.json({
          success: true,
          entry: created,
          guardian_approval_required: isMinorEntry,
```

Upstream challenge:

```ts
      await consumeEmailVerification(base44, verificationRow);
      return Response.json({ success: true, entry: upstreamEntry, guardian_approval_required: isMinorEntry });
```

Do **not** touch the success returns in `action === "update"` — that action
never checks a token and `verificationRow` is not in scope there.

---

## What to do after deploying

Reproduce the failure once. The error now ends with a reason code in brackets:

| Reason | Means |
|---|---|
| `no_verification_for_this_email` | the row was never written — the confirm step isn't persisting, or the submit email differs from the verified one |
| `token_belongs_to_a_different_address` | verified as one address, submitting as another (the session email is what the gate uses, not the form field) |
| `token_already_used` | a previous submit consumed it — the fix above prevents this recurring |
| `code_never_confirmed` | the row exists but `verified` was never set |

`console.log('[checkEmailVerified] miss', …)` records the same detail plus row
counts in the function logs.

Send me the reason code and the fix for the underlying cause is
straightforward — it's the same message today regardless of which of those five
things actually happened, which is why this has taken two passes.

## Note

The entrant's identity comes from the **session**, not the form field:

```ts
const email = String(user.email || "").toLowerCase().trim();
```

So verifying address A while signed in as B always fails. The frontend now
clears the verified state when the address changes, but that only covers the
form field — a mismatch between the signed-in account and the verified address
will report `token_belongs_to_a_different_address`.

---

## Change 3 — relay upstream verification failures as `needs_verification`

**This is the one that matters for the current failure.**

The live error is:

```
Email verification required — verify your email with the code we sent.
```

That string does not exist anywhere in this app. It comes from the **upstream
Challenge API**, relayed verbatim by the `submit_entry` push. So the local gate
passed — the token was valid here — and the upstream API rejected the same
token when it was forwarded.

The forwarding itself is correct: `fetchChallengeApi` sends
`{ action, ...params }`, so upstream receives `verification_token` at the top
level, matching the documented `submit_entry` contract.

The problem is that the relay drops the `needs_verification` flag, so the
frontend never resets the verify gate. The entrant is left looking at
"Email verified — <address>" above an error saying their email is not verified,
with no way to request a new code.

In `base44/functions/submitChallengeEntry/entry.ts`, replace:

```ts
      if (result?.error) return Response.json({ error: result.error }, { status: 400 });
      if (result?.success === false) return Response.json({ error: result.error || "Submission rejected" }, { status: 400 });
```

with:

```ts
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
```

This does not fix the upstream rejection — it makes it recoverable. With the
frontend change already deployed, the gate resets and the entrant can request a
new code and submit again.
