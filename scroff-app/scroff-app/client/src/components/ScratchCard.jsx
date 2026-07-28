import { useEffect, useRef, useState } from 'react';

const REVEAL_THRESHOLD = 0.8; // must scratch off 80% of the latex

export default function ScratchCard({ cellIndex, prize, onRevealed, onClose }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false); // avoids double-firing from rapid pointer events

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = wrapRef.current.clientWidth;
    const cssHeight = 190;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    ctx.scale(dpr, dpr);

    // Silver latex base
    const grad = ctx.createLinearGradient(0, 0, cssWidth, cssHeight);
    grad.addColorStop(0, '#E7EBEA');
    grad.addColorStop(0.5, '#B9C4C2');
    grad.addColorStop(1, '#DDE3E2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < cssWidth; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, cssHeight);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(150,114,26,0.28)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (let y = 20; y < cssHeight; y += 34) {
      for (let x = 24; x < cssWidth; x += 64) {
        ctx.fillText('🪙', x, y);
      }
    }
    ctx.fillStyle = 'rgba(7,59,54,0.55)';
    ctx.font = '700 16px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH HERE', cssWidth / 2, cssHeight / 2 + 5);

    let drawing = false;
    let lastPoint = null;

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      return { x: cx, y: cy };
    }
    function scratchAt(x, y) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    function lineScratch(p1, p2) {
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const steps = Math.max(1, Math.floor(dist / 6));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        scratchAt(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t);
      }
    }
    function checkProgress() {
      if (revealedRef.current) return;
      const w = canvas.width;
      const h = canvas.height;
      const sample = ctx.getImageData(0, 0, w, h).data;
      let clear = 0;
      let count = 0;
      for (let i = 3; i < sample.length; i += 4 * 37) {
        count++;
        if (sample[i] < 40) clear++;
      }
      if (count > 0 && clear / count > REVEAL_THRESHOLD) {
        complete();
      }
    }
    function complete() {
      revealedRef.current = true;
      canvas.style.transition = 'opacity .5s ease';
      canvas.style.opacity = '0';
      setTimeout(() => {
        canvas.style.display = 'none';
      }, 500);
      setRevealed(true);
      onRevealed(cellIndex);
    }
    function start(e) {
      drawing = true;
      lastPoint = pos(e);
      scratchAt(lastPoint.x, lastPoint.y);
      e.preventDefault();
    }
    function move(e) {
      if (!drawing) return;
      const p = pos(e);
      lineScratch(lastPoint, p);
      lastPoint = p;
      checkProgress();
      e.preventDefault();
    }
    function end() {
      drawing = false;
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-backdrop">
      <div className="ticket">
        <div className="ticket-head">
          <span>🚽 Bowl #{cellIndex + 1}</span>
          <button type="button" onClick={onClose} disabled={!revealed} style={{ opacity: revealed ? 1 : 0.3 }}>
            ✕
          </button>
        </div>
        <div className="ticket-body">
          <div className="prize-reveal">
            {prize.imageUrl ? (
              <img className="pe-img" src={prize.imageUrl} alt={prize.name} />
            ) : (
              <span className="pe">{prize.emoji || '🎁'}</span>
            )}
            <span className="pn">{prize.name}</span>
            {prize.isFreeRetry && revealed && <span className="pf">Your turn has been credited back!</span>}
          </div>
          <div className="scratch-wrap" ref={wrapRef}>
            <canvas ref={canvasRef} />
          </div>
          <div className="hint">{revealed ? 'Fully revealed!' : 'Scratch the latex to reveal your prize \u2192'}</div>
        </div>
        {revealed && (
          <div className="ticket-foot">
            <button className="btn btn-primary" onClick={onClose}>
              Nice! Claim &amp; close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
