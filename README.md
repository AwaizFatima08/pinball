# Bumper Buddies Pinball

A bright, kid-friendly pinball game that runs in any modern browser, on desktop or phone. No login and no server-side storage: the player types a fun alias (or rolls the 🎲 for one) and plays.

## How to play

- **Launch:** hold `Space` (or touch and hold the table) to pull the plunger. The power meter in the lane goes up and down; let go to fire. A weak shot rolls back for a free retry.
- **Flippers:** `←` / `Z` / `A` for the left flipper, `→` / `M` / `L` for the right one. On a touch screen, tap the left or right half of the table.
- **Score:**
  - Glowing star markers (10 / 25 / 50 / 100 points, shuffled every game) light up, glow and play a chime. Hits in quick succession climb the musical scale.
  - Smiley pop bumpers give 100–150 points and kick the ball away.
  - Pink slingshots above the flippers give 10 points.
  - Light all 3 top stars to raise the **multiplier** (up to x5 for that ball).
  - Light every marker for the **Super Star Bonus** (+1000, then the markers reshuffle).
  - When a ball drains, each lit marker adds a 20-point star bonus.
- **Ball save:** for 8 seconds after a new ball is launched, a drained ball comes back once.
- 3 balls per game. The final score and the local Top 10 (saved in this browser only) appear at the end.
- `P` or `Esc` pauses. The ♪ and 🔔 buttons turn music and sound effects on or off.

## Run it

It is plain HTML, CSS and JavaScript with no build step. Serve the folder with any static server:

```bash
python3 -m http.server 8791 --bind 127.0.0.1
```

Then open http://127.0.0.1:8791. Opening `index.html` directly from disk also works.

## Files

- `index.html` – page, HUD and the start / game-over / pause screens
- `css/style.css` – styling
- `js/game.js` – table layout, physics (sub-stepped circle/segment collisions, moving flippers), scoring, drawing
- `js/audio.js` – background music and all sound effects, synthesized live with the Web Audio API (no audio files, nothing to attribute)

No third-party requests: fonts are system fonts (rounded where available), and nothing leaves the device.

## Android app (Capacitor)

The same game ships as an Android app, package `com.homilabs.bumperbuddies`, with AdMob ads. The web version has no ads: `js/ads.js` does nothing without the Capacitor plugin.

- **Ads** (account homilabs.smc@gmail.com; ids in `config/admob.json`):
  - one interstitial before the next game starts, after every 2nd finished game, at most once every 3 minutes, never during play;
  - every request is child-directed (COPPA), under the age of consent (GDPR) and limited to rating G.
- **Debug:** `npm run build && npx cap sync android`, then `jobq run --name pinball-debug -- bash -c "cd android && ./gradlew assembleDebug"`. Debug builds always use Google's sample app id and test unit.
- **Release:** `bash scripts/release.sh` writes the signed `.aab` (Play) and `.apk` to `releases/<version>-<code>/`. It is the only path that puts the live unit in.
- **Signing:**
  - Upload key `.secrets/bumperbuddies-upload.keystore`, alias `bumperbuddies-upload`, created 15 Nov 2026, valid 10,000 days.
  - Its passwords are in `.secrets/` and are read through `android/keystore.properties`. Both are gitignored.
  - Back up `.secrets/`, and never push it.
- **Before each release:** bump `versionCode` and `versionName` in `android/app/build.gradle`.

## Hosting

Live home: https://tools.homilabs.org/pinball/ (hub card, privacy and terms sections use the slug `bumperbuddies`).
The site source is `/mnt/storage/projects/homilabs_tools/site/pinball/`; copy `index.html`, `css/` and `js/` there after changes.
`homilabs_tools/tools/add_bumperbuddies.py` adds the hub card, privacy and terms blocks to a set of pages.
