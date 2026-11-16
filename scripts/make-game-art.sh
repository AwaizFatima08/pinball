#!/usr/bin/env bash
# Makes the in-game copies in assets/game/ from the approved homidev originals in assets/images, assets/icons and
# assets/audio (registered in assets/ASSET-REGISTER.md; the originals are never edited).
# Usage: bash scripts/make-game-art.sh <playfield.png> <bumper-pink_cutout.png> <bumper-blue_cutout.png> \
#          <bumper-yellow_cutout.png> <sfx-bumper.ogg> <sfx-flipper.ogg> <sfx-launch.ogg> <sfx-drain.ogg> \
#          <sfx-bonus.ogg> <music.ogg>
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -eq 10 ] || { echo "usage: see the header"; exit 1; }
out=assets/game; mkdir -p "$out"
# playfield: the centre column of the square picture, cropped to the table shape (480x800 at 1.25x)
convert "$1" -gravity center -crop 614x1024+0+0 +repage -resize 600x1000! -quality 85 "$out/playfield.jpg"
# bumper buddies: trimmed to the character and kept small (they are drawn about 70 px wide)
buddy() { convert "$1" -trim +repage -resize 160x160 -gravity center -background none -extent 160x160 "$out/bumper-$2.png"; }
buddy "$2" pink; buddy "$3" blue; buddy "$4" yellow
cp "$5" "$out/sfx-bumper.ogg"; cp "$6" "$out/sfx-flipper.ogg"; cp "$7" "$out/sfx-launch.ogg"
cp "$8" "$out/sfx-drain.ogg"; cp "$9" "$out/sfx-bonus.ogg"; cp "${10}" "$out/music.ogg"
ls -la "$out"
