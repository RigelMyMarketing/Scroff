import { useNavigate } from 'react-router-dom';
import Coin from '../components/Coin.jsx';

export default function RoleSelect() {
  const navigate = useNavigate();
  return (
    <div className="role-screen">
      <div className="role-brand">
        <Coin size={72} />
        <h1>Scroff</h1>
        <p className="tag">Scratch &amp; Win</p>
      </div>
      <div className="role-cards">
        <button className="role-card" onClick={() => navigate('/play')}>
          <span className="role-emoji">🚽</span>
          <span className="role-title">I'm a Player</span>
          <span className="role-sub">Pick a bowl, scratch a card, win a prize</span>
        </button>
        <button className="role-card admin" onClick={() => navigate('/admin/login')}>
          <span className="role-emoji">🔐</span>
          <span className="role-title">I'm an Admin</span>
          <span className="role-sub">Manage prizes, photos &amp; the draw</span>
        </button>
      </div>
    </div>
  );
}
