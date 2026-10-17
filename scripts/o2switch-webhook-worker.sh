#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ $# == 1 && "$1" =~ ^[0-9a-f]{40}$ ]] || exit 2
SHA="$1"
# Derive the account from the installed private location, not the web PHP HOME.
PRIVATE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export HOME="$(dirname -- "$PRIVATE")"
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
STATE="$PRIVATE/deploy-jobs/$SHA.json"
finish() {
 local result=$?
 local status=failed
 [[ "$result" == 0 ]] && status=success
 printf '{"sha":"%s","state":"%s","exit_code":%s}\n' "$SHA" "$status" "$result" > "$STATE.tmp"
 mv -f -- "$STATE.tmp" "$STATE"
}
trap finish EXIT
# The publisher retains its independent CI checks, shared cron lock and rollback.
timeout 480 /bin/bash "$HOME/lumen-staging/scripts/o2switch-cron-publish.sh" --deploy "$SHA"
