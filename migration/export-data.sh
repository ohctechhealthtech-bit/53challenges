#!/usr/bin/env bash
# Exports every Base44 entity's rows to migration/data/<Entity>.json.
#
# This is step one of any migration off Base44, and a worthwhile backup on its
# own: there is no `entities pull` in the CLI, so `exec --privileged` is the
# only way to get production rows out.
#
# Prerequisites:
#   npm i -g base44@latest deno     # deno is required: `exec` runs the script locally
#   base44 login
#
# `base44 link` is NOT needed — the app id is passed explicitly with --app-id,
# which also works when the app lives in a workspace the CLI won't offer for
# linking.
#
# Resumable: already-exported entities are skipped, so it can be re-run after
# an interruption or a failure.
set -u
cd "$(dirname "$0")/.."

OUT=migration/data
mkdir -p "$OUT"

# The app id is public (it ships in the frontend bundle), so reading it from the
# env file keeps it in one place rather than duplicating it here.
APP_ID="${BASE44_APP_ID:-$(grep -h '^VITE_BASE44_APP_ID=' .env.production .env.local 2>/dev/null | head -1 | cut -d= -f2 | tr -d '\r')}"
if [ -z "$APP_ID" ]; then
  echo "error: no app id. Set BASE44_APP_ID or VITE_BASE44_APP_ID in .env.production." >&2
  exit 1
fi

if ! command -v base44 >/dev/null 2>&1; then
  echo "error: base44 not on PATH.  npm i -g base44@latest" >&2
  exit 1
fi

# `exec` shells out to deno as a child process. On Windows `npm i -g deno`
# installs a deno.cmd shim, which bash can run but Node's spawn cannot resolve —
# so a working `deno --version` here does NOT mean the CLI can find it. Test for
# the real executable instead and put its directory first on PATH.
NPM_ROOT="$(npm root -g 2>/dev/null | tr -d '\r')"
# npm reports a native path; on Windows that carries a drive letter whose colon
# would split PATH into garbage, so convert to the POSIX form before prepending.
if [ -n "$NPM_ROOT" ] && command -v cygpath >/dev/null 2>&1; then
  NPM_ROOT="$(cygpath -u "$NPM_ROOT")"
fi
if [ -n "$NPM_ROOT" ]; then
  for candidate in "$NPM_ROOT/deno/deno.exe" "$NPM_ROOT/deno/deno"; do
    if [ -x "$candidate" ]; then
      PATH="$(dirname "$candidate"):$PATH"
      export PATH
      break
    fi
  done
fi
if ! deno --version >/dev/null 2>&1; then
  echo "error: deno not found — 'base44 exec' cannot run without it.  npm i -g deno" >&2
  exit 1
fi

total=$(grep -c . migration/entities.txt)
i=0
fail=0
rows_total=0

while IFS= read -r entity; do
  entity="$(echo "$entity" | tr -d '\r')"
  [ -z "$entity" ] && continue
  i=$((i + 1))

  if [ -s "$OUT/$entity.json" ]; then
    printf '[%3d/%3d] %-34s skipped (already exported)\n' "$i" "$total" "$entity"
    continue
  fi

  printf '[%3d/%3d] %-34s ' "$i" "$total" "$entity"

  # --privileged bypasses RLS so admin-only entities export too.
  # Cursor pagination, not a single huge limit: the API caps `limit` at 10000
  # and rejects anything larger, and a fixed cap would silently truncate any
  # table that outgrew it. Walking the cursor exports every row whatever the
  # count.
  # User is a platform entity, not an app one: it rejects the cursor form with
  # "use the app users endpoints". The positional call still works, and an app's
  # user count is nowhere near the 10000 cap.
  if [ "$entity" = "User" ]; then
    script="const rows = await base44.entities.User.list('-created_date', 10000);
console.log(JSON.stringify(rows));"
  else
    script="let page = await base44.entities.$entity.list({ sort: '-created_date', limit: 1000 });
const all = page.items;
while (page.has_more) {
  page = await base44.entities.$entity.list({ cursor: page.next_cursor, limit: 1000 });
  all.push(...page.items);
}
console.log(JSON.stringify(all));"
  fi

  if echo "$script" | base44 --app-id "$APP_ID" exec --privileged --data-env prod \
        > "$OUT/$entity.json" 2>"$OUT/$entity.err"; then
    count=$(node -e "try{const a=JSON.parse(require('fs').readFileSync('$OUT/$entity.json','utf8'));console.log(Array.isArray(a)?a.length:0)}catch(e){console.log('?')}" 2>/dev/null)
    if [ "$count" = "?" ]; then
      # Exit code 0 but unparseable output is still a failure — keep the file
      # for inspection rather than letting a bad export look successful.
      printf 'FAILED (unparseable output)\n'
      fail=$((fail + 1))
    else
      printf 'ok (%s rows)\n' "$count"
      rows_total=$((rows_total + count))
      rm -f "$OUT/$entity.err"
    fi
  else
    printf 'FAILED (see %s.err)\n' "$entity"
    rm -f "$OUT/$entity.json"
    fail=$((fail + 1))
  fi
done < migration/entities.txt

echo
echo "----------------------------------------------------------"
echo "exported to $OUT"
echo "  entities : $i"
echo "  rows     : $rows_total"
echo "  failures : $fail"
[ "$fail" -gt 0 ] && echo "  re-run this script to retry only the failures."
echo "----------------------------------------------------------"
