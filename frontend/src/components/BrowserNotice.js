'use client';
import { useEffect, useState } from 'react';

// Aviso: alguns conteúdos (codecs de áudio/vídeo como HEVC/AC3/DTS) não tocam
// no Chrome, mas tocam no Edge. Mostra só no Chrome (e derivados que não sejam Edge).
export default function BrowserNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent;
      const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
      if (isChrome && !localStorage.getItem('browser_notice_dismissed')) setShow(true);
    } catch {}
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 9999, maxWidth: 560, margin: '0 auto',
      background: '#1c1c1f', border: '1px solid rgba(251,191,36,.45)', borderRadius: 12,
      padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center',
      boxShadow: '0 10px 30px rgba(0,0,0,.5)', color: '#e5e5e5', fontSize: 13, lineHeight: 1.45,
    }}>
      <span style={{ fontSize: 22 }}>⚠️</span>
      <span style={{ flex: 1 }}>
        Alguns filmes e séries <b>não funcionam no Google Chrome</b>, mas <b>todos funcionam no Microsoft Edge</b>.
        Se algum vídeo não abrir ou ficar sem áudio, abra o FlixHome no Edge.
      </span>
      <button
        onClick={() => { try { localStorage.setItem('browser_notice_dismissed', '1'); } catch {} setShow(false); }}
        style={{ background: '#fbbf24', color: '#000', border: 0, borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}
      >Entendi</button>
    </div>
  );
}
