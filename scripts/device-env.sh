# WSL talks to the one adb server running on Windows (mirrored networking).
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export WIN_HOME="${WIN_HOME:-/mnt/c/Users/$(cmd.exe /c 'echo %USERNAME%' 2>/dev/null | tr -d '\r')}"
export WIN_ANDROID_SDK="${WIN_ANDROID_SDK:-$WIN_HOME/AppData/Local/Android/Sdk}"
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5037
export PATH="$ANDROID_HOME/platform-tools:$HOME/.maestro/bin:$PATH"
export AVD="${AVD:-Sen_API36}"
export REACT_NATIVE_PACKAGER_HOSTNAME=localhost

# The phone is the default device. `.device.env` holds PHONE_ADB=<tailscale ip>:<wireless debugging port>.
SEN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export SEN_ROOT
if [ -z "${PHONE_ADB:-}" ] && [ -f "$SEN_ROOT/.device.env" ]; then
  PHONE_ADB="$(sed -n 's/^PHONE_ADB=//p' "$SEN_ROOT/.device.env" | tail -1)"
fi
export PHONE_ADB="${PHONE_ADB:-}"
if [ -z "${ANDROID_SERIAL:-}" ] && [ -n "$PHONE_ADB" ]; then export ANDROID_SERIAL="$PHONE_ADB"; fi

# Probes the port instead of calling adb, which would start a second server inside WSL.
adb_server_up() { timeout 1 bash -c '</dev/tcp/127.0.0.1/5037' 2>/dev/null; }

ensure_adb_server() {
  adb_server_up && return
  (cd /mnt/c && setsid nohup "$WIN_ANDROID_SDK/platform-tools/adb.exe" -a -P 5037 nodaemon server >/dev/null 2>&1 &)
  until adb_server_up; do sleep 1; done
}
