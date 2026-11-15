// Bumper Buddies — all music and sound effects are synthesized live with the Web Audio API.
// No audio files are shipped, so there is nothing to license or attribute.
const Sound = (() => {
  'use strict';
  let ctx = null, master, musicBus, sfxBus, noiseBuf;
  let musicOn = loadPref('music', true);
  let sfxOn = loadPref('sfx', true);
  let musicWanted = false, musicTimer = null, nextStepTime = 0, stepIdx = 0;
  let chargeOsc = null, chargeGain = null;
  let lastThud = 0;

  const BPM = 128;
  const STEP = 60 / BPM / 4; // one 16th note
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function loadPref(k, d) {
    try { const v = localStorage.getItem('bb.' + k); return v === null ? d : v === '1'; } catch (e) { return d; }
  }
  function savePref(k, v) { try { localStorage.setItem('bb.' + k, v ? '1' : '0'); } catch (e) { /* ignore */ } }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { build(AC); } catch (e) { ctx = null; } // no audio device: play silently
  }

  function build(AC) {
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.3 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.75 : 0; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function osc(type, freq, t, dur, vol, bus, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise(t, dur, vol, bus, type, freq, freqTo, q) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = type; f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    if (q) f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  const ready = () => ctx && sfxOn;

  // ---------------- music: cheerful chiptune loop, I–vi–IV–V in C ----------------
  const CHORDS = [
    { bass: 36, arp: [60, 64, 67] },  // C
    { bass: 33, arp: [57, 60, 64] },  // Am
    { bass: 29, arp: [53, 57, 60] },  // F
    { bass: 31, arp: [55, 59, 62] },  // G
  ];
  // [step, midi, lengthInSteps] per bar; A section then B section
  const MELODY = [
    [[0, 76, 2], [2, 79, 2], [4, 84, 2], [6, 79, 2], [8, 81, 2], [10, 79, 2], [12, 76, 4]],
    [[0, 72, 2], [2, 76, 2], [4, 81, 4], [8, 79, 2], [10, 76, 2], [12, 72, 4]],
    [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2], [8, 79, 2], [10, 77, 2], [12, 76, 2], [14, 74, 2]],
    [[0, 74, 2], [2, 79, 2], [4, 83, 4], [8, 81, 2], [10, 79, 2], [12, 74, 4]],
    [[0, 84, 4], [4, 83, 2], [6, 84, 2], [8, 79, 4], [12, 76, 4]],
    [[0, 81, 4], [4, 79, 2], [6, 81, 2], [8, 76, 4], [12, 72, 4]],
    [[0, 77, 2], [2, 79, 2], [4, 81, 2], [6, 84, 2], [8, 86, 4], [12, 84, 4]],
    [[0, 83, 2], [2, 81, 2], [4, 79, 2], [6, 77, 2], [8, 74, 4], [12, 79, 2], [14, 83, 2]],
  ];

  function scheduleStep(i, t) {
    const bar = Math.floor(i / 16) % 8, s = i % 16;
    const ch = CHORDS[bar % 4];
    // drums
    if (s % 8 === 0) osc('sine', 150, t, 0.16, 0.7, musicBus, 42);
    if (s === 4 || s === 12) { noise(t, 0.12, 0.28, musicBus, 'highpass', 1400); osc('triangle', 220, t, 0.08, 0.15, musicBus, 140); }
    if (s % 2 === 0) noise(t, 0.035, s % 4 === 2 ? 0.08 : 0.04, musicBus, 'highpass', 7000);
    // bass, bouncing octaves on 8ths
    if (s % 2 === 0) osc('triangle', mtof(ch.bass + 12 + (s % 4 === 2 ? 12 : 0)), t, STEP * 1.7, 0.4, musicBus);
    // sparkly arpeggio
    osc('square', mtof(ch.arp[s % 3] + 12), t, STEP * 0.8, 0.035, musicBus);
    // lead melody
    for (const n of MELODY[bar]) {
      if (n[0] === s) {
        const d = n[2] * STEP * 0.92;
        osc('square', mtof(n[1]), t, d, 0.075, musicBus);
        osc('triangle', mtof(n[1] - 12), t, d, 0.08, musicBus);
      }
    }
  }

  function tick() {
    while (nextStepTime < ctx.currentTime + 0.15) {
      scheduleStep(stepIdx, nextStepTime);
      stepIdx++;
      nextStepTime += STEP;
    }
  }

  function syncMusic() {
    const shouldPlay = ctx && musicWanted && musicOn;
    if (shouldPlay && !musicTimer) {
      nextStepTime = ctx.currentTime + 0.08;
      musicTimer = setInterval(tick, 25);
    } else if (!shouldPlay && musicTimer) {
      clearInterval(musicTimer); musicTimer = null;
    }
  }

  // ---------------- sound effects ----------------
  const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];

  return {
    init,
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    // Silence everything while the app is in the background or an ad covers it.
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    startMusic() { musicWanted = true; syncMusic(); },
    stopMusic() { musicWanted = false; syncMusic(); },
    toggleMusic() {
      musicOn = !musicOn; savePref('music', musicOn);
      if (ctx) musicBus.gain.value = musicOn ? 0.3 : 0;
      syncMusic(); return musicOn;
    },
    toggleSfx() {
      sfxOn = !sfxOn; savePref('sfx', sfxOn);
      if (ctx) sfxBus.gain.value = sfxOn ? 0.75 : 0;
      if (!sfxOn) this.chargeStop();
      return sfxOn;
    },
    // marker chime: each hit in a combo climbs the scale
    marker(combo) {
      if (!ready()) return;
      const t = ctx.currentTime, m = PENTA[Math.min(combo, PENTA.length - 1)];
      osc('triangle', mtof(m), t, 0.35, 0.35, sfxBus);
      osc('sine', mtof(m + 12), t, 0.25, 0.18, sfxBus);
      osc('sine', mtof(m + 19), t + 0.02, 0.15, 0.06, sfxBus);
    },
    bumper() {
      if (!ready()) return;
      const t = ctx.currentTime;
      osc('square', 260, t, 0.14, 0.22, sfxBus, 720);
      osc('sine', 520, t, 0.22, 0.3, sfxBus, 180);
      noise(t, 0.05, 0.15, sfxBus, 'bandpass', 2500, 0, 2);
    },
    sling() {
      if (!ready()) return;
      const t = ctx.currentTime;
      osc('square', 420, t, 0.08, 0.18, sfxBus, 900);
      noise(t, 0.04, 0.12, sfxBus, 'highpass', 3000);
    },
    flipper() {
      if (!ready()) return;
      const t = ctx.currentTime;
      noise(t, 0.05, 0.22, sfxBus, 'bandpass', 1800, 600, 1.5);
      osc('sine', 140, t, 0.06, 0.25, sfxBus, 70);
    },
    thud(impact) {
      if (!ready()) return;
      const t = ctx.currentTime;
      if (t - lastThud < 0.06) return;
      lastThud = t;
      osc('sine', 110 + Math.random() * 40, t, 0.07, Math.min(0.25, impact / 3000), sfxBus, 60);
    },
    rollover() {
      if (!ready()) return;
      const t = ctx.currentTime;
      osc('square', mtof(84), t, 0.08, 0.12, sfxBus);
      osc('square', mtof(91), t + 0.07, 0.12, 0.12, sfxBus);
    },
    chargeStart() {
      if (!ready() || chargeOsc) return;
      chargeOsc = ctx.createOscillator(); chargeGain = ctx.createGain();
      chargeOsc.type = 'triangle'; chargeOsc.frequency.value = 200;
      chargeGain.gain.value = 0.07;
      chargeOsc.connect(chargeGain); chargeGain.connect(sfxBus); chargeOsc.start();
    },
    chargeUpdate(p) { if (chargeOsc) chargeOsc.frequency.setTargetAtTime(200 + p * 700, ctx.currentTime, 0.02); },
    chargeStop() {
      if (!chargeOsc) return;
      chargeGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
      chargeOsc.stop(ctx.currentTime + 0.1);
      chargeOsc = null; chargeGain = null;
    },
    launch(p) {
      if (!ready()) return;
      const t = ctx.currentTime;
      noise(t, 0.45, 0.35, sfxBus, 'bandpass', 300, 2500 + p * 3000, 1.2);
      osc('sawtooth', 120, t, 0.3, 0.12, sfxBus, 500 + p * 600);
    },
    multiplier(level) {
      if (!ready()) return;
      const t = ctx.currentTime;
      [72, 76, 79, 84, 88].forEach((m, i) => osc('square', mtof(m + level * 2), t + i * 0.06, 0.15, 0.14, sfxBus));
    },
    bonus() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [72, 76, 79, 84, 79, 84, 88, 91, 96].forEach((m, i) => {
        osc('square', mtof(m), t + i * 0.07, 0.16, 0.13, sfxBus);
        osc('triangle', mtof(m - 12), t + i * 0.07, 0.16, 0.12, sfxBus);
      });
    },
    save() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [79, 84, 88].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.09, 0.2, 0.3, sfxBus));
    },
    drain() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [[392, 370], [370, 349], [349, 262]].forEach((f, i) => osc('sawtooth', f[0], t + i * 0.28, i === 2 ? 0.7 : 0.26, 0.13, sfxBus, f[1]));
    },
    gameOver() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [84, 79, 76, 72, 74, 76, 72].forEach((m, i) => osc('square', mtof(m), t + i * 0.13, 0.22, 0.12, sfxBus));
    },
    click() {
      if (!ready()) return;
      osc('sine', 880, ctx.currentTime, 0.06, 0.15, sfxBus, 1200);
    },
  };
})();
