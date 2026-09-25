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

# lifecycleTick is the scheduler's endpoint and takes no session, matching the
# Base44 original. It is only allowed to do what the clock already says is due,
# and every transition still has to pass its gate — so an unexpected caller
# cannot advance anything that was not going to advance anyway. What it must
# never do is fail: a 500 here means challenges stop closing on time.
r=$(call lifecycleTick '{}')
expect "lifecycleTick runs and reports what it advanced" 200 "$(status "$r")" "$(body "$r")"

# Anything not yet ported must still answer, via the Base44 fallback.
r=$(call challengeApi '{"action":"challenges","id":"6aaa7e0a99df11bc8bcc649b"}')
if printf '%s' "$(body "$r")" | grep -q 'Singing Challenge'; then
  green "unported functions still work through the Base44 fallback"
else
  red "fallback proxy: $(printf '%s' "$(body "$r")" | head -c 160)"
fi

# ─────────────────────────────── sign in ───────────────────────────────
TOKEN=""
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
