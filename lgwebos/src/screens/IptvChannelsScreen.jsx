import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { iptvAPI } from '../api/index.js';
import { KEY, useKeyDown } from '../hooks/useNav.js';

const ACCENT    = '#c91c2c';
const ITEM_H    = 76;

const _cache = {};

export default function IptvChannelsScreen() {
  const navigate   = useNavigate();
  const { state }  = useLocation();
  const { category_id, category_name } = state || {};

  const [channels,    setChannels]    = useState(_cache[category_id] || []);
  const [loading,     setLoading]     = useState(!_cache[category_id]);
  const [error,       setError]       = useState(null);
  const [focusIdx,    setFocusIdx]    = useState(0);
  const [loadingPlay, setLoadingPlay] = useState(null);

  const scrollRef = useRef(null);
  const itemRefs  = useRef([]);
  const st        = useRef({});
  st.current      = { channels, focusIdx, loadingPlay };

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await iptvAPI.streams(category_id);
      const list = Array.isArray(data) ? data : [];
      _cache[category_id] = list;
      setChannels(list);
    } catch {
      setError('Não foi possível carregar os canais.');
    } finally {
      setLoading(false);
    }
  }, [category_id]);

  useEffect(() => {
    if (!_cache[category_id]) fetch();
  }, []);

  // Keep focused item in view
  useEffect(() => {
    const el = itemRefs.current[focusIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIdx]);

  async function openChannel(ch) {
    if (loadingPlay) return;
    setLoadingPlay(ch.stream_id);
    try {
      const { data } = await iptvAPI.streamUrl(ch.stream_id);
      navigate('/iptv-player', { state: { url: data.url, name: ch.name, logo: ch.stream_icon || '' } });
    } catch {
      setLoadingPlay(null);
    }
  }

  useKeyDown(e => {
    const { channels, focusIdx, loadingPlay } = st.current;
    const k = e.keyCode;
    if (k === KEY.BACK || k === KEY.BACKSPACE) { e.preventDefault(); navigate('/iptv'); return; }
    if (k === KEY.UP)    { e.preventDefault(); setFocusIdx(f => Math.max(0, f - 1)); }
    if (k === KEY.DOWN)  { e.preventDefault(); setFocusIdx(f => Math.min(channels.length - 1, f + 1)); }
    if (k === KEY.ENTER && !loadingPlay) {
      e.preventDefault();
      const ch = channels[focusIdx];
      if (ch) openChannel(ch);
    }
  });

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '28px 52px 20px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={() => navigate('/iptv')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.10)',
            borderRadius: 30, padding: '9px 20px',
            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Voltar
        </button>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{category_name}</div>
          {!loading && !error && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{channels.length} canais</div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={centerStyle}>
          <div style={spinStyle} />
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15, marginTop: 18 }}>Carregando canais…</div>
        </div>
      ) : error ? (
        <div style={centerStyle}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: '#f44336', fontSize: 16, marginBottom: 24, textAlign: 'center', maxWidth: 480 }}>{error}</div>
          <button onClick={fetch} style={accentBtn}>Tentar novamente</button>
        </div>
      ) : channels.length === 0 ? (
        <div style={centerStyle}>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>Nenhum canal encontrado</div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto', padding: '12px 52px 40px' }}
        >
          {channels.map((ch, i) => {
            const focused = focusIdx === i;
            const isLoading = loadingPlay === ch.stream_id;
            return (
              <div
                key={ch.stream_id}
                ref={el => { itemRefs.current[i] = el; }}
                onClick={() => openChannel(ch)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 18,
                  height: ITEM_H, padding: '0 20px',
                  borderRadius: 10, marginBottom: 6,
                  background: focused ? 'rgba(255,255,255,0.09)' : 'transparent',
                  border: '2px solid ' + (focused ? 'rgba(255,255,255,0.55)' : 'transparent'),
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {/* Logo */}
                {ch.stream_icon ? (
                  <img
                    src={ch.stream_icon}
                    alt=""
                    style={{ width: 56, height: 40, objectFit: 'contain', borderRadius: 4, background: '#1a1a1a', flexShrink: 0 }}
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div style={{
                  width: 56, height: 40, borderRadius: 4, background: '#1a1a1a', flexShrink: 0,
                  alignItems: 'center', justifyContent: 'center',
                  display: ch.stream_icon ? 'none' : 'flex',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)">
                    <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM9 10l6 3.5L9 17z"/>
                  </svg>
                </div>

                {/* Name */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: 15, fontWeight: focused ? 700 : 500,
                    color: focused ? '#fff' : 'rgba(255,255,255,0.8)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    transition: 'color 0.15s',
                  }}>
                    {ch.name}
                  </div>
                </div>

                {/* LIVE badge + arrow */}
                {isLoading ? (
                  <div style={spinStyle} />
                ) : (
                  <>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: ACCENT, borderRadius: 5, padding: '4px 10px',
                      opacity: focused ? 1 : 0.55, transition: 'opacity 0.15s',
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 0.8 }}>AO VIVO</span>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={focused ? '#fff' : 'rgba(255,255,255,0.2)'} style={{ flexShrink: 0, transition: 'fill 0.15s' }}>
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const centerStyle = {
  flex: 1, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 12,
};
const spinStyle = {
  width: 36, height: 36, border: '3px solid rgba(255,255,255,0.06)',
  borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.85s linear infinite',
  flexShrink: 0,
};
const accentBtn = {
  background: ACCENT, border: 'none', borderRadius: 10, padding: '13px 32px',
  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
};
