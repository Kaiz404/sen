# Sourced by the release checks. Exports a production Android bundle into a temp dir and sets "$bundle".
# Run the checks from the MAIN checkout. A git worktree whose node_modules is a symlink makes Metro export a
# bundle with no app code, which fails every check below for the wrong reason, so the app string check stops
# that case loudly first.

out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
(cd "$(dirname "${BASH_SOURCE[0]}")/.." && npx expo export --platform android --no-bytecode --output-dir "$out" >/dev/null)
bundle="$(find "$out" -name '*.js' | head -1)"

require_app_code() {
  grep -q 'RESTING WHILE YOU SWITCH' "$bundle" || {
    echo "$1: the exported bundle has none of the app's code. Run this from the main checkout, not a worktree with a symlinked node_modules." >&2
    exit 1
  }
}
