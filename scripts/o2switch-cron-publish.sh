#!/usr/bin/env bash
set -Eeuo pipefail
# Cron-friendly static publisher. No docroot symlink or Node required.
SOURCE="${HOME}/lumen-staging"
TARGET="${HOME}/lumen.nopuna.fr"
RELEASES="${HOME}/lumen-releases"
BACKUPS="${HOME}/lumen-deploy-backups"
LOCK="${HOME}/.lumen-cron-publish.lock"
MODE="${1:---deploy}"
[[ "$MODE" == "--deploy" || "$MODE" == "--dry-run" ]] || { echo "Usage: $0 [--deploy|--dry-run]"; exit 2; }
for cmd in git python3 flock cp tar mktemp curl; do command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 1; }; done
exec 9>"$LOCK"
flock -n 9 || { echo "Another Lumen publish is running"; exit 0; }
[[ -d "$TARGET" && ! -L "$TARGET" && -d "$SOURCE/.git" ]] || { echo "Invalid checkout or public directory"; exit 1; }
cd "$SOURCE"
[[ "$(git branch --show-current)" == "main" && -z "$(git status --porcelain)" ]] || { echo "Checkout must be a clean main"; exit 1; }
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/lumen_github_pull -o IdentitiesOnly=yes -o BatchMode=yes"
git fetch --quiet origin main
git merge --ff-only origin/main
SHA="$(git rev-parse HEAD)"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
# A matching public release has already passed this publish process.
# Do not poll GitHub every minute when no new deployment is needed.
if [[ -f "$TARGET/.lumen-release-sha" && "$(cat "$TARGET/.lumen-release-sha")" == "$SHA" ]]; then
 echo "Already deployed $SHA"; exit 0
fi
# The anonymous GitHub API has a small hourly quota. On a new commit,
# check CI at most every five minutes; a pending result never authorizes release.
CI_CHECK_DIR="${HOME}/lumen-private"
CI_CHECK_MARKER="$CI_CHECK_DIR/ci-check-$SHA"
mkdir -p "$CI_CHECK_DIR"
if [[ -f "$CI_CHECK_MARKER" ]]; then
 last_check="$(stat -c %Y "$CI_CHECK_MARKER")"
 now="$(date +%s)"
 if (( now - last_check < 300 )); then
  echo "Waiting before retrying CI verification for $SHA"; exit 75
 fi
fi
touch "$CI_CHECK_MARKER"
# Publish only a successful main-workflow revision that is an ancestor of the
# fetched main HEAD. If the newest commits have not been validated yet, publish
# the newest verified ancestor; never publish a failed or unverified commit.
# This prevents rapid successive merges from indefinitely blocking releases.
VALIDATED_CANDIDATES="$(python3 - <<'PY'
import json,sys,urllib.request
url="https://api.github.com/repos/Anuponk/lumen/actions/workflows/quality.yml/runs?branch=main&per_page=100"
request=urllib.request.Request(url,headers={"Accept":"application/vnd.github+json","User-Agent":"lumen-o2switch-publisher"})
try:
    with urllib.request.urlopen(request,timeout=20) as response:
        runs=json.load(response)["workflow_runs"]
except Exception as e:
    sys.exit("GitHub CI verification failed: "+str(e))
for run in runs:
    sha=run.get("head_sha","")
    if (len(sha)==40 and all(c in "0123456789abcdef" for c in sha.lower())
        and run.get("status")=="completed" and run.get("conclusion")=="success"
        and run.get("event") in ("push","workflow_dispatch","schedule")
        and run.get("head_branch")=="main"):
        print(sha)
PY
)"
MAIN_SHA="$SHA"
DEPLOYED_SHA="$(cat "$TARGET/.lumen-release-sha" 2>/dev/null || true)"
SHA=""
while IFS= read -r candidate; do
 [[ -n "$candidate" ]] || continue
 git cat-file -e "$candidate^{commit}" 2>/dev/null || continue
 git merge-base --is-ancestor "$candidate" "$MAIN_SHA" || continue
 if [[ "$DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]] && git cat-file -e "$DEPLOYED_SHA^{commit}" 2>/dev/null; then
   if [[ "$candidate" == "$DEPLOYED_SHA" ]] || git merge-base --is-ancestor "$candidate" "$DEPLOYED_SHA"; then
     continue
   fi
 fi
 if [[ -z "$SHA" ]] || git merge-base --is-ancestor "$SHA" "$candidate"; then SHA="$candidate"; fi
done <<< "$VALIDATED_CANDIDATES"
if [[ -z "$SHA" ]]; then
 if [[ "$DEPLOYED_SHA" == "$MAIN_SHA" ]]; then echo "Already deployed $MAIN_SHA"; exit 0; fi
 echo "No newer verified main commit available yet; latest main $MAIN_SHA" 
 exit 75
fi
echo "CI verified revision $SHA (latest main $MAIN_SHA)"
if [[ -f "$TARGET/.lumen-release-sha" && "$(cat "$TARGET/.lumen-release-sha")" == "$SHA" ]]; then
 echo "Already deployed $SHA"; exit 0
fi
mkdir -p "$RELEASES" "$BACKUPS"
RELEASE="$RELEASES/$SHA"
if [[ ! -d "$RELEASE" ]]; then
 TMP="$(mktemp -d "$RELEASES/.staging.XXXXXXXX")"
 trap 'rm -rf "$TMP"' EXIT
 for asset in index.html sw.js manifest.webmanifest icon.svg icon-maskable.svg; do
   [[ -s "$asset" ]] || { echo "Missing asset $asset"; exit 1; }
   git show "$SHA:$asset" > "$TMP/$asset"
 done
 for dir in src content; do
   [[ -d "$dir" ]] || { echo "Missing $dir"; exit 1; }
   git archive "$SHA" "$dir" | tar -xf - -C "$TMP"
 done
 printf '%s\n' "$SHA" > "$TMP/.lumen-release-sha"
 find "$TMP" -type d -exec chmod 755 {} +
 find "$TMP" -type f -exec chmod 644 {} +
 mv "$TMP" "$RELEASE"
 trap - EXIT
fi
[[ -s "$RELEASE/index.html" && -s "$RELEASE/sw.js" ]] || { echo "Invalid release"; exit 1; }
if [[ "$MODE" == "--dry-run" ]]; then
 echo "DRY RUN: ready to deploy $SHA; public files unchanged"; exit 0
fi
# Backup only the public site; player data live in browser storage/Supabase.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$BACKUPS/before-$STAMP-$SHA.tar.gz"
tar -czf "$BACKUP" -C "$TARGET" .
tar -tzf "$BACKUP" >/dev/null
# A failed copy/HTTP check restores the entire old static docroot.
restore() {
 rc=$?
 trap - ERR
 echo "Publish failed ($rc), restoring previous static files" >&2
 find "$TARGET" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
 tar -xzf "$BACKUP" -C "$TARGET"
 exit "$rc"
}
trap restore ERR
# Keep the current document root so cPanel owner/group settings remain intact.
# Do not delete files outside Lumen's managed static assets.
for dir in src content; do
 rm -rf -- "$TARGET/$dir"
 cp -R "$RELEASE/$dir" "$TARGET/$dir"
done
for file in index.html sw.js manifest.webmanifest icon.svg icon-maskable.svg; do
 cp -p "$RELEASE/$file" "$TARGET/$file"
done
rm -f -- "$TARGET/transfer.html"
printf '%s\n' "$SHA" > "$TARGET/.lumen-release-sha"
# Verify the server answers with the expected application HTML.
RESPONSE="$(curl -fsS --connect-timeout 5 --max-time 20 "https://lumen.nopuna.fr/?release=$SHA")"
[[ "$RESPONSE" == *'src/'* ]] || { echo "HTTP smoke check failed" >&2; false; }
trap - ERR
echo "Lumen deployed $SHA; backup $BACKUP"
