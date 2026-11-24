#!/usr/bin/env bash
# Load the operator-managed configuration from outside the document root.
set -euo pipefail
umask 077

env_file="$HOME/lumen-private/activity-mail.env"
if [[ ! -f "$env_file" ]]; then
  printf '%s\n' 'Lumen activity mail: private configuration missing' >&2
  exit 1
fi

exec 9>"$HOME/lumen-private/activity-mail.lock"
flock -n 9 || exit 0
set -a
source "$env_file"
set +a

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
case "${1:-}" in
  --receipt) exec python3 -B "$script_dir/lumen_activity_mail_receipt.py" --live ;;
  '')
    # #947: the GitHub schedule ran ~5 times in 48 h; this 5-minute cron is the
    # reliable cadence. Observation failures never block mail delivery.
    if [[ "${LUMEN_CRITICAL_MONITOR_ENABLED:-1}" == "1" ]]; then
      LUMEN_CRITICAL_MONITOR_ENABLED=1 LUMEN_PERFORMANCE_HOURLY=1 \
        LUMEN_PERFORMANCE_MONITOR_ENABLED="${LUMEN_PERFORMANCE_MONITOR_ENABLED:-1}" \
        python3 -B "$script_dir/lumen_critical_monitor.py" \
        || printf '%s\n' 'Lumen critical monitor: observation skipped' >&2
    fi
    exec python3 -B "$script_dir/lumen_activity_mail.py" ;;
  *) printf '%s\n' 'Usage: o2switch-activity-mail.sh [--receipt]' >&2; exit 2 ;;
esac
