#!/usr/bin/env bash
# Copies the game into www/ for the Android app (Capacitor webDir).
# Usage: bash scripts/build-www.sh        -> Google's test ad unit (debug builds)
#        bash scripts/build-www.sh live   -> the live unit from config/admob.json (release only)
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf www && mkdir -p www
cp -r index.html css js www/
if [ "${1:-}" = "live" ]; then
  unit=$(node -p "require('./config/admob.json').ad_units.next_game_interstitial.id")
  [[ "$unit" == ca-app-pub-2087846699268567/* ]] || { echo "FAIL: no live interstitial id in config/admob.json"; exit 1; }
  printf "// Release build: live AdMob unit (written by scripts/build-www.sh live).\nwindow.BB_ADS = { unit: '%s', test: false };\n" "$unit" > www/js/ads-config.js
fi
echo "www/ ready ($(grep -o "test: [a-z]*" www/js/ads-config.js))"
