// Plays the custom "win" sound effect (client/public/sounds/win.mp3).
// Falls back to a generated chime if that file is ever missing or blocked.
//
// Mobile browsers (iOS Safari especially) only allow audio to actually
// start playing when it's triggered directly and synchronously by a real
// tap/click — not by a drag gesture like scratching. Since the reveal
// happens partway through a scratch (a touchmove, not a tap), calling
// .play() there gets silently blocked on phones. The fix is to "unlock"
// both the audio element and the fallback AudioContext the moment the
// player first touches the card at all (a genuine tap), so playback is
// already primed and allowed by the time scratching actually finishes.

let audioEl = null;
let audioCtx = null;

function getAudioEl() {
  if (!audioEl) {
    audioEl = new Audio('/sounds/win.mp3');
    audioEl.preload = 'auto';
  }
  return audioEl;
}

function getAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

// Call this synchronously from inside the very first touchstart/mousedown
// handler on the scratch card — before any scratching has happened.
export function unlockAudio() {
  try {
    const el = getAudioEl();
    el.volume = 0;
    const p = el.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        el.pause();
        el.currentTime = 0;
        el.volume = 0.9;
      }).catch(() => {});
    }
  } catch {
    // Ignore — playCongratsChime() will just fall back to the generated
    // chime later if the file genuinely can't play.
  }
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function playCongratsChime() {
  try {
    const el = getAudioEl();
    el.currentTime = 0;
    el.volume = 0.9;
    el.play().catch(() => playGeneratedChime());
  } catch {
    playGeneratedChime();
  }
}

function playGeneratedChime() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.11;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    // Nothing more we can do — fail silently, confetti still plays.
  }
}
