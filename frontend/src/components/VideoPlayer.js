'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './VideoPlayer.module.css';

export default function VideoPlayer({ content, onProgress }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimer = useRef(null);

  const [version, setVersion] = useState('dubbing');
  const [subtitle, setSubtitle] = useState('none');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  const versions = [
    { key: 'dubbing', label: 'Dublado', url: content.file_dubbing },
    { key: 'subtitled', label: 'Legendado', url: content.file_subtitled },
    { key: 'cinema', label: 'Cinema', url: content.file_cinema },
    { key: '4k', label: '4K', url: content.file_4k },
  ].filter(v => v.url);

  const subtitles = [
    { key: 'none', label: 'Sem legenda' },
    { key: 'pt', label: 'Português', url: content.subtitle_pt },
    { key: 'en', label: 'Inglês', url: content.subtitle_en },
    { key: 'es', label: 'Espanhol', url: content.subtitle_es },
  ].filter(s => s.key === 'none' || s.url);

  const currentUrl = versions.find(v => v.key === version)?.url || versions[0]?.url;

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
      onProgress?.(video.currentTime, video.duration);
    };
    const onLoaded = () => setDuration(video.duration);
    const onEnded = () => setPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('ended', onEnded);
    };
  }, [onProgress]);

  useEffect(() => {
    const onKey = (e) => {
      switch (e.key) {
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'm': case 'M': toggleMute(); break;
        case 'ArrowLeft': seek(-10); break;
        case 'ArrowRight': seek(10); break;
        case 'ArrowUp': e.preventDefault(); changeVolume(0.1); break;
        case 'ArrowDown': e.preventDefault(); changeVolume(-0.1); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }

  function seek(seconds) {
    if (videoRef.current) videoRef.current.currentTime += seconds;
  }

  function seekTo(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (videoRef.current) videoRef.current.currentTime = ratio * duration;
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
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }

  function changeVersion(key) {
    const v = videoRef.current;
    const time = v?.currentTime || 0;
    setVersion(key);
    setTimeout(() => {
      if (v) { v.currentTime = time; if (playing) v.play(); }
    }, 100);
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

  function fmt(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseMove={resetHideTimer}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        className={styles.video}
        src={currentUrl}
        onClick={e => e.stopPropagation()}
        crossOrigin="anonymous"
      >
        {subtitles.filter(s => s.url).map(s => (
          <track key={s.key} kind="subtitles" src={s.url} srcLang={s.key} label={s.label} />
        ))}
      </video>

      <div
        className={`${styles.controls} ${showControls ? styles.visible : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.progressBar} onClick={seekTo}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.bottomBar}>
          <div className={styles.left}>
            <button onClick={togglePlay} className={styles.btn}>{playing ? '⏸' : '▶'}</button>
            <button onClick={() => seek(-10)} className={styles.btn}>⏪10</button>
            <button onClick={() => seek(10)} className={styles.btn}>10⏩</button>
            <button onClick={toggleMute} className={styles.btn}>{muted ? '🔇' : '🔊'}</button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={muted ? 0 : volume}
              onChange={e => { changeVolume(0); videoRef.current.volume = Number(e.target.value); setVolume(Number(e.target.value)); }}
              className={styles.volumeSlider}
            />
            <span className={styles.time}>{fmt(currentTime)} / {fmt(duration)}</span>
          </div>

          <div className={styles.right}>
            {versions.length > 1 && (
              <select value={version} onChange={e => changeVersion(e.target.value)} className={styles.select}>
                {versions.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            )}

            {subtitles.length > 1 && (
              <select value={subtitle} onChange={e => changeSubtitle(e.target.value)} className={styles.select}>
                {subtitles.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            )}

            <button onClick={toggleFullscreen} className={styles.btn}>{fullscreen ? '⊡' : '⛶'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
