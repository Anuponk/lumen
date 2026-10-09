#!/usr/bin/env bash
set -Eeuo pipefail

# Manual pilot only. Do NOT schedule this command as a cron until the CI gate
# and release/rollback mechanism are implemented and validated.
SOURCE="${HOME}/lumen-staging"
TARGET="${HOME}/lumen.nopuna.fr"
LOCK="${HOME}/.lumen-pilot-publish.lock"

if ! mkdir "$LOCK" 2>/dev/null; then
  echo "A Lumen publication is already running"; exit 1
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT
[[ -d "$SOURCE/.git" && -d "$TARGET" && ! -L "$TARGET" ]] || {
  echo "Missing checkout or document root"; exit 1;
}
cd "$SOURCE"
[[ "$(git branch --show-current)" == main ]] || {
  echo "Refusing to publish a non-main branch"; exit 1;
}
[[ -z "$(git status --porcelain)" ]] || {
  echo "Uncommitted changes, publication refused"; exit 1;
}
for path in index.html sw.js manifest.webmanifest icon.svg icon-maskable.svg; do
  [[ -s "$path" ]] || { echo "Missing $path"; exit 1; }
done
for path in src content; do
  [[ -d "$path" ]] || { echo "Missing $path"; exit 1; }
done

# Sanity checks; the full quality gate MUST pass before a later production rollout.
node --version >/dev/null || { echo "Node missing; run quality gate in GitHub CI"; exit 1; }
node scripts/quality-gate.mjs

# Publish explicit public assets only; exclude .git, docs, scripts and supabase.
for dir in src content; do
  mkdir -p "$TARGET/$dir"
  cp -R "$SOURCE/$dir/." "$TARGET/$dir/"
done
for path in index.html sw.js manifest.webmanifest icon.svg icon-maskable.svg; do
  install -m 644 "$SOURCE/$path" "$TARGET/$path"
done
find "$TARGET/src" "$TARGET/content" -type d -exec chmod 755 {} +
find "$TARGET/src" "$TARGET/content" -type f -exec chmod 644 {} +
printf 'Lumen pilot published commit %s\n' "$(git rev-parse --short HEAD)"
