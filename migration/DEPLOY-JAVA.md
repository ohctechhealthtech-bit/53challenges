# Deploying the Java API on Plesk

Covers Stage 2: the Spring Boot skeleton in `server/`, running behind the nginx
you already have, against a Plesk MySQL database.

Nothing here touches the frontend. The Vite build, `.htaccess`, the wildcard
certificate and the subdomain routing all stay exactly as they are.

## 0. Install Java — it is not installed

`java -v` on your server reported *"Command 'java' not found"*. What followed
was apt listing what it **could** install, not what is present.

```bash
apt update && apt install -y openjdk-21-jre-headless
java -version
```

21 is the current LTS and what `pom.xml` targets. `jre-headless` is enough —
the JAR is built on your machine, not on the server.

## 1. Create the database

Plesk → **Databases → Add Database**. Note the name, user and password; they go
into the service file in step 4, never into the repo.

Then load the schema:

```bash
mysql -u <db_user> -p <db_name> < migration/sql/schema.sql
```

98 tables. The file is generated — regenerate with
`node migration/generate-schema.cjs > migration/sql/schema.sql` whenever
`base44/entities` changes.

## 2. Build the JAR

On your machine, not the server:

```bash
cd server && mvn -q clean package
```

Produces `server/target/challenges-api-0.1.0.jar`.

## 3. Upload

```bash
scp server/target/challenges-api-0.1.0.jar root@54.253.151.173:/var/www/vhosts/53challenges.com/backend/app.jar
```

(`mkdir -p /var/www/vhosts/53challenges.com/backend` first.)

## 4. Run it as a service

`/etc/systemd/system/challenges-api.service`:

```ini
[Unit]
Description=53 Challenges API
After=network.target mariadb.service mysql.service

[Service]
Type=simple
User=<subscription system user, e.g. sysuser_8>
WorkingDirectory=/var/www/vhosts/53challenges.com/backend
ExecStart=/usr/bin/java -jar /var/www/vhosts/53challenges.com/backend/app.jar
Restart=on-failure
RestartSec=5

# Secrets live here, readable only by root — never in the repo.
Environment=PORT=8081
Environment=DB_HOST=127.0.0.1
Environment=DB_NAME=<db_name>
Environment=DB_USER=<db_user>
Environment=DB_PASSWORD=<db_password>
Environment=JWT_SECRET=<at least 32 random bytes>
Environment=CHALLENGE_API_BASE_URL=https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/publicChallengeApi
Environment=CHALLENGE_API_KEY=<the same key already in .env>

[Install]
WantedBy=multi-user.target
```

Run it as the subscription's own system user, not a new one — Plesk's
permission repair resets ownership under `/var/www/vhosts` and would fight a
separate account. Find the user first:

```bash
stat -c %U /var/www/vhosts/53challenges.com/httpdocs
```

```bash
chown -R <sysuser>:psacln /var/www/vhosts/53challenges.com/backend
chmod 600 /etc/systemd/system/challenges-api.service
systemctl daemon-reload && systemctl enable --now challenges-api
systemctl status challenges-api
```

Generate the JWT secret with `openssl rand -base64 48`. The app refuses to
start on a secret under 32 bytes rather than issuing weak tokens.

The app binds to `127.0.0.1` only, so it is not reachable from outside except
through nginx.

## 5. Point one path at it

Do **not** move all of `/api` yet. Cut over a prefix at a time, so a problem
affects one route rather than the whole site. In Plesk →
**Apache & nginx Settings → Additional nginx directives**, add *above* the
existing `location /api/` block (nginx prefers the longer match anyway):

```nginx
location /api/health {
    proxy_pass              http://127.0.0.1:8081;
    proxy_set_header        Host $host;
    proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header        X-Forwarded-Proto $scheme;
}
```

Verify:

```bash
curl -s https://53challenges.com/api/health
# {"status":"ok"}
```

Everything else keeps going to Base44, untouched.

## 6. Prove login works

```bash
curl -s -X POST https://53challenges.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}'
```

Expect `{"success":true,"session_token":"eyJ...","user":{...}}`. Then:

```bash
curl -s https://53challenges.com/api/auth/me -H "Authorization: Bearer <token>"
```

(Add a `location /api/auth/` proxy block the same way as step 5 first.)

## How auth works, and why

Your local `User` record holds **only a role** — there are no password hashes in
this database. Credentials live in the upstream Challenge API, which is why
`UpstreamAuthClient` delegates the password check there and this API then mints
its **own** JWT. That mirrors what `challengeApi`'s login action plus
`signCustomSession` already do.

The claim set is deliberately identical to the existing custom session —
`email`, `name`, `uid`, `exp` — so the React client needs no change during
cutover. The difference is that it is now a standards-compliant JWT rather than
a bespoke `payload.signature` string.

**The role is read from the database on every request, not from the token**, so
granting or revoking admin takes effect immediately instead of when the token
expires. That matches `isAdminCaller`'s behaviour today.

## What Stage 2 does not include

- **Row-level security.** 34 entities carry RLS rules that Base44 enforced
  declaratively. In Java each becomes an explicit check. They are listed at the
  bottom of `schema.sql`. This is the largest remaining source of risk: we have
  already seen twice what happens when an RLS-protected read silently returns
  an empty list instead of an error.
- **The other 64 functions.** Stage 3 moves them in vertical slices, highest
  traffic first, each behind its own nginx prefix.
- **File uploads.** Existing rows hold `media.base44.com` URLs. Either keep
  serving those or migrate the blobs and rewrite the URLs.

## 7. Load the data (Stage 3)

The schema changed after the first load — the `user` table gained seven columns
that exist on every real row but are absent from the `.jsonc`, so the original
version would have dropped that data on import. Both files must be re-run.

`schema.sql` begins each table with `DROP TABLE IF EXISTS`. That is destructive
and it is deliberate: the tables are still empty, so there is nothing to lose,
and a clean rebuild beats patching. **Once real data is in MySQL, never run
`schema.sql` again** — from that point on, schema changes are `ALTER TABLE`.

Upload both files:

```bash
scp migration/sql/schema.sql migration/sql/data.sql root@54.253.151.173:/tmp/
```

Then on the server, schema first:

```bash
mysql -u <db_user> -p <db_name> < /tmp/schema.sql && mysql -u <db_user> -p <db_name> < /tmp/data.sql
```

### The server is MariaDB, not MySQL

Plesk installed MariaDB, and the first import attempt failed on it:

> #1064 ... check the manual that corresponds to your MariaDB server version
> ... near 'JSON), NULL, ...'

MariaDB has no `CAST(x AS JSON)`: there `JSON` is an alias for `LONGTEXT`,
not a distinct type as in MySQL 5.7+. The importer now writes JSON values as
ordinary quoted string literals, which insert correctly on both servers —
MySQL parses and validates one into a real JSON column on the way in.

That loses the server-side JSON validation `CAST` gave, so the generator now
round-trips every string literal it emits (unescape(escape(x)) === x) and
aborts if any one of them is not reversible. 11967 literals are checked on each
run. `verify-sql.cjs` additionally re-parses every value that looks like JSON.

The schema itself needed no change: it declares no `DEFAULT` on a JSON or TEXT
column, which MariaDB would reject, and every type it uses exists in MariaDB
10.2+.

`data.sql` sets `STRICT_ALL_TABLES` for its own session, so a value that does
not fit aborts the import instead of being silently truncated. Silence means it
worked; any output is a real failure.

Verify the row counts match the export:

```bash
mysql -u <db_user> -p <db_name> -e "SELECT 'challenge', COUNT(*) FROM challenge UNION ALL SELECT 'entry', COUNT(*) FROM entry UNION ALL SELECT 'vote', COUNT(*) FROM vote UNION ALL SELECT 'user', COUNT(*) FROM user UNION ALL SELECT 'challenge_domain', COUNT(*) FROM challenge_domain;"
```

Expected: challenge 60, entry 60, vote 67, user 6, challenge_domain 51.

### How the data was validated

`migration/validate-schema.cjs` compares all 898 exported rows against the DDL
and reports anything that would not survive the round trip — a value longer
than its column, a field with no column, a null in a NOT NULL column, an object
bound for a scalar column. It currently reports zero issues.

`migration/verify-sql.cjs` parses the generated SQL the way the server will,
tracking quote state character by character, and re-parses every
`CAST(... AS JSON)` payload. An unbalanced quote does not fail small: it makes
the remainder of the file parse as one enormous string and mysql then reports
an error thousands of lines from the real cause.

One conversion deserves specific mention. **Base44 exports most timestamps
without a trailing `Z`** — 1784 of 2188 — but they are UTC regardless; the same
fields carry an explicit `Z` on other rows. Handing those to JavaScript's
`new Date()` applies the local timezone and shifts them, by five and a half
hours on an IST machine. The importer therefore parses the components
textually and never constructs a Date, so no timestamp moves.

## 8. Stage 4 — the first function: challengeDomains

Ported to Java as `ChallengeDomainController`, mounted at **the Base44 function's
own URL**:

```
POST /api/apps/{appId}/functions/challengeDomains
```

That is deliberate. The React client reaches it through the SDK at exactly that
path, so serving it from Java means no frontend rebuild and no redeploy —
nginx sends this one path to Java and everything else still goes to Base44.
Rolling back is deleting four lines of nginx config. Changing the client
instead would tie the rollback to a redeploy, which is the last thing to depend
on when a route is misbehaving in production.

### Compatibility during cutover

Admins already signed in hold a Base44 custom-session token in localStorage and
send it as `session_token` in the request body. `CustomSessionVerifier`
reimplements that HMAC scheme so those sessions keep working; `CallerResolver`
accepts either it or the new JWT. Without this every signed-in admin would get
a 403 the moment the route moved, with nothing to suggest that logging out and
back in would fix it.

`CustomSessionVerifier` must match `base44/shared/customSession.ts` byte for
byte. A mismatch does not fail loudly — it silently rejects every existing
session.

### Deploy

Keep the running jar so rollback does not need a rebuild:

```bash
ssh root@54.253.151.173 'cp /var/www/vhosts/53challenges.com/backend/app.jar /var/www/vhosts/53challenges.com/backend/app.jar.prev'
```

```bash
scp server/target/challenges-api-0.1.0.jar root@54.253.151.173:/var/www/vhosts/53challenges.com/backend/app.jar
```

```bash
ssh root@54.253.151.173 'chown sysuser_8:psacln /var/www/vhosts/53challenges.com/backend/app.jar && systemctl restart challenges-api && sleep 5 && systemctl is-active challenges-api'
```

### Verify on the server BEFORE touching nginx

The endpoint is unreachable from outside until nginx routes to it, so this
tests the new code with zero public exposure:

```bash
curl -s -X POST http://127.0.0.1:8081/api/apps/6a683318ec3c2cc96e77b420/functions/challengeDomains -H 'Content-Type: application/json' -d '{"action":"resolve","host":"voice.53challenges.com"}'
```

Expected, matching what Base44 returns today:

```json
{"challenge_id":"6aaa7e0a99df11bc8bcc649b","challenge_name":"Singing Challenge — Show Us Your Voice"}
```

And the reverse map:

```bash
curl -s -X POST http://127.0.0.1:8081/api/apps/6a683318ec3c2cc96e77b420/functions/challengeDomains -H 'Content-Type: application/json' -d '{"action":"map"}'
```

Expected: four entries — voice, work, calligraphy, photo. Only 4 of the 51
domain records are live; the other 47 are `status: deleted`.

### Then route it

In Plesk → **Apache & nginx Settings → Additional nginx directives** on
`53challenges.com` AND on each challenge subdomain, above the existing
`location /api/`:

```nginx
location = /api/apps/6a683318ec3c2cc96e77b420/functions/challengeDomains {
    proxy_pass       http://127.0.0.1:8081;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`location =` is an exact match, so it cannot accidentally capture another
function. Every other Base44 function is untouched.

### Rollback

Delete that nginx block and apply. Traffic returns to Base44 immediately; no
rebuild, no restart, no redeploy. If the jar itself is at fault:

```bash
ssh root@54.253.151.173 'cd /var/www/vhosts/53challenges.com/backend && mv app.jar.prev app.jar && systemctl restart challenges-api'
```

### Two bugs the first real deploy exposed

**`characterEncoding=utf8mb4` in the JDBC URL.** That parameter takes a *Java*
charset name; `utf8mb4` is MySQL's name for it, and Connector/J rejects it with
"Unsupported character encoding". The Java name is `UTF-8`, from which the
driver negotiates utf8mb4 on the wire — which is what the utf8mb4 schema needs.

**`/api/health` could not fail.** It returned `{"status":"ok"}` without touching
the datasource, and `/api/auth/me` reports a role that falls back to `"user"`
when the lookup throws. Both answered 200 for hours while the JDBC URL was
malformed and not one query had ever succeeded — so Stage 2 looked verified
against MariaDB when nothing had ever read from it.

The health endpoint now opens a real connection and returns 503 when it cannot.
Worth keeping in mind for the remaining 64 functions: **a check that cannot
fail proves nothing**, and the fallbacks that stop a database fault from
looking like an auth failure are the same fallbacks that hide the fault.
