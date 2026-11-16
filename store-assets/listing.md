# Play Store listing — Bumper Buddies (com.homilabs.bumperbuddies)

## App name (max 30 characters)
`Bumper Buddies: Kids Pinball` (28). The launcher label stays "Bumper Buddies".

## Short description (max 80)
`Bright, bouncy pinball for kids: launch, flip and light up the glowing stars!` (78)

## Full description
Bumper Buddies is a bright, friendly pinball game made for kids. Pull the plunger, launch the ball and keep it bouncing with two flippers to light up glowing stars and boing off smiley bumpers.

HOW TO PLAY
• Hold anywhere to pull the plunger, then let go: a longer pull means a stronger shot
• Tap the left or right side of the screen to flip
• 3 balls per game, plus a ball save right after each launch

LOTS TO HIT
• 17 glowing star markers that light up and chime, climbing the musical scale on quick hits
• Smiley pop bumpers and pink slingshots that kick the ball away
• Light all 3 top stars to raise the multiplier, up to x5
• Light every marker for the SUPER STAR BONUS

MADE FOR KIDS
• No login and no account: just pick a fun nickname, or roll the dice for one
• A Top 10 score board kept only on this device
• Cheerful music and sound effects; buttons to turn music or sounds off
• Pause any time

ADS
Bumper Buddies is free. It shows a family-safe ad from Google AdMob now and then, only before a new game starts and never while a ball is in play. Ads are limited to general-audience content and are never personalised.

Privacy policy: https://tools.homilabs.org/privacy#bumperbuddies

Sound effects and music: Powered by Stability AI.

## Other fields
- App or game: Game · Category: Arcade · Free
- Contact email: homilabs.smc@gmail.com · Website: https://tools.homilabs.org/
- Privacy policy URL: https://tools.homilabs.org/privacy#bumperbuddies
- Graphics (remade 16 Nov 2026 from the approved homidev art): `icon-512.png` (app icon job 20261115-2358-pinball-image-02),
  `feature-graphic.png` (1024×500), phone screenshots `screenshots/phone-1..4.png` (1080×1920; 1–3 rendered from the game
  in headless Chrome at 1080×2340, 4 captured on the Oppo)

## App content answers
- Ads: Yes (Google AdMob interstitial between games, child-directed, rating G)
- Target audience: 6–8 and 9–12 (Families policy)
- Sign-in details: all functionality available without sign-in
- Content rating (IARC): game; cartoon-style pinball with no violence, no user interaction, no purchases → expect Everyone / PEGI 3
- Advertising ID: No (AD_ID and ad-services permissions removed; Families policy)
- Data safety: collected and shared by the AdMob SDK only — approximate location (IP), app interactions,
  diagnostics, device or other IDs (app set ID); purposes advertising, analytics, fraud prevention; encrypted in
  transit; required, not ephemeral; no accounts. The app itself collects nothing.
- Government / financial / health: No

## Progress (15 Nov 2026) — paused at Homi's request after Store settings
Play app id `4973554462212192668`, account Homilabs (9161588402757830740), package `com.homilabs.bumperbuddies`.
Dashboard: https://play.google.com/console/u/0/developers/9161588402757830740/app/4973554462212192668/app-dashboard

Done (saved in Play Console):
- App created: Game, Free; Homi ticked the two creation declarations.
- Privacy policy URL: https://tools.homilabs.org/privacy#bumperbuddies (live, with the AdMob section).
- Ads: Yes. Sign in details: no restricted parts. Advertising ID: No.
- Government apps: No. Financial features: none. Health apps: none.
- Content rating (IARC terms agreed with Homi's OK; Game, all answers No): ESRB Everyone, PEGI 3, USK all ages,
  ClassInd all ages, ACB General, IARC 3+.
- Store settings: category Arcade; contact homilabs.smc@gmail.com; website https://tools.homilabs.org/.

Still to do:
- Target audience and content: 6–8 and 9–12, Families policy acknowledged, COPPA/GDPR certification approved by Homi.
  NOT saved yet: the form would not move past step 2 "App details" (Next ignored; Play was returning 429 rate
  limits at the time). Retry later; the answers above stand.
- Data safety (answers in "App content answers" above).
- Main store listing: name, short and full description above; icon-512.png, feature-graphic.png, screenshots/phone-1..4.png.
- Production release: upload releases/1.0.0-1/bumper-buddies-1.0.0-1.aab, release notes, then send for review
  (only with Homi's go-ahead).
- After approval: AdMob → Bumper Buddies → Add store (Google Play); in AdMob mark the app as child-directed.

Build notes:
- The 1.0.0 (1) build in releases/ includes the grown-ups gate (privacy/terms behind a sum) and has the AD_ID and
  Privacy Sandbox ad-services permissions removed. The gate and its link were tested on the Oppo on 16 Nov 2026.
- The web copy at tools.homilabs.org/pinball/ is the version before the gate.
- A stale copy of the upload sits at homilabs.org/bumperbuddies/ (wrong domain); delete it only with Homi's OK.

## Art and sound update (16 Nov 2026)
- 30 homidev jobs approved by Homi before sending; 28 passed Stage 1 and Homi approved all 28 ("all passed");
  2 music loops failed Stage 1 on true peak (-0.8 / -0.9 dBFS) and sit in ~/ai-inbox/_rejected/.
- In the game (assets/game/, made by scripts/make-game-art.sh; Claude's default picks, Homi to swap by ear if wanted):
  playfield 20261115-2334-pinball-image-03 (seed 33); buddies pink 2334-icon-01, blue 2342-icon-01, yellow 2342-icon-04;
  sfx bumper 2358-sfx-01, flipper 0013-sfx-01, launch 0013-sfx-04, ball lost 0015-sfx-02, bonus 0015-sfx-05;
  music 0016-music-03. App icon 2358-image-02 (seed 33).
- "Powered by Stability AI" is on the in-app grown-ups screen and in the store description (assets/ATTRIBUTION.md).
- Privacy and terms on tools.homilabs.org corrected the same day (sounds/music wording, Stability AI credit).
- Release 1.0.0 (1) rebuilt with the new art and sounds and tested on the Oppo (debug and release): art, sounds decoding,
  gameplay, back button, grown-ups gate and its Privacy link (opens Chrome at the policy), live interstitial after the
  2nd game (closed with Back, not clicked).
