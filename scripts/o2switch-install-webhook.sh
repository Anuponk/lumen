#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
SOURCE="$HOME/lumen-staging"
PRIVATE="$HOME/lumen-private"
TARGET="$HOME/lumen.nopuna.fr"
[[ -d "$TARGET" && ! -L "$TARGET" && -d "$SOURCE/.git" ]] || { echo 'Invalid Lumen directories'; exit 1; }
for command in php timeout nohup python3; do command -v "$command" >/dev/null; done
php -l "$SOURCE/scripts/o2switch-deploy-hook.php"
install -d -m 700 "$PRIVATE" "$PRIVATE/deploy-jobs"
install -m 600 "$SOURCE/scripts/o2switch-deploy-hook.php" "$PRIVATE/lumen-deploy-hook.php"
install -m 700 "$SOURCE/scripts/o2switch-webhook-worker.sh" "$PRIVATE/lumen-webhook-worker.sh"
if [[ ! -f "$PRIVATE/deploy-webhook-secret" ]]; then
 python3 -c 'import secrets; print(secrets.token_hex(32))' > "$PRIVATE/deploy-webhook-secret"
fi
chmod 600 "$PRIVATE/deploy-webhook-secret"
python3 - "$PRIVATE/deploy-webhook-secret" <<'PY'
import pathlib,re,sys
assert re.fullmatch(r'[0-9a-f]{64}\n?', pathlib.Path(sys.argv[1]).read_text()), 'Invalid existing webhook secret'
PY
# Retain the old wrapper during migration; both routes use the private handler.
printf '<?php require %s;\n' "\"$PRIVATE/lumen-deploy-hook.php\"" > "$TARGET/lumen-deploy.php"
chmod 644 "$TARGET/lumen-deploy.php"
# Use DirectoryIndex so runners do not request a .php path directly. The
# hosting frontend resets direct PHP requests from GitHub before PHP sees them.
[[ ! -L "$TARGET/lumen-release" ]] || { echo 'Invalid webhook directory'; exit 1; }
install -d -m 755 "$TARGET/lumen-release"
printf '<?php require %s;\n' "\"$PRIVATE/lumen-deploy-hook.php\"" > "$TARGET/lumen-release/index.php"
printf 'DirectoryIndex index.php\n' > "$TARGET/lumen-release/.htaccess"
chmod 644 "$TARGET/lumen-release/index.php" "$TARGET/lumen-release/.htaccess"
echo 'HTTPS receiver installed. Copy the private secret to GitHub using cPanel File Manager; do not paste it in chat.'
echo "Private secret file: $PRIVATE/deploy-webhook-secret"
