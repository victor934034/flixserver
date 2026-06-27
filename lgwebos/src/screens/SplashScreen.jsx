import React, { useEffect, useState } from 'react';

// Progress bar animated from 0 to target %
function ProgressBar({ progress }) {
  return (
    <div style={{ width: 320, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 2,
        background: 'linear-gradient(90deg, #c91c2c, #e8354a)',
        width: progress + '%',
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

export default function SplashScreen({ onReady }) {
  const [progress, setProgress] = useState(0);
  const [label,    setLabel]    = useState('Iniciando…');
  const [visible,  setVisible]  = useState(true);

  useEffect(() => {
    // Minimum display time + progress animation
    const steps = [
      { at: 100,  p: 20, text: 'Conectando…' },
      { at: 600,  p: 50, text: 'Carregando catálogo…' },
      { at: 1200, p: 75, text: 'Quase lá…' },
      { at: 1800, p: 92, text: 'Preparando tudo…' },
    ];
    const timers = steps.map(s =>
      setTimeout(() => { setProgress(s.p); setLabel(s.text); }, s.at)
    );

    // Tell parent to start fetching — it calls onReady() when done
    // We guarantee at least 2s of splash time via the fade below
    return () => timers.forEach(clearTimeout);
  }, []);

  // onReady is called by parent when data fetch completes.
  // We intercept it here to finish the progress bar, then fade out.
  function finish() {
    setProgress(100);
    setLabel('Pronto!');
    setTimeout(() => {
      setVisible(false);
      setTimeout(onReady, 400); // wait for fade-out
    }, 300);
  }

  // Expose finish via ref trick: parent passes a wrapper that calls finish
  useEffect(() => {
    // Register our finish fn on the global splash object
    window.__splashFinish = finish;
    return () => { delete window.__splashFinish; };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 0,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      {/* Logo */}
      <img
        src="/icon.png"
        alt="FlixHome"
        style={{
          width: 120, height: 120, borderRadius: 24, objectFit: 'cover',
          marginBottom: 28,
          boxShadow: '0 0 60px rgba(201,28,44,0.35), 0 8px 40px rgba(0,0,0,0.8)',
        }}
      />
      <div style={{
        fontSize: 72, fontWeight: 900, letterSpacing: 12,
        color: '#c91c2c',
        textShadow: '0 0 60px rgba(201,28,44,0.35), 0 4px 30px rgba(0,0,0,0.9)',
        marginBottom: 6,
        fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
      }}>
        FLIXHOME
      </div>

      {/* Tagline */}
      <div style={{
        fontSize: 14, fontWeight: 400, letterSpacing: 4,
        color: 'rgba(255,255,255,0.25)',
        textTransform: 'uppercase',
        marginBottom: 60,
      }}>
        Sua plataforma de streaming
      </div>

      {/* Progress bar */}
      <ProgressBar progress={progress} />

      {/* Label */}
      <div style={{
        marginTop: 16, fontSize: 13,
        color: 'rgba(255,255,255,0.28)',
        letterSpacing: 1,
        height: 20,
      }}>
        {label}
      </div>
    </div>
  );
}
