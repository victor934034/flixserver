import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

export default function HistoricoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/history?limit=50')
      .then(r => setItems(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const navigate = (item) => {
    const route = item.content_type === 'movie'
      ? `/filme/${item.content_id}`
      : `/serie/${item.series_id || item.content_id}`;
    router.push(route);
  };

  const fmtTime = (secs) => {
    const m = Math.floor((secs || 0) / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}min restantes`;
    return `${m}min restantes`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.header}>Histórico</Text>
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color="#E50914" /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={52} color="#222" />
          <Text style={styles.emptyText}>Nenhum conteúdo assistido ainda</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => `${item.content_type}-${item.content_id}`}
          renderItem={({ item }) => {
            const pct = item.duration > 0 ? Math.min(item.progress / item.duration, 1) : 0;
            const remaining = item.duration - item.progress;
            return (
              <TouchableOpacity style={styles.item} onPress={() => navigate(item)} activeOpacity={0.7}>
                <View style={styles.thumb}>
                  {item.poster_url ? (
                    <Image source={{ uri: item.poster_url }} style={styles.thumbImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Ionicons name="film-outline" size={20} color="#333" />
                    </View>
                  )}
                  {item.completed && (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </View>
                <View style={styles.info}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  {item.episode_number && (
                    <Text style={styles.itemEp}>
                      T{item.season_number}E{String(item.episode_number).padStart(2, '0')}
                      {item.episode_title ? ` · ${item.episode_title}` : ''}
                    </Text>
                  )}
                  {!item.completed && item.duration > 0 && (
                    <>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                      </View>
                      <Text style={styles.remaining}>{fmtTime(remaining)}</Text>
                    </>
                  )}
                  {item.completed && (
                    <Text style={styles.completedText}>Concluído</Text>
                  )}
                </View>
                <Ionicons name="play-circle-outline" size={28} color="#444" />
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 8,
  },
  backBtn: { padding: 10 },
  header: { fontSize: 20, fontWeight: '700', color: '#fff', marginLeft: 4 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: '#444', fontSize: 15 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#111', gap: 14,
  },
  thumb: { width: 68, height: 100, borderRadius: 6, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
  },
  completedBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: '#46d369', borderRadius: 10, width: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1 },
  itemTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  itemEp: { color: '#666', fontSize: 12, marginBottom: 8 },
  progressTrack: {
    height: 3, backgroundColor: '#222', borderRadius: 1.5, marginBottom: 5,
  },
  progressFill: { height: '100%', backgroundColor: '#E50914', borderRadius: 1.5 },
  remaining: { color: '#666', fontSize: 11 },
  completedText: { color: '#46d369', fontSize: 12 },
});
