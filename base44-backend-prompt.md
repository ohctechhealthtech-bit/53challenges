# Backend changes for 53 Challenges

Apply all of the following to the backend. Do not change any frontend file.

There are 7 changes: 3 new shared modules, 1 new entity, 1 new function,
2 rewritten functions, and 2 small auth edits to existing functions.

## Why (read this first)

Two bugs are being fixed.

**Bug 1 — wrong auth model.** `createChallengeSubdomain` and
`deleteChallengeSubdomain` currently gate on `base44.auth.me()`, i.e. the
Base44 *platform* session. This app does not log admins in that way: admins
sign in through the Challenge-API login, which issues a signed `session_token`
and stores the role on the local `User` record. So `base44.auth.me()` returns
nothing for a real admin and every call fails with
`500 {"error":"Authentication required to view users"}`.
The repo already has `base44/shared/adminAuth.ts` exporting `isAdminCaller()`,
which accepts BOTH login types. `adminChallenge` and `hostRequestQuote`
already use it. These two functions must use it too.

**Bug 2 — public reads blocked.** `challengeEngine` and `complianceGate` both
start with `if (!user) return 401`, which runs before any action dispatch.
That makes their read-only actions unreachable for logged-out visitors, even
though `entryListQuery(challenge_id, isAdmin)` already restricts non-admins to
approved entries. The frontend swallows the 401 (`catch { return [] }`), so
native challenges and entries silently vanish from the public catalogue.

---
## 1. NEW FILE — `base44/shared/secretsEnv.ts`

```ts
// Single accessor for backend secrets.
//
// Secrets are environment-variable based, never stored in this app's
// database. `secrets.get()` reads the Base44 secret store (populated from a
// .env file via `base44 secrets set --env-file .env`); `Deno.env.get()` is
// the fallback for plain env vars in the runtime. Shared helpers should use
// this instead of reaching for Deno.env directly, so a value set through the
// secret store resolves the same way everywhere.
import { secrets } from "base44:runtime";

export function getSecret(name: string, fallback = ""): string {
  let value = "";
  try {
    value = secrets.get(name) || "";
  } catch {
    value = "";
  }
  if (!value) {
    try {
      value = Deno.env.get(name) || "";
    } catch {
      value = "";
    }
  }
  return value || fallback;
}
```

## 2. NEW FILE — `base44/shared/subdomainValidation.ts`

```ts
// Subdomain slug rules for challenge-specific domains.
//
// The authoritative copy. src/lib/subdomainValidation.js mirrors it for the
// browser; keep the two in step when the rules change. The backend re-
// validates every slug regardless of what the form allowed through.

// Hostnames that must keep pointing at platform infrastructure rather than a
// challenge. Blocking them here stops an admin creating a subdomain that
// shadows mail, DNS or the app's own entry points.
const RESERVED_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'dashboard', 'portal', 'login', 'auth',
  'mail', 'smtp', 'imap', 'pop', 'webmail', 'ftp', 'ns1', 'ns2', 'mx',
  'cdn', 'static', 'assets', 'media', 'files', 'img',
  'dev', 'staging', 'test', 'preview', 'base44',
  'my', 'host', 'judge', 'sponsor', 'guardian',
]);

/** Coerce free-text input into a valid DNS label, as far as that is possible. */
export function normalizeSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, '-')    // spaces, underscores and dots become hyphens
    .replace(/[^a-z0-9-]/g, '')  // drop anything else outright
    .replace(/^-+|-+$/g, '');    // a DNS label cannot start or end with a hyphen
}

/**
 * Validate a slug. Accepts raw or already-normalized input — it normalizes
 * first, so the form's live preview and its submit path always agree.
 * Returns { valid: true } or { valid: false, error }.
 */
export function validateSlug(slug) {
  const s = normalizeSlug(slug);
  if (!s) {
    return { valid: false, error: 'Enter a slug using letters, numbers and hyphens.' };
  }
  if (s.length < 2) {
    return { valid: false, error: 'Slug must be at least 2 characters.' };
  }
  if (s.length > 63) {
    return { valid: false, error: 'Slug must be 63 characters or fewer.' };
  }
  if (s.startsWith('xn--')) {
    return { valid: false, error: '"xn--" is reserved for internationalised domain names.' };
  }
  if (RESERVED_SLUGS.has(s)) {
    return { valid: false, error: `"${s}" is reserved and cannot be used as a challenge subdomain.` };
  }
  return { valid: true };
}
```

## 3. NEW FILE — `base44/shared/pleskApi.ts`

```ts
// Plesk provisioning for `separate_subdomain` hosting mode.
//
// Only reached when an admin explicitly picks "Separate Subdomain". The
// default `wildcard` mode never touches Plesk — DNS already resolves
// *.base_domain — so the domain feature works with none of these secrets set.
//
// Plesk's REST API has no first-class subdomain resource; the supported route
// is its CLI gateway, which runs the server-side `subdomain` utility:
//   POST {PLESK_BASE_URL}/api/v2/cli/subdomain/call
//   { "params": ["--create", "<slug>", "-domain", "<base>"] }
// and answers { code, stdout, stderr } where a non-zero code is a failure.
import { getSecret } from './secretsEnv.ts';

export type PleskConfig = {
  baseUrl: string;
  baseDomain: string;
  apiKey: string;
  username: string;
  password: string;
  documentRoot: string;
};

/** Returns null when Plesk is not configured — callers treat that as "cannot provision". */
export function getPleskConfig(): PleskConfig | null {
  const baseUrl = getSecret('PLESK_BASE_URL').replace(/\/+$/, '');
  const baseDomain = getSecret('PLESK_BASE_DOMAIN');
  const apiKey = getSecret('PLESK_API_KEY');
  const username = getSecret('PLESK_USERNAME');
  const password = getSecret('PLESK_PASSWORD');
  if (!baseUrl || !baseDomain) return null;
  // Either an API key or a username/password pair is enough to authenticate.
  if (!apiKey && !(username && password)) return null;
  return { baseUrl, baseDomain, apiKey, username, password, documentRoot: getSecret('PLESK_DOCUMENT_ROOT') };
}

function authHeaders(cfg: PleskConfig): Record<string, string> {
  if (cfg.apiKey) return { 'X-API-Key': cfg.apiKey };
  return { Authorization: `Basic ${btoa(`${cfg.username}:${cfg.password}`)}` };
}

async function runSubdomainCli(cfg: PleskConfig, params: string[]) {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/api/v2/cli/subdomain/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders(cfg) },
      body: JSON.stringify({ params }),
    });
  } catch (e) {
    return { ok: false, error: `Could not reach Plesk: ${e?.message || e}` };
  }

  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* Plesk returned a non-JSON body */ }

  if (!res.ok) {
    return { ok: false, error: json?.message || `Plesk API returned HTTP ${res.status}` };
  }
  if (typeof json?.code === 'number' && json.code !== 0) {
    const detail = String(json.stderr || json.stdout || '').trim();
    return { ok: false, error: detail || `Plesk CLI exited with code ${json.code}` };
  }
  return { ok: true, stdout: String(json?.stdout || '') };
}

export async function createPleskSubdomain(cfg: PleskConfig, slug: string) {
  const documentRoot = cfg.documentRoot ? `${cfg.documentRoot.replace(/\/+$/, '')}/${slug}` : '';
  const params = ['--create', slug, '-domain', cfg.baseDomain];
  if (documentRoot) params.push('-www-root', documentRoot);

  const res = await runSubdomainCli(cfg, params);
  if (!res.ok) return { success: false, error: res.error };
  // The CLI reports success as text, not an id. Record the document root we
  // asked for; plesk_site_id stays empty unless a future call resolves one.
  return { success: true, siteId: '', documentRoot };
}

export async function deletePleskSubdomain(cfg: PleskConfig, slug: string) {
  const res = await runSubdomainCli(cfg, ['--remove', slug, '-domain', cfg.baseDomain]);
  if (!res.ok) return { success: false, error: res.error };
  return { success: true };
}
```

## 4. NEW ENTITY — `ChallengeDomain`

```json
{
  "name": "ChallengeDomain",
  "type": "object",
  "properties": {
    "challenge_id": {
      "type": "string",
      "description": "Challenge this subdomain points at"
    },
    "challenge_name": {
      "type": "string",
      "default": "",
      "description": "Challenge title captured at creation, so the table still reads correctly if the challenge is renamed or removed"
    },
    "slug": {
      "type": "string",
      "description": "DNS label only, e.g. 'dance'"
    },
    "base_domain": {
      "type": "string",
      "description": "Apex domain the slug hangs off, from the PLESK_BASE_DOMAIN secret"
    },
    "full_domain": {
      "type": "string",
      "description": "slug + base_domain, denormalised for display and lookup"
    },
    "status": {
      "type": "string",
      "enum": [
        "pending",
        "provisioning",
        "active",
        "failed",
        "deleted"
      ],
      "default": "pending"
    },
    "hosting_mode": {
      "type": "string",
      "enum": [
        "wildcard",
        "separate_subdomain"
      ],
      "default": "wildcard",
      "description": "wildcard relies on an existing *.domain DNS record and never calls Plesk; separate_subdomain provisions a dedicated subdomain in Plesk"
    },
    "plesk_site_id": {
      "type": "string",
      "default": "",
      "description": "Plesk site identifier, separate_subdomain mode only"
    },
    "document_root": {
      "type": "string",
      "default": "",
      "description": "Document root Plesk was asked to use, separate_subdomain mode only"
    },
    "error_message": {
      "type": "string",
      "default": "",
      "description": "Last provisioning or teardown failure, surfaced in the admin table"
    }
  },
  "required": [
    "challenge_id",
    "slug",
    "base_domain",
    "full_domain"
  ],
  "rls": {
    "read": {
      "user_condition": {
        "role": "admin"
      }
    },
    "create": {
      "user_condition": {
        "role": "admin"
      }
    },
    "update": {
      "user_condition": {
        "role": "admin"
      }
    },
    "delete": {
      "user_condition": {
        "role": "admin"
      }
    }
  }
}
```

## 5. NEW FUNCTION — `challengeDomains`

```ts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getSecret } from '../../shared/secretsEnv.ts';
import { isAdminCaller } from '../../shared/adminAuth.ts';

// Read side of /domain-management.
//
// The page cannot query these entities from the browser: ChallengeDomain's RLS
// read rule is `user_condition: { role: 'admin' }`, which resolves against a
// Base44 platform user. Admins who signed in through this app's Challenge-API
// login have no platform user, so a direct base44.entities call returns
// nothing and the table looks permanently empty. Reading through a function
// with isAdminCaller + asServiceRole is the pattern the other admin pages use.
//
//   action: 'list'       -> { domains: [] }     every subdomain record
//   action: 'challenges' -> { challenges: [] }  picker options
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
    if (!isAdmin) return Response.json({ error: 'Admins only' }, { status: 403 });

    const sr = base44.asServiceRole;
    const action = body.action;

    if (action === 'list') {
      const domains = await sr.entities.ChallengeDomain.list('-created_date', 200).catch(() => []);
      return Response.json({ domains: domains || [] });
    }

    if (action === 'challenges') {
      const challenges = await sr.entities.Challenge.list('-created_date', 200).catch(() => []);
      // The picker only needs id and title.
      const slim = (challenges || []).map((c: any) => ({ id: c.id, title: c.title || c.theme || c.id }));
      return Response.json({ challenges: slim });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

## 6. REPLACE — `createChallengeSubdomain`

Replace the whole file with this.

```ts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getSecret } from '../../shared/secretsEnv.ts';
import { isAdminCaller } from '../../shared/adminAuth.ts';
import { normalizeSlug, validateSlug } from '../../shared/subdomainValidation.ts';
import { getPleskConfig, createPleskSubdomain } from '../../shared/pleskApi.ts';

// Creates a challenge-specific subdomain record, provisioning it in Plesk only
// when hosting_mode is 'separate_subdomain'. Admin only.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Admins sign in either through the Base44 platform session or through
    // this app's own Challenge-API login, whose role lives on the local User
    // record. isAdminCaller resolves both — the same check adminChallenge and
    // hostRequestQuote use. Checking base44.auth.me() alone locks out every
    // admin who logged in the normal way.
    const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
    if (!isAdmin) return Response.json({ error: 'Only admins can create subdomains' }, { status: 403 });

    const { challenge_id, slug, hosting_mode } = body;

    if (!challenge_id) return Response.json({ error: 'challenge_id is required' }, { status: 400 });
    if (!slug) return Response.json({ error: 'slug is required' }, { status: 400 });
    if (!hosting_mode || !['wildcard', 'separate_subdomain'].includes(hosting_mode)) {
      return Response.json({ error: 'hosting_mode must be wildcard or separate_subdomain' }, { status: 400 });
    }

    const normalizedSlug = normalizeSlug(slug);
    const validation = validateSlug(normalizedSlug);
    if (!validation.valid) return Response.json({ error: validation.error }, { status: 400 });

    const baseDomain = getSecret('PLESK_BASE_DOMAIN');
    if (!baseDomain) return Response.json({ error: 'PLESK_BASE_DOMAIN secret not set' }, { status: 500 });

    const fullDomain = `${normalizedSlug}.${baseDomain}`;
    const sr = base44.asServiceRole;

    const existing = await sr.entities.ChallengeDomain.filter({
      slug: normalizedSlug,
      base_domain: baseDomain,
    });
    const blockingExisting = (existing || []).filter(
      (d: any) => d.status === 'active' || d.status === 'provisioning' || d.status === 'pending'
    );
    if (blockingExisting.length > 0) {
      return Response.json({ error: 'A subdomain with this slug already exists' }, { status: 409 });
    }

    // Earlier failed attempts on the same slug are retired so the table shows
    // one live row per slug while keeping the audit trail.
    const failedExisting = (existing || []).filter((d: any) => d.status === 'failed');
    for (const f of failedExisting) {
      await sr.entities.ChallengeDomain.update(f.id, { status: 'deleted' });
    }

    let challengeName = '';
    try {
      const challenge = await sr.entities.Challenge.get(challenge_id);
      challengeName = challenge?.title || '';
    } catch {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const record = await sr.entities.ChallengeDomain.create({
      challenge_id,
      challenge_name: challengeName,
      slug: normalizedSlug,
      base_domain: baseDomain,
      full_domain: fullDomain,
      status: 'provisioning',
      hosting_mode,
    });

    // Wildcard DNS already resolves *.baseDomain, so there is nothing to provision.
    if (hosting_mode === 'wildcard') {
      await sr.entities.ChallengeDomain.update(record.id, { status: 'active' });
      return Response.json({ ok: true, domain: { ...record, status: 'active' } });
    }

    const pleskConfig = getPleskConfig();
    if (!pleskConfig) {
      await sr.entities.ChallengeDomain.update(record.id, {
        status: 'failed',
        error_message: 'Plesk secrets not configured',
      });
      return Response.json({ error: 'Plesk secrets not configured' }, { status: 500 });
    }

    const result = await createPleskSubdomain(pleskConfig, normalizedSlug);
    if (result.success) {
      await sr.entities.ChallengeDomain.update(record.id, {
        status: 'active',
        plesk_site_id: result.siteId || '',
        document_root: result.documentRoot || '',
      });
      return Response.json({
        ok: true,
        domain: { ...record, status: 'active', plesk_site_id: result.siteId, document_root: result.documentRoot },
      });
    }

    await sr.entities.ChallengeDomain.update(record.id, {
      status: 'failed',
      error_message: result.error || 'Plesk API failed',
    });
    return Response.json({ error: result.error || 'Failed to create subdomain in Plesk' }, { status: 502 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

## 7. REPLACE — `deleteChallengeSubdomain`

Replace the whole file with this.

```ts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getPleskConfig, deletePleskSubdomain } from '../../shared/pleskApi.ts';
import { getSecret } from '../../shared/secretsEnv.ts';
import { isAdminCaller } from '../../shared/adminAuth.ts';

// Retires a challenge subdomain. The record is soft-deleted so the audit
// history survives; Plesk teardown only applies to separate_subdomain mode.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Accepts both the Base44 platform session and the app's Challenge-API
    // login — see the note in createChallengeSubdomain.
    const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
    if (!isAdmin) return Response.json({ error: 'Only admins can delete subdomains' }, { status: 403 });

    const { domain_id } = body;
    if (!domain_id) return Response.json({ error: 'domain_id is required' }, { status: 400 });

    const sr = base44.asServiceRole;
    const record = await sr.entities.ChallengeDomain.get(domain_id).catch(() => null);
    if (!record) return Response.json({ error: 'Domain record not found' }, { status: 404 });
    if (record.status === 'deleted') return Response.json({ error: 'Domain already deleted' }, { status: 400 });

    if (record.hosting_mode === 'separate_subdomain' && record.status === 'active') {
      const pleskConfig = getPleskConfig();
      if (pleskConfig) {
        const result = await deletePleskSubdomain(pleskConfig, record.slug);
        // A Plesk failure still retires the record — leaving it active would
        // strand the row — but the reason is kept and reported to the caller.
        if (!result.success) {
          await sr.entities.ChallengeDomain.update(domain_id, {
            status: 'deleted',
            error_message: `Plesk delete warning: ${result.error || 'unknown error'}`,
          });
          return Response.json({ ok: true, warning: result.error });
        }
      }
    }

    await sr.entities.ChallengeDomain.update(domain_id, { status: 'deleted' });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

## 8. EDIT — `challengeEngine`

Do **not** rewrite this file. Make one change to its auth gate.

Add this constant immediately above `export default async function (req) {`:

```ts
// Actions that must work for logged-out visitors. Everything else
// requires a signed-in user; write actions additionally require an admin.
// entries is already filtered to approved-only for non-admins by entryListQuery.
const PUBLIC_ACTIONS = new Set(["list", "get", "entries"]);
```

Then, inside the function, this block:

```ts
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;
    const isAdmin = user.role === "admin" || user.is_admin === true;
```

becomes:

```ts
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (!user && !PUBLIC_ACTIONS.has(action)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sr = base44.asServiceRole;
    const isAdmin = user?.role === "admin" || user?.is_admin === true;
```

Leave every existing `if (!isAdmin) return ... 403` check exactly as it is —
`create`, `moderate_entry` and `moderate_entries` stay admin-only. The `user?.`
optional chaining is required because `user` can now legitimately be null.

## 9. EDIT — `complianceGate`

Same change, different allowlist. Add above `export default async function (req) {`:

```ts
// Actions that must work for logged-out visitors. Everything else
// requires a signed-in user; write actions additionally require an admin.
// statuses is read-only and only reports whether a challenge is launch-blocked.
const PUBLIC_ACTIONS = new Set(["statuses"]);
```

Replace:

```ts
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const sr = base44.asServiceRole;

    const isAdmin = user.role === "admin" || user.is_admin === true;
```

with:

```ts
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (!user && !PUBLIC_ACTIONS.has(action)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sr = base44.asServiceRole;

    const isAdmin = user?.role === "admin" || user?.is_admin === true;
```

The existing catch-all `if (!isAdmin) return ... 403` that sits just after the
`statuses` block must stay — it keeps `list`, `get`, `audit`, `sync` and
`update` admin-only.

## 10. SECRET

Add this app secret:

```
PLESK_BASE_DOMAIN=53challenges.com
```

Required in both hosting modes — `createChallengeSubdomain` returns
`500 PLESK_BASE_DOMAIN secret not set` without it.

These are optional and only used by `separate_subdomain` hosting mode. Leave
them unset for now; `wildcard` mode never calls Plesk:

```
PLESK_BASE_URL=
PLESK_API_KEY=
PLESK_USERNAME=
PLESK_PASSWORD=
PLESK_DOCUMENT_ROOT=
```

## Do not change

- Any file under `src/` — the frontend is deployed separately.
- `base44/shared/adminAuth.ts`, `customSession.ts`, `challengeApiHelper.ts`,
  `entryVisibility.ts` — these already exist and are used as-is.

## How to verify when done

Anonymous calls, no auth header:

- `POST functions/challengeEngine {"action":"list"}` → **200** (was 401)
- `POST functions/complianceGate {"action":"statuses","challenge_ids":["x"]}` → **200** (was 401)
- `POST functions/challengeDomains {"action":"list"}` → **403 Admins only** (was 404 not found)
- `POST functions/createChallengeSubdomain {}` → **403 Only admins can create subdomains**
  (must NOT be `500 Authentication required to view users`)
