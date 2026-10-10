#!/usr/bin/env bash
set -Eeuo pipefail
# Release publisher: fail closed. Never enable --activate on cron until docroot
# is explicitly migrated to a symlink and rollback tested by an operator.
MODE="${1:---prepare}"
SOURCE="${HOME}/lumen-staging"
TARGET="${HOME}/lumen.nopuna.fr"
RELEASES="${HOME}/lumen-releases"
LOCK="${HOME}/.lumen-auto-release.lock"
LOG_PREFIX="[lumen-release]"
case "$MODE" in --prepare|--activate|--rollback) ;; *) echo "Usage: $0 --prepare|--activate|--rollback SHA" >&2; exit 2;; esac
for cmd in git curl python3 flock mktemp install readlink; do
 command -v "$cmd" >/dev/null || { echo "Missing dependency: $cmd" >&2; exit 1; }
done
mkdir -p "$RELEASES"
exec 9>"$LOCK"
flock -n 9 || { echo "Already running"; exit 0; }
cd "$SOURCE"
[[ -d .git && "$(git branch --show-current)" == "main" ]] || { echo "Expected main checkout"; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "Dirty checkout; refusing"; exit 1; }
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/lumen_github_pull -o IdentitiesOnly=yes -o BatchMode=yes"
if [[ "$MODE" == "--rollback" ]]; then
 SHA="${2:-}"
 [[ "$SHA" =~ ^[0-9a-f]{40}$ && -d "$RELEASES/$SHA" ]] || { echo "Unknown rollback release SHA"; exit 1; }
else
 git fetch --quiet origin main
 git merge --ff-only origin/main
 SHA="$(git rev-parse HEAD)"
 [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
 # A successful PR workflow is NOT a proof that the merge commit passed CI.
 # A public GitHub API request fails closed on network/rate-limit errors.
 LUMEN_SHA="$SHA" python3 - <<'PY'
import json,os,sys,urllib.request
sha=os.environ["LUMEN_SHA"]
url="https://api.github.com/repos/Anuponk/lumen/actions/workflows/quality.yml/runs?branch=main&event=push&per_page=100"
request=urllib.request.Request(url,headers={"Accept":"application/vnd.github+json","User-Agent":"lumen-o2switch-deployer"})
try:
    with urllib.request.urlopen(request,timeout=20) as response:
        data=json.load(response)
except Exception as exc:
    sys.exit("Cannot verify CI: "+str(exc))
runs=[r for r in data.get("workflow_runs",[]) if r.get("head_sha")==sha and r.get("event")=="push" and r.get("head_branch")=="main"]
if not runs or not any(r.get("status")=="completed" and r.get("conclusion")=="success" for r in runs):
    sys.exit("CI is not green for exact main push SHA "+sha)
print("GitHub quality gate passed for",sha)
PY
fi
if [[ "$MODE" != "--rollback" ]]; then
 RELEASE="$RELEASES/$SHA"
 if [[ ! -d "$RELEASE" ]]; then
  TMP="$(mktemp -d "$RELEASES/.staging.XXXXXXXX")"
  trap 'rm -rf "$TMP"' EXIT
  for asset in index.html sw.js manifest.webmanifest icon.svg icon-maskable.svg; do
    [[ -s "$asset" ]] || { echo "Missing $asset"; exit 1; }
    install -m 644 "$asset" "$TMP/$asset"
  done
  for dir in src content; do
    [[ -d "$dir" ]] || { echo "Missing $dir"; exit 1; }
    cp -R "$dir" "$TMP/$dir"
  done
  printf '%s\n' "$SHA" > "$TMP/.lumen-release-sha"
  find "$TMP" -type d -exec chmod 755 {} +
  find "$TMP" -type f -exec chmod 644 {} +
  mv "$TMP" "$RELEASE"
  trap - EXIT
 fi
fi
if [[ "$MODE" == "--prepare" ]]; then
 echo "$LOG_PREFIX Prepared $SHA; no live files modified"
 exit 0
fi
# Atomic activation requires an explicitly bootstrapped document-root symlink.
# Never delete/rename an existing physical docroot in an unattended task.
[[ -L "$TARGET" ]] || { echo "Refusing activation: docroot is not a symlink. Manual migration/rollback test required."; exit 1; }
CURRENT="$(readlink -f "$TARGET")"
case "$CURRENT" in "$RELEASES/"*) ;; *) echo "Docroot points outside managed releases"; exit 1;; esac
if [[ "$CURRENT" == "$RELEASES/$SHA" ]]; then
 echo "$LOG_PREFIX Already live $SHA"; exit 0
fi
ln -s "$RELEASES/$SHA" "$TARGET.next.$$"
mv -Tf "$TARGET.next.$$" "$TARGET"
# Lightweight post-activation smoke test. Revert symlink on an HTTP failure.
if ! curl -fsS --retry 2 --connect-timeout 5 --max-time 20 "https://lumen.nopuna.fr/?release=$SHA" | grep -q 'src/'; then
  echo "HTTP smoke test failed. Restoring previous release $CURRENT" >&2
  ln -s "$CURRENT" "$TARGET.rollback.$"
  mv -Tf "$TARGET.rollback.$" "$TARGET"
  exit 1
fi
echo "$LOG_PREFIX Activated $SHA (previous: $CURRENT)"
# Keep previous releases. Rollback: bash script --rollback <known 40-char SHA>
