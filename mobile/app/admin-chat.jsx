// Chat ao vivo — lado do admin no app: lista de conversas + conversa aberta.
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, AppState } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ChatThread from '../components/ChatThread';
import api from '../lib/api';

function fmtWhen(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(params.userId ? String(params.userId) : null);

  useEffect(() => {
    let alive = true;
    let ctrl = null;
    let since = null;
    let active = true;
    const sub = AppState.addEventListener('change', s => { active = s === 'active'; if (!active) ctrl?.abort(); });
    (async () => {
      let failures = 0;
      while (alive) {
        if (!active) { await new Promise(r => setTimeout(r, 1000)); continue; }
        ctrl = new AbortController();
        try {
          const { data } = await api.get('/chat/admin/conversations', {
            params: since ? { since, wait: 1 } : {}, signal: ctrl.signal, timeout: 35000,
          });
          if (!alive) break;
          setConvs(data.conversations || []);
          since = data.now;
          setLoading(false);
          failures = 0;
        } catch {
          if (!alive) break;
          failures++;
          await new Promise(r => setTimeout(r, Math.min(10000, 1000 * failures)));
        }
      }
    })();
    return () => { alive = false; ctrl?.abort(); sub.remove(); };
  }, []);

  const current = convs.find(c => c.user_id === selected);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => (selected ? setSelected(null) : router.back())}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{selected ? (current?.name || current?.email || 'Usuário') : 'Chat ao vivo'}</Text>
          {selected && !!current?.email && <Text style={styles.subtitle} numberOfLines={1}>{current.email}</Text>}
        </View>
      </View>

      {selected ? (
        <ChatThread
          key={selected}
          listUrl={`/chat/admin/conversations/${selected}/messages`}
          sendUrl={`/chat/admin/conversations/${selected}/messages`}
          me="admin"
          emptyText="Envie a primeira mensagem."
        />
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator color="#E50914" /></View>
      ) : (
        <FlatList
          data={convs}
          keyExtractor={c => c.user_id}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>Nenhuma conversa ainda.</Text></View>}
          renderItem={({ item: c }) => (
            <TouchableOpacity style={styles.conv} onPress={() => { setSelected(c.user_id); setConvs(p => p.map(x => x.user_id === c.user_id ? { ...x, unread: 0 } : x)); }}>
              <View style={styles.avatar}><Text style={styles.avatarTxt}>{(c.name || c.email || '?')[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.convTop}>
                  <Text style={styles.convName} numberOfLines={1}>{c.name || c.email || 'Usuário'}</Text>
                  <Text style={styles.convTime}>{fmtWhen(c.last_at)}</Text>
                </View>
                <View style={styles.convTop}>
                  <Text style={styles.convLast} numberOfLines={1}>{c.last_sender === 'admin' ? 'Você: ' : ''}{c.last_message}</Text>
                  {c.unread > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{c.unread}</Text></View>}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  back: { padding: 6 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  subtitle: { color: '#666', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: { color: '#666' },
  conv: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#151515' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 17 },
  convTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  convName: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 15 },
  convTime: { color: '#666', fontSize: 11 },
  convLast: { flex: 1, color: '#888', fontSize: 13, marginTop: 2 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
