'use client';
import { useState } from 'react';
import { useWatched } from '../lib/watched';

const BASE = { background: '#1f1f1f', color: '#e5e5e5', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 15 };

export default function WatchedButton({ type, id }) {
  const { enabled, has, toggle } = useWatched();
  const [busy, setBusy] = useState(false);
  if (!enabled || !id) return null;
  const on = has(type, id);

  async function click() {
    setBusy(true);
    try { await toggle(type, id); } catch { window.alert('Não foi possível salvar. Tente de novo.'); }
    setBusy(false);
  }

  return (
    <button type="button" aria-pressed={on} disabled={busy} onClick={click}
      style={on ? { ...BASE, borderColor: '#4ade80', color: '#4ade80' } : BASE}>
      {on ? '✓ Já assisti' : 'Marcar como assistido'}
    </button>
  );
}
