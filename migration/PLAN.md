# Migrating 53 Challenges off Base44 to Java + Plesk

Scope assessment and a staged plan. Read the "Before you commit" section first —
two of those points can stop the project dead, and both are cheap to check now.

## What actually has to be rebuilt

Measured from this repo, not estimated:

| | |
|---|---|
| Backend functions | **65** |
| Entities (tables) | **98** |
| Shared modules | **30** |
| Backend lines | **~16,300** |
| Frontend lines | ~60,900 (mostly reusable) |

And the coupling to Base44 is not superficial:

| Platform feature | Files using it |
|---|---|
| `createClientFromRequest` | 60 |
| `entities.*` (CRUD + RLS) | 64 |
| `asServiceRole` | 54 |
| `auth.me()` | 46 |
| `base44:runtime` secrets | 31 |

Every one of those is a Base44 platform service with no drop-in Java equivalent.
This is a rewrite of the entire server tier, not a port. Realistically that is
months of work, not days — and during it you are maintaining two backends.

The frontend is the good news: it is a normal Vite SPA talking to `/api/...`
over HTTP. Most of it survives untouched if the Java API mirrors the existing
request/response shapes.

## Before you commit — three things that can stop this

### 1. Getting your data out  ← start here

There is no `entities pull` in the CLI. The only route is
`base44 exec --privileged`, which `migration/export-data.sh` uses.

Two prerequisites that are easy to miss:

```bash
npm i -g base44@latest deno
base44 login
```

`exec` runs the script **locally** under Deno and fails with a bare "Deno is
required" if it is absent. `base44 link` is not needed and will not work here:
the app sits in the USTC workspace, which the linker does not offer, so the
script passes `--app-id` explicitly instead.

**Run that today regardless of whether you go ahead.** You currently have no
backup of 98 tables of production data, and the export is the one step that is
useful in every scenario.

### 2. Java hosting on Plesk

Plesk runs Java via a Tomcat component that is not enabled on every plan or
server. Confirm **Tools & Settings → Updates → Add Components → Tomcat** exists
on your server before designing around it. If it is unavailable, the app has to
run as a standalone JAR behind the nginx proxy instead — workable, but it
changes deployment and restart handling.

Also confirm you can create a database: **Databases → Add Database** (MySQL or
PostgreSQL).

### 3. You do not own the upstream Challenge API

A large part of this backend proxies app `69341410f89d26a8fc73a4d1` —
challenges, entries, votes, the email OTP service, host ideas, judges. Those
live in a **different Base44 app** that this migration does not touch.

So a Java backend does **not** make you independent. It replaces the middle
tier while leaving the system of record upstream. Worth deciding explicitly
whether the goal is to absorb that too, because that roughly doubles the work
and requires whatever access that app's owner grants.

## Where JWT actually stands

Better than expected. `base44/shared/customSession.ts` already issues and
verifies a signed session token, and `src/lib/customSession.js` stores it. The
payload is already JWT-shaped:

```json
{ "email": "…", "name": "…", "uid": "…", "exp": 1792757078 }
```

So the frontend contract barely changes: the Java side issues a real JWT with
the same claims, the SPA keeps sending it, and `isAdminCaller` becomes a
standard Spring Security filter. Auth is one of the smaller pieces here.

## Staged plan

Each stage ships something usable and is independently abandonable.

**Stage 0 — Export the data.** `migration/export-data.sh`. Also confirms
exactly how many rows each table holds, which sizes the rest.

**Stage 1 — Schema.** Generate SQL DDL from the 98 `.jsonc` entity definitions.
They carry types, enums, defaults and required fields, so this is largely
mechanical. RLS rules become application-layer checks, not database ones.

**Stage 2 — Spring Boot skeleton.** JWT issue/verify matching the existing
claims, the `User` entity, sign-in, and a generic entity repository layer.
Deployable to Plesk and provable end to end before any business logic moves.

**Stage 3 — Vertical slices**, highest-traffic first: challenges read →
entries → voting → judging → host portal → admin. Each slice moves a handful of
the 65 functions and can go live behind the nginx proxy one path at a time, so
you are never mid-cutover across the whole app.

**Stage 4 — Files.** Uploads currently land in Base44's media store and existing
rows hold `media.base44.com` URLs. Either keep serving those (the dependency
stays) or migrate the blobs and rewrite the URLs.

**Stage 5 — Cutover.** nginx routes `/api` to the Java app instead of Base44,
one prefix at a time.

## Deployment shape

Unchanged from today apart from the proxy target:

```
nginx (Plesk)
  /            → httpdocs  (the Vite build — exactly as now)
  /api/        → the Java app instead of base44.app
```

The frontend build process, `.htaccess`, the wildcard certificate and the
subdomain routing all stay as they are.

## The honest recommendation

Do **Stage 0 today** — you need that backup regardless.

Then decide the upstream question before Stage 1, because it determines whether
this is a six-function-a-week grind toward independence or a rewrite that
leaves you just as dependent on someone else's app as you are now.
