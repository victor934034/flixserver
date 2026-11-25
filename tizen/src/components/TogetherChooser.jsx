import React, { useEffect, useRef, useState } from 'react';
import { KEY } from '../hooks/useNav.js';

// Mesmo alfabeto dos códigos de sala (sem 0/O e 1/I)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('');
const COLS = 8;
const EXTRA = ['⌫ Apagar', 'Entrar', 'Voltar'];

// "Assistir juntos" na TV: criar uma sala ou digitar o código com o controle.
// Enquanto está aberto, o controle remoto é só dele.
export default function TogetherChooser({ title, onCreate, onJoin, onClose }) {
  const [step, setStep] = useState('choose'); // 'choose' | 'code'
  const [idx, setIdx] = useState(0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function join() {
    if (busy) return;
    if (code.length !== 6) { setError('O código tem 6 letras e números.'); return; }
    setBusy(true); setError('');
    try { await onJoin(code); } catch (e) {
      setError((e.response && e.response.data && e.response.data.error) || 'Sala não encontrada ou encerrada.');
      setBusy(false);
    }
  }

  function press(i) {
    if (step === 'choose') {
      if (i === 0) { onClose(); onCreate(); }
      else if (i === 1) { setStep('code'); setIdx(0); }
      else onClose();
      return;
    }
    if (i < CHARS.length) { setError(''); setCode(c => (c.length < 6 ? c + CHARS[i] : c)); return; }
    const extra = EXTRA[i - CHARS.length];
    if (extra === 'Entrar') join();
    else if (extra === 'Voltar') { setStep('choose'); setIdx(1); setError(''); }
    else setCode(c => c.slice(0, -1));
  }

  const ref = useRef(null);
  ref.current = (e) => {
    const k = e.keyCode;
    const back = k === KEY.BACK || k === KEY.BACKSPACE;
    if (!back && [KEY.LEFT, KEY.RIGHT, KEY.UP, KEY.DOWN, KEY.ENTER].indexOf(k) < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (back) { if (step === 'code') { setStep('choose'); setIdx(1); setError(''); } else onClose(); return; }
    if (k === KEY.ENTER) { if (!e.repeat) press(idx); return; }
    if (step === 'choose') {
      if (k === KEY.UP) setIdx(i => Math.max(0, i - 1));
      if (k === KEY.DOWN) setIdx(i => Math.min(2, i + 1));
      return;
    }
    const n = CHARS.length;
    setIdx(i => {
      if (k === KEY.LEFT) return Math.max(0, i - 1);
      if (k === KEY.RIGHT) return Math.min(n + EXTRA.length - 1, i + 1);
      if (k === KEY.UP) return i >= n ? n - COLS + Math.min(COLS - 1, (i - n) * 3) : Math.max(i % COLS, i - COLS);
      if (i >= n) return i;
      return i + COLS < n ? i + COLS : n + Math.min(EXTRA.length - 1, Math.floor((i % COLS) / 3));
    });
  };

  useEffect(() => {
    const fn = (e) => ref.current(e);
    // o OK que abriu o painel ainda está sendo processado: começa a ouvir no próximo ciclo
    const t = setTimeout(() => document.addEventListener('keydown', fn, true), 0);
    return () => { clearTimeout(t); document.removeEventListener('keydown', fn, true); };
  }, []);

  const item = (i, label, extra) => (
    <div key={label} onClick={() => { setIdx(i); press(i); }} style={Object.assign({
      padding: '14px 0', borderRadius: 10, textAlign: 'center', fontSize: 22, fontWeight: 800, cursor: 'pointer',
      background: idx === i ? '#fff' : 'rgba(255,255,255,0.08)', color: idx === i ? '#000' : '#fff',
    }, extra)}>{label}</div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9960, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 760, padding: 40, borderRadius: 20, background: '#141414', border: '1px solid #2a2a2a', color: '#fff' }}>
        <div style={{ fontSize: 32, fontWeight: 900 }}>👥 Assistir juntos</div>
        <div style={{ color: '#aaa', fontSize: 18, margin: '8px 0 24px' }}>{step === 'choose' ? title : 'Digite o código da sala'}</div>
        {step === 'choose' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Criar uma sala', 'Entrar com o código', 'Cancelar'].map((label, i) => item(i, label))}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 14, textAlign: 'center', marginBottom: 20, minHeight: 56 }}>
              {(code + '______').slice(0, 6)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + COLS + ', 1fr)', gap: 10 }}>
              {CHARS.map((ch, i) => item(i, ch))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {EXTRA.map((label, i) => item(CHARS.length + i, label === 'Entrar' && busy ? 'Entrando...' : label, { flex: 1 }))}
            </div>
          </>
        )}
        {error && <div style={{ color: '#f87171', fontSize: 18, marginTop: 16, textAlign: 'center' }}>{error}</div>}
      </div>
    </div>
  );
}
