import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ChatThread from '../components/ChatThread';
import api from '../lib/api';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [telegram, setTelegram] = useState('');

  useEffect(() => {
    // Link do grupo vem do admin (Configurações) — muda sem atualizar o app
    api.get('/settings').then(r => setTelegram(r.data?.telegram_link || '')).catch(() => {});
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Suporte Flixhome</Text>
          <Text style={styles.subtitle}>Fale direto com a equipe</Text>
        </View>
        {!!telegram && (
          <TouchableOpacity style={styles.telegram} onPress={() => Linking.openURL(telegram)}>
            <Ionicons name="paper-plane" size={15} color="#fff" />
            <Text style={styles.telegramTxt}>Telegram</Text>
          </TouchableOpacity>
        )}
      </View>
      <ChatThread
        listUrl="/chat/messages"
        sendUrl="/chat/messages"
        me="user"
        emptyText={'Mande sua dúvida, problema ou sugestão.\nVocê pode enviar fotos, vídeos e arquivos.'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  back: { padding: 6 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  subtitle: { color: '#666', fontSize: 12 },
  telegram: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#229ED9',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18,
  },
  telegramTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
