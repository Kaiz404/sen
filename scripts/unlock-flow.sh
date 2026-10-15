#!/usr/bin/env bash
# Maestro cannot touch the emulator console, so the finger touch runs between two flows.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/device-env.sh
mkdir -p shots
maestro test --test-output-dir shots/maestro .maestro/lock-prompt.yaml
adb -e emu finger touch 1
maestro test --test-output-dir shots/maestro .maestro/lands-on-history.yaml
