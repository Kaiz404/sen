#!/usr/bin/env bash
# Proves the dev auth override is compiled out of a release bundle: the setter is empty and the native
# prompt call has no branch in front of it.
set -euo pipefail
cd "$(dirname "$0")/.."
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
npx expo export --platform android --no-bytecode --output-dir "$out" >/dev/null
bundle="$(find "$out" -name '*.js' | head -1)"

fail() {
  echo "check-release-auth: $*" >&2
  exit 1
}
grep -q 'setAuthOverride=function([a-z]*){}' "$bundle" || fail "setAuthOverride still stores something in the release bundle."
grep -Eq 'function [a-zA-Z]+\([a-z]+\)\{return\(0,[a-z]+\.authenticateAsync\)\(\{promptMessage:' "$bundle" ||
  fail "the native prompt call is not the whole body of its function in the release bundle."
echo "check-release-auth: the override is compiled out of the release bundle."
