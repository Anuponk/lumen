#!/usr/bin/env bash
set -Eeuo pipefail
# Cron-friendly static publisher. No docroot symlink or Node required.
SOURCE="${HOME}/lumen-staging"
TARGET="${HOME}/lumen.nopuna.fr"
RELEASES="${HOME}/lumen-releases"
BACKUPS="${HOME}/lumen-deploy-backups"
LOCK="${HOME}/.lumen-cron-publish.lock"
MODE="${1:---deploy}"
REQUESTED_SHA="${2:-}"
# Closed list: historical revisions may predate these public pages.
PUBLIC_PAGES=(mentions-legales.html confidentialite.html supprimer-compte.html)
[[ $# -le 2 && ( "$MODE" == "--deploy" || "$MODE" == "--dry-run" ) ]] || { echo "Usage: $0 [--deploy|--dry-run] [SHA]"; exit 2; }
[[ -z "$REQUESTED_SHA" || "$REQUESTED_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid requested SHA" >&2; exit 2; }
for cmd in git python3 flock cp tar mktemp curl cmp; do command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 1; }; done
exec 9>"$LOCK"
if [[ -n "$REQUESTED_SHA" ]]; then
 flock -w 120 9 || { echo "Publish lock timed out" >&2; exit 1; }
else
 flock -n 9 || { echo "Another Lumen publish is running"; exit 0; }
fi
[[ -d "$TARGET" && ! -L "$TARGET" && -d "$SOURCE/.git" ]] || { echo "Invalid checkout or public directory"; exit 1; }
cd "$SOURCE"
[[ "$(git branch --show-current)" == "main" && -z "$(git status --porcelain)" ]] || { echo "Checkout must be a clean main"; exit 1; }
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/lumen_github_pull -o IdentitiesOnly=yes -o BatchMode=yes"
git fetch --quiet origin main
git merge --ff-only origin/main
SHA="$(git rev-parse HEAD)"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
if [[ -n "$REQUESTED_SHA" ]]; then
 git merge-base --is-ancestor "$REQUESTED_SHA" "$SHA" || { echo "Requested commit is not on main" >&2; exit 1; }
 SHA="$REQUESTED_SHA"
 if [[ -f "$TARGET/.lumen-release-sha" ]]; then
  deployed="$(cat "$TARGET/.lumen-release-sha")"
  if [[ "$deployed" != "$SHA" && "$deployed" =~ ^[0-9a-f]{40}$ ]]; then
   git merge-base --is-ancestor "$deployed" "$SHA" || { echo "Refusing to replace a newer or divergent deployment" >&2; exit 1; }
  fi
 fi
fi
# A matching public release has already passed this publish process.
# Do not poll GitHub every minute when no new deployment is needed.
if [[ -f "$TARGET/.lumen-release-sha" && "$(cat "$TARGET/.lumen-release-sha")" == "$SHA" ]]; then
 echo "Already deployed $SHA"; exit 0
fi
# The anonymous GitHub API has a small hourly quota. On a new commit,
# check CI at most every five minutes; a pending result never authorizes release.
if [[ -n "$REQUESTED_SHA" ]]; then
 # Event-driven deployment: independently verify the exact target, with no
 # polling cooldown or fallback to an older successful revision.
 python3 "$SOURCE/scripts/o2switch-ci-status.py" "$SHA"
else
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
 # The fallback cron must enforce the same gates as the event-driven path.
 if ! python3 "$SOURCE/scripts/o2switch-ci-status.py" "$candidate"; then continue; fi
 if [[ -z "$SHA" ]] || git merge-base --is-ancestor "$SHA" "$candidate"; then SHA="$candidate"; fi
done <<< "$VALIDATED_CANDIDATES"
if [[ -z "$SHA" ]]; then
 if [[ "$DEPLOYED_SHA" == "$MAIN_SHA" ]]; then echo "Already deployed $MAIN_SHA"; exit 0; fi
 echo "No newer verified main commit available yet; latest main $MAIN_SHA" 
 exit 75
fi
echo "CI verified revision $SHA (latest main $MAIN_SHA)"
fi
if [[ -f "$TARGET/.lumen-release-sha" && "$(cat "$TARGET/.lumen-release-sha")" == "$SHA" ]]; then
 echo "Already deployed $SHA"; exit 0
fi
mkdir -p "$RELEASES" "$BACKUPS"
RELEASE="$RELEASES/$SHA"
if [[ ! -d "$RELEASE" ]]; then
 TMP="$(mktemp -d "$RELEASES/.staging.XXXXXXXX")"
 trap 'rm -rf "$TMP"' EXIT
 for asset in index.html sw.js manifest.webmanifest icon.svg icon-maskable.svg; do
   git cat-file -e "$SHA:$asset" || { echo "Missing verified asset $asset"; exit 1; }
   git show "$SHA:$asset" > "$TMP/$asset"
 done
 for page in "${PUBLIC_PAGES[@]}"; do
   if git cat-file -e "$SHA:$page" 2>/dev/null; then
     git show "$SHA:$page" > "$TMP/$page"
   fi
 done
 for dir in src content; do
   git cat-file -e "$SHA:$dir" || { echo "Missing verified directory $dir"; exit 1; }
   git archive "$SHA" "$dir" | tar -xf - -C "$TMP"
 done
 # Stamp the immutable release version in the staged HTML only.
 LUMEN_SHA="$SHA" LUMEN_TARGET="$TMP" python3 - <<'PY'
import json,os,re,subprocess,pathlib
sha=os.environ["LUMEN_SHA"]
target=pathlib.Path(os.environ["LUMEN_TARGET"])
count=int(subprocess.check_output(["git","rev-list","--first-parent","--count",sha],universal_newlines=True).strip())
version=f"1.11.1+{count}"
html=target.joinpath("index.html").read_text()
html,n=re.subn(r'(<meta name="lumen-build" content=")[^"]*(")',lambda m:m.group(1)+version+" · "+sha[:7]+m.group(2),html,count=1)
if n!=1: raise SystemExit("Missing build meta")
target.joinpath("index.html").write_text(html)
target.joinpath("build-info.json").write_text(json.dumps({"version":version,"sha":sha})+"\n")
PY
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
 tar --same-permissions -xzf "$BACKUP" -C "$TARGET"
 exit "$rc"
}
trap restore ERR
# Keep the current document root so cPanel owner/group settings remain intact.
# Do not delete files outside Lumen's managed static assets.
for dir in src content; do
 rm -rf -- "$TARGET/$dir"
 # The HTTPS worker has umask 077 for private receipts and logs. Preserve the
 # explicitly public 755/644 release modes rather than inheriting that mask.
 cp -Rp "$RELEASE/$dir" "$TARGET/$dir"
done
for file in index.html build-info.json sw.js manifest.webmanifest icon.svg icon-maskable.svg; do
 cp -p "$RELEASE/$file" "$TARGET/$file"
done
for page in "${PUBLIC_PAGES[@]}"; do
 if [[ -f "$RELEASE/$page" ]]; then
  cp -p "$RELEASE/$page" "$TARGET/$page"
 else
  rm -f -- "$TARGET/$page"
 fi
done
rm -f -- "$TARGET/transfer.html"
printf '%s\n' "$SHA" > "$TARGET/.lumen-release-sha"
# Verify the server answers with the expected application HTML.
RESPONSE="$(curl -fsS --connect-timeout 5 --max-time 20 "https://lumen.nopuna.fr/?release=$SHA")"
[[ "$RESPONSE" == *'src/'* ]] || { echo "HTTP smoke check failed" >&2; false; }
BUILD_INFO="$(curl -fsS --connect-timeout 5 --max-time 20 "https://lumen.nopuna.fr/build-info.json?release=$SHA")"
printf '%s' "$BUILD_INFO" | python3 -c 'import json,sys; assert json.load(sys.stdin)["sha"] == sys.argv[1], "Published SHA mismatch"' "$SHA"
# HTML and the marker can be readable while every module is forbidden (403).
# Verify the actual public entry points before declaring the job successful.
for asset in src/main.js src/ui/game-screen.js src/ui/styles.css; do
 curl -fsS --connect-timeout 5 --max-time 20 "https://lumen.nopuna.fr/$asset?release=$SHA" | cmp -s - "$RELEASE/$asset"
done
for page in "${PUBLIC_PAGES[@]}"; do
 if [[ -f "$RELEASE/$page" ]]; then
  curl -fsS --connect-timeout 5 --max-time 20 "https://lumen.nopuna.fr/$page?release=$SHA" | cmp -s - "$RELEASE/$page"
 fi
done
trap - ERR
echo "Lumen deployed $SHA; backup $BACKUP"
