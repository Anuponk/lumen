#!/usr/bin/env bash
set -euo pipefail

package="fr.nopuna.lumen.debug"
activity="com.google.androidbrowserhelper.trusted.LauncherActivity"
logfile="android-startup-logcat.txt"

adb install -r app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -W -n "${package}/${activity}"
sleep 12
adb logcat -d -v time > "$logfile"

if grep -E -q 'FATAL EXCEPTION|Process: fr\.nopuna\.lumen\.debug' "$logfile"; then
  echo 'Potential Android runtime exception detected. Relevant Logcat:'
  grep -E -A 35 'FATAL EXCEPTION|Process: fr\.nopuna\.lumen\.debug' "$logfile" | head -100 || true
  exit 1
fi

echo 'No fatal exception observed during startup smoke.'
echo 'This does not certify page rendering, Custom Tabs fallback or physical-device behavior.'
