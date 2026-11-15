// Bumper Buddies — AdMob for the Android app only. In a browser there is no Capacitor plugin,
// so every call is a no-op and the web version stays ad-free.
// Kid-safe rules: one interstitial at a natural break (before the next game starts), after
// every 2nd finished game and at least 3 minutes after the last ad; never during play.
// Every request is child-directed (COPPA), under the age of consent (GDPR) and rated General.
const Ads = (() => {
  'use strict';
  const GAP_MS = 3 * 60 * 1000, GAMES = 2, KEY = 'bb.ads';
  const cfg = window.BB_ADS || {};
  const AdMob = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;
  const KIDS = { tagForChildDirectedTreatment: true, tagForUnderAgeOfConsent: true, maxAdContentRating: 'General' };
  let on = false, ready = false, games = 0;

  function last() { try { return Number(localStorage.getItem(KEY)) || 0; } catch (e) { return 0; } }
  function setLast(t) { try { localStorage.setItem(KEY, String(t)); } catch (e) { /* ignore */ } }

  function load() {
    if (!on || ready) return;
    AdMob.prepareInterstitial({ adId: cfg.unit, isTesting: !!cfg.test, npa: true })
      .then(() => { ready = true; }).catch(() => {});
  }

  (async function start() {
    if (!AdMob || !cfg.unit) return;
    try {
      // Under-age users get no consent form; UMP only records the TFUA flag.
      const info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: true });
      if (info && info.canRequestAds === false) return;
    } catch (e) { /* offline or no consent message: ads stay non-personalised anyway */ }
    try {
      await AdMob.initialize(KIDS);
      on = true;
      if (AdMob.addListener) AdMob.addListener('interstitialAdDismissed', load);
      load();
    } catch (e) { /* no ads */ }
  })();

  return {
    // A game has just ended.
    gameOver() { games++; },
    // The player asked for the next game. Shows an ad first when one is due, then calls next().
    beforeNext(next) {
      const due = on && ready && games >= GAMES && Date.now() - last() >= GAP_MS;
      if (!due) { next(); return; }
      ready = false;
      let done = false;
      const go = () => { if (!done) { done = true; next(); } };
      const handles = ['interstitialAdDismissed', 'interstitialAdFailedToShow'].map(ev =>
        AdMob.addListener ? AdMob.addListener(ev, () => {
          handles.forEach(h => Promise.resolve(h).then(x => x && x.remove && x.remove()));
          go();
        }) : null);
      AdMob.showInterstitial()
        .then(() => { games = 0; setLast(Date.now()); })
        .catch(() => { go(); load(); });
    },
  };
})();
