'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getToken } from '../lib/auth';
import { CHANGELOG, PLAY_STORE_URL } from '../lib/changelog';
import s from './Dialog.module.css';

const SEEN_KEY = 'lastSeenChangelogVersion';
// Não atrapalha login, escolha de perfil, vídeo nem sala em andamento
const SKIP = ['/login', '/perfis', '/admin', '/juntos', '/tv', '/pagamento', '/politica-de-privacidade', '/excluir-conta', '/autorizar-tv', '/filme/', '/serie/'];

// Na primeira abertura de cada versão: mostra as novidades e depois o convite para avaliar o app.
export default function WhatsNew() {
  const pathname = usePathname();
  const [step, setStep] = useState(null); // null | 'news' | 'rate' | 'done'
  const latest = CHANGELOG[0];
  const skip = SKIP.some(p => pathname.startsWith(p));

  useEffect(() => {
    if (step || skip || !getToken()) return;
    try {
      if (localStorage.getItem(SEEN_KEY) !== latest.version) setStep('news');
    } catch {}
  }, [skip, step, latest.version, pathname]);

  const seen = () => { try { localStorage.setItem(SEEN_KEY, latest.version); } catch {} };

  if (skip || (step !== 'news' && step !== 'rate')) return null;

  if (step === 'news') {
    return (
      <div className={s.overlay}>
        <div className={s.card} role="dialog" aria-modal="true" aria-label="Novidades">
          <h2>✨ Novidades</h2>
          <span className={s.version}>Versão {latest.version}</span>
          <ul className={s.list}>{latest.items.map(t => <li key={t}>{t}</li>)}</ul>
          <button className={s.primary} onClick={() => { seen(); setStep('rate'); }}>Entendi</button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.overlay}>
      <div className={s.card} role="dialog" aria-modal="true" aria-label="Avaliar o app">
        <div className={s.stars}>★★★★★</div>
        <h2>O que está achando do FlixHome?</h2>
        <p>Sua avaliação do app na Play Store ajuda muito.</p>
        <a className={s.primary} href={PLAY_STORE_URL} target="_blank" rel="noreferrer" onClick={() => setStep('done')}>Avaliar o app</a>
        <button className={s.secondary} onClick={() => setStep('done')}>Agora não</button>
      </div>
    </div>
  );
}
