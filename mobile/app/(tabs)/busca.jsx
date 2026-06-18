import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, ScrollView, useWindowDimensions, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MovieCard from '../../components/MovieCard';
import api from '../../lib/api';

function EpisodeCard({ item, cardW }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={[styles.epCard, { width: cardW }]}
      onPress={() => router.push(`/serie/${item.series_id}`)}
      activeOpacity={0.75}
    >
      <View style={{ width: cardW, height: cardW * 0.56, borderRadius: 7, overflow: 'hidden', backgroundColor: '#1a1a1a' }}>
        {item.thumbnail_url || item.poster_url ? (
          <Image source={{ uri: item.thumbnail_url || item.poster_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={styles.epThumbPlaceholder}>
            <Ionicons name="play-circle-outline" size={28} color="#444" />
          </View>
        )}
        <View style={styles.epBadge}>
          <Text style={styles.epBadgeText}>T{item.season_number}E{String(item.episode_number).padStart(2, '0')}</Text>
        </View>
      </View>
      <Text style={styles.epTitle} numberOfLines={1}>{item.title || `Ep. ${item.episode_number}`}</Text>
      {item.seriesTitle && <Text style={styles.epSeries} numberOfLines={1}>{item.seriesTitle}</Text>}
    </TouchableOpacity>
  );
}

export default function BuscaScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ movies: [], series: [], episodes: [] });
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genreContent, setGenreContent] = useState([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const timer = useRef(null);
  const inputRef = useRef(null);

  const GAP = 8;
  const PAD = 16;
  const cardW = (width - PAD * 2 - GAP * 2) / 3;

  useEffect(() => {
    // carrega trending e gêneros em paralelo
    Promise.all([
      api.get('/movies?limit=9').catch(() => ({ data: [] })),
      api.get('/genres').catch(() => ({ data: [] })),
    ]).then(([trendRes, genresRes]) => {
      setTrending(Array.isArray(trendRes.data) ? trendRes.data : (trendRes.data?.data ?? []));
      setGenres(Array.isArray(genresRes.data) ? genresRes.data : []);
    });
  }, []);

  // Filtra por gênero (quando sem texto digitado)
  useEffect(() => {
    if (!selectedGenre || query.trim()) return;
    setGenreLoading(true);
    Promise.all([
      api.get(`/movies?genre=${encodeURIComponent(selectedGenre)}&limit=30`).catch(() => ({ data: [] })),
      api.get(`/series?genre=${encodeURIComponent(selectedGenre)}&limit=30`).catch(() => ({ data: [] })),
    ]).then(([mRes, sRes]) => {
      const movies = (Array.isArray(mRes.data) ? mRes.data : (mRes.data?.data ?? [])).map(m => ({ ...m, _type: 'movie' }));
      const series = (Array.isArray(sRes.data) ? sRes.data : (sRes.data?.data ?? [])).map(s => ({ ...s, _type: 'series' }));
      setGenreContent([...movies, ...series]);
    }).finally(() => setGenreLoading(false));
  }, [selectedGenre]);

  const search = (q) => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults({ movies: [], series: [], episodes: [] }); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = [`q=${encodeURIComponent(q)}`, 'limit=20'];
        if (selectedGenre) params.push(`genre=${encodeURIComponent(selectedGenre)}`);
        const res = await api.get(`/search?${params.join('&')}`);
        setResults({
          movies: res.data.movies || [],
          series: res.data.series || [],
          episodes: res.data.episodes || [],
        });
      } catch {}
      setLoading(false);
    }, 350);
  };

  const clear = () => {
    setQuery('');
    setResults({ movies: [], series: [], episodes: [] });
    inputRef.current?.focus();
  };

  const toggleGenre = (g) => {
    const next = selectedGenre === g ? null : g;
    setSelectedGenre(next);
    setGenreContent([]);
    if (query.trim()) search(query);
  };

  const hasResults = results.movies.length + results.series.length + results.episodes.length > 0;
  const showGenreContent = !query.trim() && selectedGenre && genreContent.length > 0;
  const genreMovies = genreContent.filter(i => i._type === 'movie');
  const genreSeries = genreContent.filter(i => i._type === 'series');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Barra de busca */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Buscar filmes, séries e episódios..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={(v) => { setQuery(v); search(v); }}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={20} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {/* Chips de gênero */}
      {genres.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.genreRow}
          style={styles.genreScroll}
        >
          {genres.map(g => (
            <TouchableOpacity
              key={g}
              style={[styles.genreChip, selectedGenre === g && styles.genreChipActive]}
              onPress={() => toggleGenre(g)}
            >
              <Text style={[styles.genreChipText, selectedGenre === g && styles.genreChipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading || genreLoading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color="#E50914" /></View>

      ) : query.length === 0 && !selectedGenre ? (
        /* Tela inicial — Em Alta */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.emptyContent}>
          <Text style={styles.sectionTitle}>Em Alta</Text>
          <View style={styles.grid}>
            {trending.map(item => (
              <MovieCard key={item.id} item={item} type="movie" cardWidth={cardW} />
            ))}
          </View>
        </ScrollView>

      ) : query.length === 0 && showGenreContent ? (
        /* Conteúdo filtrado por gênero sem texto */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: PAD, marginBottom: 12 }]}>{selectedGenre}</Text>
          {genreMovies.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Filmes</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{genreMovies.length}</Text></View>
              </View>
              <View style={styles.grid}>
                {genreMovies.map(item => <MovieCard key={item.id} item={item} type="movie" cardWidth={cardW} />)}
              </View>
            </View>
          )}
          {genreSeries.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Séries</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{genreSeries.length}</Text></View>
              </View>
              <View style={styles.grid}>
                {genreSeries.map(item => <MovieCard key={item.id} item={item} type="series" cardWidth={cardW} />)}
              </View>
            </View>
          )}
          {genreContent.length === 0 && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>Nenhum conteúdo em "{selectedGenre}"</Text>
            </View>
          )}
        </ScrollView>

      ) : !hasResults && query.length > 0 ? (
        /* Sem resultados */
        <View style={styles.noResults}>
          <Ionicons name="search-outline" size={52} color="#222" />
          <Text style={styles.noResultsText}>Sem resultados para</Text>
          <Text style={styles.noResultsQuery}>"{query}"</Text>
        </View>

      ) : (
        /* Resultados da busca */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {results.movies.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Filmes</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{results.movies.length}</Text></View>
              </View>
              <View style={styles.grid}>
                {results.movies.map(item => <MovieCard key={item.id} item={item} type="movie" cardWidth={cardW} />)}
              </View>
            </View>
          )}
          {results.series.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Séries</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{results.series.length}</Text></View>
              </View>
              <View style={styles.grid}>
                {results.series.map(item => <MovieCard key={item.id} item={item} type="series" cardWidth={cardW} />)}
              </View>
            </View>
          )}
          {results.episodes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Episódios</Text>
                <View style={styles.countBadge}><Text style={styles.countText}>{results.episodes.length}</Text></View>
              </View>
              <View style={styles.grid}>
                {results.episodes.map(item => <EpisodeCard key={item.id} item={item} cardW={cardW} />)}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', marginHorizontal: 16, marginTop: 8, marginBottom: 0,
    paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: 12, borderWidth: 1, borderColor: '#252525',
  },
  input: { flex: 1, color: '#fff', fontSize: 16 },
  genreScroll: { flexGrow: 0, marginVertical: 10 },
  genreRow: { paddingHorizontal: 16, gap: 8 },
  genreChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  genreChipActive: { backgroundColor: '#E50914', borderColor: '#E50914' },
  genreChipText: { color: '#888', fontSize: 13, fontWeight: '500' },
  genreChipTextActive: { color: '#fff', fontWeight: '700' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContent: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14 },
  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 16 },
  sectionLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  countBadge: { backgroundColor: '#1f1f1f', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  countText: { color: '#888', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noResults: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 32 },
  noResultsText: { color: '#555', fontSize: 15, textAlign: 'center' },
  noResultsQuery: { color: '#333', fontSize: 14 },
  epCard: { marginBottom: 4 },
  epThumbPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  epBadge: {
    position: 'absolute', bottom: 5, left: 5,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  epBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  epTitle: { color: '#ccc', fontSize: 11, marginTop: 5, lineHeight: 15 },
  epSeries: { color: '#E50914', fontSize: 10, marginTop: 2 },
});
