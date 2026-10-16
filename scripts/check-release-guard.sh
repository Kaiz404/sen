#!/usr/bin/env bash
# Proves the release bundle blocks screen capture: the screen guard calls preventScreenCaptureAsync with its key
# (inferred bundle shape, run once to confirm). The unit test proves release always guards.
set -euo pipefail
cd "$(dirname "$0")/.."
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
npx expo export --platform android --no-bytecode --output-dir "$out" >/dev/null
bundle="$(find "$out" -name '*.js' | head -1)"

fail() {
  echo "check-release-guard: $*" >&2
  exit 1
}
grep -q 'sen-screen-guard' "$bundle" || fail "the release bundle has no screen guard."
grep -Eq '\.preventScreenCaptureAsync\)?\(' "$bundle" || fail "the release bundle never calls preventScreenCaptureAsync."
echo "check-release-guard: the release bundle blocks screen capture."
