'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import s from './live.module.css';

function loadQueue() { try { return JSON.parse(sessionStorage.getItem('iptv_queue') || 'null') || { list: [], index: 0, cat: '' }; } catch { return { list: [], index: 0, cat: '' }; } }

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [cur, setCur] = useState({ url: sp.get('url') || '', name: sp.get('name') || 'Canal', logo: sp.get('logo') || '' });
  const [queue, setQueue] = useState({ list: [], index: 0, cat: '' });
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [hint, setHint] = useState(null);
  const [uiOn, setUiOn] = useState(true);
  const [tries, setTries] = useState(0);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hideT = useRef(null);
  const hintT = useRef(null);

  useEffect(() => { setQueue(loadQueue()); }, []);

  const poke = useCallback(() => {
    setUiOn(true); clearTimeout(hideT.current);
    hideT.current = setTimeout(() => setUiOn(false), 4000);
  }, []);
  useEffect(() => { poke(); return () => { clearTimeout(hideT.current); clearTimeout(hintT.current); }; }, [poke]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cur.url) return undefined;
    let destroyed = false;
    setError(''); setBuffering(true);
    (async () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = cur.url; video.play().catch(() => {}); return; }
      const { default: Hls } = await import('hls.js');
      if (destroyed) return;
      if (!Hls.isSupported()) { setError('Seu navegador não suporta reprodução ao vivo (HLS).'); return; }
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
      hlsRef.current = hls;
      hls.loadSource(cur.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) setError('timeout'); });
    })();
    return () => { destroyed = true; if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [cur.url, tries]);

  const load = useCallback(async (i) => {
    const q = queue; const ch = q.list[i]; if (!ch) return;
    try {
      const { data } = await api.get(`/iptv/stream-url/${ch.stream_id}`, { params: { fmt: 'm3u8' } });
      setCur({ url: data.url, name: ch.name || 'Canal', logo: ch.stream_icon || '' });
      const nq = { ...q, index: i }; setQueue(nq);
      try { sessionStorage.setItem('iptv_queue', JSON.stringify(nq)); } catch {}
    } catch { setError('timeout'); }
  }, [queue]);

  const go = useCallback((d) => {
    const l = queue.list; if (l.length < 2) return;
    const i = (queue.index + d + l.length) % l.length;
    setHint({ name: l[i].name, num: 100 + i + 1, dir: d > 0 ? '↓' : '↑', logo: l[i].stream_icon });
    clearTimeout(hintT.current); hintT.current = setTimeout(() => setHint(null), 1500);
    load(i);
  }, [queue, load]);

  useEffect(() => {
    const onKey = (e) => {
      poke();
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape') { if (drawer) setDrawer(false); else router.back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, poke, drawer, router]);

  if (!cur.url) return <div className={s.root}><p className={s.errTxt}>Canal inválido.</p></div>;
  const sub = queue.cat;

  return (
    <div className={s.root} onMouseMove={poke}>
      <video ref={videoRef} className={s.video} autoPlay playsInline controls={uiOn}
        onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)} onCanPlay={() => setBuffering(false)} />

      <div className={`${s.top} ${uiOn ? '' : s.hidden}`}>
        <button className={s.back} onClick={() => router.back()} aria-label="Voltar">‹</button>
        {cur.logo ? <img src={cur.logo} alt="" className={s.logo} /> : null}
        <div className={s.info}><b>{cur.name}</b>{sub && <small>{sub}</small>}</div>
        <span className={s.livePill}><i />AO VIVO</span>
        {queue.list.length > 1 && <button className={s.listBtn} onClick={() => setDrawer(v => !v)}>☰ Canais</button>}
      </div>

      {queue.list.length > 1 && <div className={`${s.tip} ${uiOn ? '' : s.hidden}`}>Teclas ↑ ↓ trocam de canal</div>}

      {hint && (
        <div className={s.hint}>
          {hint.logo ? <img src={hint.logo} alt="" /> : null}
          <div><small>Canal {hint.dir} · {hint.num}</small><b>{hint.name}</b></div>
        </div>
      )}

      {buffering && !error && <div className={s.center} style={{ pointerEvents: 'none' }}><div className={s.spinner} /></div>}

      {error && (
        <div className={s.err}>
          <div className={s.errIcon}>📺</div>
          <h2>Este canal não abriu</h2>
          <p>O servidor atual não respondeu. Tentar de novo costuma resolver.</p>
          <div className={s.errBtns}>
            <button className={s.red} onClick={() => setTries(t => t + 1)}>Tentar de novo</button>
            <button className={s.ghost} onClick={() => router.back()}>Ver canais</button>
          </div>
          <small>código ERR_STREAM_TIMEOUT</small>
        </div>
      )}

      {drawer && (
        <aside className={s.drawer}>
          <div className={s.dHead}><b>{queue.cat || 'Canais'}</b><button onClick={() => setDrawer(false)}>✕</button></div>
          <div className={s.dList}>
            {queue.list.map((c, i) => (
              <button key={c.stream_id} className={i === queue.index ? s.dOn : ''} onClick={() => { setDrawer(false); if (i !== queue.index) load(i); }}>
                <em>{100 + i + 1}</em>
                {c.stream_icon ? <img src={c.stream_icon} alt="" /> : <span className={s.noLogo} />}
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

export default function IptvPlayerPage() {
  return <Suspense fallback={<div className={s.root} />}><Inner /></Suspense>;
}
