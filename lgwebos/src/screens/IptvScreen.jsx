import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { iptvAPI } from '../api/index.js';
import { KEY, useKeyDown } from '../hooks/useNav.js';

const ACCENT = '#E50914';
const COLS = 4;
const FAV = '__fav';

let _catCache = null;
let _statusCache = null;
const _chCache = {};

function loadFavs() { try { return JSON.parse(localStorage.getItem('iptv_favs') || '[]'); } catch (e) { return []; } }
function saveFavs(l) { try { localStorage.setItem('iptv_favs', JSON.stringify(l)); } catch (e) {} }

const COLORS = ['#1F4D32', '#7A2E14', '#2A4A7A', '#4A2A5A', '#2F6F85', '#4F7A1F', '#3F3F46', '#7A5A1F'];
const colorOf = (s) => COLORS[[...String(s || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

function Center({ children }) {
  return <div style={{ width: '100%', height: '100%', background: '#0A0A0A', color: '#E5E5E5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{children}</div>;
}
function Btn({ label, focused, red, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: '18px 40px', borderRadius: 14, fontSize: 26, fontWeight: 800, color: '#fff', cursor: 'pointer',
      background: red ? ACCENT : '#1F1F1F', border: '3px solid ' + (focused ? '#fff' : (red ? ACCENT : '#2A2A2A')),
      transform: focused ? 'scale(1.06)' : 'none', transition: 'transform 0.2s',
    }}>{label}</div>
  );
}

export default function IptvScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(_statusCache || 'loading');
  const [cats, setCats] = useState(_catCache || []);
  const [catIdx, setCatIdx] = useState(0);     // índice na lista [Favoritos, ...categorias]
  const [chans, setChans] = useState([]);
  const [chLoading, setChLoading] = useState(false);
  const [favs, setFavs] = useState(loadFavs());
  const [area, setArea] = useState('side');    // side | grid
  const [gIdx, setGIdx] = useState(0);
  const [btn, setBtn] = useState(0);
  const [opening, setOpening] = useState(null);
  const gridRef = useRef(null);
  const st = useRef({});

  const list = [{ category_id: FAV, category_name: 'Favoritos' }].concat(cats);
  const cur = list[catIdx] || list[0];
  const shown = cur.category_id === FAV ? favs : chans;
  st.current = { status, list, catIdx, shown, area, gIdx, btn, favs, cur, opening };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await iptvAPI.status();
        _statusCache = data.status;
        setStatus(data.status);
        if (data.status === 'active') {
          if (!_catCache) { const r = await iptvAPI.categories(); _catCache = Array.isArray(r.data) ? r.data : []; }
          setCats(_catCache);
          setCatIdx(_catCache.length ? 1 : 0);
        }
      } catch (e) { if (!_catCache) setStatus('none'); }
    })();
  }, []);

  useEffect(() => {
    if (status !== 'active' || cur.category_id === FAV) return undefined;
    if (_chCache[cur.category_id]) { setChans(_chCache[cur.category_id]); return undefined; }
    let alive = true;
    setChLoading(true);
    iptvAPI.streams(cur.category_id).then(r => {
      const l = Array.isArray(r.data) ? r.data : [];
      _chCache[cur.category_id] = l;
      if (alive) setChans(l);
    }).catch(() => { if (alive) setChans([]); }).finally(() => { if (alive) setChLoading(false); });
    return () => { alive = false; };
  }, [catIdx, status, cats]);

  useEffect(() => { setGIdx(0); }, [catIdx]);
  useEffect(() => {
    const el = gridRef.current && gridRef.current.children[gIdx];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [gIdx, area]);

  async function openChannel(ch) {
    if (st.current.opening) return;
    setOpening(ch.stream_id);
    try {
      const { data } = await iptvAPI.streamUrl(ch.stream_id);
      navigate('/iptv-player', { state: { url: data.url, name: ch.name, logo: ch.stream_icon || '' } });
    } catch (e) { setOpening(null); }
  }
  function toggleFav(ch) {
    const f = st.current.favs;
    const next = f.some(x => x.stream_id === ch.stream_id) ? f.filter(x => x.stream_id !== ch.stream_id) : f.concat([{ stream_id: ch.stream_id, name: ch.name, stream_icon: ch.stream_icon }]);
    setFavs(next); saveFavs(next);
  }

  useKeyDown(function (e) {
    const s = st.current;
    const k = e.keyCode;
    if (k === KEY.BACK || k === KEY.BACKSPACE || k === 461) { e.preventDefault(); if (s.status === 'active' && s.area === 'grid') setArea('side'); else navigate('/'); return; }

    if (s.status === 'none' || s.status === 'pending') {
      const max = s.status === 'none' ? 1 : 0;
      if (k === KEY.LEFT) { e.preventDefault(); setBtn(b => Math.max(0, b - 1)); }
      if (k === KEY.RIGHT) { e.preventDefault(); setBtn(b => Math.min(max, b + 1)); }
      if (k === KEY.ENTER) { e.preventDefault(); if (s.status === 'none') { navigate(s.btn === 0 ? '/subscription?tab=iptv' : '/'); } else navigate('/'); }
      return;
    }
    if (s.status !== 'active') return;

    if (s.area === 'side') {
      if (k === KEY.UP) { e.preventDefault(); setCatIdx(i => Math.max(0, i - 1)); }
      if (k === KEY.DOWN) { e.preventDefault(); setCatIdx(i => Math.min(s.list.length - 1, i + 1)); }
      if ((k === KEY.RIGHT || k === KEY.ENTER) && s.shown.length) { e.preventDefault(); setArea('grid'); }
      return;
    }
    // grid
    if (k === KEY.LEFT) { e.preventDefault(); if (s.gIdx % COLS === 0) setArea('side'); else setGIdx(i => i - 1); }
    if (k === KEY.RIGHT) { e.preventDefault(); setGIdx(i => Math.min(s.shown.length - 1, i + 1)); }
    if (k === KEY.UP) { e.preventDefault(); setGIdx(i => (i - COLS >= 0 ? i - COLS : i)); }
    if (k === KEY.DOWN) { e.preventDefault(); setGIdx(i => (i + COLS < s.shown.length ? i + COLS : i)); }
    if (k === KEY.ENTER) { e.preventDefault(); const ch = s.shown[s.gIdx]; if (ch) openChannel(ch); }
    if (k === KEY.YELLOW || k === 70) { e.preventDefault(); const ch = s.shown[s.gIdx]; if (ch) toggleFav(ch); }
  });

  if (status === 'loading') return <Center><div style={{ width: 56, height: 56, border: '4px solid rgba(255,255,255,0.08)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} /></Center>;

  if (status === 'none') return (
    <Center>
      <div style={{ width: 130, height: 130, borderRadius: 32, background: '#1F1F1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, marginBottom: 26 }}>📺</div>
      <div style={{ fontSize: 56, fontWeight: 900, marginBottom: 12 }}>Canais ao vivo, 24h</div>
      <div style={{ fontSize: 28, color: '#A3A3A3', maxWidth: 820, lineHeight: 1.5, marginBottom: 44 }}>Esportes, notícias, filmes e infantis no mesmo app. Até 2 telas.</div>
      <div style={{ display: 'flex', gap: 20 }}>
        <Btn red label="Ver planos IPTV" focused={btn === 0} onClick={() => navigate('/subscription?tab=iptv')} />
        <Btn label="Voltar" focused={btn === 1} onClick={() => navigate('/')} />
      </div>
    </Center>
  );

  if (status === 'pending') return (
    <Center>
      <div style={{ fontSize: 22, color: '#FBBF24', fontWeight: 900, letterSpacing: 4, marginBottom: 14 }}>AGUARDANDO ATIVAÇÃO</div>
      <div style={{ fontSize: 56, fontWeight: 900, marginBottom: 12 }}>Estamos ligando seu acesso</div>
      <div style={{ fontSize: 28, color: '#A3A3A3', maxWidth: 820, lineHeight: 1.5, marginBottom: 36 }}>Pagamento recebido. Normalmente leva até 30 minutos — a TV atualiza sozinha.</div>
      <div style={{ textAlign: 'left', padding: '26px 36px', borderRadius: 20, background: '#141414', border: '1px solid #1F1F1F', fontSize: 28, lineHeight: 2, marginBottom: 40 }}>
        <div style={{ color: '#4ADE80', fontWeight: 800 }}>✓ Pagamento confirmado</div>
        <div style={{ color: '#FBBF24', fontWeight: 800 }}>◔ Ativando</div>
        <div style={{ color: '#777', fontWeight: 800 }}>○ Pronto para assistir</div>
      </div>
      <Btn label="Voltar ao início" focused onClick={() => navigate('/')} />
    </Center>
  );

  return (
    <div style={{ width: '100%', height: '100%', background: '#0A0A0A', color: '#E5E5E5', display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 300, background: '#0F0F0F', borderRight: '1px solid #1A1A1A', padding: '40px 24px', boxSizing: 'border-box', overflowY: 'auto' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: 8, marginBottom: 34 }}>FLIXHOME</div>
        {list.map(function (c, i) {
          const on = i === catIdx;
          const foc = on && area === 'side';
          const n = c.category_id === FAV ? favs.length : (_chCache[c.category_id] ? _chCache[c.category_id].length : '');
          return (
            <div key={c.category_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', marginBottom: 6, borderRadius: 12, fontSize: 26,
              fontWeight: on ? 800 : 600, color: on ? '#fff' : '#A3A3A3', background: on ? 'rgba(229,9,20,0.12)' : 'transparent',
              border: '3px solid ' + (foc ? '#fff' : 'transparent'), transform: foc ? 'scale(1.03)' : 'none', transition: 'transform 0.2s',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category_id === FAV ? '★ ' : ''}{c.category_name}</span>
              <span style={{ fontSize: 22, color: '#777' }}>{n}</span>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, padding: '40px 50px 30px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 22 }}>
          <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -1 }}>{cur.category_name}</div>
          <div style={{ fontSize: 24, color: '#A3A3A3' }}>{shown.length} canais · botão amarelo favorita</div>
        </div>
        <div ref={gridRef} style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(' + COLS + ', 1fr)', gap: 18, alignContent: 'start', padding: '8px 8px 20px' }}>
          {chLoading && <div style={{ gridColumn: '1 / -1', color: '#A3A3A3', fontSize: 26 }}>Carregando canais…</div>}
          {!chLoading && shown.length === 0 && <div style={{ gridColumn: '1 / -1', color: '#888', fontSize: 28, padding: '40px 0' }}>{cur.category_id === FAV ? 'Nenhum favorito ainda. Aperte o botão amarelo em um canal.' : 'Nenhum canal nesta categoria.'}</div>}
          {shown.map(function (ch, i) {
            const foc = area === 'grid' && gIdx === i;
            const fav = favs.some(f => f.stream_id === ch.stream_id);
            return (
              <div key={ch.stream_id} onClick={() => openChannel(ch)} style={{
                padding: '20px 22px', borderRadius: 18, background: foc ? '#262626' : '#141414', minHeight: 150, boxSizing: 'border-box',
                border: '3px solid ' + (foc ? '#fff' : 'transparent'), transform: foc ? 'scale(1.06)' : 'none', transition: 'transform 0.2s ease-out', position: 'relative', zIndex: foc ? 2 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ minWidth: 76, height: 50, borderRadius: 10, background: colorOf(ch.name), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', overflow: 'hidden' }}>
                    {ch.stream_icon ? <img src={ch.stream_icon} alt="" style={{ maxWidth: 76, maxHeight: 44, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} /> : <span style={{ fontWeight: 900, fontSize: 20 }}>{String(ch.name || '?').slice(0, 5).toUpperCase()}</span>}
                  </div>
                  <span style={{ fontSize: 30, color: fav ? '#FBBF24' : '#666' }}>{fav ? '★' : '☆'}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
                <div style={{ fontSize: 24, marginTop: 6 }}><b style={{ color: '#F87171' }}>{opening === ch.stream_id ? 'ABRINDO…' : 'AO VIVO'}</b></div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 30, fontSize: 24, color: '#A3A3A3', paddingTop: 6 }}>
          <span>◀ categorias</span><span><b style={{ color: '#fff' }}>OK</b> assistir</span><span><b style={{ color: '#fff' }}>Botão amarelo</b> favoritar</span>
        </div>
      </div>
    </div>
  );
}
