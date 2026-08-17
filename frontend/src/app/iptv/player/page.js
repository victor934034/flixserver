'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './page.module.css';

function IptvPlayerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get('url');
  const name = searchParams.get('name') || 'Canal';
  const logo = searchParams.get('logo');

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    let destroyed = false;

    async function setup() {
      // Safari toca HLS nativamente via <video src>
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.play().catch(() => {});
        return;
      }
      const { default: Hls } = await import('hls.js');
      if (destroyed) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) setError('Não foi possível carregar o canal. Tente novamente.');
        });
      } else {
        setError('Seu navegador não suporta reprodução ao vivo (HLS).');
      }
    }

    setup();

    return () => {
      destroyed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [url]);

  if (!url) {
    return (
      <div className={styles.root}>
        <p className={styles.error}>Canal inválido.</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <video
        ref={videoRef}
        className={styles.video}
        autoPlay
        playsInline
        controls
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
      />

      <div className={styles.topBar}>
        <button className={styles.back} onClick={() => router.back()}>‹ Voltar</button>
        <div className={styles.channelInfo}>
          {logo && <img src={logo} alt="" className={styles.channelLogo} />}
          <span className={styles.channelName}>{name}</span>
        </div>
      </div>

      {buffering && !error && (
        <div className={styles.center} style={{ pointerEvents: 'none' }}>
          <div className={styles.spinner} />
        </div>
      )}

      {error && (
        <div className={styles.center}>
          <p className={styles.error}>{error}</p>
        </div>
      )}
    </div>
  );
}

export default function IptvPlayerPage() {
  return (
    <Suspense fallback={<div className={styles.root} />}>
      <IptvPlayerInner />
    </Suspense>
  );
}
