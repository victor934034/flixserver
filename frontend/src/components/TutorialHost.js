'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import api from '../lib/api';
import { getToken } from '../lib/auth';
import { CHANGELOG } from '../lib/changelog';
import { useProfile } from '../contexts/ProfileContext';
import { OPEN_EVENT, requestSurprise } from '../lib/tutorial';
import { TutorialScreen, TutorialToast } from './Tutorial';

// Só abre sozinho nas telas de navegação (nunca por cima de vídeo, sala ou pagamento)
const AUTO_PATHS = ['/', '/filmes', '/series'];

// Decide quando o passo a passo aparece. Os avisos (children: Novidades e pedido
// atendido) esperam: assim uma conta nova não recebe três janelas seguidas.
export default function TutorialHost({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeProfile } = useProfile();
  const [view, setView] = useState(null); // null | 'tour' | 'toast'
  const [auto, setAuto] = useState(false); // abriu sozinho (mostra o aviso ao pular)
  const [checkedToken, setCheckedToken] = useState(null);
  const checking = useRef(null);
  const [token, setCurrentToken] = useState(null);

  useEffect(() => { setCurrentToken(getToken()); }, [pathname]);

  useEffect(() => {
    if (!token || !activeProfile || checkedToken === token || checking.current === token) return;
    if (!AUTO_PATHS.includes(pathname)) return;
    checking.current = token;
    api.get('/auth/tutorial')
      .then(r => {
        if (!r.data?.show) return;
        // Conta nova ainda não usou o app: as Novidades desta versão ficam como vistas
        try { localStorage.setItem('lastSeenChangelogVersion', CHANGELOG[0].version); } catch {}
        setAuto(true);
        setView('tour');
      })
      .catch(() => {})
      .finally(() => { checking.current = null; setCheckedToken(token); });
  }, [token, activeProfile, pathname, checkedToken]);

  useEffect(() => {
    const open = () => { setAuto(false); setView('tour'); };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  function close(reason) {
    if (auto) api.post('/auth/tutorial/seen').catch(() => {});
    setView(reason === 'skip' && auto ? 'toast' : null);
    if (reason === 'surprise') requestSurprise();
    if (reason !== 'skip' && pathname !== '/') router.push('/');
  }

  const waiting = view !== null || (!!token && AUTO_PATHS.includes(pathname) && checkedToken !== token);

  return (
    <>
      {view === 'tour' && <TutorialScreen name={activeProfile?.name} onClose={close} />}
      {view === 'toast' && (
        <TutorialToast onReopen={() => { setAuto(false); setView('tour'); }} onDone={() => setView(null)} />
      )}
      {!waiting && children}
    </>
  );
}
