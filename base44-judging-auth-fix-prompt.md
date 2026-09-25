# Fix: judging is unusable for anyone who signed in normally, and 17 functions return 500 instead of 401

Three changes, independent of each other. Part C is mechanical and safe to
apply on its own if you want to split them.

- **A** — new helper in `base44/shared/adminAuth.ts`
- **B** — `base44/functions/judgeScoring/entry.ts` uses it
- **C** — one-line fix in 17 functions

Do not change any other file. The frontend change is already deployed
separately: `src/lib/judgeScoring.js` now sends `session_token` on every call.

---

## The two bugs

**1. `judgeScoring` only recognises Base44 platform logins.**

```ts
const user = await base44.auth.me();
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
```

Judges and admins sign in through the **Challenge-API** login, which issues a
signed `session_token` and keeps the role on this app's own `User` record.
`base44.auth.me()` sees nothing for them, so the judging workspace is
unreachable for every real user. `judgeScoring` accepts no `session_token` at
all today.

**2. It returns `500`, not `401`.**

`base44.auth.me()` **throws** when there is no platform session — it does not
return `null`. With no `.catch`, the throw reaches the outer `catch` and the
caller gets:

```
500 {"error":"Authentication required to view users"}
```

leaking an internal SDK message. The `if (!user)` line is unreachable.
**17 functions** have this same pattern.

---

## A — add `resolveCaller` to `base44/shared/adminAuth.ts`

`isAdminCaller` already resolves both login types but only answers yes/no.
Judging needs the caller's **email** too, to find their `JudgeProfile`.

Add below the existing `isAdminCaller`, changing nothing above it:

```ts
/**
 * The signed-in caller, from either login: a Base44 platform session or this
 * app's Challenge-API session token. Returns { email, role } shaped like the
 * platform user object so it can be used in its place, or null when neither
 * login is present.
 */
export async function resolveCaller(base44: any, sessionToken: string, apiKey: string) {
  const platform = await base44.auth.me().catch(() => null);
  if (platform?.email) {
    return { email: String(platform.email).toLowerCase().trim(), role: platform.role || 'user' };
  }

  if (!sessionToken) return null;
  const session = await verifyCustomSession(String(sessionToken), apiKey).catch(() => null);
  if (!session?.email) return null;

  const email = String(session.email).toLowerCase().trim();
  const users = await base44.asServiceRole.entities.User.filter({ email }).catch(() => []);
  return { email, role: users?.[0]?.role || 'user' };
}
```

`verifyCustomSession` is already imported at the top of that file.

---

## B — `base44/functions/judgeScoring/entry.ts`

**Imports** — add these two below the existing `createClientFromRequest` import:

```ts
import { secrets } from 'base44:runtime';
import { resolveCaller } from '../../shared/adminAuth.ts';
```

**The gate** — replace:

```ts
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
```

with:

```ts
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Judges sign in through the Challenge-API login, so base44.auth.me() alone
    // sees nobody and the whole judging surface was unreachable for them.
    // resolveCaller accepts either login and returns { email, role }.
    const user = await resolveCaller(base44, body.session_token || '', secrets.get('CHALLENGE_API_KEY') || '');
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;
```

Note `body` moves **above** the gate, because the token comes from it. Make sure
`const body = ...` is declared once, not twice.

Everything downstream keeps working unchanged — the function only reads
`user.email` and `user.role`, which `resolveCaller` provides:

```ts
const email = String(user.email || '').toLowerCase().trim();   // resolveJudge
const isAdmin = user.role === 'admin';
const actor = String(user.email || '').toLowerCase().trim();
```

---

## C — `500` → `401` in 17 functions

In each file below, find:

```ts
const user = await base44.auth.me();
```

and add the catch:

```ts
const user = await base44.auth.me().catch(() => null);
```

That is the whole change. The `if (!user) return … 401` line immediately after
it already exists in each one and becomes reachable.

```
activityReport          auditCompetition        challengeFunds
guardianConsent         hostDepositCheckout     judgeScoring
lifecycleGate           marketingHub            participantPromo
permitTracker           prizeLedger             prizePayoutAction
reporting               rightsManager           runComplianceAssessment
templateLibrary         termsAssembler
```

`judgeScoring` is in the list but part B already removes its `auth.me()` call —
skip it there if you apply B.

This changes only the **status code and message** on an unauthenticated call. It
does not grant anyone access, and it does not fix those functions for
Challenge-API logins — most of them are admin surfaces that will still need
`resolveCaller` or `isAdminCaller` individually. Worth doing separately, per
function, as each is exercised.

---

## Verify

Anonymous, no auth header:

```
POST judgeScoring {"action":"workspace"}
  -> 401 {"error":"Unauthorized"}          (was 500 "Authentication required to view users")

POST activityReport {}
  -> 401                                    (was 500)
```

Then, signed in as a judge through the normal login, open the judge portal. The
workspace should load. Before this change every call returned `500`.
