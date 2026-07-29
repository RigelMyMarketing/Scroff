import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import Coin from '../components/Coin.jsx';
import PrizeRow from '../components/PrizeRow.jsx';

const BOARD_SIZE = 50;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [username, setUsername] = useState('');
  const [prizeTypes, setPrizeTypes] = useState([]);
  const [attemptsPerUser, setAttemptsPerUser] = useState(3);
  const [activeBoards, setActiveBoards] = useState(0);
  const [claims, setClaims] = useState([]);
  const [toast, setToast] = useState('');
  const [stockAlerts, setStockAlerts] = useState([]); // names currently at 0 qty
  const [publishing, setPublishing] = useState(false);
  const saveTimers = useRef({});
  const prevQtyRef = useRef({}); // id -> last-known qty, used to spot new 0s

  async function bootstrap() {
    try {
      const me = await api.get('/api/auth/me');
      setUsername(me.username);
    } catch {
      navigate('/admin/login');
      return;
    }
    setCheckingAuth(false);
    await loadOverview();
    await loadClaims();
  }

  async function loadOverview() {
    const data = await api.get('/api/admin/overview');

    // Spot any prize that just dropped to 0 since the last load, so the
    // admin gets a clear alert rather than having to notice it themselves.
    const justEmptied = data.prizeTypes.filter((p) => {
      const prevQty = prevQtyRef.current[p.id];
      return p.qty === 0 && prevQty !== undefined && prevQty > 0;
    });
    if (justEmptied.length > 0) {
      flashToast(`⚠️ Out of stock: ${justEmptied.map((p) => p.name).join(', ')}`);
    }
    data.prizeTypes.forEach((p) => {
      prevQtyRef.current[p.id] = p.qty;
    });
    setStockAlerts(data.prizeTypes.filter((p) => p.qty === 0).map((p) => p.name));

    setPrizeTypes(data.prizeTypes);
    setAttemptsPerUser(data.attemptsPerUser);
    setActiveBoards(data.activeBoards);
  }

  async function loadClaims() {
    const data = await api.get('/api/admin/claims');
    setClaims(data.claims);
  }

  useEffect(() => {
    bootstrap();
    const interval = setInterval(() => {
      loadOverview().catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flashToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  function updatePrizeLocal(id, patch) {
    setPrizeTypes((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      const latest = { ...prizeTypes.find((p) => p.id === id), ...patch };
      try {
        await api.patch(`/api/admin/prize-types/${id}`, {
          name: latest.name,
          emoji: latest.emoji,
          qty: latest.qty,
          isFreeRetry: latest.isFreeRetry,
        });
      } catch (err) {
        flashToast(err.message);
      }
    }, 500);
  }

  async function addPrize() {
    try {
      const created = await api.post('/api/admin/prize-types', { name: 'New prize', emoji: '🎁', qty: 0 });
      setPrizeTypes((prev) => [...prev, created]);
    } catch (err) {
      flashToast(err.message);
    }
  }

  async function removePrize(id) {
    try {
      await api.delete(`/api/admin/prize-types/${id}`);
      setPrizeTypes((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      flashToast(err.message);
    }
  }

  async function saveAttempts(value) {
    setAttemptsPerUser(value);
    try {
      await api.put('/api/admin/settings', { attemptsPerUser: value });
      flashToast('Turns per player updated');
    } catch (err) {
      flashToast(err.message);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      await api.post('/api/admin/publish', {});
      flashToast('New draw published! Every player gets a freshly shuffled board.');
      await loadOverview();
    } catch (err) {
      flashToast(err.message);
    } finally {
      setPublishing(false);
    }
  }

  async function logout() {
    await api.post('/api/auth/logout', {});
    navigate('/');
  }

  if (checkingAuth) {
    return (
      <div className="empty">
        <span className="big-emoji">🪙</span>Checking credentials…
      </div>
    );
  }

  const total = prizeTypes.reduce((s, p) => s + Number(p.qty || 0), 0);
  const totalOk = total <= BOARD_SIZE;

  return (
    <div id="app">
      <div className="topbar">
        <div className="brand">
          <Coin />
          <div>
            <h1>Scroff Admin</h1>
            <div className="tagline">Signed in as {username}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/play')}>
            🚽 View player side
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      {stockAlerts.length > 0 && (
        <div className="panel alert-banner">
          <span className="alert-icon">⚠️</span>
          <div>
            <b>Out of stock:</b> {stockAlerts.join(', ')} — refill the quantity below or players will stop being
            able to win {stockAlerts.length > 1 ? 'these prizes' : 'this prize'}.
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Prize pool</h2>
        <p className="sub">
          Set the prizes in the pool, upload a photo for each (or leave it as an emoji), and set how many of the {BOARD_SIZE}{' '}
          bowls each one fills. Quantities can total anything up to {BOARD_SIZE} — any bowls left over show as
          "Better luck next time" (this also happens naturally as prizes get claimed and the pool runs down).
        </p>
        <div className="stat-row">
          <div className={`stat-chip ${totalOk ? 'ok' : 'warn'}`}>
            Assigned <b>{total}</b> / {BOARD_SIZE}
          </div>
          <div className="stat-chip">
            Active boards right now <b>{activeBoards}</b>
          </div>
        </div>
        <div>
          {prizeTypes.map((p) => (
            <PrizeRow
              key={p.id}
              prize={p}
              onChange={(patch) => updatePrizeLocal(p.id, patch)}
              onRemove={() => removePrize(p.id)}
            />
          ))}
        </div>
        <button className="btn btn-ghost" onClick={addPrize} style={{ marginTop: 8 }}>
          + Add prize type
        </button>
      </div>

      <div className="panel">
        <h2>Player turns</h2>
        <p className="sub">How many bowls each player gets before their board refreshes with a new shuffle.</p>
        <div className="field-row">
          <label htmlFor="attempts-input">Turns per player</label>
          <input
            id="attempts-input"
            type="number"
            min="1"
            value={attemptsPerUser}
            onChange={(e) => saveAttempts(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>

      <div className="panel">
        <h2>Claims</h2>
        <p className="sub">
          Every real prize claimed by a player, matched to the phone number they entered. Free retries aren't
          included here since they're not a physical prize.
        </p>
        <div className="stat-row">
          <div className="stat-chip">
            Total claims <b>{claims.length}</b>
          </div>
          <a className="btn btn-ghost" href="/api/admin/claims/export">
            ⬇ Export to Excel
          </a>
        </div>
        <div className="claims-table">
          <div className="claims-row claims-head">
            <span>Prize</span>
            <span>H/P Number</span>
            <span>Record</span>
          </div>
          {claims.length === 0 && (
            <div className="sub" style={{ margin: '10px 0 0' }}>
              No prizes claimed yet.
            </div>
          )}
          {claims.slice(0, 20).map((c) => (
            <div className="claims-row" key={c.id}>
              <span className="claims-prize">
                {c.imageUrl ? (
                  <img className="hi-img" src={c.imageUrl} alt={c.prizeName} />
                ) : (
                  <span className="e">{c.prizeEmoji || '🎁'}</span>
                )}
                {c.prizeName}
              </span>
              <span>{c.phone}</span>
              <span className="t">
                {new Date(c.claimedAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
        {claims.length > 20 && (
          <p className="hint" style={{ marginTop: 8 }}>
            Showing the 20 most recent — export to Excel for the full list ({claims.length} total).
          </p>
        )}
      </div>

      <div className="panel">
        <h2>Publish</h2>
        <p className="sub">
          Publishing applies your prize pool changes to every player immediately — the next time each of them loads or
          finishes their turns, they'll get a fresh board built from these settings.
        </p>
        <button className="btn btn-gold" onClick={publish} disabled={!totalOk || publishing}>
          {publishing ? 'Publishing…' : '🪙 Publish changes'}
        </button>
        {!totalOk && <span className="hint"> Reduce the prize quantities to {BOARD_SIZE} or fewer first.</span>}
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}
