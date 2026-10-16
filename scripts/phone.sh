#!/usr/bin/env bash
# Gets the phone ready for device flows over Tailscale: connected, awake, Metro reachable, and the current
# arm64 dev build installed. Safe to rerun. Prints the adb serial last.
# `scripts/phone.sh --release` gives the phone its own screen timeout back.
set -euo pipefail
. "$(dirname "$0")/device-env.sh"

PKG=com.kaiz404.sen
APK="$SEN_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/sen"
AWAKE_MS=1800000

die() {
  echo "phone.sh: $*" >&2
  exit 1
}
sh_out() { adb shell "$@" 2>&1 | tr -d '\r'; }

[ -n "$PHONE_ADB" ] || die "No phone set. Put PHONE_ADB=<tailscale ip>:<port> in $SEN_ROOT/.device.env. The port is under Developer options > Wireless debugging."
ip="${PHONE_ADB%:*}"
saved="$STATE_DIR/screen-$ip"
ensure_adb_server

connected() { [ "$(adb -s "$1" get-state 2>/dev/null)" = device ]; }
try_connect() {
  adb connect "$1" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5; do
    connected "$1" && return 0
    sleep 1
  done
  return 1
}

# Wireless debugging picks a new port each time it restarts, and mDNS does not cross Tailscale, so probe for it.
if ! try_connect "$PHONE_ADB"; then
  adb disconnect "$PHONE_ADB" >/dev/null 2>&1 || true
  echo "phone.sh: $PHONE_ADB did not answer. Looking for the Wireless debugging port on $ip." >&2
  found=""
  for port in $(seq 30000 47000 | xargs -P 400 -I{} timeout 1 bash -c "</dev/tcp/$ip/{} && echo {}" 2>/dev/null); do
    if try_connect "$ip:$port"; then
      found="$ip:$port"
      break
    fi
  done
  [ -n "$found" ] || die "No Wireless debugging port answers on $ip. On the phone, check Tailscale is on and Developer options > Wireless debugging is on. If the phone was never paired with this laptop, tap Pair device with pairing code, then run: . scripts/device-env.sh && adb pair $ip:<pairing port> <code>"
  PHONE_ADB="$found"
  if grep -q '^PHONE_ADB=' "$SEN_ROOT/.device.env" 2>/dev/null; then
    sed -i "s/^PHONE_ADB=.*/PHONE_ADB=$PHONE_ADB/" "$SEN_ROOT/.device.env"
  else
    echo "PHONE_ADB=$PHONE_ADB" >>"$SEN_ROOT/.device.env"
  fi
  echo "phone.sh: found $PHONE_ADB and saved it to .device.env." >&2
fi
export ANDROID_SERIAL="$PHONE_ADB"

if [ "${1:-}" = --release ]; then
  if [ -f "$saved" ]; then
    read -r stay timeout <"$saved"
    adb shell settings put global stay_on_while_plugged_in "$stay"
    adb shell settings put system screen_off_timeout "$timeout"
    rm "$saved"
  fi
  echo "$PHONE_ADB"
  exit 0
fi

# Saved once, so a rerun never records the values this script set.
if [ ! -f "$saved" ]; then
  mkdir -p "$STATE_DIR"
  echo "$(sh_out settings get global stay_on_while_plugged_in) $(sh_out settings get system screen_off_timeout)" >"$saved"
fi
adb shell svc power stayon true
adb shell settings put system screen_off_timeout "$AWAKE_MS"

case "$(sh_out input keyevent KEYCODE_WAKEUP)" in
  *SecurityException*) die "The phone refuses injected input, which Maestro needs. Turn on Developer options > USB debugging (Security settings), then rerun." ;;
esac
sleep 1
case "$(sh_out dumpsys window)" in
  *isKeyguardShowing=true*) die "The phone is on its lock screen. Unlock it by hand, then rerun." ;;
esac

adb reverse tcp:8081 tcp:8081 >/dev/null

[ -f "$APK" ] || die "No dev build at $APK. Build it with: (cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a; ./gradlew --stop)"
unzip -Z1 "$APK" 'lib/arm64-v8a/*' >/dev/null 2>&1 || die "$APK has no arm64 code. It is probably the emulator build. Rebuild it with -PreactNativeArchitectures=arm64-v8a."
installed="$(sh_out pm path "$PKG" | sed -n 's/^package://p' | grep 'base.apk$' || true)"
on_phone=""
[ -z "$installed" ] || on_phone="$(sh_out sha256sum "$installed" | cut -d' ' -f1)"
if [ "$(sha256sum "$APK" | cut -d' ' -f1)" != "$on_phone" ]; then
  [ "$(sh_out getprop persist.security.adbinstall)" = 1 ] || die "Turn on Developer options > Install via USB, then rerun."
  echo "phone.sh: installing $APK. Watch the phone and tap Install on the Install via USB sheet within 10 s. Tick Remember my choice to skip the sheet next time." >&2
  out="$(adb install -r "$APK" 2>&1 || true)"
  case "$out" in
    *Success*) ;;
    *INSTALL_FAILED_USER_RESTRICTED*) die "Nobody tapped Install on the phone's Install via USB sheet before it timed out. Rerun and tap Install." ;;
    *) die "adb install failed: $out" ;;
  esac
  # A cold start can hit "failed to complete startup" before the app is compiled ahead of time.
  adb shell cmd package compile -m speed -f "$PKG" >/dev/null
fi

# The dev client's floating gear button sits over History's lock key, so a flow's tap opens the developer menu.
# Debug builds let run-as write the dev menu's own preferences: no gear, no menu at launch, onboarding done.
prefs="$(sh_out run-as "$PKG" cat shared_prefs/expo.modules.devmenu.sharedpreferences.xml || true)"
case "$prefs" in
  *'name="showFab" value="false"'*) ;;
  *)
    adb shell am force-stop "$PKG"
    printf '%s\n' "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>" '<map>' \
      '    <boolean name="isOnboardingFinished" value="true" />' \
      '    <boolean name="showsAtLaunch" value="false" />' \
      '    <boolean name="showFab" value="false" />' '</map>' |
      adb shell "run-as $PKG sh -c 'cat > shared_prefs/expo.modules.devmenu.sharedpreferences.xml'"
    ;;
esac

echo "$PHONE_ADB"
