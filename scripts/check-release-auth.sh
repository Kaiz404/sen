#!/usr/bin/env bash
# Proves the dev auth override is compiled out of a release bundle: the setter is empty, and the function that asks the
# phone (every route: the sensor alone, the combined sheet and the screen lock) answers only from the native modules.
set -euo pipefail
# shellcheck source=release-bundle.sh
source "$(dirname "$0")/release-bundle.sh"

fail() {
  echo "check-release-auth: $*" >&2
  exit 1
}
require_app_code check-release-auth
grep -q 'setAuthOverride=function([a-z]*){}' "$bundle" || fail "setAuthOverride still stores something in the release bundle."

# The function that asks the phone is the one whose body calls authenticateAsync with `promptMessage` and also
# confirmDeviceCredential. Take its balanced body and look for anything that answers without asking the phone.
BUNDLE="$bundle" node -e '
const src = require("fs").readFileSync(process.env.BUNDLE, "utf8");
const at = src.indexOf("authenticateAsync)({promptMessage:");
if (at < 0) { console.error("no native prompt call found in the release bundle."); process.exit(2); }
const start = src.lastIndexOf("function ", at);
const open = src.indexOf("{", start);
let depth = 0, end = open;
for (let i = open; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}" && --depth === 0) { end = i; break; }
}
const body = src.slice(start, end + 1);
const problems = [];
if (!/confirmDeviceCredential/.test(body)) problems.push("the prompt function does not cover the screen-lock route");
if (/Promise\.resolve|success:!0|user_cancel/.test(body)) problems.push("the prompt function can answer without asking the phone");
if (problems.length) { console.error(problems.join("; ")); process.exit(1); }
' || fail "the release prompt function is not a bare native ask on every route."
echo "check-release-auth: the override is compiled out of the release bundle."
