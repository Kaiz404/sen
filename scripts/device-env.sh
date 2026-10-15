# WSL talks to the one adb server running on Windows (mirrored networking).
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export WIN_HOME="${WIN_HOME:-/mnt/c/Users/$(cmd.exe /c 'echo %USERNAME%' 2>/dev/null | tr -d '\r')}"
export WIN_ANDROID_SDK="${WIN_ANDROID_SDK:-$WIN_HOME/AppData/Local/Android/Sdk}"
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5037
export PATH="$ANDROID_HOME/platform-tools:$HOME/.maestro/bin:$PATH"
export AVD="${AVD:-Sen_API36}"
export REACT_NATIVE_PACKAGER_HOSTNAME=localhost
