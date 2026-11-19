#!/usr/bin/env bash
set -euo pipefail

input=$(realpath "$1")
signer=$(dirname "$0")/sign-aab.sh
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
export LUMEN_UPLOAD_KEY_ALIAS=ci-aab-test
export LUMEN_UPLOAD_STORE_PASSWORD
LUMEN_UPLOAD_STORE_PASSWORD=$(openssl rand -hex 20)
export LUMEN_UPLOAD_KEY_PASSWORD="$LUMEN_UPLOAD_STORE_PASSWORD"
keytool -genkeypair -keystore "$scratch/test.jks" -storetype JKS \
  -storepass:env LUMEN_UPLOAD_STORE_PASSWORD -keypass:env LUMEN_UPLOAD_KEY_PASSWORD \
  -alias "$LUMEN_UPLOAD_KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 1 \
  -dname 'CN=Disposable Android CI test' > /dev/null 2>&1
export LUMEN_UPLOAD_STORE_BASE64
LUMEN_UPLOAD_STORE_BASE64=$(base64 -w 0 "$scratch/test.jks")
fingerprint=$(keytool -exportcert -keystore "$scratch/test.jks" \
  -storepass:env LUMEN_UPLOAD_STORE_PASSWORD -alias "$LUMEN_UPLOAD_KEY_ALIAS" 2> /dev/null | sha256sum)
export LUMEN_UPLOAD_CERT_SHA256="${fingerprint%% *}"

bash "$signer" "$input" "$scratch/signed.aab"
if bash "$signer" "$scratch/signed.aab" "$scratch/resigned.aab" > "$scratch/refusal" 2>&1; then
  echo 'Expected already signed input to be refused' >&2
  exit 1
fi
grep -Fxq 'Expected an unsigned Android App Bundle' "$scratch/refusal"
test ! -e "$scratch/resigned.aab"

if LUMEN_UPLOAD_CERT_SHA256=$(printf '%064d' 0) \
  bash "$signer" "$input" "$scratch/wrong.aab" > "$scratch/refusal" 2>&1; then
  echo 'Expected an incorrect Play certificate to be refused' >&2
  exit 1
fi
grep -Fxq 'The configured key does not match the expected Play upload certificate' "$scratch/refusal"
test ! -e "$scratch/wrong.aab"
echo 'Signing with a disposable key and both refusal paths passed.'
