#!/usr/bin/env bash
# Flings the History list down and back up, then prints Android's frame stats for the flings.
# Start with Sen open on History. FLINGS sets the flings each way (default 12).
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/device-env.sh
PKG=com.kaiz404.sen
read -r width height < <(adb shell wm size | awk -F'[ x]' '/Physical/ { print $3, $4 }')
x=$((width / 2))
low=$((height * 80 / 100))
high=$((height * 25 / 100))
adb shell dumpsys gfxinfo "$PKG" reset >/dev/null
for _ in $(seq "${FLINGS:-12}"); do
  adb shell input swipe "$x" "$low" "$x" "$high" 150
  sleep 0.5
done
for _ in $(seq "${FLINGS:-12}"); do
  adb shell input swipe "$x" "$high" "$x" "$low" 150
  sleep 0.5
done
adb shell dumpsys gfxinfo "$PKG" | tr -d '\r' |
  grep -E '^(Total frames rendered|Janky frames|[0-9]+th percentile|Number Missed Vsync|Number Slow UI thread|Number Frame deadline missed)' |
  sed -n '1,12p'
