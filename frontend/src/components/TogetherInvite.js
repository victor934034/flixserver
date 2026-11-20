'use client';
import { useEffect, useState } from 'react';
import api from '../lib/api';

const box = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999, display: 'grid', placeItems: 'center', padding: 16 };
const card = { background: '#141414', border: '1px solid #1f1f1f', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, color: '#e5e5e5', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 60px rgba(0,0,0,.6)' };
const btn = { background: '#E50914', color: '#fff', border: 0, borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14 };
const btn2 = { background: '#1f1f1f', color: '#e5e5e5', border: '1px solid #2a2a2a', borderRadius: 10, padding: '10px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 13 };

export default function TogetherInvite({ room, onClose }) {
  const link = typeof window !== 'undefined' ? `${window.location.origin}/juntos/${room.code}` : '';
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [sent, setSent] = useState({});

  useEffect(() => {
    if (q.trim().length < 3) { setFound([]); return; }
    const t = setTimeout(() => api.get('/together/users', { params: { q } }).then(r => setFound(r.data || [])).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);

  async function invite(u) {
    try { await api.post(`/together/rooms/${room.code}/invite`, { user_id: u.id }); setSent(s => ({ ...s, [u.id]: true })); } catch {}
  }
  function copy() { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }
  const wa = `https://wa.me/?text=${encodeURIComponent(`Vem assistir "${room.title}" comigo no FlixHome! ${link}`)}`;

  return (
    <div style={box} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Chamar para assistir junto</h2>
        <p style={{ color: '#888', fontSize: 13 }}>Código da sala: <b style={{ letterSpacing: 3, color: '#fff' }}>{room.code}</b></p>

        <div style={{ display: 'flex', gap: 8 }}>
          <input readOnly value={link} style={{ flex: 1, background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '10px 12px', color: '#b3b3b3', fontSize: 13 }} />
          <button style={copied ? { ...btn, background: '#22C55E', color: '#000' } : btn} onClick={copy}>{copied ? '✓ Copiado!' : 'Copiar'}</button>
        </div>
        <a href={wa} target="_blank" rel="noreferrer" style={{ ...btn2, textAlign: 'center', textDecoration: 'none' }}>Compartilhar no WhatsApp</a>

        <div style={{ borderTop: '1px solid #1f1f1f', paddingTop: 14 }}>
          <label style={{ fontSize: 13, color: '#b3b3b3', fontWeight: 600 }}>Chamar um amigo que tem conta
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome ou e-mail (mín. 3 letras)" style={{ marginTop: 6, width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '10px 12px', color: '#fff', outline: 'none' }} />
          </label>
          {found.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <div><div style={{ fontWeight: 700 }}>{u.name}</div><div style={{ fontSize: 12, color: '#666' }}>{u.hint}</div></div>
              <button style={sent[u.id] ? { ...btn2, color: '#22C55E' } : btn2} disabled={sent[u.id]} onClick={() => invite(u)}>{sent[u.id] ? '✓ Convidado' : 'Convidar'}</button>
            </div>
          ))}
        </div>
        <button style={btn2} onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}
