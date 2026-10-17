#!/usr/bin/env bash
# Proves the release bundle blocks screen capture: `guardsScreens` returns true (the dev branch is compiled out),
# and the guard still calls preventScreenCaptureAsync with its key. The minified shapes are inferred from
# check-release-auth.sh and have not been seen in a real export, so confirm them once from the main checkout.
set -euo pipefail
# Upgrade tripwire: the sheets inherit the activity's FLAG_SECURE only while react-native-screens builds a
# formSheet inside the activity window. Static, so it needs no bundle and no device.
stack="$(dirname "${BASH_SOURCE[0]}")/../node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/ScreenStack.kt"
grep -Eq 'FORM_SHEET -> ScreenStackFragment\(' "$stack" || {
  echo "check-release-guard: ScreenStack.kt no longer maps FORM_SHEET to ScreenStackFragment. Sheets may now be a separate window, so recheck FLAG_SECURE on the Delete sheet (D30)." >&2
  exit 1
}
# shellcheck source=release-bundle.sh
source "$(dirname "$0")/release-bundle.sh"

fail() {
  echo "check-release-guard: $*" >&2
  exit 1
}
require_app_code check-release-guard
grep -q 'sen-screen-guard' "$bundle" || fail "the release bundle has no screen guard."
grep -Eq '\.preventScreenCaptureAsync\)?\(' "$bundle" || fail "the release bundle never calls preventScreenCaptureAsync."
# Either `exports.guardsScreens=function(){return!0}`, or the name bound to a declared function with that body.
# A dev body is `return!1`, and the call then never runs. Terser may also fold the whole function into its
# caller, in which case no `guardsScreens` string remains and the two checks above are the proof.
if grep -q 'guardsScreens' "$bundle"; then
  grep -Pq 'guardsScreens=function\(\)\{return(!0|true)\}|guardsScreens=([A-Za-z_$][\w$]*)\b[,;]?[\s\S]*?function \2\(\)\{return(!0|true)\}' "$bundle" ||
    fail "guardsScreens does not return true in the release bundle."
fi
echo "check-release-guard: the release bundle blocks screen capture."
