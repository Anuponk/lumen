#!/usr/bin/env bash
# #1056 · Daily Facebook post and #1057 acquisition counts, from the o2switch cron.
# Private configuration outside the document root (never in Git):
#   ~/lumen-private/social-post.env  (LUMEN_SOCIAL_MODE, META_PAGE_ID, META_PAGE_TOKEN…)
# Emergency stop: touch ~/lumen-private/social-post.stop  (or LUMEN_SOCIAL_MODE=off)
# Suggested crontab (Paris time is computed by the script, not by cron):
#   */10 7-12 * * *  bash ~/lumen-staging/scripts/o2switch-social-post.sh
#   20 1 * * *       bash ~/lumen-staging/scripts/o2switch-social-post.sh --counts
set -euo pipefail
umask 077
mkdir -p "$HOME/lumen-private"

env_file="$HOME/lumen-private/social-post.env"
if [[ -f "$env_file" ]]; then
  set -a
  source "$env_file"
  set +a
fi
exec 9>"$HOME/lumen-private/social-post.lock"
flock -n 9 || exit 0

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
case "${1:-}" in
  '') exec python3 -B "$script_dir/lumen_social_post.py" ;;
  --counts) exec python3 -B "$script_dir/lumen_mini_counts.py" ;;
  *) printf '%s\n' 'Usage: o2switch-social-post.sh [--counts]' >&2; exit 2 ;;
esac
