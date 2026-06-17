import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';

const { width, height } = Dimensions.get('window');

export default function SerieDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [serie, setSerie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [season, setSeason] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/series/${id}`),
      api.get(`/series/${id}/episodes`),
    ]).then(([sRes, eRes]) => {
      setSerie(sRes.data);
      const eps = eRes.data || [];
      setEpisodes(eps);
      if (eps.length > 0) setSeason(eps[0].season_number);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const seasons = [...new Set(episodes.map(e => e.season_number))].sort((a, b) => a - b);
  const currentEps = episodes
    .filter(e => e.season_number === season)
    .sort((a, b) => a.episode_number - b.episode_number);

  const playEp = (ep) => {
    const url = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
    if (!url) return;
    router.push({
      pathname: '/player',
      params: {
        url,
        title: `${serie.title} — T${ep.season_number}E${String(ep.episode_number).padStart(2, '0')}`,
        id: ep.id,
        type: 'episode',
      },
    });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#E50914" /></View>;
  if (!serie) return <View style={styles.center}><Text style={{ color: '#666' }}>Série não encontrada</Text></View>;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={{ height: height * 0.35 }}>
        <Image source={{ uri: serie.backdrop_url || serie.poster_url }} style={styles.backdrop} />
        <LinearGradient colors={['rgba(0,0,0,0.1)', '#0a0a0a']} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={[styles.back, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{serie.title}</Text>
        <View style={styles.tags}>
          {serie.year_start && <Text style={styles.tag}>{serie.year_start}</Text>}
          {serie.total_seasons && <Text style={styles.tag}>{serie.total_seasons} temp.</Text>}
          {serie.rating && <Text style={styles.rating}>★ {Number(serie.rating).toFixed(1)}</Text>}
        </View>
        {serie.synopsis && <Text style={styles.synopsis}>{serie.synopsis}</Text>}

        {seasons.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonsRow}>
            {seasons.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.seasonBtn, s === season && styles.seasonBtnActive]}
                onPress={() => setSeason(s)}
              >
                <Text style={[styles.seasonText, s === season && styles.seasonTextActive]}>
                  Temporada {s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={styles.sectionTitle}>
          {seasons.length === 1 ? `Temporada ${season}` : ''} — {currentEps.length} episódio{currentEps.length !== 1 ? 's' : ''}
        </Text>

        {currentEps.map(ep => {
          const hasFile = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
          return (
            <TouchableOpacity key={ep.id} style={styles.episode} onPress={() => playEp(ep)} disabled={!hasFile}>
              <View style={styles.epNum}>
                <Text style={styles.epNumText}>{ep.episode_number}</Text>
              </View>
              <View style={styles.epInfo}>
                <Text style={styles.epTitle} numberOfLines={1}>
                  {ep.title || `Episódio ${ep.episode_number}`}
                </Text>
                {ep.synopsis && (
                  <Text style={styles.epSynopsis} numberOfLines={2}>{ep.synopsis}</Text>
                )}
                {ep.duration && (
                  <Text style={styles.epDuration}>{Math.floor(ep.duration / 60)}min</Text>
                )}
              </View>
              {hasFile && <Ionicons name="play-circle" size={30} color="#E50914" />}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  backdrop: { width: '100%', height: '100%' },
  back: {
    position: 'absolute', left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8,
  },
  body: { paddingHorizontal: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  tags: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tag: { color: '#b3b3b3', fontSize: 13 },
  rating: { color: '#ffa500', fontSize: 13, fontWeight: '600' },
  synopsis: { color: '#ccc', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  seasonsRow: { marginBottom: 16 },
  seasonBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8,
  },
  seasonBtnActive: { backgroundColor: '#E50914', borderColor: '#E50914' },
  seasonText: { color: '#b3b3b3', fontSize: 13 },
  seasonTextActive: { color: '#fff', fontWeight: '700' },
  sectionTitle: { color: '#555', fontSize: 12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  episode: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#141414', gap: 12,
  },
  epNum: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1f1f1f', justifyContent: 'center', alignItems: 'center',
  },
  epNumText: { color: '#b3b3b3', fontSize: 14, fontWeight: '700' },
  epInfo: { flex: 1 },
  epTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  epSynopsis: { color: '#555', fontSize: 12, lineHeight: 16 },
  epDuration: { color: '#555', fontSize: 11, marginTop: 2 },
});
