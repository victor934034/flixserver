import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MovieCard from '../../components/MovieCard';
import api from '../../lib/api';

export default function FilmesScreen() {
  const insets = useSafeAreaInsets();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => { load(1, true); }, []);

  const load = async (p, reset = false) => {
    if (p > 1) setLoadingMore(true);
    try {
      const res = await api.get(`/movies?page=${p}&limit=21`);
      const data = res.data.items ?? res.data;
      setMovies(prev => reset ? data : [...prev, ...data]);
      setHasMore(data.length === 21);
    } catch {}
    setLoading(false);
    setLoadingMore(false);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    const next = page + 1;
    setPage(next);
    load(next);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.header}>Filmes</Text>
      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color="#E50914" /></View>
      ) : (
        <FlatList
          data={movies}
          keyExtractor={item => item.id}
          numColumns={3}
          renderItem={({ item }) => <MovieCard item={item} type="movie" compact />}
          contentContainerStyle={styles.grid}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#E50914" style={{ padding: 16 }} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { fontSize: 24, fontWeight: '700', color: '#fff', paddingHorizontal: 16, paddingBottom: 8 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  grid: { paddingHorizontal: 8, paddingBottom: 16 },
});
