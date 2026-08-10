import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';
import MovieCard from '../../components/MovieCard';

export default function CronologiaDetailScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [collection, setCollection] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/collections/${slug}`)
      .then(r => setCollection(r.data))
      .catch(() => setNotFound(true));
  }, [slug]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{collection?.name || 'Cronologia'}</Text>
      </View>

      {notFound ? (
        <View style={styles.loader}><Text style={styles.emptyText}>Cronologia não encontrada</Text></View>
      ) : !collection ? (
        <View style={styles.loader}><ActivityIndicator size="large" color="#E50914" /></View>
      ) : (
        <FlatList
          data={collection.items}
          keyExtractor={item => `${item.type}-${item.id}`}
          contentContainerStyle={styles.list}
          ListHeaderComponent={collection.description ? (
            <Text style={styles.desc}>{collection.description}</Text>
          ) : null}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <View style={styles.positionBadge}>
                <Text style={styles.positionText}>{index + 1}</Text>
              </View>
              <MovieCard item={item} type={item.type} />
            </View>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 14 },
  list: { padding: 16, paddingBottom: 32, gap: 14 },
  desc: { color: '#999', fontSize: 13, marginBottom: 6, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  positionBadge: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1a1a1a',
    borderWidth: 1, borderColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center',
  },
  positionText: { color: '#E50914', fontWeight: '700', fontSize: 13 },
});
