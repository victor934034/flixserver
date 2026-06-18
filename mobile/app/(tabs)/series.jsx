import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, useWindowDimensions,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MovieCard from '../../components/MovieCard';
import api from '../../lib/api';

export default function SeriesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);

  const GAP = 8;
  const PAD = 12;
  const cardW = (width - PAD * 2 - GAP * 2) / 3;

  useEffect(() => {
    api.get('/genres').then(r => setGenres(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => { load(1); }, [selectedGenre]);

  const load = useCallback(async (pageNum = 1) => {
    if (pageNum === 1) setLoading(true); else setLoadingMore(true);
    try {
      let url = `/series?limit=21&page=${pageNum}`;
      if (selectedGenre) url += `&genre=${encodeURIComponent(selectedGenre)}`;
      const res = await api.get(url);
      const items = Array.isArray(res.data) ? res.data : (res.data.data ?? res.data.items ?? []);
      setSeries(prev => pageNum === 1 ? items : [...prev, ...items]);
      setHasMore(items.length === 21);
      setPage(pageNum);
    } catch {}
    if (pageNum === 1) setLoading(false); else setLoadingMore(false);
  }, [selectedGenre]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    load(page + 1);
  };

  const toggleGenre = (g) => setSelectedGenre(prev => prev === g ? null : g);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.header}>Séries</Text>

      {genres.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreRow} style={styles.genreScroll}>
          {genres.map(g => (
            <TouchableOpacity key={g} style={[styles.chip, selectedGenre === g && styles.chipActive]} onPress={() => toggleGenre(g)}>
              <Text style={[styles.chipText, selectedGenre === g && styles.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color="#E50914" /></View>
      ) : series.length === 0 ? (
        <View style={styles.loader}>
          <Text style={styles.emptyText}>Nenhuma série{selectedGenre ? ` em "${selectedGenre}"` : ''}</Text>
        </View>
      ) : (
        <FlatList
          data={series}
          keyExtractor={item => item.id}
          numColumns={3}
          renderItem={({ item }) => <MovieCard item={item} type="series" cardWidth={cardW} />}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: GAP }}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#E50914" style={{ marginVertical: 20 }} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { fontSize: 24, fontWeight: '700', color: '#fff', paddingHorizontal: 16, paddingBottom: 6 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 15 },
  genreScroll: { flexGrow: 0, marginBottom: 8 },
  genreRow: { paddingHorizontal: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  chipActive: { backgroundColor: '#E50914', borderColor: '#E50914' },
  chipText: { color: '#777', fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  grid: { paddingHorizontal: 12, paddingBottom: 16 },
});
