#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/device-env.sh"

if ! adb devices >/dev/null 2>&1; then
  (cd /mnt/c && setsid nohup "$WIN_ANDROID_SDK/platform-tools/adb.exe" -a -P 5037 nodaemon server >/dev/null 2>&1 &)
  until adb devices >/dev/null 2>&1; do sleep 1; done
fi

# The emulator needs about 5.5 GB of Windows RAM. With less free it pages to disk and every device step
# slows down 5x to 15x. FORCE=1 boots anyway.
free_mb=$(powershell.exe -NoProfile -Command "(Get-Counter '\Memory\Available MBytes').CounterSamples.CookedValue" | tr -d '\r' | cut -d. -f1)
if ! adb devices | grep -q '^emulator-.*device$' && [ "${free_mb:-0}" -lt 6000 ] && [ "${FORCE:-0}" != 1 ]; then
  echo "emulator.sh: Windows has ${free_mb} MB free, under 6000. Stop Gradle daemons, Docker or a parallel build first, or rerun with FORCE=1." >&2
  exit 1
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
