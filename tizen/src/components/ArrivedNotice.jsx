import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KEY } from '../hooks/useNav.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api/index.js';

const SEEN_KEY = 'seenArrivedSuggestions';
function readSeen() {
  try { return JSON.parse(window.localStorage.getItem(SEEN_KEY)) || []; } catch (e) { return []; }
}

// Aviso de pedido atendido na TV: OK abre o título, Voltar fecha.
export default function ArrivedNotice() {
  const { user, activeProfile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const open = !!item && pathname === '/';
  const userId = user && user.id;

  useEffect(() => {
    if (!userId || !activeProfile) return;
    api.get('/api/suggestions/arrived')
      .then(r => {
        const seen = readSeen();
        setItem((r.data || []).find(i => seen.indexOf(i.id) < 0) || null);
      })
      .catch(() => {});
  }, [userId, !!activeProfile]);

  useEffect(() => {
    if (!open) return undefined;
    const fn = (e) => {
      const k = e.keyCode;
      const back = k === KEY.BACK || k === KEY.BACKSPACE;
      if (!back && [KEY.LEFT, KEY.RIGHT, KEY.UP, KEY.DOWN, KEY.ENTER].indexOf(k) < 0) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!back && k !== KEY.ENTER) return;
      try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(readSeen().concat(item.id).slice(-50))); } catch (err) {}
      setItem(null);
      if (k === KEY.ENTER) navigate('/detail?type=' + item.content_type + '&id=' + item.content_id);
    };
    document.addEventListener('keydown', fn, true);
    return () => document.removeEventListener('keydown', fn, true);
  }, [open, item]);

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9980, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 760, padding: 40, borderRadius: 20, background: '#141414', border: '1px solid #2a2a2a', color: '#fff', display: 'flex', gap: 28 }}>
        {item.poster_url && <img src={item.poster_url} alt="" style={{ width: 160, height: 240, objectFit: 'cover', borderRadius: 10 }} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 32, fontWeight: 900 }}>🎉 Seu pedido chegou!</div>
          <div style={{ fontSize: 24, color: '#ddd', margin: '14px 0 30px' }}>{item.title}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Aperte <span style={{ color: '#e50914' }}>OK</span> para assistir ou <span style={{ color: '#e50914' }}>Voltar</span> para fechar.</div>
        </div>
      </div>
    </div>
  );
}
