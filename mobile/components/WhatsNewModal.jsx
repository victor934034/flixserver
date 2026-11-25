import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHANGELOG } from '../constants/changelog';
import { openStoreRating } from '../lib/rate';

const STORAGE_KEY = 'lastSeenChangelogVersion';

export default function WhatsNewModal() {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState([]);
  const [askRate, setAskRate] = useState(false);

  useEffect(() => {
    (async () => {
      if (!CHANGELOG.length) return;
      try {
        const lastSeen = await AsyncStorage.getItem(STORAGE_KEY);
        if (lastSeen === CHANGELOG[0].version) return;
        // Mostra so as entradas ainda nao vistas (so a mais nova, se nunca abriu antes)
        const idx = CHANGELOG.findIndex(c => c.version === lastSeen);
        const toShow = idx === -1 ? CHANGELOG.slice(0, 1) : CHANGELOG.slice(0, idx);
        if (toShow.length === 0) return;
        setPending(toShow);
        setVisible(true);
      } catch {}
    })();
  }, []);

  const close = async () => {
    setVisible(false);
    // Na primeira abertura de cada versao, depois das novidades vem o convite para avaliar
    if (Platform.OS === 'android') setAskRate(true);
    try { await AsyncStorage.setItem(STORAGE_KEY, CHANGELOG[0].version); } catch {}
  };

  if (askRate) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setAskRate(false)}>
        <View style={styles.overlay}>
          <View style={[styles.card, { alignItems: 'center' }]}>
            <View style={styles.stars}>
              {[0, 1, 2, 3, 4].map(i => <Ionicons key={i} name="star" size={30} color="#f5c518" />)}
            </View>
            <Text style={[styles.title, { textAlign: 'center' }]}>O que está achando do FlixHome?</Text>
            <Text style={styles.rateText}>Sua avaliação na Play Store ajuda muito.</Text>
            <TouchableOpacity style={[styles.btn, { alignSelf: 'stretch' }]} onPress={() => { setAskRate(false); openStoreRating(); }} activeOpacity={0.85}>
              <Text style={styles.btnText}>Avaliar o app</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAskRate(false)} style={{ padding: 12 }}>
              <Text style={styles.later}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="sparkles" size={22} color="#E50914" />
            <Text style={styles.title}>Novidades</Text>
          </View>
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {pending.map(entry => (
              <View key={entry.version} style={styles.section}>
                <Text style={styles.version}>Versão {entry.version}</Text>
                {entry.items.map((text, i) => (
                  <View key={i} style={styles.itemRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.itemText}>{text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.btn} onPress={close} activeOpacity={0.85}>
            <Text style={styles.btnText}>Entendi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  rateText: { color: '#A3A3A3', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 18 },
  later: { color: '#888', fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 420, maxHeight: '75%',
    backgroundColor: '#161616', borderRadius: 16, padding: 22,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { color: '#fff', fontSize: 19, fontWeight: '800' },
  body: { marginBottom: 18 },
  section: { marginBottom: 14 },
  version: { color: '#E50914', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E50914', marginTop: 6, flexShrink: 0 },
  itemText: { color: '#ccc', fontSize: 14, lineHeight: 20, flex: 1 },
  btn: { backgroundColor: '#E50914', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
