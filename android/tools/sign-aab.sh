#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || ! -f $1 || -e $2 ]]; then
  echo 'Usage: sign-aab.sh <unsigned.aab> <new-output.aab>' >&2
  exit 2
fi
for variable in LUMEN_UPLOAD_STORE_BASE64 LUMEN_UPLOAD_STORE_PASSWORD \
  LUMEN_UPLOAD_KEY_ALIAS LUMEN_UPLOAD_KEY_PASSWORD LUMEN_UPLOAD_CERT_SHA256; do
  if [[ -z ${!variable:-} ]]; then
    echo "Missing Android signing setting $variable" >&2
    exit 2
  fi
done

expected=$(printf '%s' "$LUMEN_UPLOAD_CERT_SHA256" | tr -d ':' | tr '[:upper:]' '[:lower:]')
if [[ ! $expected =~ ^[0-9a-f]{64}$ ]]; then
  echo 'Invalid upload certificate SHA-256' >&2
  exit 2
fi

umask 077
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
jar tf "$1" > "$scratch/entries"
if ! grep -Fxq 'base/dex/classes.dex' "$scratch/entries" ||
  grep -Eiq '^META-INF/[^/]+\.(SF|RSA|DSA|EC)$' "$scratch/entries"; then
  echo 'Expected an unsigned Android App Bundle' >&2
  exit 1
fi

printf '%s' "$LUMEN_UPLOAD_STORE_BASE64" | base64 --decode > "$scratch/upload.jks"
unset LUMEN_UPLOAD_STORE_BASE64

if ! keytool -exportcert -keystore "$scratch/upload.jks" -storepass:env LUMEN_UPLOAD_STORE_PASSWORD \
  -alias "$LUMEN_UPLOAD_KEY_ALIAS" > "$scratch/upload.der" 2> /dev/null; then
  echo 'Cannot read the configured upload certificate from the keystore' >&2
  exit 1
fi
read -r from_keystore _ < <(sha256sum "$scratch/upload.der")
if [[ $from_keystore != "$expected" ]]; then
  echo 'The configured key does not match the expected Play upload certificate' >&2
  exit 1
fi

signed="$scratch/signed.aab"
if ! jarsigner -keystore "$scratch/upload.jks" -storepass:env LUMEN_UPLOAD_STORE_PASSWORD \
  -keypass:env LUMEN_UPLOAD_KEY_PASSWORD -signedjar "$signed" "$1" "$LUMEN_UPLOAD_KEY_ALIAS" \
  > /dev/null 2>&1; then
  echo 'AAB signing failed' >&2
  exit 1
fi
unset LUMEN_UPLOAD_STORE_PASSWORD LUMEN_UPLOAD_KEY_PASSWORD LUMEN_UPLOAD_KEY_ALIAS

jarsigner -J-Duser.language=en -J-Duser.country=US -verify "$signed" > "$scratch/verification.txt"
if ! grep -Fxq 'jar verified.' "$scratch/verification.txt"; then
  echo 'AAB signature could not be verified' >&2
  exit 1
fi
signer=$(keytool -printcert -jarfile "$signed" -rfc | openssl x509 -outform der | sha256sum)
if [[ ${signer%% *} != "$expected" ]]; then
  echo 'AAB signer does not match the expected Play upload certificate' >&2
  exit 1
fi
mv -- "$signed" "$2"
echo 'AAB signature and Play upload certificate verified.'
