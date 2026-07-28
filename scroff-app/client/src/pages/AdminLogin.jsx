import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import Coin from '../components/Coin.jsx';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/api/auth/login', { username, password });
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="role-screen">
      <div className="role-brand">
        <Coin size={72} />
        <h1>Scroff Admin</h1>
        <p className="tag">Sign in to manage the draw</p>
      </div>
      <form className="panel login-panel" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="username">
          Username
        </label>
        <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="stat-chip warn" style={{ marginTop: 12 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 16, width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 10, width: '100%' }}
          onClick={() => navigate('/')}
        >
          ← Back
        </button>
      </form>
    </div>
  );
}
