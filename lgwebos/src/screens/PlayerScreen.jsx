import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { KEY, useKeyDown } from '../hooks/useNav.js';

const SEEK_S     = 10;
const HIDE_MS    = 5_000;

const TRACK_META = {
  dubbing:   { label: 'Dublado',   sub: 'Áudio em português' },
  subtitled: { label: 'Legendado', sub: 'Áudio original' },
  cinema:    { label: 'Cinema',    sub: 'Sem legenda' },
};
const SUB_META = { pt: 'Português', en: 'English', es: 'Español', off: 'Desativado' };

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  return `${m}:${String(s % 60).padStart(2,'0')}`;
}

// ─── Control button ───────────────────────────────────────────────────────────
function CtrlBtn({ label, icon, accent, skipStyle, nextStyle, focused: isFocused, onFocus, onPress, refs: btnRef }) {
  return (
    <button
      ref={btnRef}
      onFocus={onFocus}
      onClick={onPress}
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: '12px 22px', borderRadius: 30, cursor: 'none',
        background: accent
          ? isFocused ? '#E50914' : 'rgba(229,9,20,0.75)'
          : isFocused ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
        border: isFocused ? '2px solid #fff' : '2px solid transparent',
        transform: isFocused ? 'scale(1.06)' : 'scale(1)',
        transition: 'background 0.12s, border-color 0.12s, transform 0.12s',
        outline: 'none',
        ...(skipStyle && !accent && isFocused ? { background: 'rgba(255,255,255,0.22)' } : {}),
        ...(nextStyle && isFocused ? { background: '#E50914', boxShadow: '0 0 20px rgba(229,9,20,0.6)' } : {}),
      }}
    >
      {icon && <span style={{ fontSize: 16, color: '#fff' }}>{icon}</span>}
      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

// ─── Panel option ──────────────────────────────────────────────────────────────
function PanelOpt({ label, sub, active, focused: isFocused, refs: btnRef, onFocus, onPress }) {
  return (
    <button
      ref={btnRef}
      onFocus={onFocus}
      onClick={onPress}
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: '12px 18px', borderRadius: 8, cursor: 'none', outline: 'none',
        background: isFocused ? 'rgba(255,255,255,0.12)' : 'transparent',
        border: isFocused ? '2px solid #fff' : '2px solid transparent',
        width: '100%', textAlign: 'left',
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      <span style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E50914', fontSize: 16 }}>
        {active ? '✓' : ''}
      </span>
      <span>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: active ? '#fff' : 'rgba(255,255,255,0.7)' }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{sub}</span>}
      </span>
    </button>
  );
}

// ─── PlayerScreen ─────────────────────────────────────────────────────────────
export default function PlayerScreen() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const {
    url:          initialUrl = '',
    title         = '',
    tracks        = {},
    subtitles     = {},
    skipIntroTo   = null,
    seriesContext = null,
  } = state || {};

  // Available tracks / subs
  const availTracks = ['dubbing', 'subtitled', 'cinema'].filter(k => !!tracks[k]);
  const availSubs   = [...['pt','en','es'].filter(k => !!subtitles[k]), 'off'];

  const initTrack = availTracks.find(k => tracks[k] === initialUrl) ?? availTracks[0] ?? 'dubbing';

  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoRef    = useRef(null);
  const hideTimer   = useRef(null);
  const switchPos   = useRef(null);
  const wasLoaded   = useRef(false);
  // Button refs for native focus()
  const btnRefs     = useRef({});

  // ── State ─────────────────────────────────────────────────────────────────
  const [trackKey,     setTrackKey]    = useState(initTrack);
  const [subKey,       setSubKey]      = useState('off');
  const [panel,        setPanel]       = useState(null); // null|'audio'|'sub'
  const [ctrlVisible,  setCtrlVisible] = useState(true);
  const [loaded,       setLoaded]      = useState(false);
  const [error,        setError]       = useState(null);
  const [currentTime,  setCurrentTime] = useState(0);
  const [duration,     setDuration]    = useState(0);
  const [buffered,     setBuffered]    = useState(0);
  const [paused,       setPaused]      = useState(false);
  // focused button index: 0=seek back, 1=play/pause, 2=seek fwd, 3=skip, 4=nextEp
  const [focusedBtn,   setFocusedBtn]  = useState(1);
  const [focusedPanel, setFocusedPanel] = useState(0);

  const currentUrl  = tracks[trackKey] || initialUrl;
  const progress    = duration > 0 ? currentTime / duration : 0;
  const bufProgress = duration > 0 ? buffered / duration    : 0;

  // Next episode
  const nextEp = useMemo(() => {
    if (!seriesContext) return null;
    const { seriesTitle, backdropUrl, episodes, currentEpId } = seriesContext;
    const idx  = episodes.findIndex(e => e.id === currentEpId);
    if (idx < 0 || idx >= episodes.length - 1) return null;
    const next    = episodes[idx + 1];
    const nextUrl = next.file_dubbing || next.file_subtitled || next.file_cinema;
    if (!nextUrl) return null;
    const epLabel = `T${next.season_number}E${String(next.episode_number).padStart(2, '0')}`;
    return {
      url: nextUrl, poster: next.thumbnail_url || backdropUrl,
      title: `${seriesTitle} · ${epLabel}${next.title ? ` · ${next.title}` : ''}`,
      tracks:    { dubbing: next.file_dubbing||null, subtitled: next.file_subtitled||null, cinema: next.file_cinema||null },
      subtitles: { pt: next.subtitle_pt||null, en: next.subtitle_en||null, es: next.subtitle_es||null },
      skipIntroTo: 90_000,
      seriesContext: { ...seriesContext, currentEpId: next.id },
    };
  }, [seriesContext]);

  // Visible control buttons list
  const buttons = useMemo(() => {
    const btns = [
      { id: 'back10', label: '−10s',     icon: '⏮', accent: false },
      { id: 'play',   label: paused ? 'Reproduzir' : 'Pausar', icon: paused ? '▶' : '⏸', accent: true },
      { id: 'fwd10',  label: '+10s',     icon: '⏭', accent: false },
    ];
    if (skipIntroTo && currentTime > 8 && currentTime < skipIntroTo / 1000) {
      btns.push({ id: 'skip', label: 'Pular abertura', icon: '⏩', accent: false, skipStyle: true });
    }
    if (nextEp) {
      btns.push({ id: 'next', label: 'Próximo ep.', icon: '▶▶', accent: false, nextStyle: true });
    }
    return btns;
  }, [paused, skipIntroTo, currentTime, nextEp]);

  // Panel options
  const panelOptions = useMemo(() => {
    if (panel === 'audio') return availTracks.map(k => ({ key: k, label: TRACK_META[k]?.label, sub: TRACK_META[k]?.sub, active: k === trackKey }));
    if (panel === 'sub')   return availSubs.map(k => ({ key: k, label: SUB_META[k], active: k === subKey }));
    return [];
  }, [panel, availTracks, availSubs, trackKey, subKey]);

  // ── Controls hide/show ────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setCtrlVisible(true);
    clearTimeout(hideTimer.current);
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!panel) setCtrlVisible(false);
    }, HIDE_MS);
  }, [panel]);

  useEffect(() => {
    if (paused || panel) {
      showControls();
    } else if (loaded) {
      showControls();
      scheduleHide();
    }
    return () => clearTimeout(hideTimer.current);
  }, [paused, panel, loaded]);

  // ── Video events ─────────────────────────────────────────────────────────
  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
  }

  function onCanPlay() {
    if (!wasLoaded.current) {
      wasLoaded.current = true;
      if (switchPos.current !== null) {
        videoRef.current.currentTime = switchPos.current;
        switchPos.current = null;
      }
    }
    setLoaded(true);
  }

  // Re-init when URL changes (track switch)
  useEffect(() => {
    setLoaded(false);
    wasLoaded.current = false;
  }, [currentUrl]);

  // ── D-pad: keyboard handler ───────────────────────────────────────────────
  useKeyDown(e => {
    const k = e.keyCode;

    // Back
    if (k === KEY.BACK || k === KEY.BACKSPACE) {
      e.preventDefault();
      if (panel) { setPanel(null); showControls(); return; }
      navigate(-1);
      return;
    }

    showControls();
    if (!paused) scheduleHide();

    const v = videoRef.current;

    // When panel is open: UP/DOWN navigate options, ENTER selects
    if (panel) {
      if (k === KEY.UP)   { e.preventDefault(); setFocusedPanel(p => Math.max(0, p - 1)); }
      if (k === KEY.DOWN) { e.preventDefault(); setFocusedPanel(p => Math.min(panelOptions.length - 1, p + 1)); }
      if (k === KEY.ENTER) {
        const opt = panelOptions[focusedPanel];
        if (!opt) return;
        if (panel === 'audio') {
          if (opt.key !== trackKey) { switchPos.current = currentTime; setTrackKey(opt.key); }
          setPanel(null);
        } else {
          setSubKey(opt.key);
          setPanel(null);
        }
      }
      return;
    }

    // Main controls: LEFT/RIGHT navigate buttons, ENTER activates
    if (k === KEY.LEFT)  { e.preventDefault(); setFocusedBtn(b => Math.max(0, b - 1)); }
    if (k === KEY.RIGHT) { e.preventDefault(); setFocusedBtn(b => Math.min(buttons.length - 1, b + 1)); }
    if (k === KEY.UP || k === KEY.DOWN) { e.preventDefault(); /* just show controls */ }

    if (k === KEY.ENTER || k === KEY.PLAY || k === KEY.PAUSE) {
      const btn = buttons[focusedBtn];
      if (!btn) return;
      if (btn.id === 'play') {
        if (v) paused ? v.play() : v.pause();
      } else if (btn.id === 'back10') {
        if (v) v.currentTime = Math.max(0, v.currentTime - SEEK_S);
      } else if (btn.id === 'fwd10') {
        if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + SEEK_S);
      } else if (btn.id === 'skip') {
        if (v && skipIntroTo) v.currentTime = skipIntroTo / 1000;
      } else if (btn.id === 'next' && nextEp) {
        navigate('/player', { state: nextEp, replace: true });
      }
    }

    // Dedicated media keys
    if (k === KEY.REWIND)   { if (v) v.currentTime = Math.max(0, v.currentTime - SEEK_S); }
    if (k === KEY.FAST_FWD) { if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + SEEK_S); }
  }, [panel, focusedBtn, focusedPanel, buttons, panelOptions, paused, currentTime, skipIntroTo, nextEp, trackKey, subKey]);

  // Subtitle <track> elements
  const subTracks = ['pt','en','es'].filter(k => !!subtitles[k]);

  // Sync video subtitle track
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    Array.from(v.textTracks || []).forEach(t => {
      t.mode = t.language === subKey ? 'showing' : 'disabled';
    });
  }, [subKey, loaded]);

  const TRACK_W = 1920 - 88; // px

  return (
    <div style={{ width: '100%', height: '100%', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* Video */}
      <video
        ref={videoRef}
        src={currentUrl}
        autoPlay
        crossOrigin="anonymous"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
        onCanPlay={onCanPlay}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onError={() => setError('Não foi possível reproduzir o vídeo')}
        onEnded={() => navigate(-1)}
      >
        {subTracks.map(lang => (
          <track key={lang} kind="subtitles" label={SUB_META[lang]} srcLang={lang} src={subtitles[lang]} />
        ))}
      </video>

      {/* Error */}
      {!!error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', gap: 16 }}>
          <span style={{ fontSize: 52, color: '#E50914' }}>⚠</span>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>Não foi possível reproduzir</div>
          <div style={{ fontSize: 14, color: '#888', maxWidth: 400, textAlign: 'center' }}>{error}</div>
          <div style={{ fontSize: 13, color: '#444', marginTop: 8 }}>Pressione Voltar para sair</div>
        </div>
      )}

      {/* Loading */}
      {!error && !loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#E50914', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Abrindo vídeo…</div>
        </div>
      )}

      {/* Pause icon */}
      {loaded && paused && !panel && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: 'rgba(0,0,0,0.55)', border: '2px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 42, color: '#fff', marginLeft: 4 }}>▶</span>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div style={{ position: 'absolute', inset: 0, opacity: ctrlVisible ? 1 : 0, transition: 'opacity 0.4s ease', pointerEvents: ctrlVisible ? 'auto' : 'none' }}>
        {/* Gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, transparent 25%, transparent 62%, rgba(0,0,0,0.80) 82%, rgba(0,0,0,0.97) 100%)', pointerEvents: 'none' }} />

        {/* Top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '28px 44px', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.10)', borderRadius: 20, padding: '7px 16px', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span style={{ fontSize: 14, color: '#fff' }}>←</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Voltar</span>
          </div>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>

          {/* Audio + Subtitle buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            {availTracks.length > 1 && (
              <button
                onClick={() => setPanel(p => p === 'audio' ? null : 'audio')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                  background: panel === 'audio' ? 'rgba(229,9,20,0.25)' : 'rgba(255,255,255,0.10)',
                  borderRadius: 20, border: panel === 'audio' ? '2px solid #E50914' : '2px solid rgba(255,255,255,0.12)',
                  cursor: 'none', outline: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                }}
              >
                🔊 {TRACK_META[trackKey]?.label || 'Áudio'} {panel === 'audio' ? '▲' : '▼'}
              </button>
            )}
            {availSubs.length > 1 && (
              <button
                onClick={() => setPanel(p => p === 'sub' ? null : 'sub')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                  background: panel === 'sub' ? 'rgba(229,9,20,0.25)' : 'rgba(255,255,255,0.10)',
                  borderRadius: 20, border: panel === 'sub' ? '2px solid #E50914' : '2px solid rgba(255,255,255,0.12)',
                  cursor: 'none', outline: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                }}
              >
                💬 {subKey === 'off' ? 'Legenda' : SUB_META[subKey]} {panel === 'sub' ? '▲' : '▼'}
              </button>
            )}
          </div>
        </div>

        {/* Panel dropdown */}
        {!!panel && (
          <div style={{ position: 'absolute', top: 78, right: 44, minWidth: 260, background: 'rgba(14,14,14,0.97)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', padding: '8px 0', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 18px 6px' }}>
              {panel === 'audio' ? 'Idioma de Áudio' : 'Legenda'}
            </div>
            {panelOptions.map((opt, i) => (
              <PanelOpt
                key={opt.key}
                label={opt.label}
                sub={opt.sub}
                active={opt.active}
                focused={focusedPanel === i}
                onFocus={() => setFocusedPanel(i)}
                onPress={() => {
                  if (panel === 'audio') {
                    if (opt.key !== trackKey) { switchPos.current = currentTime; setTrackKey(opt.key); }
                  } else {
                    setSubKey(opt.key);
                  }
                  setPanel(null);
                }}
              />
            ))}
          </div>
        )}

        {/* Bottom controls */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 44px 34px' }}>
          {/* Progress bar */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.20)', borderRadius: 2, marginBottom: 18, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${bufProgress * 100}%`, background: 'rgba(255,255,255,0.32)', borderRadius: 2 }} />
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progress * 100}%`, background: '#E50914', borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: -6, width: 16, height: 16, borderRadius: 8, background: '#E50914', boxShadow: '0 0 8px rgba(229,9,20,0.8)', transform: 'translateX(-50%)', left: `${progress * 100}%` }} />
          </div>

          {/* Buttons row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', minWidth: 52 }}>{fmtTime(currentTime)}</span>

            {buttons.map((btn, i) => (
              <CtrlBtn
                key={btn.id}
                label={btn.label}
                icon={btn.icon}
                accent={btn.accent}
                skipStyle={btn.skipStyle}
                nextStyle={btn.nextStyle}
                focused={focusedBtn === i}
                onFocus={() => setFocusedBtn(i)}
                onPress={() => {
                  if (btn.id === 'play') { const v = videoRef.current; if (v) paused ? v.play() : v.pause(); }
                  else if (btn.id === 'back10') { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - SEEK_S); }
                  else if (btn.id === 'fwd10')  { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration||0, v.currentTime + SEEK_S); }
                  else if (btn.id === 'skip' && skipIntroTo) { const v = videoRef.current; if (v) v.currentTime = skipIntroTo / 1000; }
                  else if (btn.id === 'next' && nextEp) navigate('/player', { state: nextEp, replace: true });
                }}
              />
            ))}

            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', minWidth: 52, textAlign: 'right', marginLeft: 'auto' }}>{fmtTime(duration)}</span>
          </div>

          {/* Hint */}
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>◀ ▶  navegar  ·  OK  selecionar  ·  botão Voltar para sair</span>
          </div>
        </div>
      </div>
    </div>
  );
}
