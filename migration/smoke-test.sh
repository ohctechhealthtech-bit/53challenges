#!/usr/bin/env bash
#
# End-to-end check of the Java API against the live system.
#
#   bash migration/smoke-test.sh you@example.com 'your-password'
#
# Run it from anywhere with curl. It talks to https://53challenges.com, so it
# exercises the real nginx routing, not just the app on localhost.
#
# PART A is read-only and creates nothing.
# PART B creates real data and is skipped unless you pass --write.
# PART C checks the login path the site actually uses.
# PART D checks the entity API, which nginx does not yet route here.
#
# Why this exists: every write path in the Java API was deployed without ever
# processing real input. Boot tests prove the app starts; only this proves it
# does the right thing.
set -u

HOST="${HOST:-https://53challenges.com}"
APP="${APP:-6a683318ec3c2cc96e77b420}"
FN="$HOST/api/apps/$APP/functions"

EMAIL=""
PASSWORD=""
WRITE=0
for arg in "$@"; do
  case "$arg" in
    --write) WRITE=1 ;;
    *) if [ -z "$EMAIL" ]; then EMAIL="$arg"; elif [ -z "$PASSWORD" ]; then PASSWORD="$arg"; fi ;;
  esac
done

# The password is read from the terminal rather than taken as an argument.
# An argument lands in shell history and in the process list, where any other
# account on the machine can read it with ps — for a live login on a shared
# server that is a real leak, not a theoretical one.
if [ -n "$EMAIL" ] && [ -z "$PASSWORD" ]; then
  printf 'Password for %s (not echoed): ' "$EMAIL"
  stty -echo 2>/dev/null
  read -r PASSWORD
  stty echo 2>/dev/null
  echo
fi

pass=0; fail=0
green() { printf '  \033[32m✓\033[0m %s\n' "$*"; pass=$((pass+1)); }
red()   { printf '  \033[31m✗\033[0m %s\n' "$*"; fail=$((fail+1)); }
info()  { printf '    %s\n' "$*"; }
head2() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# Body and status in one call, so a check never fires two requests that could
# disagree.
call() {
  local fn="$1" data="$2" auth="${3:-}"
  if [ -n "$auth" ]; then
    curl -s --compressed -m 40 -w '\n%{http_code}' -X POST "$FN/$fn" \
      -H 'Content-Type: application/json' -H "Authorization: Bearer $auth" -d "$data"
  else
    curl -s --compressed -m 40 -w '\n%{http_code}' -X POST "$FN/$fn" \
      -H 'Content-Type: application/json' -d "$data"
  fi
}
body()   { printf '%s' "$1" | sed '$d'; }
status() { printf '%s' "$1" | tail -n1; }

expect() {
  local label="$1" want="$2" got="$3" bodytext="$4"
  if [ "$got" = "$want" ]; then
    green "$label ($got)"
  else
    red "$label — expected $want, got $got"
    info "$(printf '%s' "$bodytext" | head -c 200)"
  fi
}

# ─────────────────────────────── PART A ───────────────────────────────
head2 "PART A — read-only"

r=$(curl -s --compressed -m 20 -w '\n%{http_code}' "$HOST/api/health")
if [ "$(status "$r")" = "200" ] && printf '%s' "$(body "$r")" | grep -q '"database":"ok"'; then
  green "health: app up and database reachable"
else
  red "health: $(body "$r")"
  echo; echo "The API is not healthy — nothing below will be meaningful. Stopping."
  exit 1
fi

r=$(call publicPanel '{}')
expect "publicPanel returns judges and sponsors" 200 "$(status "$r")" "$(body "$r")"

r=$(call challengeDomains '{"action":"resolve","host":"voice.53challenges.com"}')
if printf '%s' "$(body "$r")" | grep -q '6aaa7e0a99df11bc8bcc649b'; then
  green "challengeDomains resolves the voice subdomain"
else
  red "challengeDomains: $(body "$r")"
fi

r=$(call challengeVotes '{"challenge_id":"6a852c82215798f814cde148"}')
if printf '%s' "$(body "$r")" | grep -q '"6a85356ea4ca444eb9e07cbe":2'; then
  green "challengeVotes counts match the migrated data"
else
  red "challengeVotes: $(body "$r")"
fi

r=$(call challengeEngine '{"action":"entries","challenge_id":"6a6833d744dde11ab99273d2"}')
b=$(body "$r")
if printf '%s' "$b" | grep -q 'creator_email"'; then
  red "challengeEngine LEAKS creator_email"
else
  green "challengeEngine does not leak entrant emails"
fi

# Identity must come from the session, never the body.
r=$(call myVotes '{"user_email":"someone.else@example.com"}')
expect "myVotes refuses an unauthenticated caller" 401 "$(status "$r")" "$(body "$r")"

r=$(call submitChallengeEntry '{"action":"check","challenge_id":"x"}')
expect "submitChallengeEntry requires sign-in" 401 "$(status "$r")" "$(body "$r")"

r=$(call castVote '{"entry_id":"x","challenge_id":"y"}')
expect "castVote requires sign-in" 401 "$(status "$r")" "$(body "$r")"

r=$(call guardianPortal '{"action":"list_requests"}')
expect "guardianPortal requires sign-in" 401 "$(status "$r")" "$(body "$r")"

r=$(call prizeLedger '{"competition_id":"x","action":"save"}')
expect "prizeLedger requires sign-in" 401 "$(status "$r")" "$(body "$r")"

r=$(call detectVoteFraud '{}')
expect "detectVoteFraud is admin-only" 403 "$(status "$r")" "$(body "$r")"

r=$(call templateLibrary '{"action":"list"}')
expect "templateLibrary list needs a session" 401 "$(status "$r")" "$(body "$r")"

# recommend is the one public action: the host wizard shows the catalogue
# before anyone signs in. It reads the separate Idea Templates master API, so
# this also proves the API key reaches that service — an expired key returns
# an empty list here and an empty wizard on the site.
r=$(call templateLibrary '{"action":"recommend","limit":3}')
if printf '%s' "$(body "$r")" | grep -q '"is_best_match":true'; then
  green "templateLibrary recommend returns the host template catalogue"
else
  red "templateLibrary recommend returned no templates: $(body "$r")"
fi

r=$(call lifecycleGate '{"action":"list_gates"}')
expect "lifecycleGate needs a session" 401 "$(status "$r")" "$(body "$r")"

r=$(call termsAssembler '{"action":"list_clauses"}')
expect "termsAssembler needs a session" 401 "$(status "$r")" "$(body "$r")"

r=$(call runComplianceAssessment '{"action":"list_triggers"}')
expect "runComplianceAssessment needs a session" 401 "$(status "$r")" "$(body "$r")"

r=$(call rightsManager '{"action":"list_templates"}')
expect "rightsManager needs a session" 401 "$(status "$r")" "$(body "$r")"

r=$(call corporateIntake '{"action":"list_responses"}')
expect "corporateIntake admin actions need a session" 401 "$(status "$r")" "$(body "$r")"

# The intake questionnaire is deliberately public: a corporate visitor fills
# it in before creating an account. A 401 here means the wizard is unreachable
# to exactly the people it exists for.
r=$(call corporateIntake '{"action":"get_questionnaire"}')
expect "corporateIntake questionnaire is public" 200 "$(status "$r")" "$(body "$r")"

r=$(call pathways '{"action":"list"}')
expect "pathways management is admin-only" 403 "$(status "$r")" "$(body "$r")"

# The submit form asks what a gated challenge needs before anyone signs in.
r=$(call pathways '{"action":"public_config"}')
expect "pathways public_config is public" 200 "$(status "$r")" "$(body "$r")"

# lifecycleTick advances challenges on the clock — including closing voting on
# a live competition. The Base44 original authenticated nobody, so this checks
# the gate that replaced it. An anonymous 200 here is not a cosmetic failure:
# it means a stranger can close your voting.
r=$(call lifecycleTick '{}')
expect "lifecycleTick refuses an anonymous caller" 401 "$(status "$r")" "$(body "$r")"

# Anything not yet ported must still answer, via the Base44 fallback.
r=$(call challengeApi '{"action":"challenges","id":"6aaa7e0a99df11bc8bcc649b"}')
if printf '%s' "$(body "$r")" | grep -q 'Singing Challenge'; then
  green "unported functions still work through the Base44 fallback"
else
  red "fallback proxy: $(printf '%s' "$(body "$r")" | head -c 160)"
fi

# ─────────────────────────────── sign in ───────────────────────────────
TOKEN=""
# Set by PART C and read by PART D, so it must exist under set -u either way.
JWT=""
if [ -n "$EMAIL" ] && [ -n "$PASSWORD" ]; then
  head2 "Signing in as $EMAIL"
  payload=$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")
  r=$(curl -s --compressed -m 30 -w '\n%{http_code}' -X POST "$HOST/api/auth/login" \
    -H 'Content-Type: application/json' -d "$payload")
  if [ "$(status "$r")" = "200" ]; then
    TOKEN=$(printf '%s' "$(body "$r")" | sed -n 's/.*"session_token":"\([^"]*\)".*/\1/p')
    [ -n "$TOKEN" ] && green "signed in, token received" || red "signed in but no token in the response"
  else
    red "login failed ($(status "$r")): $(body "$r")"
  fi
fi

if [ -n "$TOKEN" ]; then
  head2 "PART A — signed in"

  r=$(call myEntries '{}' "$TOKEN")
  expect "myEntries works with a bearer token" 200 "$(status "$r")" "$(body "$r")"

  r=$(call myVotes '{}' "$TOKEN")
  expect "myVotes works with a bearer token" 200 "$(status "$r")" "$(body "$r")"

  r=$(call guardianPortal '{"action":"me"}' "$TOKEN")
  expect "guardianPortal 'me' works" 200 "$(status "$r")" "$(body "$r")"

  r=$(call judgeScoring '{"action":"is_judge"}' "$TOKEN")
  expect "judgeScoring 'is_judge' works" 200 "$(status "$r")" "$(body "$r")"

  r=$(call myApplications '{}' "$TOKEN")
  expect "myApplications works" 200 "$(status "$r")" "$(body "$r")"

  # Admin-only endpoints answer 200 for an admin and 403 otherwise; either is a
  # correct answer, so only a 500 or 401 is a failure here.
  r=$(call adminInbox '{}' "$TOKEN"); s=$(status "$r")
  case "$s" in 200|403) green "adminInbox answers correctly for this account ($s)" ;;
               *) red "adminInbox returned $s: $(body "$r")" ;; esac

  r=$(call activityReport '{}' "$TOKEN"); s=$(status "$r")
  case "$s" in 200|403) green "activityReport answers correctly for this account ($s)" ;;
               *) red "activityReport returned $s: $(body "$r")" ;; esac
fi

# ───────────────────── PART C — the login path ─────────────────────
# The site does NOT sign in through /api/auth/login; it calls challengeApi
# with action=login and uses the session_token that comes back. Once
# challengeApi is served by Java, that token is minted by Java too — so this
# is the check that decides whether anyone can sign in at all.
if [ -n "$EMAIL" ] && [ -n "$PASSWORD" ]; then
  head2 "PART C — the login path the site actually uses"

  payload=$(printf '{"action":"login","email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")
  r=$(call challengeApi "$payload")
  b=$(body "$r")

  if printf '%s' "$b" | grep -q '"success":true'; then
    green "challengeApi login succeeds"
  else
    red "challengeApi login FAILED — the site cannot sign anyone in"
    info "$(printf '%s' "$b" | head -c 200)"
  fi

  ST=$(printf '%s' "$b" | sed -n 's/.*"session_token":"\([^"]*\)".*/\1/p')
  if [ -n "$ST" ]; then
    green "a session_token was issued"

    # Two dot-separated base64url parts, as base44/shared/customSession.ts mints.
    if printf '%s' "$ST" | grep -qE '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'; then
      green "the token has the expected payload.signature shape"
    else
      red "the token is not in the expected format: $(printf '%s' "$ST" | head -c 40)..."
    fi


    # The JWT the entity API reads. Minted by the same login, because the SDK
    # sends a bearer header and a GET carries no body for a session token to
    # travel in. Without it a signed-in user is anonymous to every entity route.
    JWT=$(printf '%s' "$b" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
    if printf '%s' "$JWT" | grep -qE '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'; then
      green "login also issued a JWT for the entity API"
    else
      red "login issued no usable access_token — entity reads will be anonymous"
    fi

    # Sessions created before the JWT existed must be able to trade up, or
    # every currently signed-in browser silently loses its entity access.
    r=$(call challengeApi "$(printf '{"action":"exchange_token","session_token":"%s"}' "$ST")")
    expect "an existing session exchanges for a JWT" 200 "$(status "$r")" "$(body "$r")"

    r=$(call challengeApi '{"action":"exchange_token","session_token":"forged.token"}')
    expect "a forged session cannot exchange for a JWT" 401 "$(status "$r")" "$(body "$r")"
    # The real proof: a function must accept the token that login just minted.
    r=$(call myEntries "$(printf '{"session_token":"%s"}' "$ST")")
    expect "a function accepts the minted session_token" 200 "$(status "$r")" "$(body "$r")"

    r=$(call guardianPortal "$(printf '{"action":"me","session_token":"%s"}' "$ST")")
    expect "guardianPortal accepts the minted session_token" 200 "$(status "$r")" "$(body "$r")"
  else
    red "no session_token in the login response — signed-in features will all fail"
  fi

  # Drafts must never reach an anonymous caller.
  r=$(call challengeApi '{"action":"challenges","status":"draft"}')
  if printf '%s' "$(body "$r")" | grep -q '"status":"draft"'; then
    red "SECURITY: draft challenges are visible through the public proxy"
  else
    green "draft challenges stay hidden even when explicitly requested"
  fi

  r=$(call challengeApi '{"action":"categories"}')
  expect "categories resolve" 200 "$(status "$r")" "$(body "$r")"
fi


# ─────────────────── PART D — the entity API ───────────────────
# The 98 entities are still served by Base44: nginx sends /entities/ upstream.
# These checks therefore talk to the Java app DIRECTLY, so its behaviour can be
# proved BEFORE any real traffic is pointed at it. After the nginx change, run
# with ENTITY_HOST="$HOST" to prove the same things through the proxy.
#
# The stake here is quiet failure. An unauthenticated caller is not refused —
# it is narrowed to the rows it may see, which for most entities is none. So a
# broken credential does not look like an error; it looks like an empty site.
ENTITY_HOST="${ENTITY_HOST:-http://127.0.0.1:8081}"
EN="$ENTITY_HOST/api/apps/$APP/entities"

head2 "PART D — the entity API (direct at $ENTITY_HOST)"

ent() {
  local path="$1" auth="${2:-}"
  if [ -n "$auth" ]; then
    curl -s --compressed -m 30 -w '\n%{http_code}' "$EN/$path" \
      -H "Authorization: Bearer $auth"
  else
    curl -s --compressed -m 30 -w '\n%{http_code}' "$EN/$path"
  fi
}

r=$(ent "SiteSetting")
if [ "$(status "$r")" = "000" ]; then
  info "PART D SKIPPED: no app at $ENTITY_HOST (run this on the server, or set ENTITY_HOST)"
else
  expect "a public entity reads without signing in" 200 "$(status "$r")" "$(body "$r")"

  # Fails closed: an entity with no policy entry must not be reachable at all,
  # so a table added later is never exposed by having been forgotten.
  r=$(ent "User")
  s=$(status "$r")
  if [ "$s" = "404" ] || [ "$s" = "403" ]; then
    green "an unlisted entity is refused ($s)"
  else
    red "SECURITY: unlisted entity 'User' returned $s"
    info "$(body "$r" | head -c 200)"
  fi

  r=$(ent "NotAnEntity")
  expect "an unknown entity is 404" 404 "$(status "$r")" "$(body "$r")"

  # Admin-only reads answer 200 with an empty array rather than 403, so the
  # body is what matters — a non-empty one here is a real data leak.
  for e in PrizeLedger PrizePayout VoteAuditLog JudgingAuditLog; do
    r=$(ent "$e")
    b=$(body "$r")
    if [ "$(status "$r")" = "200" ] && [ "$(printf '%s' "$b" | tr -d ' \n')" = "[]" ]; then
      green "$e is empty to an anonymous caller"
    else
      red "SECURITY: $e returned rows to an anonymous caller"
      info "$(printf '%s' "$b" | head -c 200)"
    fi
  done

  # Writes are refused outright, unlike reads.
  r=$(curl -s --compressed -m 30 -w '\n%{http_code}' -X POST "$EN/SiteSetting" \
    -H 'Content-Type: application/json' -d '{"key":"smoke_test","value":"x"}')
  expect "an anonymous create is refused" 401 "$(status "$r")" "$(body "$r")"

  r=$(curl -s --compressed -m 30 -w '\n%{http_code}' -X DELETE "$EN/SiteSetting/does-not-exist")
  s=$(status "$r")
  if [ "$s" = "401" ] || [ "$s" = "404" ]; then
    green "an anonymous delete is refused ($s)"
  else
    red "SECURITY: anonymous delete returned $s"
  fi

  # A rejected credential must leave the caller anonymous, never authenticated.
  r=$(ent "PrizeLedger" "not.a.valid.jwt")
  b=$(body "$r")
  if [ "$(printf '%s' "$b" | tr -d ' \n')" = "[]" ]; then
    green "a garbage bearer token grants nothing"
  else
    red "SECURITY: a garbage bearer token returned rows"
  fi

  # With a real JWT the caller should stop being anonymous. What that unlocks
  # depends on the account, so this reports rather than fails — except for the
  # public entity, which must keep working for a signed-in caller too.
  if [ -n "$JWT" ]; then
    r=$(ent "SiteSetting" "$JWT")
    expect "a signed-in caller still reads a public entity" 200 "$(status "$r")" "$(body "$r")"

    r=$(ent "PrizeLedger" "$JWT")
    if [ "$(printf '%s' "$(body "$r")" | tr -d ' \n')" = "[]" ]; then
      info "PrizeLedger is empty for this account — expected unless it is an admin"
    else
      green "an admin JWT reads an admin-only entity"
    fi
  else
    info "no JWT available — pass credentials to check authenticated entity reads"
  fi
fi
# ─────────────────────────────── PART B ───────────────────────────────
if [ "$WRITE" = "1" ] && [ -n "$TOKEN" ]; then
  head2 "PART B — writes (creates real data)"
  echo "    These create records in your live database. Note the ids printed"
  echo "    so you can remove them afterwards."
  echo

  # An email code is required before an entry is accepted. The code is emailed,
  # so this step cannot be automated.
  r=$(call emailVerification "$(printf '{"action":"send","purpose":"challenge_entry","email":"%s"}' "$EMAIL")")
  expect "verification code requested" 200 "$(status "$r")" "$(body "$r")"

  printf '    Enter the 6-digit code emailed to %s (or press Enter to skip): ' "$EMAIL"
  read -r CODE
  if [ -n "$CODE" ]; then
    r=$(call emailVerification "$(printf '{"action":"verify","purpose":"challenge_entry","email":"%s","code":"%s"}' "$EMAIL" "$CODE")")
    VT=$(printf '%s' "$(body "$r")" | sed -n 's/.*"verification_token":"\([^"]*\)".*/\1/p')
    if [ -n "$VT" ]; then
      green "code confirmed, verification token issued"

      entry=$(printf '{"action":"submit","verification_token":"%s","entry":{"challenge_id":"6aaa7e0a99df11bc8bcc649b","creator_email":"%s","creator_name":"Smoke Test","title":"Smoke test entry","description":"Created by migration/smoke-test.sh","work_text":"test","division":"adults","state":"NSW"}}' "$VT" "$EMAIL")
      r=$(call submitChallengeEntry "$entry" "$TOKEN")
      s=$(status "$r"); b=$(body "$r")
      case "$s" in
        200) green "entry submitted"; info "$(printf '%s' "$b" | head -c 200)" ;;
        409) green "duplicate guard works (you have already entered this challenge)" ;;
        402) green "entry fee guard works (this challenge is paid)" ;;
        403) green "a gate refused the entry — read the message and confirm it is the expected one"; info "$b" ;;
        *)   red "entry submission returned $s"; info "$(printf '%s' "$b" | head -c 300)" ;;
      esac

      # The same token must not work twice.
      r=$(call submitChallengeEntry "$entry" "$TOKEN")
      if [ "$(status "$r")" != "200" ]; then
        green "the verification token cannot be reused"
      else
        red "SECURITY: the verification token was accepted a second time"
      fi
    else
      red "code not confirmed: $(body "$r")"
    fi
  else
    info "skipped — no code entered"
  fi
fi

# ─────────────────────────────── summary ───────────────────────────────
head2 "Result"
printf '  %s passed, %s failed\n' "$pass" "$fail"
if [ "$WRITE" != "1" ]; then
  echo "  (read-only. re-run with --write to exercise entry submission)"
fi
[ "$fail" -eq 0 ] || exit 1
