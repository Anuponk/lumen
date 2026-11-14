#!/usr/bin/env bash
# One o2switch publication attempt for deploy-o2switch.yml.
# Writes result=published on success, result=blocked when the hosting filter
# (TigerProtect) refused this runner (exit 75, retryable from a fresh runner).
# Any other failure fails the job immediately and is never retried.
set -uo pipefail
status=0
python3 scripts/o2switch-https-deploy.py || status=$?
case "$status" in
  0) echo 'result=published' >> "$GITHUB_OUTPUT" ;;
  75)
    echo 'result=blocked' >> "$GITHUB_OUTPUT"
    echo '::warning::TigerProtect refused this runner; a fresh runner will retry'
    ;;
  *) exit "$status" ;;
esac
