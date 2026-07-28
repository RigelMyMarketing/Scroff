const EMOJIS = ['🪙', '✨', '🎉', '⭐'];

export function burstConfetti() {
  for (let i = 0; i < 26; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.fontSize = 14 + Math.random() * 14 + 'px';
    el.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }
}
