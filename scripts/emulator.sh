#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/device-env.sh"

if ! adb devices >/dev/null 2>&1; then
  (cd /mnt/c && setsid nohup "$WIN_ANDROID_SDK/platform-tools/adb.exe" -a -P 5037 nodaemon server >/dev/null 2>&1 &)
  until adb devices >/dev/null 2>&1; do sleep 1; done
fi

if ! adb devices | grep -q '^emulator-.*device$'; then
  (cd /mnt/c && setsid nohup "$WIN_ANDROID_SDK/emulator/emulator.exe" -avd "$AVD" -no-snapshot -no-boot-anim -no-audio >/dev/null 2>&1 &)
fi

adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 2; done

# After a cold boot the user stays locked until the PIN is entered, and Android
# will not start Maestro's driver against locked storage.
unlocked() { adb shell dumpsys user | grep -q 'State: RUNNING_UNLOCKED'; }
for _ in 1 2 3 4 5; do
  unlocked && break
  adb shell input keyevent KEYCODE_WAKEUP
  adb shell input keyevent KEYCODE_MENU
  sleep 2
  adb shell input text "${AVD_PIN:-1111}"
  adb shell input keyevent KEYCODE_ENTER
  sleep 3
done
unlocked || { echo "emulator.sh: could not unlock the device" >&2; exit 1; }
[ -f "$HOME/.emulator_console_auth_token" ] || cp "$WIN_HOME/.emulator_console_auth_token" "$HOME/"
adb reverse tcp:8081 tcp:8081 >/dev/null
adb devices
