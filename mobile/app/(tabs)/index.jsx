import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  Image, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import HeroBanner from '../../components/HeroBanner';
import ContentRow from '../../components/ContentRow';
import api from '../../lib/api';
import { useProfile } from '../../contexts/ProfileContext';

function ContinueCard({ item }) {
  const router = useRouter();
  const [pressing, setPressing] = useState(false);
  const W = 140;
  const H = 80;
  const progress = item.duration > 0 ? Math.min(item.progress / item.duration, 1) : 0;

  const handlePress = async () => {
    if (pressing) return;
    if (item.content_type === 'movie') {
      router.push({ pathname: `/filme/${item.content_id}`, params: { startAt: String(Math.floor(item.progress)) } });
      return;
    }
    // Episodes: fetch episode data and navigate directly to player
    // This avoids the intermediate serie screen in the nav stack (no gray screen on back)
    setPressing(true);
    try {
      const episodeId = item.episode_id || item.content_id;
      const { data: ep } = await api.get(`/episodes/${episodeId}`);
      const version = ep.file_dubbing ? 'dubbing' : ep.file_subtitled ? 'subtitled' : 'cinema';
      const url = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
      if (!url) { setPressing(false); return; }
      const seriesId = item.series_id || item.content_id;
      const playerParams = {
        url,
        title: `${item.title || ''} · T${ep.season_number}E${String(ep.episode_number).padStart(2, '0')}${ep.title ? ` · ${ep.title}` : ''}`,
        id: String(ep.id),
        type: 'episode',
        currentVersion: version,
        versions: JSON.stringify({
          dubbing: ep.file_dubbing || null,
          subtitled: ep.file_subtitled || null,
          cinema: ep.file_cinema || null,
        }),
        subtitles: JSON.stringify({
          pt: ep.subtitle_pt || null,
          en: ep.subtitle_en || null,
          es: ep.subtitle_es || null,
        }),
        seriesId: String(seriesId),
      };
      if (ep.intro_end) playerParams.introEnd = String(ep.intro_end);
      if (item.progress > 5) playerParams.startAt = String(Math.floor(item.progress));
      router.push({ pathname: '/player', params: playerParams });
    } catch {}
    setPressing(false);
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.continueCard} activeOpacity={0.75} disabled={pressing}>
      <View style={{ width: W, height: H }}>
        {item.poster_url ? (
          <Image source={{ uri: item.poster_url }} style={{ width: W, height: H, borderRadius: 6, opacity: pressing ? 0.5 : 1 }} resizeMode="cover" />
        ) : (
          <View style={[styles.continuePlaceholder, { width: W, height: H }]} />
        )}
        {pressing && (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', borderRadius: 6 }]}>
            <ActivityIndicator size="small" color="#E50914" />
          </View>
        )}
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text numberOfLines={1} style={styles.continueTitle}>{item.title || 'Sem título'}</Text>
      {item.episode_number && (
        <Text numberOfLines={1} style={styles.continueEp}>
          T{item.season_number}E{String(item.episode_number).padStart(2, '0')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { activeProfile } = useProfile();
  const [featured, setFeatured] = useState([]);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [continueItems, setContinueItems] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    // Sem perfil ativo nunca buscar — evita misturar histórico de perfis diferentes
    if (!activeProfile?.id) {
      setContinueItems([]);
      return;
    }
    try {
      const hRes = await api.get(`/history?limit=10&profile_id=${activeProfile.id}`);
      const history = Array.isArray(hRes.data) ? hRes.data : [];
      setContinueItems(history.filter(h => !h.completed && h.progress > 0 && h.title));
    } catch {}
  }, [activeProfile?.id]);

  useEffect(() => {
    Promise.all([
      api.get('/featured').catch(() => ({ data: [] })),
      api.get('/movies?limit=20').catch(() => ({ data: [] })),
      api.get('/series?limit=20').catch(() => ({ data: [] })),
      api.get('/movies/section/popular').catch(() => ({ data: [] })),
      api.get('/series/section/popular').catch(() => ({ data: [] })),
    ]).then(([fRes, mRes, sRes, popMoviesRes, popSeriesRes]) => {
      setFeatured(Array.isArray(fRes.data) ? fRes.data : []);
      setMovies(Array.isArray(mRes.data) ? mRes.data : (mRes.data?.data ?? []));
      setSeries(Array.isArray(sRes.data) ? sRes.data : (sRes.data?.data ?? []));
      const popM = Array.isArray(popMoviesRes.data) ? popMoviesRes.data : [];
      const popS = Array.isArray(popSeriesRes.data) ? popSeriesRes.data : [];
      const merged = [...popM, ...popS].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 20);
      setPopular(merged);
    }).finally(() => setLoading(false));
  }, []);

  // Re-busca histórico quando perfil muda (mesmo que a aba já esteja focada)
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Re-busca histórico ao ganhar foco (ao voltar do player)
  useFocusEffect(useCallback(() => {
    fetchHistory();
  }, [fetchHistory]));

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  const hero = featured[0] || movies[0];
  const isEmpty = !featured.length && !movies.length && !series.length;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
    >
      {hero && <HeroBanner items={featured.length ? featured : movies} />}

      <View style={styles.rows}>
        {continueItems.length > 0 && (
          <View style={styles.continueSection}>
            <Text style={styles.sectionTitle}>Continuar Assistindo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.continueRow}>
              {continueItems.map(item => (
                <ContinueCard key={`${item.content_type}-${item.content_id}`} item={item} />
              ))}
            </ScrollView>
          </View>
        )}

        <ContentRow title="Filmes" items={movies} type="movie" />
        <ContentRow title="Séries" items={series} type="series" />
        {popular.length > 0 && (
          <ContentRow title="Mais Assistidos" items={popular} type="mixed" />
        )}

        {isEmpty && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhum conteúdo disponível</Text>
            <Text style={styles.emptyDesc}>Adicione filmes e séries pelo painel admin.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  rows: { paddingBottom: 32 },
  continueSection: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 17, fontWeight: '700', color: '#fff',
    paddingHorizontal: 16, marginBottom: 12,
  },
  continueRow: { paddingHorizontal: 16, gap: 10 },
  continueCard: { marginRight: 0 },
  continuePlaceholder: { borderRadius: 6, backgroundColor: '#1a1a1a' },
  progressTrack: {
    height: 3, backgroundColor: '#333', borderRadius: 1.5,
    marginTop: 5, width: 140,
  },
  progressFill: { height: '100%', backgroundColor: '#E50914', borderRadius: 1.5 },
  continueTitle: { color: '#ccc', fontSize: 11, marginTop: 4, width: 140 },
  continueEp: { color: '#666', fontSize: 10, marginTop: 1 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: '#555', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptyDesc: { color: '#333', fontSize: 14, textAlign: 'center' },
});
