import { useState } from 'react';

export default function PhoneGate({ onSubmit }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!/^[0-9+\s-]{7,20}$/.test(trimmed)) {
      setError('Enter a valid phone number');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="role-screen">
      <div className="role-brand">
        <span className="big-emoji">📱</span>
        <h1>One quick step</h1>
        <p className="tag">Enter your phone number to start playing</p>
      </div>
      <form className="panel" style={{ maxWidth: 420, width: '100%', margin: '0 auto' }} onSubmit={handleSubmit}>
        <div className="field-row">
          <label htmlFor="phone-input">Phone number</label>
          <input
            id="phone-input"
            type="tel"
            inputMode="tel"
            placeholder="e.g. 012-3456789"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        {error && (
          <p className="hint" style={{ color: 'var(--cherry)' }}>
            {error}
          </p>
        )}
        <button className="btn btn-gold" type="submit" disabled={submitting} style={{ width: '100%', marginTop: 12 }}>
          {submitting ? 'Saving…' : "Let's play →"}
        </button>
        <p className="sub" style={{ marginTop: 12 }}>
          We only use this to match you with any prize you win.
        </p>
      </form>
    </div>
  );
}
