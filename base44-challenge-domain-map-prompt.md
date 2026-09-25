# Add a public `map` action to the `challengeDomains` function

One file changes: `base44/functions/challengeDomains/entry.ts`.
Do not change any other function, entity, or frontend file.

This is an **edit**, not a rewrite. Keep the existing `resolve`, `list` and
`challenges` branches exactly as they are.

## Why

`resolve` answers "which challenge does this hostname belong to?", which is what
a challenge subdomain needs when a visitor lands on it.

The main site needs the reverse: "does this challenge have its own domain?" —
so that clicking a challenge banner on `53challenges.com` sends the visitor to
`photo.53challenges.com` instead of rendering the challenge at
`/challenges/<id>` on the main site.

It must be public for the same reason `resolve` is: the visitors clicking those
banners are anonymous, and `ChallengeDomain`'s RLS resolves against a Base44
platform user, so a browser read returns an empty list rather than an error. It
exposes only hostnames that are already publicly reachable.

## Change 1 — add `map` to the public allowlist

```ts
const PUBLIC_ACTIONS = new Set(['resolve', 'map']);
```

## Change 2 — add the branch

Insert this immediately **after** the `if (action === 'resolve') { ... }` block
and **before** the `if (!PUBLIC_ACTIONS.has(action))` admin gate:

```ts
    if (action === 'map') {
      // Reverse of 'resolve': challenge_id -> full_domain, so the main site can
      // send a visitor straight to a challenge's own domain instead of routing
      // to /challenges/<id> in place. Public for the same reason resolve is —
      // it only exposes hostnames that are already publicly reachable.
      const rows = await sr.entities.ChallengeDomain
        .list('-created_date', 500)
        .catch(() => []);

      const LIVE = new Set(['active', 'deployed', 'ssl_pending', 'dns_pending']);
      const map: Record<string, string> = {};
      for (const r of (rows || [])) {
        const cid = String(r?.challenge_id || '');
        const host = String(r?.full_domain || '').trim().toLowerCase();
        if (!cid || !host) continue;
        if (!LIVE.has(String(r?.status || ''))) continue;
        // Rows are newest-first, so the first live row per challenge wins.
        if (!(cid in map)) map[cid] = host;
      }
      return Response.json({ map });
    }
```

Placement matters: above the admin gate, or the action becomes admin-only and
every banner silently falls back to in-app routing.

## Change 3 — update the header comment

```ts
//   action: 'resolve'    -> { challenge_id } host -> challenge          (public)
//   action: 'map'        -> { map } challenge_id -> full_domain         (public)
//   action: 'list'       -> { domains: [] }     every subdomain record  (admin)
//   action: 'challenges' -> { challenges: [] }  picker options          (admin)
```

## Notes

- Uses the same `LIVE` status set as `resolve`, so `failed` and `deleted`
  records are excluded and a retired domain stops redirecting.
- No entity change is needed — it reads only `challenge_id`, `full_domain` and
  `status`.

## Verify

Anonymous, with no auth header:

```
POST challengeDomains {"action":"map"}
  -> 200 {"map":{"6a868b76…":"photo.53challenges.com", …}}

POST challengeDomains {"action":"list"}
  -> 403 {"error":"Admins only"}     (unchanged — must stay admin-only)
```

The second matters as much as the first: if `list` starts returning data to an
anonymous caller, the new branch was inserted below the admin gate instead of
above it.
