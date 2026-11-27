import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';

// Novidades mostradas na primeira abertura de cada versão.
// A CADA versão com mudança para o usuário, troque VERSION e ITEMS.
export const VERSION = '1.3.0';
const ITEMS = [
  'Corrigido: dezenas de filmes que não davam play no Dublado ou no Legendado.',
  'Passo a passo novo: veja em um minuto como usar o FlixHome.',
  'Para abrir: menu lateral, “Como usar o FlixHome”.',
  'Corrigido: episódio já assistido recomeça do início, em vez de abrir no final.',
  'Pular abertura e Próximo episódio aparecem na hora certa nas séries.',
  'Marque como já assistido, e no Assistir juntos agora dá para entrar com o código.',
  'Surpreenda-me: botão no topo do Início sorteia um filme pelo gênero.',
  'Top 10 da semana e aviso quando um título que você pediu chega.',
  'Continuar assistindo: abra o título e escolha "Tirar do Continuar".',
  'Assistir juntos corrigido: a sala volta a conectar.',
];
const SEEN_KEY = 'lastSeenChangelogVersion';

export default function WhatsNew() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then(v => setPending(v !== VERSION)).catch(() => {});
  }, []);

  const close = () => {
    setPending(false);
    AsyncStorage.setItem(SEEN_KEY, VERSION).catch(() => {});
  };

  if (!pending || !user || !activeProfile) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>✨ Novidades</Text>
          <Text style={s.version}>VERSÃO {VERSION}</Text>
          {ITEMS.map(t => <Text key={t} style={s.item}>•  {t}</Text>)}
          <Pressable hasTVPreferredFocus onPress={close} style={({ focused }) => [s.btn, focused && s.btnFocus]}>
            <Text style={s.btnTxt}>Entendi</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '55%', backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', padding: 28 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  version: { color: '#E50914', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: 6, marginBottom: 16 },
  item: { color: '#ddd', fontSize: 15, lineHeight: 22, marginBottom: 10 },
  btn: { alignSelf: 'flex-start', marginTop: 14, backgroundColor: '#E50914', borderRadius: 10, paddingHorizontal: 32, paddingVertical: 12, borderWidth: 3, borderColor: 'transparent' },
  btnFocus: { borderColor: '#fff' },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
