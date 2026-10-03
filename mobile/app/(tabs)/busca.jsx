import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, ScrollView, useWindowDimensions, Image, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MovieCard from '../../components/MovieCard';
import api from '../../lib/api';

// Módulo nativo — não existe no Expo Go (só em builds com dev-client/AAB/APK).
// O require() em si não falha (só quebra quando o hook/método é realmente
// usado), então detectamos o Expo Go via expo-constants e nem tentamos
// carregar o módulo real nesse caso; o botão de busca por voz continua na
// tela mas avisa que precisa do app instalado.
const isExpoGo = require('expo-constants').default?.executionEnvironment === 'storeClient';
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = () => {};
if (!isExpoGo) {
  try {
    const speechMod = require('expo-speech-recognition');
    ExpoSpeechRecognitionModule = speechMod.ExpoSpeechRecognitionModule;
    useSpeechRecognitionEvent = speechMod.useSpeechRecognitionEvent;
  } catch {}
}

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
  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  const [genreContent, setGenreContent] = useState([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const timer = useRef(null);
  const inputRef = useRef(null);
  const [listening, setListening] = useState(false);

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

  // Busca por voz (pt-BR). O texto reconhecido cai no mesmo fluxo de busca
  // digitada, entao acento/hifen/etc sao tratados pelo backend igual.
  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', () => setListening(false));
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results?.[0]?.transcript?.trim();
    if (text) { setQuery(text); search(text); }
  });

  const toggleVoice = async () => {
    if (!ExpoSpeechRecognitionModule) {
      Alert.alert('Indisponível', 'A busca por voz só funciona no app instalado (não funciona no Expo Go).');
      return;
    }
    if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return;
    ExpoSpeechRecognitionModule.start({ lang: 'pt-BR', interimResults: true, maxAlternatives: 1 });
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
        <TouchableOpacity onPress={toggleVoice} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 10 }}>
          <Ionicons name={listening ? 'mic' : 'mic-outline'} size={22} color={listening ? '#E50914' : '#888'} />
        </TouchableOpacity>
      </View>

      {/* Dropdown de categoria */}
      {genres.length > 0 && (
        <View style={styles.genreDropdownWrap}>
          <TouchableOpacity style={styles.genreDropdownBtn} onPress={() => setGenreDropdownOpen(true)}>
            <Ionicons name="options-outline" size={16} color={selectedGenre ? '#E50914' : '#888'} />
            <Text style={[styles.genreDropdownText, selectedGenre && styles.genreDropdownTextActive]} numberOfLines={1}>
              {selectedGenre || 'Todas as categorias'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#888" />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={genreDropdownOpen} transparent animationType="fade" onRequestClose={() => setGenreDropdownOpen(false)}>
        <TouchableOpacity style={styles.genreModalOverlay} activeOpacity={1} onPress={() => setGenreDropdownOpen(false)}>
          <View style={styles.genreModalBox}>
            <Text style={styles.genreModalTitle}>Categoria</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              <TouchableOpacity
                style={styles.genreModalRow}
                onPress={() => { toggleGenre(null); setGenreDropdownOpen(false); }}
              >
                <Text style={[styles.genreModalRowText, !selectedGenre && styles.genreModalRowTextActive]}>Todas as categorias</Text>
                {!selectedGenre && <Ionicons name="checkmark" size={18} color="#E50914" />}
              </TouchableOpacity>
              {genres.map(g => (
                <TouchableOpacity
                  key={g}
                  style={styles.genreModalRow}
                  onPress={() => { toggleGenre(g); setGenreDropdownOpen(false); }}
                >
                  <Text style={[styles.genreModalRowText, selectedGenre === g && styles.genreModalRowTextActive]}>{g}</Text>
                  {selectedGenre === g && <Ionicons name="checkmark" size={18} color="#E50914" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

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
  genreDropdownWrap: { paddingHorizontal: 16, marginVertical: 10 },
  genreDropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', maxWidth: '100%',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  genreDropdownText: { color: '#888', fontSize: 13.5, fontWeight: '500', flexShrink: 1 },
  genreDropdownTextActive: { color: '#fff', fontWeight: '700' },

  genreModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  genreModalBox: {
    backgroundColor: '#161616', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a',
    paddingTop: 16, paddingBottom: 8, maxHeight: '70%',
  },
  genreModalTitle: { color: '#fff', fontSize: 15, fontWeight: '700', paddingHorizontal: 20, marginBottom: 8 },
  genreModalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 13,
  },
  genreModalRowText: { color: '#bbb', fontSize: 15 },
  genreModalRowTextActive: { color: '#fff', fontWeight: '700' },
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
