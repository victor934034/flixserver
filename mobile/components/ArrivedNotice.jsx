import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CachedImage from './CachedImage';
import api from '../lib/api';

const SEEN_KEY = 'seenArrivedSuggestions';
const readSeen = async () => {
  try { return JSON.parse(await AsyncStorage.getItem(SEEN_KEY)) || []; } catch { return []; }
};

// Aviso de pedido atendido: cartão na Home (quem não ativou notificação também vê).
export default function ArrivedNotice() {
  const router = useRouter();
  const [items, setItems] = useState([]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    api.get('/suggestions/arrived')
      .then(async r => {
        const seen = await readSeen();
        if (alive) setItems((Array.isArray(r.data) ? r.data : []).filter(i => !seen.includes(i.id)));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []));

  const item = items[0];
  if (!item) return null;

  const dismiss = async () => {
    setItems(list => list.slice(1));
    const seen = await readSeen();
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen, item.id].slice(-50))).catch(() => {});
  };

  return (
    <View style={s.card}>
      {item.poster_url ? <CachedImage source={{ uri: item.poster_url }} style={s.poster} resizeMode="cover" /> : null}
      <View style={{ flex: 1 }}>
        <Text style={s.title}>🎉 Seu pedido chegou!</Text>
        <Text style={s.name} numberOfLines={2}>{item.title}</Text>
        <View style={s.row}>
          <TouchableOpacity style={s.go} onPress={() => { dismiss(); router.push(`/${item.content_type === 'movie' ? 'filme' : 'serie'}/${item.content_id}`); }}>
            <Text style={s.btnTxt}>Assistir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.later} onPress={dismiss}>
            <Text style={s.btnTxt}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 4, marginBottom: 20, padding: 12, borderRadius: 14, backgroundColor: '#161616', borderWidth: 1, borderColor: '#E50914' },
  poster: { width: 56, height: 84, borderRadius: 6, backgroundColor: '#1a1a1a' },
  title: { color: '#fff', fontSize: 14, fontWeight: '800' },
  name: { color: '#ccc', fontSize: 13, marginTop: 3 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  go: { backgroundColor: '#E50914', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  later: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
