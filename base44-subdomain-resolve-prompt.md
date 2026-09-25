# Add a public `resolve` action to the `challengeDomains` function

One file changes: `base44/functions/challengeDomains/entry.ts`.
Do not change any other function, entity, or frontend file.

This is an **edit**, not a rewrite. Keep the existing `list` and `challenges`
branches, the `Unknown action` fallback and the `catch` exactly as they are,
and keep them admin-only.

## Why

Challenge subdomains such as `limit.53challenges.com` must show that
challenge's page at `/`. The frontend asks the backend which challenge a
hostname maps to.

Every visitor arriving on a subdomain is **anonymous**, so this lookup cannot
sit behind the `isAdminCaller` gate that currently wraps the whole function —
today it returns `403 Admins only`, the frontend treats that as "no mapping",
and falls back to the homepage. That fallback is why subdomains currently show
the homepage instead of the challenge.

`resolve` returns only a challenge id and name for a hostname. That reveals
nothing the public hostname does not already reveal.

## What to change

Three edits inside `base44/functions/challengeDomains/entry.ts`:

**1.** Add a `PUBLIC_ACTIONS` constant immediately above
`export default async function`:

```ts
// 'resolve' must be public: every visitor arriving at limit.53challenges.com is
// anonymous, and the page cannot render until the host is mapped to a challenge.
// It reveals only what the hostname already reveals.
const PUBLIC_ACTIONS = new Set(['resolve']);
```

**2.** Inside the handler, make sure `body`, `action` and `sr` are read
**before** the admin check, then handle `resolve` before that check, and make
the check conditional. The opening of the handler should end up like this:

```ts
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;

    if (action === 'resolve') {
      const host = String(body.host || '').trim().toLowerCase().replace(/\.$/, '');
      if (!host) return Response.json({ challenge_id: null });

      // Match on the stored full_domain rather than the slug, so the mapping
      // stays correct if the app is ever served from more than one base domain.
      // Status is filtered in code rather than in the query because a record
      // can legitimately be live under several status values.
      const rows = await sr.entities.ChallengeDomain
        .filter({ full_domain: host }, '-created_date', 20)
        .catch(() => []);

      const LIVE = new Set(['active', 'deployed', 'ssl_pending', 'dns_pending']);
      const row = (rows || []).find((r: any) => LIVE.has(String(r?.status || '')));

      return Response.json({
        challenge_id: row?.challenge_id || null,
        challenge_name: row?.challenge_name || '',
      });
    }

    if (!PUBLIC_ACTIONS.has(action)) {
      const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
      if (!isAdmin) return Response.json({ error: 'Admins only' }, { status: 403 });
    }
```

**3.** Delete the old unconditional admin gate if it is still present further
down — this pair of lines must appear **once**, inside the
`if (!PUBLIC_ACTIONS.has(action))` block and nowhere else:

```ts
const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
if (!isAdmin) return Response.json({ error: 'Admins only' }, { status: 403 });
```

Likewise make sure `const body`, `const action` and `const sr` are each
declared **once**. If the current file declares any of them after the admin
check, remove that second declaration rather than adding a new one.

Update the header comment to:

```ts
//   action: 'resolve'    -> { challenge_id } host -> challenge          (public)
//   action: 'list'       -> { domains: [] }     every subdomain record  (admin)
//   action: 'challenges' -> { challenges: [] }  picker options          (admin)
```

## Notes

- `ChallengeDomain` gained fields since this function was written
  (`domain_type`, `ssl_status`, `git_deployment_status`, and others). `resolve`
  reads only `full_domain`, `status`, `challenge_id` and `challenge_name`, so
  no entity change is needed.
- Records with `status: 'failed'` or `'deleted'` are deliberately excluded, so
  a retired subdomain stops resolving.
- If two live records share a hostname, the newest wins (`-created_date`).

## Verify

Anonymous, with no auth header:

```
POST challengeDomains {"action":"resolve","host":"limit.53challenges.com"}
  -> 200 {"challenge_id":"6a852...","challenge_name":"Limitless"}      (was 403)

POST challengeDomains {"action":"resolve","host":"53challenges.com"}
  -> 200 {"challenge_id":null}

POST challengeDomains {"action":"list"}
  -> 403 {"error":"Admins only"}     (unchanged — must stay admin-only)

POST challengeDomains {"action":"challenges"}
  -> 403 {"error":"Admins only"}     (unchanged — must stay admin-only)
```

The last two matter as much as the first: if either starts returning data to an
anonymous caller, the admin gate was moved incorrectly.

## After this is deployed

No frontend upload is needed — the resolver already ships in the build that is
live on `53challenges.com` (bundle `index-C9vmtayD.js`).

A subdomain will still only reach this code if its vhost serves the app **and**
proxies `/api/` to Base44. At the time of writing `limit`, `food` and every
other subdomain return `404` with another tenant's certificate, so the
`*.53challenges.com` wildcard vhost needs repairing separately before the
challenge page can appear.
