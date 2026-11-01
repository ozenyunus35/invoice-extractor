#!/bin/bash
# Renders the synthetic sample documents in samples-src/ to PNG with headless Chrome.
set -eu
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PROFILE="$(mktemp -d)"
shot() { "$CHROME" --headless=new --user-data-dir="$PROFILE" --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size="$2" --screenshot="public/samples/$1.png" "file://$PWD/samples-src/$1.html" >/dev/null 2>&1; }
mkdir -p public/samples
for n in halcyon brauer kuzey ridgeline northshore; do shot "$n" 1240,1754; done
shot kettle 640,1100
