import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { burstConfetti } from '../lib/confetti.js';
import { playCongratsChime } from '../lib/sound.js';
import Coin from '../components/Coin.jsx';
import BowlGrid from '../components/BowlGrid.jsx';
import ScratchCard from '../components/ScratchCard.jsx';
import PhoneGate from '../components/PhoneGate.jsx';

export default function PlayHome() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [activeCell, setActiveCell] = useState(null); // { cellIndex, prize }
  const [flushingCell, setFlushingCell] = useState(null);
  const [checkingPhone, setCheckingPhone] = useState(true);
  const [phone, setPhone] = useState(null); // null = not yet registered
  const toastTimer = useRef(null);

  async function loadState() {
    try {
      const data = await api.get('/api/game/state');
      setGameState(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function checkPhone() {
      try {
        const data = await api.get('/api/player/profile');
        if (data.phone) {
          setPhone(data.phone);
          await loadState();
        }
      } finally {
        setCheckingPhone(false);
      }
    }
    checkPhone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePhoneSubmit(value) {
    const res = await api.post('/api/player/profile', { phone: value });
    setPhone(res.phone);
    setLoading(true);
    await loadState();
  }

  function flashToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }

  async function handlePick(cellIndex) {
    if (!gameState || gameState.remaining <= 0) return;
    setFlushingCell(cellIndex);
    try {
      const res = await api.post('/api/game/pick', { cellIndex });
      setGameState((prev) => ({
        ...prev,
        used: res.used,
        remaining: res.remaining,
        cells: prev.cells.map((c) => (c.cellIndex === cellIndex ? { ...c, status: 'taken' } : c)),
      }));
      setTimeout(() => {
        setActiveCell({ cellIndex, prize: res.prize });
      }, 260);
    } catch (e) {
      flashToast(e.message);
      loadState();
    } finally {
      setTimeout(() => setFlushingCell(null), 500);
    }
  }

  async function handleRevealed(cellIndex) {
    try {
      const res = await api.post('/api/game/reveal', { cellIndex });
      burstConfetti();
      playCongratsChime();
      setGameState((prev) => ({
        ...prev,
        used: res.used,
        remaining: res.remaining,
        myPrizes: [
          {
            cellIndex,
            name: res.prize.name,
            emoji: res.prize.emoji,
            imageUrl: res.prize.imageUrl,
            wonAt: new Date().toISOString(),
          },
          ...prev.myPrizes,
        ],
      }));
      if (res.creditedBack) flashToast("One more time! That turn's back in your pocket.");
    } catch (e) {
      flashToast(e.message);
    }
  }

  async function handleRefresh() {
    try {
      const res = await api.post('/api/game/refresh', {});
      setGameState((prev) => ({
        ...prev,
        used: res.used,
        remaining: res.remaining,
        cells: res.cells,
        myPrizes: res.myPrizes,
      }));
      flashToast('Fresh board! New prizes are waiting.');
    } catch (e) {
      flashToast(e.message);
    }
  }

  function closeModal() {
    setActiveCell(null);
    loadState();
  }

  if (checkingPhone) {
    return (
      <div className="empty">
        <span className="big-emoji">🪙</span>Loading Scroff…
      </div>
    );
  }

  if (!phone) {
    return <PhoneGate onSubmit={handlePhoneSubmit} />;
  }

  if (loading) {
    return (
      <div className="empty">
        <span className="big-emoji">🪙</span>Loading Scroff…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty">
        <span className="big-emoji">😕</span>
        <h3>Couldn't load the draw</h3>
        <p className="sub">{error}</p>
      </div>
    );
  }

  const { attemptsPerUser, remaining, cells, myPrizes } = gameState;

  return (
    <div id="app">
      <div className="topbar">
        <div className="brand">
          <Coin />
          <div>
            <h1>Scroff</h1>
            <div className="tagline">Scratch &amp; Win</div>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          ← Switch role
        </button>
      </div>

      <div className="panel">
        <h2>Pick a bowl</h2>
        <p className="sub">Every bowl hides one scratch card. Once it's picked, it's gone — choose wisely.</p>
        <div className="stat-row">
          <div className={`stat-chip ${remaining > 0 ? 'ok' : 'warn'}`}>
            Turns left <b>{remaining}</b> / {attemptsPerUser}
          </div>
          {remaining <= 0 && (
            <button className="btn btn-primary" onClick={handleRefresh}>
              🔄 Refresh board
            </button>
          )}
        </div>
        {remaining <= 0 && (
          <div className="stat-chip warn" style={{ marginBottom: 16 }}>
            You're out of turns for this round. Hit "Refresh board" above for a new one!
          </div>
        )}
        <BowlGrid cells={cells} canPlay={remaining > 0} onPick={handlePick} flushingCell={flushingCell} />
      </div>

      <div className="panel">
        <h2>My prizes</h2>
        <p className="sub">This round's wins — resets when a fresh board starts.</p>
        <div className="history-list">
          {myPrizes.length === 0 && <div className="sub" style={{ margin: 0 }}>No prizes claimed yet — go pick a bowl!</div>}
          {myPrizes.map((h, i) => (
            <div className="history-item" key={i}>
              {h.imageUrl ? <img className="hi-img" src={h.imageUrl} alt={h.name} /> : <span className="e">{h.emoji}</span>}
              <span>{h.name}</span>
              <span className="t">
                {new Date(h.wonAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {activeCell && (
        <ScratchCard cellIndex={activeCell.cellIndex} prize={activeCell.prize} onRevealed={handleRevealed} onClose={closeModal} />
      )}

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}
