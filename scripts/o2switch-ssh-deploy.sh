#!/usr/bin/env bash
set -Eeuo pipefail
# Install this dispatcher outside the checkout and use it as a forced command
# for the dedicated GitHub -> o2switch key. No shell, scp or arbitrary commands.
if [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
 SHA="${BASH_REMATCH[1]}"
else
 echo "Only deploy followed by a full commit SHA is accepted" >&2
 exit 2
fi
exec /bin/bash "$HOME/lumen-staging/scripts/o2switch-cron-publish.sh" --deploy "$SHA"
