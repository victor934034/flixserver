import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { KEY, useKeyDown } from '../hooks/useNav.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { historyAPI } from '../api/index.js';

const SEEK_S  = 10;
const HIDE_MS = 5000;
const ACCENT  = '#c91c2c';

const TRACK_META = {
  dubbing:   { label: 'Dublado',   sub: 'Áudio em português' },
  subtitled: { label: 'Legendado', sub: 'Áudio original' },
  cinema:    { label: 'Cinema',    sub: 'Sem legenda' },
};
const SUB_META = { pt: 'Português', en: 'English', es: 'Español', off: 'Desativado' };

function fmt(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return h + ':' + String(m % 60).padStart(2,'0') + ':' + String(s % 60).padStart(2,'0');
  return m + ':' + String(s % 60).padStart(2,'0');
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IC = {
  play: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="#0a0a0a">
      <path d="M8 5v14l11-7z"/>
    </svg>
  ),
  pause: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#0a0a0a">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  ),
  back10: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
      <text x="12" y="14.5" textAnchor="middle" fontSize="5" fontWeight="bold" fill="currentColor">10</text>
    </svg>
  ),
  fwd10: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
      <text x="12" y="14.5" textAnchor="middle" fontSize="5" fontWeight="bold" fill="currentColor">10</text>
    </svg>
  ),
  prev: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
    </svg>
  ),
  next: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
    </svg>
  ),
  skip: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.58 16.89 10.47 12 5.58 7.11 7 5.7l6 6-6 6zM16 6h2v12h-2z"/>
    </svg>
  ),
  audio: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  ),
  cc: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/>
    </svg>
  ),
  config: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
    </svg>
  ),
  back: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
};

// ── Small icon control button (icon + label below) ────────────────────────────
function CtrlBtn({ id, label, icon, focused, onClick, active, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
        minWidth: 72,
      }}
    >
      <div style={{
        width: 54, height: 54, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: focused
          ? '2.5px solid #fff'
          : active ? '2px solid ' + ACCENT : '2px solid rgba(255,255,255,0.22)',
        background: focused
          ? 'rgba(255,255,255,0.18)'
          : active ? 'rgba(201,28,44,0.2)' : 'transparent',
        transform: focused ? 'scale(1.12)' : 'scale(1)',
        transition: 'all 0.16s cubic-bezier(.4,0,.2,1)',
        color: active && !focused ? ACCENT : 'rgba(255,255,255,0.88)',
        boxShadow: focused ? '0 0 18px rgba(255,255,255,0.25)' : 'none',
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: 12, fontWeight: 600,
        color: focused ? '#fff' : 'rgba(255,255,255,0.45)',
        whiteSpace: 'nowrap', letterSpacing: 0.3,
        transition: 'color 0.16s',
      }}>
        {label}
      </span>
    </button>
  );
}

// ── Big play/pause button ─────────────────────────────────────────────────────
function PlayBtn({ paused, focused, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
      }}
    >
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: focused ? '#fff' : 'rgba(255,255,255,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: focused
          ? '0 0 0 6px rgba(255,255,255,0.28), 0 0 40px rgba(255,255,255,0.35), 0 8px 32px rgba(0,0,0,0.6)'
          : '0 4px 24px rgba(0,0,0,0.6)',
        animation: focused ? 'pulseRing 1.4s ease-out infinite' : 'none',
        transform: focused ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.16s, box-shadow 0.16s, background 0.16s',
        flexShrink: 0,
      }}>
        {paused ? IC.play : IC.pause}
      </div>
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: focused ? '#fff' : 'rgba(255,255,255,0.5)',
        letterSpacing: 0.3, transition: 'color 0.16s',
      }}>
        {paused ? 'Reproduzir' : 'Pausar'}
      </span>
    </button>
  );
}

// ── Panel option ──────────────────────────────────────────────────────────────
function PanelOpt({ label, sub, active, focused, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 20px', borderRadius: 10, cursor: 'pointer',
        outline: 'none', width: '100%', textAlign: 'left',
        background: focused ? 'rgba(255,255,255,0.10)' : 'transparent',
        border: focused ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        border: '2px solid ' + (active ? ACCENT : 'rgba(255,255,255,0.3)'),
        background: active ? ACCENT : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
        )}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: active ? 700 : 500, color: active ? '#fff' : 'rgba(255,255,255,0.7)' }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{sub}</div>}
      </div>
    </button>
  );
}

// ── PlayerScreen ──────────────────────────────────────────────────────────────
export default function PlayerScreen() {
  const navigate          = useNavigate();
  const { state }         = useLocation();
  const { activeProfile } = useAuth();
  const {
    url:          initialUrl  = '',
    title                     = '',
    tracks                    = {},
    subtitles                 = {},
    skipIntroTo               = null,
    seriesContext             = null,
    contentMeta               = null,
  } = state || {};

  const availTracks = ['dubbing','subtitled','cinema'].filter(k => !!tracks[k]);
  const availSubs   = [].concat(['pt','en','es'].filter(k => !!subtitles[k]), ['off']);
  const initTrack   = availTracks.find(k => tracks[k] === initialUrl) || availTracks[0] || 'dubbing';

  const videoRef   = useRef(null);
  const hideTimer  = useRef(null);
  const switchPos  = useRef(null);
  const wasLoaded  = useRef(false);

  const [trackKey,     setTrackKey]     = useState(initTrack);
  const [subKey,       setSubKey]       = useState('off');
  const [panel,        setPanel]        = useState(null); // null|'audio'|'sub'|'config'
  const [ctrlVisible,  setCtrlVisible]  = useState(true);
  const [loaded,       setLoaded]       = useState(false);
  const [buffering,    setBuffering]    = useState(false);
  const [error,        setError]        = useState(null);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [buffered,     setBuffered]     = useState(0);
  const [paused,       setPaused]       = useState(false);
  const [focusedBtn,   setFocusedBtn]   = useState(2); // default: play button
  const [focusedPanel, setFocusedPanel] = useState(0);
  const currentUrl  = tracks[trackKey] || initialUrl;
  const progress    = duration > 0 ? currentTime / duration : 0;
  const bufProgress = duration > 0 ? buffered / duration : 0;

  const nextEp = useMemo(() => {
    if (!seriesContext) return null;
    const { seriesTitle, episodes, currentEpId } = seriesContext;
    const idx = episodes.findIndex(e => e.id === currentEpId);
    if (idx < 0 || idx >= episodes.length - 1) return null;
    const next    = episodes[idx + 1];
    const nextUrl = next.file_dubbing || next.file_subtitled || next.file_cinema;
    if (!nextUrl) return null;
    const epLabel = 'T' + next.season_number + 'E' + String(next.episode_number).padStart(2,'0');
    return {
      url: nextUrl,
      title: seriesTitle + ' · ' + epLabel + (next.title ? ' · ' + next.title : ''),
      tracks:    { dubbing: next.file_dubbing||null, subtitled: next.file_subtitled||null, cinema: next.file_cinema||null },
      subtitles: { pt: next.subtitle_pt||null, en: next.subtitle_en||null, es: next.subtitle_es||null },
      skipIntroTo: null,
      seriesContext: Object.assign({}, seriesContext, { currentEpId: next.id }),
      contentMeta: { content_type: 'episode', content_id: next.id, episode_id: next.id, series_id: contentMeta && contentMeta.series_id },
    };
  }, [seriesContext, contentMeta]);

  const prevEp = useMemo(() => {
    if (!seriesContext) return null;
    const { seriesTitle, episodes, currentEpId } = seriesContext;
    const idx = episodes.findIndex(e => e.id === currentEpId);
    if (idx <= 0) return null;
    const prev    = episodes[idx - 1];
    const prevUrl = prev.file_dubbing || prev.file_subtitled || prev.file_cinema;
    if (!prevUrl) return null;
    const epLabel = 'T' + prev.season_number + 'E' + String(prev.episode_number).padStart(2,'0');
    return {
      url: prevUrl,
      title: seriesTitle + ' · ' + epLabel + (prev.title ? ' · ' + prev.title : ''),
      tracks:    { dubbing: prev.file_dubbing||null, subtitled: prev.file_subtitled||null, cinema: prev.file_cinema||null },
      subtitles: { pt: prev.subtitle_pt||null, en: prev.subtitle_en||null, es: prev.subtitle_es||null },
      skipIntroTo: null,
      seriesContext: Object.assign({}, seriesContext, { currentEpId: prev.id }),
      contentMeta: { content_type: 'episode', content_id: prev.id, episode_id: prev.id, series_id: contentMeta && contentMeta.series_id },
    };
  }, [seriesContext, contentMeta]);

  // Build button list (left group + right group)
  const leftBtns = useMemo(() => {
    const b = [];
    if (prevEp) b.push({ id: 'prev',   label: 'Anterior',    icon: IC.prev });
    b.push(      { id: 'back10', label: 'Voltar 10s',   icon: IC.back10 });
    b.push(      { id: 'play',   label: null,            icon: null });  // placeholder for play button
    b.push(      { id: 'fwd10',  label: 'Avançar 10s',  icon: IC.fwd10 });
    if (nextEp) b.push({ id: 'next',   label: 'Próximo',     icon: IC.next });
    return b;
  }, [prevEp, nextEp]);

  const rightBtns = useMemo(() => {
    const b = [];
    const showSkip = skipIntroTo && currentTime > 8 && currentTime < skipIntroTo / 1000;
    if (showSkip) b.push({ id: 'skip',   label: 'Pular Abertura', icon: IC.skip });
    if (availTracks.length > 1) b.push({ id: 'audio', label: 'Áudio', icon: IC.audio });
    if (availSubs.length > 1)   b.push({ id: 'cc',    label: 'CC',    icon: IC.cc   });
    b.push({ id: 'config', label: 'Configurações', icon: IC.config });
    return b;
  }, [skipIntroTo, currentTime, availTracks.length, availSubs.length]);

  const allBtns = useMemo(() => [...leftBtns, ...rightBtns], [leftBtns, rightBtns]);

  const panelOptions = useMemo(() => {
    if (panel === 'audio') return availTracks.map(k => ({ key: k, label: TRACK_META[k]?.label, sub: TRACK_META[k]?.sub, active: k === trackKey }));
    if (panel === 'sub')   return availSubs.map(k   => ({ key: k, label: SUB_META[k], active: k === subKey }));
    if (panel === 'config') return [
      { key: 'quality', label: 'Qualidade: Auto', sub: 'Ajuste automático de qualidade', active: true },
    ];
    return [];
  }, [panel, availTracks, availSubs, trackKey, subKey]);

  const showControls = useCallback(() => {
    setCtrlVisible(true);
    clearTimeout(hideTimer.current);
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (!panel) setCtrlVisible(false); }, HIDE_MS);
  }, [panel]);

  useEffect(() => {
    if (paused || panel) showControls();
    else if (loaded) { showControls(); scheduleHide(); }
    return () => clearTimeout(hideTimer.current);
  }, [paused, panel, loaded]);

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
  }

  const saveHistory = useCallback(() => {
    const v = videoRef.current;
    if (!v || !contentMeta || v.currentTime < 5) return;
    const profileId = activeProfile && activeProfile.id;
    historyAPI.save({
      ...contentMeta,
      progress: Math.floor(v.currentTime),
      duration: Math.floor(v.duration) || 0,
      profile_id: profileId || null,
    }).catch(() => {});
  }, [contentMeta, activeProfile]);

  // Save history every 30s while playing
  useEffect(() => {
    if (!contentMeta) return;
    const id = setInterval(saveHistory, 30000);
    return () => {
      clearInterval(id);
      saveHistory(); // save on unmount/episode change
    };
  }, [saveHistory, contentMeta, currentUrl]);

  function onCanPlay() {
    if (!wasLoaded.current) {
      wasLoaded.current = true;
      if (switchPos.current !== null) {
        videoRef.current.currentTime = switchPos.current;
        switchPos.current = null;
      }
    }
    setLoaded(true);
    setBuffering(false);
  }

  useEffect(() => { setLoaded(false); wasLoaded.current = false; }, [currentUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    Array.from(v.textTracks || []).forEach(t => {
      t.mode = t.language === subKey ? 'showing' : 'disabled';
    });
  }, [subKey, loaded]);

  function execBtn(btn) {
    const v = videoRef.current;
    if (!btn) return;
    if (btn.id === 'play') {
      if (v) { if (paused) v.play(); else v.pause(); }
    } else if (btn.id === 'back10') {
      if (v) v.currentTime = Math.max(0, v.currentTime - SEEK_S);
    } else if (btn.id === 'fwd10') {
      if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + SEEK_S);
    } else if (btn.id === 'prev' && prevEp) {
      navigate('/player', { state: prevEp, replace: true });
    } else if (btn.id === 'next' && nextEp) {
      navigate('/player', { state: nextEp, replace: true });
    } else if (btn.id === 'skip' && skipIntroTo) {
      if (v) v.currentTime = skipIntroTo / 1000;
    } else if (btn.id === 'audio') {
      setPanel(p => p === 'audio' ? null : 'audio');
      setFocusedPanel(0);
    } else if (btn.id === 'cc') {
      setPanel(p => p === 'sub' ? null : 'sub');
      setFocusedPanel(0);
    } else if (btn.id === 'config') {
      setPanel(p => p === 'config' ? null : 'config');
      setFocusedPanel(0);
    }
  }

  useKeyDown(e => {
    const k = e.keyCode;

    if (k === KEY.BACK || k === KEY.BACKSPACE) {
      e.preventDefault();
      if (panel) { setPanel(null); showControls(); return; }
      navigate(-1); return;
    }

    showControls();
    if (!paused) scheduleHide();

    const v = videoRef.current;

    if (panel) {
      if (k === KEY.UP)    { e.preventDefault(); setFocusedPanel(p => Math.max(0, p - 1)); }
      if (k === KEY.DOWN)  { e.preventDefault(); setFocusedPanel(p => Math.min(panelOptions.length - 1, p + 1)); }
      if (k === KEY.ENTER) {
        const opt = panelOptions[focusedPanel];
        if (!opt) return;
        if (panel === 'audio') {
          if (opt.key !== trackKey) { switchPos.current = currentTime; setTrackKey(opt.key); }
          setPanel(null);
        } else if (panel === 'sub') {
          setSubKey(opt.key);
          setPanel(null);
        }
      }
      return;
    }

    if (k === KEY.LEFT)  { e.preventDefault(); setFocusedBtn(b => Math.max(0, b - 1)); }
    if (k === KEY.RIGHT) { e.preventDefault(); setFocusedBtn(b => Math.min(allBtns.length - 1, b + 1)); }
    if (k === KEY.UP || k === KEY.DOWN) { e.preventDefault(); }
    if (k === KEY.REWIND)   { if (v) v.currentTime = Math.max(0, v.currentTime - SEEK_S); }
    if (k === KEY.FAST_FWD) { if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + SEEK_S); }
    if (k === KEY.PLAY || k === KEY.PAUSE) {
      if (v) { if (paused) v.play(); else v.pause(); }
    }
    if (k === KEY.ENTER) {
      execBtn(allBtns[focusedBtn]);
    }
  }, [panel, focusedBtn, focusedPanel, panelOptions, paused, currentTime, skipIntroTo, nextEp, prevEp, trackKey, allBtns]);

  const subTracks = ['pt','en','es'].filter(k => !!subtitles[k]);

  const playBtnIdx = leftBtns.findIndex(b => b.id === 'play');
  const playBtnGlobalIdx = playBtnIdx; // play is in leftBtns which is first

  return (
    <div
      style={{ width: '100%', height: '100%', background: '#000', position: 'relative', overflow: 'hidden' }}
      onMouseMove={() => { showControls(); if (!paused) scheduleHide(); }}
    >
      <video
        ref={videoRef}
        src={currentUrl}
        autoPlay
        preload="auto"
        crossOrigin="anonymous"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={() => setDuration(videoRef.current ? videoRef.current.duration || 0 : 0)}
        onCanPlay={onCanPlay}
        onPlay={() => { setPaused(false); setBuffering(false); }}
        onPause={() => setPaused(true)}
        onWaiting={() => { if (loaded) setBuffering(true); }}
        onStalled={() => { if (loaded) setBuffering(true); }}
        onPlaying={() => setBuffering(false)}
        onError={() => setError('Não foi possível reproduzir o vídeo')}
        onEnded={() => { if (nextEp) navigate('/player', { state: nextEp, replace: true }); else navigate(-1); }}
      >
        {subTracks.map(lang => (
          <track key={lang} kind="subtitles" label={SUB_META[lang]} srcLang={lang} src={subtitles[lang]} />
        ))}
      </video>

      {/* Initial loading (before canplay) */}
      {!error && !loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, background: '#000' }}>
          <div style={{ width: 56, height: 56, border: '3px solid rgba(255,255,255,0.08)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} />
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1 }}>Abrindo vídeo…</div>
        </div>
      )}

      {/* Buffering overlay (after initial load, while stalled) */}
      {!error && loaded && buffering && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 64, height: 64, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} />
        </div>
      )}

      {/* Error */}
      {!!error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)', gap: 18 }}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill={ACCENT}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>Não foi possível reproduzir</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', maxWidth: 480, textAlign: 'center' }}>{error}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>Pressione Voltar para sair</div>
        </div>
      )}

      {/* Controls overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: ctrlVisible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: ctrlVisible ? 'auto' : 'none',
      }}>
        {/* Background gradients */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 22%, transparent 60%, rgba(0,0,0,0.75) 82%, rgba(0,0,0,0.96) 100%)',
        }} />

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '28px 52px',
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.10)',
              border: '1.5px solid rgba(255,255,255,0.15)',
              borderRadius: 40, padding: '9px 20px',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              backdropFilter: 'blur(6px)',
              transition: 'background 0.15s',
            }}
          >
            {IC.back}
            Voltar
          </button>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: 18, fontWeight: 700, color: '#fff',
              textShadow: '0 2px 8px rgba(0,0,0,0.9)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title}
            </div>
            {seriesContext && seriesContext.currentEpId && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {(() => {
                  const ep = seriesContext.episodes.find(e => e.id === seriesContext.currentEpId);
                  if (!ep) return null;
                  return 'T' + ep.season_number + ' · E' + ep.episode_number + (ep.title ? ' · ' + ep.title : '');
                })()}
              </div>
            )}
          </div>

          {/* Next ep indicator */}
          {nextEp && (
            <div style={{
              fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500,
              background: 'rgba(255,255,255,0.08)', borderRadius: 6,
              padding: '6px 14px', border: '1px solid rgba(255,255,255,0.10)',
            }}>
              Próximo ep. disponível
            </div>
          )}
        </div>

        {/* ── Subtitle display ──────────────────────────────────────────────── */}
        {subKey !== 'off' && (
          <div style={{
            position: 'absolute', bottom: 210, left: 0, right: 0,
            textAlign: 'center', pointerEvents: 'none',
          }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(0,0,0,0.75)',
              padding: '8px 20px', borderRadius: 6,
              fontSize: 22, fontWeight: 600, color: '#fff',
              textShadow: '0 2px 6px rgba(0,0,0,0.9)',
              maxWidth: '80%',
            }}>
              {/* subtitles rendered by <track> element */}
            </div>
          </div>
        )}

        {/* ── Panel ────────────────────────────────────────────────────────── */}
        {!!panel && (
          <div style={{
            position: 'absolute', bottom: 200, left: 52,
            minWidth: 300, maxWidth: 420,
            background: 'rgba(12,12,14,0.97)',
            borderRadius: 14, border: '1px solid rgba(255,255,255,0.09)',
            padding: '12px 8px',
            boxShadow: '0 -16px 48px rgba(0,0,0,0.8)',
            animation: 'slideUp 0.2s ease',
            zIndex: 10,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase', letterSpacing: 1.5,
              padding: '4px 16px 10px',
            }}>
              {panel === 'audio' ? 'Idioma de Áudio' : panel === 'sub' ? 'Legenda' : 'Configurações'}
            </div>
            {panelOptions.map((opt, i) => (
              <PanelOpt
                key={opt.key || i}
                label={opt.label}
                sub={opt.sub}
                active={opt.active}
                focused={focusedPanel === i}
                onClick={() => {
                  if (panel === 'audio') { if (opt.key !== trackKey) { switchPos.current = currentTime; setTrackKey(opt.key); } setPanel(null); }
                  else if (panel === 'sub') { setSubKey(opt.key); setPanel(null); }
                }}
              />
            ))}
          </div>
        )}

        {/* ── Bottom controls ───────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 52px 36px',
        }}>
          {/* Progress bar */}
          <div style={{
            height: 6, background: 'rgba(255,255,255,0.18)',
            borderRadius: 3, marginBottom: 24, position: 'relative', cursor: 'pointer',
          }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct  = (e.clientX - rect.left) / rect.width;
              const v    = videoRef.current;
              if (v && v.duration) v.currentTime = pct * v.duration;
            }}
          >
            {/* Buffer fill */}
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: (bufProgress * 100) + '%',
              background: 'rgba(255,255,255,0.28)', borderRadius: 3,
            }} />
            {/* Play fill */}
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: (progress * 100) + '%',
              background: ACCENT, borderRadius: 3,
            }} />
            {/* Thumb */}
            <div style={{
              position: 'absolute', top: '50%',
              width: 18, height: 18, borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 0 10px rgba(255,255,255,0.5)',
              transform: 'translate(-50%, -50%)',
              left: (progress * 100) + '%',
              transition: 'left 0.1s',
            }} />
          </div>

          {/* Time + controls row */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {/* Time left */}
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)', minWidth: 64, flexShrink: 0, paddingBottom: 6 }}>
              {fmt(currentTime)}
            </div>

            {/* Left button group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {leftBtns.map((btn, i) => {
                const globalIdx = i;
                const focused   = focusedBtn === globalIdx;
                if (btn.id === 'play') {
                  return (
                    <PlayBtn
                      key="play"
                      paused={paused}
                      focused={focused}
                      onClick={() => { const v = videoRef.current; if (v) { if (paused) v.play(); else v.pause(); } }}
                    />
                  );
                }
                return (
                  <CtrlBtn
                    key={btn.id}
                    id={btn.id}
                    label={btn.label}
                    icon={btn.icon}
                    focused={focused}
                    onClick={() => execBtn(btn)}
                  />
                );
              })}
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Right button group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {rightBtns.map((btn, i) => {
                const globalIdx = leftBtns.length + i;
                const focused   = focusedBtn === globalIdx;
                const isActive  = (btn.id === 'audio' && panel === 'audio') ||
                                  (btn.id === 'cc'    && panel === 'sub')   ||
                                  (btn.id === 'config' && panel === 'config');
                return (
                  <CtrlBtn
                    key={btn.id}
                    id={btn.id}
                    label={btn.label}
                    icon={btn.icon}
                    focused={focused}
                    active={isActive}
                    onClick={() => execBtn(btn)}
                  />
                );
              })}
            </div>

            {/* Time right */}
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)', minWidth: 64, flexShrink: 0, textAlign: 'right', paddingBottom: 6 }}>
              {fmt(duration)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
