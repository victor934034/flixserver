'use client';
import { useEffect, useState } from 'react';
import api from '../lib/api';
import { getToken } from '../lib/auth';

// Faixa "TESTE GRÁTIS" da Home (design): só aparece para quem ainda pode usar o teste
export default function TrialBar() {
  const [trial, setTrial] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!getToken()) return;
    api.get('/payments/trial').then(r => setTrial(r.data)).catch(() => {});
  }, []);

  async function start() {
    setBusy(true); setErr('');
    try { await api.post('/payments/trial/start'); window.location.reload(); }
    catch (e) { setErr(e.response?.data?.error || 'Não foi possível ativar.'); setBusy(false); }
  }

  if (!trial?.available) return null;
  return (
    <div style={{ position: 'relative', zIndex: 5, marginTop: 64, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '12px 3%', background: 'rgba(229,9,20,0.10)', borderBottom: '1px solid rgba(229,9,20,0.4)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <span style={{ background: '#E50914', color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: 1, padding: '4px 10px', borderRadius: 999 }}>TESTE GRÁTIS</span>
      <span style={{ color: '#E5E5E5', fontSize: 14 }}>Experimente o FlixHome por {trial.days} dias, sem cartão.</span>
      {err && <span style={{ color: '#F87171', fontSize: 13 }}>{err}</span>}
      <button onClick={start} disabled={busy} style={{ marginLeft: 'auto', height: 38, padding: '0 20px', border: 0, borderRadius: 10, background: '#E50914', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Ativando…' : 'Começar teste grátis'}
      </button>
    </div>
  );
}
