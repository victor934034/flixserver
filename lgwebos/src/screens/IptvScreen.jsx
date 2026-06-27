import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { iptvAPI } from '../api/index.js';
import { KEY, useKeyDown } from '../hooks/useNav.js';

const COLS   = 5;
const CARD_H = 100;
const GAP    = 14;
const PAD    = 60;
const ACCENT = '#c91c2c';

let _catCache    = null;
let _statusCache = null;

function CategoryCard({ item, focused, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, height: CARD_H, borderRadius: 12,
        background: focused ? '#fff' : 'rgba(255,255,255,0.06)',
        border: '2px solid ' + (focused ? '#fff' : 'rgba(255,255,255,0.07)'),
        display: 'flex', alignItems: 'center', padding: '0 22px', gap: 14,
        cursor: 'pointer',
        transform: focused ? 'scale(1.04)' : 'scale(1)',
        transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
        boxShadow: focused ? '0 8px 32px rgba(0,0,0,0.5)' : 'none',
      }}
    >
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          fontSize: 14, fontWeight: focused ? 800 : 600,
          color: focused ? '#0a0a0a' : '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color 0.18s',
        }}>
          {item.category_name}
        </div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill={focused ? '#0a0a0a' : 'rgba(255,255,255,0.25)'}>
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
      </svg>
    </div>
  );
}

export default function IptvScreen() {
  const navigate = useNavigate();
  const [status,     setStatus]     = useState(_statusCache || 'loading');
  const [categories, setCategories] = useState(_catCache || []);
  const [focusRow,   setFocusRow]   = useState(0);
  const [focusCol,   setFocusCol]   = useState(0);
  const scrollRef = useRef(null);
  const st = useRef({});

  useEffect(() => {
    (async () => {
      try {
        const { data } = await iptvAPI.status();
        _statusCache = data.status;
        setStatus(data.status);
        if (data.status === 'active') {
          if (!_catCache) {
            const res = await iptvAPI.categories();
            _catCache = Array.isArray(res.data) ? res.data : [];
          }
          setCategories(_catCache);
        }
      } catch {
        if (!_catCache) setStatus('none');
      }
    })();
  }, []);

  const rows = Math.ceil(categories.length / COLS);

  st.current = { focusRow, focusCol, rows, categories };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rowTop = focusRow * (CARD_H + GAP);
    const rowBot = rowTop + CARD_H;
    const vTop   = el.scrollTop;
    const vBot   = vTop + el.clientHeight;
    if (rowTop < vTop + 20)      el.scrollTop = rowTop - 20;
    else if (rowBot > vBot - 20) el.scrollTop = rowBot - el.clientHeight + 20;
  }, [focusRow]);

  useKeyDown(e => {
    const { focusRow, focusCol, rows, categories } = st.current;
    const k = e.keyCode;

    if (k === KEY.BACK || k === KEY.BACKSPACE) { e.preventDefault(); navigate('/'); return; }

    const colsInRow = (r) => Math.min(COLS, categories.length - r * COLS);

    if (k === KEY.UP) {
      e.preventDefault();
      if (focusRow > 0) {
        const nr = focusRow - 1;
        setFocusRow(nr);
        setFocusCol(c => Math.min(c, colsInRow(nr) - 1));
      }
    }
    if (k === KEY.DOWN) {
      e.preventDefault();
      if (focusRow < rows - 1) {
        const nr = focusRow + 1;
        setFocusRow(nr);
        setFocusCol(c => Math.min(c, colsInRow(nr) - 1));
      }
    }
    if (k === KEY.LEFT) {
      e.preventDefault();
      if (focusCol > 0) setFocusCol(f => f - 1);
    }
    if (k === KEY.RIGHT) {
      e.preventDefault();
      if (focusCol < colsInRow(focusRow) - 1) setFocusCol(f => f + 1);
    }
    if (k === KEY.ENTER) {
      e.preventDefault();
      const cat = categories[focusRow * COLS + focusCol];
      if (cat) navigate('/iptv-channels', { state: { category_id: cat.category_id, category_name: cat.category_name } });
    }
  });

  if (status === 'loading') return (
    <div style={centerStyle}>
      <div style={spinStyle} />
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 16, marginTop: 20 }}>Carregando IPTV…</div>
    </div>
  );

  if (status === 'none') return (
    <div style={centerStyle}>
      <div style={{ fontSize: 68, marginBottom: 16 }}>📺</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 12 }}>FlixHome IPTV</div>
      <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 520, lineHeight: 1.6, marginBottom: 32 }}>
        Você ainda não tem uma assinatura IPTV ativa.<br/>Entre em contato com o administrador.
      </div>
      <button onClick={() => navigate('/')} style={backBtnStyle}>← Voltar</button>
    </div>
  );

  if (status === 'pending') return (
    <div style={centerStyle}>
      <div style={{ fontSize: 68, marginBottom: 16 }}>⏳</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 12 }}>Ativando IPTV…</div>
      <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 520, lineHeight: 1.6, marginBottom: 32 }}>
        Sua assinatura está sendo ativada pelo administrador.<br/>Volte em breve.
      </div>
      <button onClick={() => navigate('/')} style={backBtnStyle}>← Voltar</button>
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '32px ' + PAD + 'px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 24 }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.10)',
            borderRadius: 30, padding: '9px 20px',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Início
        </button>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill={ACCENT}><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM9 10l6 3.5L9 17z"/></svg>
            IPTV
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
            {categories.length} categorias disponíveis
          </div>
        </div>
      </div>

      {/* Grid */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '4px ' + PAD + 'px ' + PAD + 'px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {Array.from({ length: rows }, (_, ri) => {
            const rowCats = categories.slice(ri * COLS, ri * COLS + COLS);
            return (
              <div key={ri} style={{ display: 'flex', gap: GAP }}>
                {rowCats.map((cat, ci) => (
                  <CategoryCard
                    key={cat.category_id}
                    item={cat}
                    focused={focusRow === ri && focusCol === ci}
                    onClick={() => navigate('/iptv-channels', { state: { category_id: cat.category_id, category_name: cat.category_name } })}
                  />
                ))}
                {/* Fill empty slots so row has COLS items */}
                {rowCats.length < COLS && Array.from({ length: COLS - rowCats.length }, (_, fi) => (
                  <div key={'empty-' + fi} style={{ flex: 1, height: CARD_H }} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const centerStyle = {
  width: '100%', height: '100%', background: '#0a0a0a',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
};
const spinStyle = {
  width: 48, height: 48, border: '3px solid rgba(255,255,255,0.06)',
  borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.85s linear infinite',
};
const backBtnStyle = {
  background: ACCENT, border: 'none', borderRadius: 10, padding: '14px 36px',
  color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
};
