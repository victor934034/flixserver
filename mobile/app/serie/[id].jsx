import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';

export default function SerieDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [serie, setSerie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [season, setSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listItem, setListItem] = useState(null);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/series/${id}`),
      api.get(`/series/${id}/episodes`),
      api.get('/watchlist'),
    ]).then(([sRes, eRes, wRes]) => {
      setSerie(sRes.data);
      const eps = Array.isArray(eRes.data) ? eRes.data : (eRes.data?.data ?? []);
      setEpisodes(eps);
      if (eps.length > 0) setSeason(eps[0].season_number);
      const wl = Array.isArray(wRes.data) ? wRes.data : [];
      setListItem(wl.find(i => i.content_id === id) || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const toggleList = async () => {
    setListLoading(true);
    try {
      if (listItem) {
        await api.delete(`/watchlist/${listItem.id}`);
        setListItem(null);
      } else {
        const res = await api.post('/watchlist', { content_type: 'series', content_id: id });
        setListItem(res.data);
      }
    } catch {}
    setListLoading(false);
  };

  const seasons = [...new Set(episodes.map(e => e.season_number))].sort((a, b) => a - b);
  const currentEps = episodes
    .filter(e => e.season_number === season)
    .sort((a, b) => a.episode_number - b.episode_number);

  const playEp = (ep, preferredVersion) => {
    const version = preferredVersion || (ep.file_dubbing ? 'dubbing' : ep.file_subtitled ? 'subtitled' : 'cinema');
    const url = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
    if (!url) return;
    router.push({
      pathname: '/player',
      params: {
        url,
        title: `${serie.title} · T${ep.season_number}E${String(ep.episode_number).padStart(2, '0')}${ep.title ? ` · ${ep.title}` : ''}`,
        id: ep.id,
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
      },
    });
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#E50914" />
    </View>
  );
  if (!serie) return (
    <View style={styles.center}>
      <Text style={{ color: '#666' }}>Série não encontrada</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={{ height: height * 0.36 }}>
        <Image
          source={{ uri: serie.backdrop_url || serie.poster_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', '#0a0a0a']}
          locations={[0.2, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity style={[styles.back, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{serie.title}</Text>
        <View style={styles.tags}>
          {serie.year_start && <Text style={styles.tag}>{serie.year_start}</Text>}
          {serie.total_seasons && (
            <Text style={styles.tag}>{serie.total_seasons} temp.</Text>
          )}
          {serie.rating > 0 && (
            <Text style={styles.rating}>★ {Number(serie.rating).toFixed(1)}</Text>
          )}
        </View>

        <View style={styles.actionRow}>
          {episodes.length > 0 && (
            <TouchableOpacity style={styles.btnPlay} onPress={() => playEp(episodes[0])}>
              <Ionicons name="play" size={18} color="#000" />
              <Text style={styles.btnPlayText}>Assistir</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnList} onPress={toggleList} disabled={listLoading}>
            {listLoading
              ? <ActivityIndicator size="small" color="#E50914" />
              : <Ionicons name={listItem ? 'heart' : 'heart-outline'} size={22} color={listItem ? '#E50914' : '#fff'} />}
          </TouchableOpacity>
        </View>

        {serie.synopsis && (
          <Text style={styles.synopsis}>{serie.synopsis}</Text>
        )}

        {seasons.length > 0 && (
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
          {currentEps.length} episódio{currentEps.length !== 1 ? 's' : ''}
        </Text>

        {currentEps.map(ep => {
          const hasFile = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
          return (
            <TouchableOpacity
              key={ep.id}
              style={[styles.episode, !hasFile && styles.episodeDisabled]}
              onPress={() => playEp(ep)}
              disabled={!hasFile}
              activeOpacity={0.7}
            >
              <View style={styles.epThumb}>
                {ep.thumbnail_url ? (
                  <Image source={{ uri: ep.thumbnail_url }} style={styles.epThumbImg} />
                ) : (
                  <View style={styles.epThumbPlaceholder}>
                    <Text style={styles.epNumText}>{ep.episode_number}</Text>
                  </View>
                )}
                {hasFile && (
                  <View style={styles.epPlayOverlay}>
                    <Ionicons name="play-circle" size={28} color="#fff" />
                  </View>
                )}
              </View>
              <View style={styles.epInfo}>
                <Text style={styles.epNum}>
                  T{ep.season_number}E{String(ep.episode_number).padStart(2, '0')}
                </Text>
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
  back: {
    position: 'absolute', left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8,
  },
  body: { paddingHorizontal: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'center' },
  btnPlay: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', paddingVertical: 14, borderRadius: 8, gap: 8,
  },
  btnPlayText: { color: '#000', fontSize: 16, fontWeight: '700' },
  btnList: {
    width: 50, height: 50, borderRadius: 8,
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  tags: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'center' },
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
  sectionTitle: {
    color: '#555', fontSize: 11, marginBottom: 12,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  episode: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#141414', gap: 12,
  },
  episodeDisabled: { opacity: 0.45 },
  epThumb: { width: 120, height: 68, borderRadius: 6, overflow: 'hidden', position: 'relative' },
  epThumbImg: { width: '100%', height: '100%' },
  epThumbPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
  },
  epNumText: { color: '#555', fontSize: 18, fontWeight: '700' },
  epPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  epInfo: { flex: 1 },
  epNum: { color: '#666', fontSize: 11, marginBottom: 3 },
  epTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  epSynopsis: { color: '#666', fontSize: 12, lineHeight: 16 },
  epDuration: { color: '#555', fontSize: 11, marginTop: 4 },
});
