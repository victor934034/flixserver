import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KEY } from '../hooks/useNav.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api/index.js';
import { joinTogetherWeb } from '../lib/together.js';

// Convites do "Assistir juntos": confere a cada 15s; ENTER entra, BACK recusa.
export default function TogetherInvites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [focus, setFocus] = useState(0); // 0 entrar, 1 agora não
  const [busy, setBusy] = useState(false);
  const dismissed = useRef({});
  const st = useRef({});
  st.current = { invite, focus, busy };

  useEffect(() => {
    if (!user) { setInvite(null); return undefined; }
    let alive = true;
    const check = async () => {
      try {
        const { data } = await api.get('/api/together/invites');
        const next = (data || []).find(i => !dismissed.current[i.code]);
        if (alive && next) setInvite(prev => prev || next);
      } catch (e) {}
    };
    check();
    const t = setInterval(check, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);

  function decline() {
    const inv = st.current.invite;
    if (!inv) return;
    dismissed.current[inv.code] = true;
    api.delete('/api/together/invites/' + inv.code).catch(() => {});
    setInvite(null);
  }
  async function join() {
    const inv = st.current.invite;
    if (!inv || st.current.busy) return;
    setBusy(true);
    try { await joinTogetherWeb(navigate, inv.code); dismissed.current[inv.code] = true; setInvite(null); }
    catch (e) { decline(); }
    setBusy(false);
  }

  useEffect(() => {
    // captura antes das telas: enquanto o convite está aberto, o controle é só dele
    const fn = (e) => {
      if (!st.current.invite) return;
      const k = e.keyCode;
      if ([KEY.LEFT, KEY.RIGHT, KEY.UP, KEY.DOWN, KEY.ENTER, KEY.BACK, 461, KEY.BACKSPACE].indexOf(k) < 0) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (k === KEY.LEFT || k === KEY.UP) setFocus(0);
      else if (k === KEY.RIGHT || k === KEY.DOWN) setFocus(1);
      else if (k === KEY.ENTER) { if (st.current.focus === 0) join(); else decline(); }
      else decline();
    };
    document.addEventListener('keydown', fn, true);
    return () => document.removeEventListener('keydown', fn, true);
  }, []);

  if (!invite) return null;
  const btn = (i, red) => ({
    padding: '16px 40px', borderRadius: 12, fontSize: 22, fontWeight: 800, color: '#fff', cursor: 'pointer',
    background: red ? '#E50914' : '#1F1F1F', border: '3px solid ' + (focus === i ? '#fff' : 'transparent'),
    transform: focus === i ? 'scale(1.06)' : 'none', transition: 'transform .12s',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 32, width: 980, padding: 36, borderRadius: 20, background: '#141414', border: '1px solid #2a2a2a', color: '#fff' }}>
        {invite.poster_url && <img src={invite.poster_url} alt="" style={{ width: 180, height: 270, borderRadius: 10, objectFit: 'cover' }} />}
        <div style={{ flex: 1 }}>
          <div style={{ color: '#E50914', fontSize: 14, fontWeight: 800, letterSpacing: 2 }}>ASSISTIR JUNTOS</div>
          <div style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>{invite.from} chamou você</div>
          <div style={{ fontSize: 22, color: '#A3A3A3', marginTop: 6 }}>{invite.title}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 30 }}>
            <div style={btn(0, true)} onClick={join}>{busy ? 'Entrando…' : 'Entrar'}</div>
            <div style={btn(1, false)} onClick={decline}>Agora não</div>
          </div>
        </div>
      </div>
    </div>
  );
}
