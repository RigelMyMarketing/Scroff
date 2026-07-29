import { useRef, useState } from 'react';
import { api } from '../lib/api.js';

export default function PrizeRow({ prize, onChange, onRemove, onAdjustClaimed }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('image', file);
      const updated = await api.upload(`/api/admin/prize-types/${prize.id}/image`, form);
      onChange({ ...prize, imageUrl: updated.imageUrl });
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="prize-row">
      <button type="button" className="photo-btn" onClick={() => fileRef.current?.click()} title="Upload a photo">
        {prize.imageUrl ? <img src={prize.imageUrl} alt={prize.name} /> : <span>{prize.emoji || '🎁'}</span>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={handleFile} />
      </button>

      <div className="prize-row-fields">
        <input
          type="text"
          value={prize.name}
          placeholder="Prize name"
          onChange={(e) => onChange({ ...prize, name: e.target.value })}
        />
        <div className="prize-row-sub">
          <input
            type="text"
            className="emoji-fallback"
            value={prize.emoji || ''}
            maxLength={2}
            placeholder="🎁"
            title="Fallback emoji, used if no photo is uploaded"
            onChange={(e) => onChange({ ...prize, emoji: e.target.value })}
          />
          <label className="retry-toggle" title="Refunds the player's turn instead of using it up">
            <input
              type="checkbox"
              checked={!!prize.isFreeRetry}
              onChange={(e) => onChange({ ...prize, isFreeRetry: e.target.checked })}
            />
            One more time
          </label>
        </div>
        {uploading && <span className="hint">Uploading…</span>}
        {uploadError && <span className="hint" style={{ color: 'var(--cherry)' }}>{uploadError}</span>}
      </div>

      <div className="claimed-counter" title="How many of this prize have been collected so far">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onAdjustClaimed(-1)}
          disabled={!prize.claimedCount}
        >
          −
        </button>
        <span className="claimed-count">
          <b>{prize.claimedCount || 0}</b>
          <small>collected</small>
        </span>
        <button type="button" className="icon-btn" onClick={() => onAdjustClaimed(1)}>
          +
        </button>
      </div>

      <input
        type="number"
        min="0"
        value={prize.qty}
        onChange={(e) => onChange({ ...prize, qty: Math.max(0, Number(e.target.value) || 0) })}
      />

      <button type="button" className="icon-btn" title="Remove prize type" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}
