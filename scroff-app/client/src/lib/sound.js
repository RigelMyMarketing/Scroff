// A short, cheerful ascending chime played when a player reveals/claims a
// prize. Generated on the fly with the Web Audio API instead of an audio
// file, so there's nothing to upload, host, or license.
export function playCongratsChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
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

    setTimeout(() => ctx.close(), (notes.length * 110 + 500));
  } catch {
    // Audio might be blocked by the browser's autoplay policy — fine to
    // fail silently, the visual confetti still plays either way.
  }
}
