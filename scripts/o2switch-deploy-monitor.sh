#!/usr/bin/env bash
set -Eeuo pipefail
# Same alerting transport as nopuna.fr; failures only, once per incident.
ROOT="${HOME}/lumen-staging"
STATE_DIR="${HOME}/lumen-private"
STATE="$STATE_DIR/deploy-state"
LOCK="${HOME}/.lumen-deploy-monitor.lock"
NOTIFIER="${HOME}/nopuna-staging/scripts/o2switch-notify.php"
mkdir -p "$STATE_DIR"
exec 8>"$LOCK"
flock -n 8 || exit 0
previous="ok"
[[ -f "$STATE" ]] && previous="$(cat "$STATE")"
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
set +e
bash "$ROOT/scripts/o2switch-cron-publish.sh" --deploy >"$log" 2>&1
result=$?
set -e
if [[ "$result" -eq 0 ]]; then
  cat "$log"
  printf 'ok\n' > "$STATE"
  exit 0
fi
if [[ "$result" -eq 75 ]]; then
  # Workflow main not finished yet; not a deployment failure.
  cat "$log"
  exit 0
fi
cat "$log" >&2
printf 'failed\n' > "$STATE"
if [[ "$previous" != failed ]]; then
  revision="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  details="$(tail -n 20 "$log")"
  message="$(printf 'Lumen : échec de synchronisation, validation CI, publication ou contrôle HTTPS.\nCode : %s\nCommit : %s\nDate UTC : %s\n\n%s\n' "$result" "$revision" "$(date -u)" "$details")"
  if [[ -f "$NOTIFIER" ]]; then
    printf '%s\n' "$message" | php "$NOTIFIER" '[Lumen] Échec de déploiement' || echo "WARNING: Brevo alert failed" >&2
  else
    echo "WARNING: Nopuna Brevo notifier is unavailable" >&2
  fi
fi
exit "$result"
