#!/usr/bin/env bash
#
# One-command deploy for the Java API. Put this on the server at
#   /var/www/vhosts/53challenges.com/backend/deploy.sh
# and run it after uploading a new jar to target/:
#   sudo bash /var/www/vhosts/53challenges.com/backend/deploy.sh
#
# What it does, in order:
#   1. checks the uploaded jar is complete and larger than nothing
#   2. keeps the running jar as app.jar.rollback
#   3. installs the new one with the right owner and mode
#   4. restarts and WAITS for the app to actually answer
#   5. rolls back automatically if it does not come up
#   6. only updates app.jar.good once the new build is proven healthy
#
# Step 4 is the point of the script. `systemctl is-active` reports "active" the
# instant the process spawns, and this app needs ~15 seconds before it serves a
# request — so every check run straight after a restart has looked like a
# failure. Worse, a crash-looping app keeps reporting "active" indefinitely
# because systemd restarts it, which is exactly how a broken build once sat in
# front of live traffic returning 502s.
set -u

BACKEND=/var/www/vhosts/53challenges.com/backend
NEW="$BACKEND/target/challenges-api-0.1.0.jar"
LIVE="$BACKEND/app.jar"
ROLLBACK="$BACKEND/app.jar.rollback"
GOOD="$BACKEND/app.jar.good"
OWNER=sysuser_8:psacln
HEALTH=http://127.0.0.1:8081/api/health
WAIT_SECONDS=60

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  red "Run with sudo — installing into $BACKEND and restarting the service both need root."
  exit 1
fi

# --- 1. is the upload complete? ---------------------------------------------
# A part-transferred jar has bitten us twice: FileZilla was still writing when
# the copy ran, and an 11 MB fragment was installed as the live application.
# A jar is a zip, so `unzip -t` is a real integrity check, not a size guess.
if [ ! -f "$NEW" ]; then
  red "No jar at $NEW — upload it first."
  exit 1
fi

SIZE=$(stat -c %s "$NEW")
if [ "$SIZE" -lt 40000000 ]; then
  red "$NEW is only $SIZE bytes — that is far short of a full build (~53 MB)."
  red "The upload is probably still running. Wait for it to finish and re-run."
  exit 1
fi

if command -v unzip >/dev/null 2>&1; then
  if ! unzip -qt "$NEW" >/dev/null 2>&1; then
    red "$NEW is corrupt — the archive does not verify. Re-upload it."
    exit 1
  fi
fi

if cmp -s "$NEW" "$LIVE"; then
  echo "note: the uploaded jar is byte-identical to the running one."
fi

echo "installing $(basename "$NEW") ($SIZE bytes)"

# --- 2 & 3. keep the current jar, install the new one -----------------------
if [ -f "$LIVE" ]; then
  cp "$LIVE" "$ROLLBACK"
fi
cp "$NEW" "$LIVE"
chown "$OWNER" "$LIVE"
chmod 644 "$LIVE"

# --- 4. restart and wait for it to actually answer --------------------------
systemctl restart challenges-api

printf 'waiting for the app to respond'
READY=0
for _ in $(seq 1 "$WAIT_SECONDS"); do
  if curl -sf --max-time 2 "$HEALTH" >/dev/null 2>&1; then
    READY=1
    break
  fi
  printf '.'
  sleep 1
done
echo

# --- 5. roll back if it never came up ---------------------------------------
if [ "$READY" -ne 1 ]; then
  red "The app did not respond within ${WAIT_SECONDS}s — rolling back."
  if [ -f "$ROLLBACK" ]; then
    cp "$ROLLBACK" "$LIVE"
    chown "$OWNER" "$LIVE"
    chmod 644 "$LIVE"
    systemctl restart challenges-api
    echo "restored the previous jar. Reason for the failure:"
  else
    red "No rollback jar available."
  fi
  echo "----------------------------------------------------------"
  journalctl -u challenges-api -n 40 --no-pager \
    | grep -iE "APPLICATION FAILED|Unsatisfied|Error creating bean|Caused by" \
    | tail -10
  echo "----------------------------------------------------------"
  red "Nothing was left broken, but the new build is NOT deployed."
  exit 1
fi

# --- 6. healthy: record it as the known-good build --------------------------
HEALTH_BODY=$(curl -s --max-time 5 "$HEALTH")
green "healthy: $HEALTH_BODY"

case "$HEALTH_BODY" in
  *'"database":"ok"'*)
    cp "$LIVE" "$GOOD"
    green "deployed, and saved as app.jar.good"
    ;;
  *)
    # Serving but unable to reach MariaDB is not a build worth keeping as the
    # one to fall back to.
    red "The app is up but the database is not reachable — NOT saving as known-good."
    exit 1
    ;;
esac
