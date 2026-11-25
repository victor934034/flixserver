import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Image, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';

const SEEN_KEY = 'seenArrivedSuggestions';
const readSeen = async () => {
  try { return JSON.parse(await AsyncStorage.getItem(SEEN_KEY)) || []; } catch { return []; }
};

// Aviso de pedido atendido na TV
export default function ArrivedNotice({ profileId, onOpen }) {
  const [item, setItem] = useState(null);

  useEffect(() => {
    if (!profileId) return;
    api.get('/suggestions/arrived')
      .then(async r => {
        const seen = await readSeen();
        setItem((Array.isArray(r.data) ? r.data : []).find(i => !seen.includes(i.id)) || null);
      })
      .catch(() => {});
  }, [profileId]);

  if (!item) return null;

  const dismiss = async () => {
    setItem(null);
    const seen = await readSeen();
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen, item.id].slice(-50))).catch(() => {});
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={s.overlay}>
        <View style={s.card}>
          {!!item.poster_url && <Image source={{ uri: item.poster_url }} style={s.poster} />}
          <View style={{ flex: 1 }}>
            <Text style={s.title}>🎉 Seu pedido chegou!</Text>
            <Text style={s.name} numberOfLines={2}>{item.title}</Text>
            <View style={s.actions}>
              <Pressable hasTVPreferredFocus style={({ focused }) => [s.btn, s.primary, focused && s.focus]}
                onPress={() => { dismiss(); onOpen({ id: item.content_id, title: item.title, poster_url: item.poster_url }, item.content_type); }}>
                <Text style={s.btnTxt}>Assistir</Text>
              </Pressable>
              <Pressable style={({ focused }) => [s.btn, focused && s.focus]} onPress={dismiss}>
                <Text style={s.btnTxt}>Fechar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '50%', flexDirection: 'row', gap: 20, backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', padding: 24 },
  poster: { width: 100, height: 150, borderRadius: 8, backgroundColor: '#1a1a1a' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  name: { color: '#ddd', fontSize: 16, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  btn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 11, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 3, borderColor: 'transparent' },
  primary: { backgroundColor: '#E50914' },
  focus: { borderColor: '#fff' },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
