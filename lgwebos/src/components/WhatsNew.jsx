import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { KEY } from '../hooks/useNav.js';
import { useAuth } from '../contexts/AuthContext.jsx';

// Novidades mostradas na primeira abertura de cada versão.
// A CADA versão com mudança para o usuário, troque VERSION e ITEMS.
const VERSION = '1.2.0';
const ITEMS = [
  'Continuar assistindo: abra o título e escolha "Tirar do Continuar assistindo".',
  'Assistir juntos corrigido: a sala volta a conectar.',
];
const SEEN_KEY = 'lastSeenChangelogVersion';

function alreadySeen() {
  try { return window.localStorage.getItem(SEEN_KEY) === VERSION; } catch (e) { return true; }
}

export default function WhatsNew() {
  const { user, activeProfile } = useAuth();
  const { pathname } = useLocation();
  const [closed, setClosed] = useState(alreadySeen);
  const open = !closed && !!user && !!activeProfile && pathname === '/';

  useEffect(() => {
    if (!open) return undefined;
    // captura antes das telas: enquanto o aviso está aberto, o controle é só dele
    const fn = (e) => {
      const k = e.keyCode;
      if ([KEY.LEFT, KEY.RIGHT, KEY.UP, KEY.DOWN, KEY.ENTER, KEY.BACK, 461, KEY.BACKSPACE].indexOf(k) < 0) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (k === KEY.ENTER || k === KEY.BACK || k === 461 || k === KEY.BACKSPACE) {
        try { window.localStorage.setItem(SEEN_KEY, VERSION); } catch (err) {}
        setClosed(true);
      }
    };
    document.addEventListener('keydown', fn, true);
    return () => document.removeEventListener('keydown', fn, true);
  }, [open]);

  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 900, padding: 44, borderRadius: 20, background: '#141414', border: '1px solid #2a2a2a', color: '#fff' }}>
        <div style={{ fontSize: 38, fontWeight: 900 }}>✨ Novidades</div>
        <div style={{ color: '#E50914', fontSize: 16, fontWeight: 800, letterSpacing: 2, marginTop: 8 }}>VERSÃO {VERSION}</div>
        <ul style={{ margin: '24px 0 32px', paddingLeft: 26, fontSize: 24, lineHeight: 1.5, color: '#ddd' }}>
          {ITEMS.map(t => <li key={t} style={{ marginBottom: 10 }}>{t}</li>)}
        </ul>
        <div style={{ display: 'inline-block', padding: '16px 48px', borderRadius: 12, fontSize: 22, fontWeight: 800, background: '#E50914', border: '3px solid #fff' }}>Entendi (OK)</div>
      </div>
    </div>
  );
}
