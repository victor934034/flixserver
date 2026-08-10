import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';

export default function CronologiasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [collections, setCollections] = useState(null);

  useEffect(() => {
    api.get('/collections').then(r => setCollections(r.data || [])).catch(() => setCollections([]));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cronologias</Text>
      </View>

      {collections === null ? (
        <View style={styles.loader}><ActivityIndicator size="large" color="#E50914" /></View>
      ) : collections.length === 0 ? (
        <View style={styles.loader}><Text style={styles.emptyText}>Nenhuma cronologia disponível ainda</Text></View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/cronologia/${item.slug}`)} activeOpacity={0.8}>
              {item.cover_url ? (
                <Image source={{ uri: item.cover_url }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Text style={styles.coverPlaceholderText}>{item.name?.[0]}</Text>
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#555" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10 },
  backBtn: { padding: 6, marginRight: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414',
    borderRadius: 10, padding: 10, gap: 12, borderWidth: 1, borderColor: '#222',
  },
  cover: { width: 72, height: 48, borderRadius: 6, backgroundColor: '#1a1a1a' },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  coverPlaceholderText: { color: '#444', fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardDesc: { color: '#888', fontSize: 12, marginTop: 3 },
});
