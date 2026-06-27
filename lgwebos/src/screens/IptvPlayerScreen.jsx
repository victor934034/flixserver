import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { KEY, useKeyDown } from '../hooks/useNav.js';

const ACCENT   = '#c91c2c';
const HIDE_MS  = 5000;

export default function IptvPlayerScreen() {
  const navigate  = useNavigate();
  const { state } = useLocation();
  const { url = '', name = '', logo = '' } = state || {};

  const videoRef    = useRef(null);
  const hideTimer   = useRef(null);
  const retryRef    = useRef(0);

  const [ctrlVisible, setCtrlVisible] = useState(true);
  const [isPlaying,   setIsPlaying]   = useState(true);
  const [buffering,   setBuffering]   = useState(true);
  const [hasError,    setHasError]    = useState(false);

  const schedHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setCtrlVisible(false), HIDE_MS);
  }, []);

  const showCtrl = useCallback(() => {
    setCtrlVisible(true);
    schedHide();
  }, [schedHide]);

  useEffect(() => {
    schedHide();
    return () => clearTimeout(hideTimer.current);
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
    showCtrl();
  }

  function retry() {
    const v = videoRef.current;
    if (!v) return;
    retryRef.current += 1;
    setHasError(false);
    setBuffering(true);
    v.load();
    v.play().catch(() => {});
    showCtrl();
  }

  useKeyDown(e => {
    const k = e.keyCode;
    if (k === KEY.BACK || k === KEY.BACKSPACE) { e.preventDefault(); navigate(-1); return; }
    if (k === KEY.ENTER || k === KEY.PLAY || k === KEY.PAUSE) {
      e.preventDefault();
      if (hasError) { retry(); return; }
      togglePlay();
      return;
    }
    showCtrl();
  });

  if (!url) return (
    <div style={absCenter}>
      <div style={{ color: '#fff', fontSize: 18 }}>URL inválida</div>
      <button onClick={() => navigate(-1)} style={backBtn}>Voltar</button>
    </div>
  );

  return (
    <div
      style={{ width: '100%', height: '100%', background: '#000', position: 'relative', overflow: 'hidden' }}
      onClick={showCtrl}
    >
      {/* Video */}
      <video
        key={url}
        ref={videoRef}
        src={url}
        autoPlay
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        onPlay={() => { setIsPlaying(true); setBuffering(false); setHasError(false); }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onError={() => { setHasError(true); setBuffering(false); }}
      />

      {/* Buffering spinner */}
      {buffering && !hasError && (
        <div style={absCenter}>
          <div style={{ width: 60, height: 60, border: '4px solid rgba(255,255,255,0.08)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} />
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 18 }}>Carregando canal…</div>
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div style={{ ...absCenter, background: 'rgba(0,0,0,0.88)', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 52 }}>⚠️</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>Canal indisponível</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 480 }}>
            Verifique sua conexão ou tente outro canal.
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <button onClick={retry} style={{ ...accentBtnSt }}>Tentar novamente</button>
            <button onClick={() => navigate(-1)} style={{ ...ghostBtnSt }}>Voltar</button>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: ctrlVisible ? 1 : 0,
        transition: 'opacity 0.35s ease',
        pointerEvents: ctrlVisible ? 'auto' : 'none',
      }}>
        {/* Gradient top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 160,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
        {/* Gradient bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center', gap: 20,
          padding: '32px 52px',
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.15)',
              borderRadius: 30, padding: '9px 20px',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              backdropFilter: 'blur(6px)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            Voltar
          </button>

          {!!logo && (
            <img src={logo} alt="" style={{ width: 52, height: 38, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.08)', padding: 3 }} />
          )}

          <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>

          {/* LIVE badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: ACCENT, borderRadius: 7, padding: '7px 14px',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', animation: 'glow 1.8s ease-in-out infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>AO VIVO</span>
          </div>
        </div>

        {/* Center play/pause */}
        {!buffering && !hasError && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            {!isPlaying && (
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: 'rgba(255,255,255,0.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 40px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.6)',
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="#0a0a0a">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Bottom bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 52px 32px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {/* Play/pause button */}
          <button
            onClick={togglePlay}
            style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 3 }}><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
            📡 Transmissão ao vivo
          </div>
        </div>
      </div>
    </div>
  );
}

const absCenter = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 12,
};
const accentBtnSt = {
  background: ACCENT, border: 'none', borderRadius: 10, padding: '12px 28px',
  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
};
const ghostBtnSt = {
  background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.18)',
  borderRadius: 10, padding: '12px 28px',
  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
};
const backBtn = {
  background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)',
  borderRadius: 10, padding: '12px 28px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 20,
};
