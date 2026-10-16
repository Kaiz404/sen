#!/usr/bin/env bash
# Runs every unattended Maestro flow plus the gallery screenshots on the phone in one `maestro test`, then
# prints a pass or fail row per flow. Exits non-zero on any failure.
# Usage: scripts/verify-device.sh [--only <glob>]   (the glob matches flow names, such as 'auth-*')
set -euo pipefail
cd "$(dirname "$0")/.."

only=""
while [ $# -gt 0 ]; do
  case "$1" in
    --only)
      only="${2:?--only needs a glob}"
      shift 2
      ;;
    *)
      echo "usage: scripts/verify-device.sh [--only <glob>]" >&2
      exit 2
      ;;
  esac
done

serial="$(scripts/phone.sh | tail -1)"
. scripts/device-env.sh
export ANDROID_SERIAL="$serial"
METRO=http://localhost:8081
DEV_CLIENT="sen://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"

metro_up() { [ "$(curl -s --max-time 2 "$METRO/status" || true)" = packager-status:running ]; }
metro_root() {
  local pid
  pid="$(ss -ltnpH 'sport = :8081' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)"
  [ -n "$pid" ] && readlink "/proc/$pid/cwd"
}

# Another worktree's Metro on 8081 would put its code on the phone, so refuse rather than share it.
if metro_up; then
  root="$(metro_root || true)"
  [ "$root" = "$SEN_ROOT" ] || {
    echo "verify-device: Metro on 8081 serves ${root:-an unknown folder}, not $SEN_ROOT. Stop it first." >&2
    exit 1
  }
else
  mkdir -p .expo
  setsid nohup npx expo start --localhost >.expo/metro.log 2>&1 </dev/null &
  for _ in $(seq 1 120); do
    metro_up && break
    sleep 1
  done
  metro_up || {
    echo "verify-device: Metro did not start. See .expo/metro.log." >&2
    exit 1
  }
  echo "verify-device: started Metro. It keeps running, and its log is .expo/metro.log." >&2
fi

flows=()
for f in .maestro/*.yaml; do
  name="$(basename "$f" .yaml)"
  if [ -n "$only" ]; then
    # shellcheck disable=SC2053
    [[ $name == $only ]] && flows+=("$f")
  elif ! grep -qx '  - needs-human' "$f"; then
    flows+=("$f")
  fi
done
[ ${#flows[@]} -gt 0 ] || {
  echo "verify-device: no flow in .maestro matches '$only'." >&2
  exit 2
}

adb shell am start -a android.intent.action.VIEW -d "$DEV_CLIENT" com.kaiz404.sen >/dev/null 2>&1

case "$(adb shell pm list packages dev.mobile.maestro 2>&1)" in
  *dev.mobile.maestro*) ;;
  *) echo "verify-device: Maestro installs its two driver apps first. Watch the phone and tap Install on each Install via USB sheet within 10 s." >&2 ;;
esac

run="shots/runs/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$run"
set +e
# The driver apps install once. Each install waits for a tap on Install via USB, so Maestro must not reinstall them.
maestro --device "$serial" test --no-reinstall-driver --format junit --output "$run/report.xml" --test-output-dir "$run" "${flows[@]}" 2>&1 |
  tee "$run/maestro.log" | grep --line-buffered -v '^[[:space:]]*at \|stack trace was'
status=${PIPESTATUS[0]}
set -e

# Flows leave the override on their last outcome. Hand the phone back to the real prompt.
adb shell am start -a android.intent.action.VIEW -d "sen://dev/states?auth=real" com.kaiz404.sen >/dev/null 2>&1 || true

shots="$(find "$run" -name '*.png' | wc -l)"
python3 -I - "$run/report.xml" "${flows[@]}" <<'EOF' || status=1
import os, sys
import xml.etree.ElementTree as ET

report, flows = sys.argv[1], [os.path.basename(f)[:-5] for f in sys.argv[2:]]
results = {}
if os.path.exists(report):
    for case in ET.parse(report).iter("testcase"):
        failed = case.find("failure") is not None or case.find("error") is not None
        results[case.get("name")] = ("FAIL" if failed else "pass", case.get("time") or "")
width = max(len(f) for f in flows)
print(f"\n{'flow'.ljust(width)}  result  seconds")
bad = False
for flow in flows:
    result, secs = results.get(flow, ("not run", ""))
    bad |= result != "pass"
    print(f"{flow.ljust(width)}  {result.ljust(6)}  {secs}")
sys.exit(1 if bad else 0)
EOF
if grep -q INSTALL_FAILED_USER_RESTRICTED "$run/maestro.log"; then
  echo "verify-device: the phone cancelled Maestro's driver install. Accept the install prompts on the phone, then rerun." >&2
fi
echo "shots: $shots"
echo "run: $run"
exit "$status"
