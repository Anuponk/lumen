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
PUBLIC_PAGES=(mentions-legales.html confidentialite.html cgv.html supprimer-compte.html legal-notice.html privacy-policy.html terms-of-sale.html delete-account.html decouvrir.html discover.html descubrir.html comment-jouer.html how-to-play.html como-jugar.html apprendre-constellations.html learn-constellations.html constellations/index.html constellations/en.html aviso-legal.html politica-privacidad.html condiciones-venta.html eliminar-cuenta.html aprender-constelaciones.html constellations/es.html manifest-en.webmanifest manifest-es.webmanifest robots.txt sitemap.xml)
[[ $# -le 2 && ( "$MODE" == "--deploy" || "$MODE" == "--dry-run" ) ]] || { echo "Usage: $0 [--deploy|--dry-run] [SHA]"; exit 2; }
[[ -z "$REQUESTED_SHA" || "$REQUESTED_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid requested SHA" >&2; exit 2; }
for cmd in git python3 flock cp tar mktemp curl cmp install; do command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 1; }; done
exec 9>"$LOCK"
if [[ -n "$REQUESTED_SHA" ]]; then
 flock -w 120 9 || { echo "Publish lock timed out" >&2; exit 1; }
else
 flock -n 9 || { echo "Another Lumen publish is running"; exit 0; }
fi
[[ -d "$TARGET" && ! -L "$TARGET" && -d "$SOURCE/.git" ]] || { echo "Invalid checkout or public directory"; exit 1; }
cd "$SOURCE"
# #742: a private repository needs an authenticated, read-only GitHub API token.
# It lives outside the repository and the docroot; it is never printed.
GITHUB_TOKEN_FILE="${HOME}/.config/lumen/github-token"
if [[ -z "${GH_TOKEN:-}" && ( -e "$GITHUB_TOKEN_FILE" || -L "$GITHUB_TOKEN_FILE" ) ]]; then
 [[ -f "$GITHUB_TOKEN_FILE" && ! -L "$GITHUB_TOKEN_FILE" && "$(stat -c %a "$GITHUB_TOKEN_FILE")" == 600 ]] || { echo "GitHub token file must be a regular file with mode 600" >&2; exit 1; }
 GH_TOKEN="$(tr -d '[:space:]' < "$GITHUB_TOKEN_FILE")"
 [[ -n "$GH_TOKEN" ]] || { echo "GitHub token file is empty" >&2; exit 1; }
 export GH_TOKEN
fi
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
# The GitHub API has an hourly quota (small when anonymous). On a new commit,
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
import json,os,re,sys,urllib.request
api=os.environ.get("LUMEN_GITHUB_API","https://api.github.com")
# Only the real API, or a loopback fixture in tests, may ever receive the token.
if api!="https://api.github.com" and not re.fullmatch(r"http://127\.0\.0\.1:[0-9]+",api):
    sys.exit("Refusing GitHub API override")
url=api+"/repos/Anuponk/lumen/actions/workflows/quality.yml/runs?branch=main&per_page=100"
headers={"Accept":"application/vnd.github+json","User-Agent":"lumen-o2switch-publisher"}
if os.environ.get("GH_TOKEN"):
    headers["Authorization"]="Bearer "+os.environ["GH_TOKEN"]
request=urllib.request.Request(url,headers=headers)
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
     mkdir -p -- "$(dirname "$TMP/$page")"
     git show "$SHA:$page" > "$TMP/$page"
   fi
 done
 # Android Digital Asset Links for the exact app certificate, with no secrets.
 if git cat-file -e "$SHA:.well-known/assetlinks.json" 2>/dev/null; then
   mkdir -p "$TMP/.well-known"
   git show "$SHA:.well-known/assetlinks.json" > "$TMP/.well-known/assetlinks.json"
 fi
 for dir in src content; do
   git cat-file -e "$SHA:$dir" || { echo "Missing verified directory $dir"; exit 1; }
   git archive "$SHA" "$dir" | tar -xf - -C "$TMP"
 done
 # #1057: public mini-puzzle pages; older revisions omit them.
 for dir in mini; do
   if git cat-file -e "$SHA:$dir" 2>/dev/null; then git archive "$SHA" "$dir" | tar -xf - -C "$TMP"; fi
 done
 # Stamp the immutable release version in the staged HTML only.
 # Narrow administration rewrite, independent of the root hosting configuration.
 if git cat-file -e "$SHA:admin/.htaccess" 2>/dev/null; then
   mkdir -p "$TMP/admin"
   git show "$SHA:admin/.htaccess" > "$TMP/admin/.htaccess"
 fi
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
# #1057: the public mini-puzzle pages follow the release (absent in older ones).
[[ ! -L "$TARGET/mini" ]] || { echo "Refusing symlinked mini" >&2; false; }
rm -rf -- "$TARGET/mini"
if [[ -d "$RELEASE/mini" ]]; then cp -Rp "$RELEASE/mini" "$TARGET/mini"; fi
for file in index.html build-info.json sw.js manifest.webmanifest icon.svg icon-maskable.svg; do
 cp -p "$RELEASE/$file" "$TARGET/$file"
done
if [[ -f "$RELEASE/admin/.htaccess" ]]; then
 [[ ! -L "$TARGET/admin" && ! -L "$TARGET/admin/.htaccess" ]] || { echo "Refusing symlinked admin route" >&2; false; }
 mkdir -p "$TARGET/admin"
 chmod 755 "$TARGET/admin"
 cp -p "$RELEASE/admin/.htaccess" "$TARGET/admin/.htaccess"
fi
for page in "${PUBLIC_PAGES[@]}"; do
 if [[ "$page" == */* ]]; then
  page_dir="${page%/*}"
  [[ ! -L "$TARGET/$page_dir" && ! -L "$TARGET/$page" ]] || { echo "Refusing symlinked public page $page" >&2; false; }
 fi
 if [[ -f "$RELEASE/$page" ]]; then
  if [[ "$page" == */* ]]; then install -d -m 755 "$TARGET/$page_dir"; fi
  cp -p "$RELEASE/$page" "$TARGET/$page"
 else
  rm -f -- "$TARGET/$page"
  if [[ "$page" == */* && -d "$TARGET/$page_dir" ]]; then rmdir -- "$TARGET/$page_dir" 2>/dev/null || true; fi
 fi
done
# Publish DAL without deleting other applications' existing associations.
if [[ -f "$RELEASE/.well-known/assetlinks.json" ]]; then
 [[ ! -L "$TARGET/.well-known" ]] || { echo "Refusing symlinked .well-known" >&2; false; }
 python3 "$SOURCE/scripts/merge-assetlinks.py" \
   "$TARGET/.well-known/assetlinks.json" \
   "$RELEASE/.well-known/assetlinks.json" \
   "$TARGET/.well-known/assetlinks.json"
fi
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
if [[ -f "$RELEASE/admin/.htaccess" ]]; then
 curl -fsS --connect-timeout 5 --max-time 20 "https://lumen.nopuna.fr/admin/analytics?release=$SHA" | cmp -s - "$RELEASE/index.html"
fi
if [[ -f "$RELEASE/mini/index.html" ]]; then
 curl -fsSL --max-redirs 2 --connect-timeout 5 --max-time 20 "https://lumen.nopuna.fr/mini/?release=$SHA" | cmp -s - "$RELEASE/mini/index.html"
fi
for page in "${PUBLIC_PAGES[@]}"; do
 if [[ -f "$RELEASE/$page" ]]; then
  if [[ "$page" == */index.html ]]; then
   public_url="${page%/index.html}"
   curl -fsSL --max-redirs 2 --connect-timeout 5 --max-time 20 "https://lumen.nopuna.fr/$public_url?release=$SHA" | cmp -s - "$RELEASE/$page"
  else
   curl -fsS --connect-timeout 5 --max-time 20 "https://lumen.nopuna.fr/$page?release=$SHA" | cmp -s - "$RELEASE/$page"
  fi
 fi
done
# A broken/forbidden DAL must roll back the publication, not strand a CCT fallback.
if [[ -f "$RELEASE/.well-known/assetlinks.json" ]]; then
 curl -fsS --connect-timeout 5 --max-time 20 \
   "https://lumen.nopuna.fr/.well-known/assetlinks.json?release=$SHA" | \
   python3 -c 'import json,sys
desired=json.load(open(sys.argv[1]))
published=json.load(sys.stdin)
assert isinstance(published,list)
for item in desired:
 t=item["target"]
 assert any(
  p.get("relation")==item["relation"] and p.get("target",{}).get("namespace")==t["namespace"]
  and p["target"].get("package_name")==t["package_name"]
  and set(t["sha256_cert_fingerprints"]).issubset(set(p["target"].get("sha256_cert_fingerprints",[])))
  for p in published
 ), "Published DAL missing required app/certificate"' "$RELEASE/.well-known/assetlinks.json"
fi
trap - ERR
echo "Lumen deployed $SHA; backup $BACKUP"
