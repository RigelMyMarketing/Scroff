// Plays the custom "win" sound effect (client/public/sounds/win.mp3).
// Falls back to a generated chime if that file is ever missing or blocked,
// so a reveal/claim never goes silent for a boring technical reason.
export function playCongratsChime() {
  try {
    const audio = new Audio('/sounds/win.mp3');
    audio.volume = 0.9;
    audio.play().catch(() => playGeneratedChime());
  } catch {
    playGeneratedChime();
  }
}

function playGeneratedChime() {
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

    setTimeout(() => ctx.close(), notes.length * 110 + 500);
  } catch {
    // Nothing more we can do — fail silently, confetti still plays.
  }
}
