import { useEffect, useRef, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tutorial, { TutorialToast } from './Tutorial';
import { CHANGELOG } from '../constants/changelog';
import { onOpenTutorial, requestSurprise } from '../lib/tutorial';
import api from '../lib/api';

// Decide quando o passo a passo aparece. Os avisos (children) esperam, para uma
// conta nova não receber três janelas seguidas.
export default function TutorialHost({ userId, name, children }) {
  const router = useRouter();
  const segments = useSegments();
  const inTabs = segments[0] === '(tabs)';
  const [view, setView] = useState(null); // null | 'tour' | 'toast'
  const [auto, setAuto] = useState(false); // abriu sozinho (mostra o aviso ao pular)
  const [checked, setChecked] = useState(null); // id da conta já conferida
  const checking = useRef(null);

  useEffect(() => {
    if (!userId || !inTabs || checked === userId || checking.current === userId) return;
    checking.current = userId;
    api.get('/auth/tutorial')
      .then(async r => {
        if (!r.data?.show) return;
        // Conta nova ainda não usou o app: as Novidades desta versão ficam como vistas
        await AsyncStorage.setItem('lastSeenChangelogVersion', CHANGELOG[0].version).catch(() => {});
        setAuto(true);
        setView('tour');
      })
      .catch(() => {})
      .finally(() => { checking.current = null; setChecked(userId); });
  }, [userId, inTabs, checked]);

  useEffect(() => onOpenTutorial(() => { setAuto(false); setView('tour'); }), []);

  const close = (reason) => {
    if (auto) api.post('/auth/tutorial/seen').catch(() => {});
    setView(reason === 'skip' && auto ? 'toast' : null);
    if (reason === 'skip') return;
    router.navigate('/(tabs)');
    // espera a janela do passo a passo fechar antes de abrir o sorteio
    if (reason === 'surprise') setTimeout(requestSurprise, 400);
  };

  const waiting = view !== null || checked !== userId;

  return (
    <>
      {view === 'tour' && <Tutorial name={name} onClose={close} />}
      {view === 'toast' && <TutorialToast onReopen={() => { setAuto(false); setView('tour'); }} onDone={() => setView(null)} />}
      {!waiting && children}
    </>
  );
}
