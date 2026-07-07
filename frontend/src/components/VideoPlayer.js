'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './VideoPlayer.module.css';
import api from '../lib/api';

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IC = {
  play:      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>,
  pause:     <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>,
  back10:    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="8" y="16" fontSize="7" fill="currentColor" textAnchor="middle">10</text></svg>,
  fwd10:     <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="16" y="16" fontSize="7" fill="currentColor" textAnchor="middle">10</text></svg>,
  volHigh:   <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>,
  volLow:    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>,
  volMute:   <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>,
  sub:       <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11H4v-2h8v2zm8 0h-6v-2h6v2zm0-4H4V9h16v2z"/></svg>,
  cast:      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5H8c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z"/></svg>,
  castOk:    <svg width="20" height="20" viewBox="0 0 24 24" fill="#46d369"><path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5H8c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z"/><path d="M9 16.17L4.83 12l-1.42 1.41L9 19l7.59-7.59L15.17 10z"/></svg>,
  fullOn:    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>,
  fullOff:   <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>,
};

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

export default function VideoPlayer({ content, onProgress }) {
  const videoRef     = useRef(null);
  const containerRef = useRef(null);
  const hideTimer    = useRef(null);
  const progressRef  = useRef(null);

  const [version,      setVersion]      = useState('dubbing');
  const [subtitle,     setSubtitle]     = useState('none');
  const [playing,      setPlaying]      = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [buffered,     setBuffered]     = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [muted,        setMuted]        = useState(false);
  const [fullscreen,   setFullscreen]   = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [audioWarning, setAudioWarning] = useState(false);
  const [remuxActive, setRemuxActive]   = useState(false);
  const [castStatus,   setCastStatus]   = useState('idle');
  const [flashIcon,    setFlashIcon]    = useState(null); // 'play' | 'pause'
  const [hoverTime,    setHoverTime]    = useState(null); // { pct, time }

  const versions = [
    { key: 'dubbing',    label: 'Dublado',   url: content.file_dubbing },
    { key: 'subtitled',  label: 'Legendado', url: content.file_subtitled },
    { key: 'cinema',     label: 'Cinema',    url: content.file_cinema },
    { key: '4k',         label: '4K',        url: content.file_4k },
  ].filter(v => v.url);

  const subtitles = [
    { key: 'none', label: 'Sem legenda' },
    { key: 'pt',   label: 'Português', url: content.subtitle_pt },
    { key: 'en',   label: 'Inglês',    url: content.subtitle_en },
    { key: 'es',   label: 'Espanhol',  url: content.subtitle_es },
  ].filter(s => s.key === 'none' || s.url);

  const rawUrl    = versions.find(v => v.key === version)?.url || versions[0]?.url;
  const remuxUrl  = rawUrl ? `/api/remux?url=${encodeURIComponent(rawUrl)}` : null;
  const currentUrl = remuxActive ? remuxUrl : rawUrl;

  const showCtrl = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  // Auto-hide when playing starts
  useEffect(() => {
    if (playing) showCtrl();
    else { setShowControls(true); clearTimeout(hideTimer.current); }
    return () => clearTimeout(hideTimer.current);
  }, [playing]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
      // buffered
      if (video.buffered.length > 0) {
        setBuffered(video.duration ? (video.buffered.end(video.buffered.length - 1) / video.duration) * 100 : 0);
      }
      onProgress?.(video.currentTime, video.duration);
    };
    const onLoaded = () => {
      setDuration(video.duration);
      if (video.audioTracks && video.audioTracks.length === 0) setAudioWarning(true);
    };
    const onEnded  = () => setPlaying(false);
    const onError  = () => {
      // code 4 = MEDIA_ERR_SRC_NOT_SUPPORTED (codec de áudio ou vídeo incompatível)
      if (video.error?.code === 4 || video.error?.code === 3) setAudioWarning(true);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [onProgress]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      switch (e.key) {
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'm': case 'M': toggleMute(); break;
        case 'ArrowLeft':  e.preventDefault(); seek(-10); break;
        case 'ArrowRight': e.preventDefault(); seek(10);  break;
        case 'ArrowUp':    e.preventDefault(); changeVolume(0.1); break;
        case 'ArrowDown':  e.preventDefault(); changeVolume(-0.1); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Fullscreen state
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  function flash(type) {
    setFlashIcon(type);
    setTimeout(() => setFlashIcon(null), 800);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); flash('play'); }
    else          { v.pause(); setPlaying(false); flash('pause'); }
  }

  function seek(seconds) {
    if (videoRef.current) videoRef.current.currentTime += seconds;
  }

  function seekTo(e) {
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoRef.current) videoRef.current.currentTime = ratio * duration;
  }

  function onProgressHover(e) {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime({ pct: pct * 100, time: fmt(pct * duration) });
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function changeVolume(delta) {
    const v = videoRef.current;
    if (!v) return;
    const newVol = Math.max(0, Math.min(1, v.volume + delta));
    v.volume = newVol;
    setVolume(newVol);
    if (newVol > 0 && v.muted) { v.muted = false; setMuted(false); }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.() || containerRef.current?.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
  }

  function activateRemux() {
    const saved = videoRef.current?.currentTime || 0;
    setRemuxActive(true);
    setAudioWarning(false);
    setTimeout(() => {
      videoRef.current?.addEventListener('loadedmetadata', function onReady() {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = saved;
        if (playing) v.play();
        v.removeEventListener('loadedmetadata', onReady);
      });
    }, 50);
  }

  function changeVersion(key) {
    const saved = videoRef.current?.currentTime || 0;
    setVersion(key);
    setRemuxActive(false);
    setAudioWarning(false);
    setTimeout(() => {
      videoRef.current?.addEventListener('loadedmetadata', function onReady() {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = saved;
        if (playing) v.play();
        v.removeEventListener('loadedmetadata', onReady);
      });
    }, 50);
  }

  async function castToTV() {
    if (castStatus !== 'idle') return;
    setCastStatus('sending');
    try {
      await api.post('/cast', {
        url: currentUrl,
        title: content.title || '',
        position: Math.floor(videoRef.current?.currentTime || 0),
        version,
      });
      setCastStatus('sent');
      setTimeout(() => setCastStatus('idle'), 3500);
    } catch { setCastStatus('idle'); }
  }

  function changeSubtitle(key) {
    setSubtitle(key);
    const tracks = videoRef.current?.textTracks;
    if (tracks) {
      for (const track of tracks) {
        track.mode = track.language === key ? 'showing' : 'hidden';
      }
    }
  }

  const volIcon = muted || volume === 0 ? IC.volMute : volume < 0.5 ? IC.volLow : IC.volHigh;

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${showControls ? styles.controlsVisible : ''}`}
      onMouseMove={showCtrl}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        className={styles.video}
        onClick={e => e.stopPropagation()}
        crossOrigin="anonymous"
        key={currentUrl}
      >
        <source src={currentUrl} type="video/mp4" />
        {subtitles.filter(s => s.url).map(s => (
          <track key={s.key} kind="subtitles" src={s.url} srcLang={s.key} label={s.label} />
        ))}
      </video>

      {/* Center flash icon */}
      <div className={styles.centerFlash}>
        <div className={`${styles.centerIcon} ${flashIcon ? styles.show : ''}`} key={flashIcon}>
          {flashIcon === 'play' ? IC.play : flashIcon === 'pause' ? IC.pause : null}
        </div>
      </div>

      {audioWarning && (
        <div className={styles.audioWarning}>
          ⚠ Codec incompatível com este navegador (vídeo H.265 ou áudio AC3).{' '}
          <button
            onClick={(e) => { e.stopPropagation(); activateRemux(); }}
            style={{ background: '#E50914', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13, marginLeft: 8 }}
          >
            Corrigir áudio
          </button>
        </div>
      )}

      <div
        className={`${styles.controls} ${showControls ? styles.visible : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className={styles.progressWrap}>
          {/* Tooltip */}
          {hoverTime && (
            <div
              className={styles.progressTooltip}
              style={{ left: `${hoverTime.pct}%` }}
            >
              {hoverTime.time}
            </div>
          )}

          <div
            ref={progressRef}
            className={styles.progressBar}
            onClick={seekTo}
            onMouseMove={onProgressHover}
            onMouseLeave={() => setHoverTime(null)}
          >
            {/* Buffered */}
            <div className={styles.progressBuffer} style={{ transform: `scaleX(${buffered / 100})` }} />
            {/* Fill */}
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            {/* Thumb */}
            <div className={styles.progressThumb} style={{ left: `${progress}%` }} />
          </div>
        </div>

        {/* Bottom controls */}
        <div className={styles.bottomBar}>
          <div className={styles.left}>
            <button onClick={togglePlay} className={styles.btn} title={playing ? 'Pausar (Space)' : 'Reproduzir (Space)'}>
              {playing ? IC.pause : IC.play}
            </button>
            <button onClick={() => seek(-10)} className={styles.btn} title="Voltar 10s (←)">
              {IC.back10}
            </button>
            <button onClick={() => seek(10)} className={styles.btn} title="Avançar 10s (→)">
              {IC.fwd10}
            </button>

            <div className={styles.volumeWrap}>
              <button onClick={toggleMute} className={styles.btn} title="Silenciar (M)">
                {volIcon}
              </button>
              <input
                type="range" min="0" max="1" step="0.05"
                value={muted ? 0 : volume}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (videoRef.current) videoRef.current.volume = val;
                  setVolume(val);
                  if (val > 0 && muted) { videoRef.current.muted = false; setMuted(false); }
                }}
                className={styles.volumeSlider}
                title="Volume (↑↓)"
              />
            </div>

            <div className={styles.sep} />
            <span className={styles.time}>
              {fmt(currentTime)}<span className={styles.timeDivider}> / </span>{fmt(duration)}
            </span>
          </div>

          <div className={styles.right}>
            {versions.length > 1 && (
              <div className={styles.selectWrap}>
                <select value={version} onChange={e => changeVersion(e.target.value)} className={styles.select}>
                  {versions.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                </select>
                <svg className={styles.selectArrow} width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
              </div>
            )}

            {subtitles.length > 1 && (
              <div className={styles.selectWrap}>
                <select value={subtitle} onChange={e => changeSubtitle(e.target.value)} className={styles.select}>
                  {subtitles.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <svg className={styles.selectArrow} width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
              </div>
            )}

            <div className={styles.sep} />

            <button
              onClick={castToTV}
              className={`${styles.btn} ${castStatus === 'sent' ? styles.castSent : ''}`}
              title={castStatus === 'sent' ? 'Enviado para a TV!' : 'Enviar para TV (FlixHome)'}
            >
              {castStatus === 'sending'
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                : castStatus === 'sent' ? IC.castOk : IC.cast}
            </button>

            <button onClick={toggleFullscreen} className={styles.btn} title={fullscreen ? 'Sair de tela cheia (F)' : 'Tela cheia (F)'}>
              {fullscreen ? IC.fullOff : IC.fullOn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
