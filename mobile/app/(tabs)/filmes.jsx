import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, useWindowDimensions, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MovieCard from '../../components/MovieCard';
import api from '../../lib/api';

export default function FilmesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const GAP = 8;
  const PAD = 12;
  const cardW = (width - PAD * 2 - GAP * 2) / 3;
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genreModal, setGenreModal] = useState(false);

  useEffect(() => {
    api.get('/genres').then(r => setGenres(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => { load(1, true); }, [selectedGenre]);

  const load = async (p, reset = false) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      let url = `/movies?page=${p}&limit=21`;
      if (selectedGenre) url += `&genre=${encodeURIComponent(selectedGenre)}`;
      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : (res.data.data ?? res.data.items ?? []);
      setMovies(prev => reset ? data : [...prev, ...data]);
      setHasMore(data.length === 21);
      setPage(p);
    } catch {}
    setLoading(false);
    setLoadingMore(false);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    load(page + 1);
  };

  const selectGenre = (g) => { setSelectedGenre(g); setGenreModal(false); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Filmes</Text>
        {genres.length > 0 && (
          <TouchableOpacity style={styles.genreDropBtn} onPress={() => setGenreModal(true)} activeOpacity={0.7}>
            <Text style={styles.genreDropTxt} numberOfLines={1}>{selectedGenre || 'Todos os gêneros'}</Text>
            <Ionicons name="chevron-down" size={15} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={genreModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setGenreModal(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setGenreModal(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Gêneros</Text>
            <ScrollView style={{ maxHeight: '70%' }}>
              <TouchableOpacity style={styles.modalItem} activeOpacity={0.7} onPress={() => selectGenre(null)}>
                <Text style={[styles.modalItemTxt, !selectedGenre && styles.modalItemTxtActive]}>Todos os gêneros</Text>
                {!selectedGenre && <Ionicons name="checkmark" size={20} color="#E50914" />}
              </TouchableOpacity>
              {genres.map(g => (
                <TouchableOpacity key={g} style={styles.modalItem} activeOpacity={0.7} onPress={() => selectGenre(g)}>
                  <Text style={[styles.modalItemTxt, selectedGenre === g && styles.modalItemTxtActive]}>{g}</Text>
                  {selectedGenre === g && <Ionicons name="checkmark" size={20} color="#E50914" />}
                </TouchableOpacity>
              ))}
              <View style={{ height: 12 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color="#E50914" /></View>
      ) : movies.length === 0 ? (
        <View style={styles.loader}><Text style={{ color: '#444', fontSize: 14 }}>Nenhum filme{selectedGenre ? ` em "${selectedGenre}"` : ''}</Text></View>
      ) : (
        <FlatList
          data={movies}
          keyExtractor={item => item.id}
          numColumns={3}
          renderItem={({ item }) => <MovieCard item={item} type="movie" cardWidth={cardW} />}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: GAP }}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
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
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, gap: 10,
  },
  header: { fontSize: 24, fontWeight: '700', color: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  genreDropBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    maxWidth: 170,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  genreDropTxt: { color: '#fff', fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#141414', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingTop: 12, paddingHorizontal: 0,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#333',
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: {
    color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.5,
    paddingHorizontal: 20, marginBottom: 8,
  },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  modalItemTxt: { color: '#b3b3b3', fontSize: 16 },
  modalItemTxtActive: { color: '#fff', fontWeight: '700' },
  grid: { paddingHorizontal: 12, paddingBottom: 16 },
});
