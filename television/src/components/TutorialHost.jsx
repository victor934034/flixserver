import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tutorial, { TutorialToast } from './Tutorial';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { onOpenTutorial, requestHome, requestSurprise } from '../lib/tutorial';
import api from '../lib/api';

// Decide quando o passo a passo aparece. Os avisos (children) esperam, para uma
// conta nova não receber várias janelas seguidas.
export default function TutorialHost({ atHome, version, children }) {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [view, setView] = useState(null); // null | 'tour' | 'toast'
  const [auto, setAuto] = useState(false);
  const [checked, setChecked] = useState(null); // id da conta já conferida
  const checking = useRef(null);
  const userId = user?.id;
  const ready = !!userId && !!activeProfile && atHome;

  useEffect(() => {
    if (!ready || checked === userId || checking.current === userId) return;
    checking.current = userId;
    api.get('/auth/tutorial')
      .then(async r => {
        if (!r.data?.show) return;
        // Conta nova ainda não usou o app: as Novidades desta versão ficam como vistas
        await AsyncStorage.setItem('lastSeenChangelogVersion', version).catch(() => {});
        setAuto(true);
        setView('tour');
      })
      .catch(() => {})
      .finally(() => { checking.current = null; setChecked(userId); });
  }, [ready, userId, checked, version]);

  useEffect(() => onOpenTutorial(() => { setAuto(false); setView('tour'); }), []);

  const close = (reason) => {
    if (auto) api.post('/auth/tutorial/seen').catch(() => {});
    setView(reason === 'skip' && auto ? 'toast' : null);
    if (reason === 'skip') return;
    requestHome();
    // espera a janela do passo a passo fechar antes de abrir o sorteio
    if (reason === 'surprise') setTimeout(requestSurprise, 400);
  };

  const waiting = ready && (view !== null || checked !== userId);

  return (
    <>
      {ready && view === 'tour' && <Tutorial name={activeProfile.name} onClose={close} />}
      {ready && view === 'toast' && <TutorialToast onReopen={() => { setAuto(false); setView('tour'); }} onDone={() => setView(null)} />}
      {!waiting && children}
    </>
  );
}
