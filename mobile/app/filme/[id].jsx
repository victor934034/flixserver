import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../lib/api';
import { useDownloads } from '../../contexts/DownloadContext';
import { useParental } from '../../contexts/ParentalContext';

async function checkInList(contentId) {
  try {
    const res = await api.get('/watchlist');
    return (res.data || []).find(i => i.content_id === contentId) || null;
  } catch { return null; }
}

export default function FilmeDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listItem, setListItem] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [likeData, setLikeData] = useState({ likes: 0, dislikes: 0, userVote: null });
  const [likeLoading, setLikeLoading] = useState(false);
  const { getStatus, startDownload, cancelDownload, deleteDownload } = useDownloads();
  const { checkAccess } = useParental();

  useEffect(() => {
    api.get(`/movies/${id}`)
      .then(r => { setMovie(r.data); return checkInList(id); })
      .then(async item => {
        setListItem(item);
        try { const lr = await api.get(`/likes/movie/${id}`); setLikeData(lr.data); } catch {}
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleVote = async (vote) => {
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      await api.post(`/likes/movie/${id}`, { vote });
      const lr = await api.get(`/likes/movie/${id}`);
      setLikeData(lr.data);
    } catch {}
    setLikeLoading(false);
  };

  const toggleList = async () => {
    setListLoading(true);
    try {
      if (listItem) {
        await api.delete(`/watchlist/${listItem.id}`);
        setListItem(null);
      } else {
        const res = await api.post('/watchlist', { content_type: 'movie', content_id: id });
        setListItem(res.data);
      }
    } catch {}
    setListLoading(false);
  };

  const play = async (version) => {
    const urls = {
      dubbing: movie.file_dubbing,
      subtitled: movie.file_subtitled,
      cinema: movie.file_cinema,
      '4k': movie.file_4k,
    };
    const remoteUrl = urls[version];
    if (!remoteUrl) return;

    // Check parental controls
    const allowed = await checkAccess(movie);
    if (!allowed) return;

    // If downloaded, use local file
    const dlStatus = getStatus(movie.id, version);
    const playUrl = dlStatus.state === 'done' ? dlStatus.filePath : remoteUrl;

    router.push({
      pathname: '/player',
      params: {
        url: playUrl,
        title: movie.title,
        id: movie.id,
        type: 'movie',
        currentVersion: version,
        versions: JSON.stringify({
          dubbing: dlStatus.state === 'done' && version === 'dubbing' ? dlStatus.filePath : (movie.file_dubbing || null),
          subtitled: dlStatus.state === 'done' && version === 'subtitled' ? dlStatus.filePath : (movie.file_subtitled || null),
          cinema: dlStatus.state === 'done' && version === 'cinema' ? dlStatus.filePath : (movie.file_cinema || null),
          '4k': dlStatus.state === 'done' && version === '4k' ? dlStatus.filePath : (movie.file_4k || null),
        }),
        subtitles: JSON.stringify({
          pt: movie.subtitle_pt || null,
          en: movie.subtitle_en || null,
          es: movie.subtitle_es || null,
        }),
      },
    });
  };

  const handleDownload = (version, url) => {
    const st = getStatus(movie.id, version);
    if (st.state === 'done') {
      Alert.alert(
        'Baixado',
        'Já salvo no dispositivo. Deseja excluir?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: () => deleteDownload(movie.id, version) },
        ]
      );
    } else if (st.state === 'downloading') {
      Alert.alert('Cancelar download?', '', [
        { text: 'Não', style: 'cancel' },
        { text: 'Cancelar', style: 'destructive', onPress: () => cancelDownload(movie.id, version) },
      ]);
    } else {
      startDownload(movie.id, version, url, {
        title: movie.title,
        type: 'movie',
        posterUrl: movie.poster_url || movie.backdrop_url,
      });
      Alert.alert('Download iniciado', `"${movie.title}" está sendo baixado para assistir offline.`);
    }
  };

  const getFirstVersion = () => {
    if (movie.file_dubbing) return 'dubbing';
    if (movie.file_subtitled) return 'subtitled';
    if (movie.file_cinema) return 'cinema';
    if (movie.file_4k) return '4k';
    return null;
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#E50914" />
    </View>
  );
  if (!movie) return (
    <View style={styles.center}>
      <Text style={styles.notFound}>Filme não encontrado</Text>
    </View>
  );

  const hasAny = movie.file_dubbing || movie.file_subtitled || movie.file_cinema || movie.file_4k;
  const firstVersion = getFirstVersion();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={{ height: height * 0.44 }}>
        <Image
          source={{ uri: movie.backdrop_url || movie.poster_url }}
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
        <View style={styles.topRow}>
          {movie.poster_url && (
            <Image source={{ uri: movie.poster_url }} style={styles.poster} />
          )}
          <View style={styles.meta}>
            <Text style={styles.title}>{movie.title}</Text>
            <View style={styles.tags}>
              {movie.year && <Text style={styles.tag}>{movie.year}</Text>}
              {movie.duration && (
                <Text style={styles.tag}>
                  {Math.floor(movie.duration / 60)}h {movie.duration % 60}min
                </Text>
              )}
              {movie.age_rating && (
                <View style={styles.ageBox}>
                  <Text style={styles.ageText}>{movie.age_rating}</Text>
                </View>
              )}
            </View>
            {movie.rating > 0 && (
              <Text style={styles.rating}>★ {Number(movie.rating).toFixed(1)}</Text>
            )}
          </View>
        </View>

        <View style={styles.actionRow}>
          {hasAny && firstVersion && (
            <TouchableOpacity style={styles.btnPlay} onPress={() => play(firstVersion)}>
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

        <View style={styles.likeRow}>
          <TouchableOpacity
            style={[styles.likeBtn, likeData.userVote === 'like' && styles.likeBtnActive]}
            onPress={() => handleVote('like')} disabled={likeLoading}
          >
            <Ionicons name={likeData.userVote === 'like' ? 'thumbs-up' : 'thumbs-up-outline'} size={20} color={likeData.userVote === 'like' ? '#46d369' : '#888'} />
            <Text style={[styles.likeCount, likeData.userVote === 'like' && { color: '#46d369' }]}>
              {likeData.likes > 0 ? likeData.likes : 'Gostei'}
            </Text>
          </TouchableOpacity>
          <View style={styles.likeSep} />
          <TouchableOpacity
            style={[styles.likeBtn, likeData.userVote === 'dislike' && styles.dislikeBtnActive]}
            onPress={() => handleVote('dislike')} disabled={likeLoading}
          >
            <Ionicons name={likeData.userVote === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'} size={20} color={likeData.userVote === 'dislike' ? '#E50914' : '#888'} />
            <Text style={[styles.likeCount, likeData.userVote === 'dislike' && { color: '#E50914' }]}>
              {likeData.dislikes > 0 ? likeData.dislikes : 'Não gostei'}
            </Text>
          </TouchableOpacity>
        </View>

        {movie.genres?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genresRow}>
            {movie.genres.map(g => (
              <View key={g} style={styles.genre}>
                <Text style={styles.genreText}>{g}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {movie.synopsis && (
          <Text style={styles.synopsis}>{movie.synopsis}</Text>
        )}

        {hasAny && (
          <View style={styles.versions}>
            <Text style={styles.versionsLabel}>Versões disponíveis</Text>
            {[
              { key: 'dubbing',   url: movie.file_dubbing,   icon: 'musical-notes',  label: 'Dublado' },
              { key: 'subtitled', url: movie.file_subtitled, icon: 'text',           label: 'Legendado' },
              { key: 'cinema',    url: movie.file_cinema,    icon: 'film-outline',   label: 'Original' },
              { key: '4k',        url: movie.file_4k,        icon: 'sparkles-outline', label: '4K' },
            ].filter(v => v.url).map(v => {
              const st = getStatus(movie.id, v.key);
              return (
                <View key={v.key} style={styles.versionRow}>
                  <TouchableOpacity style={styles.versionBtn} onPress={() => play(v.key)}>
                    <Ionicons name={v.icon} size={14} color="#fff" />
                    <Text style={styles.versionBtnText}>{v.label}</Text>
                    {st.state === 'done' && (
                      <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dlBtn}
                    onPress={() => handleDownload(v.key, v.url)}
                  >
                    {st.state === 'downloading' ? (
                      <View style={styles.dlProgress}>
                        <ActivityIndicator size="small" color="#E50914" />
                        <Text style={styles.dlPct}>{Math.round((st.progress || 0) * 100)}%</Text>
                      </View>
                    ) : st.state === 'done' ? (
                      <Ionicons name="trash-outline" size={16} color="#E50914" />
                    ) : (
                      <Ionicons name="download-outline" size={16} color="#aaa" />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  notFound: { color: '#666', fontSize: 16 },
  back: {
    position: 'absolute', left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8,
  },
  body: { paddingHorizontal: 16, paddingBottom: 48 },
  topRow: { flexDirection: 'row', marginBottom: 18, marginTop: -30 },
  poster: { width: 88, height: 132, borderRadius: 8, marginRight: 14 },
  meta: { flex: 1, justifyContent: 'flex-end', paddingBottom: 4 },
  title: { fontSize: 21, fontWeight: '800', color: '#fff', marginBottom: 8, lineHeight: 26 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6, alignItems: 'center' },
  tag: { color: '#b3b3b3', fontSize: 13 },
  ageBox: { borderWidth: 1, borderColor: '#555', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3 },
  ageText: { color: '#b3b3b3', fontSize: 12 },
  rating: { color: '#ffa500', fontSize: 14, fontWeight: '600' },
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
  likeRow: {
    flexDirection: 'row', backgroundColor: '#111', borderRadius: 10,
    marginBottom: 16, overflow: 'hidden',
  },
  likeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, gap: 8,
  },
  likeBtnActive: { backgroundColor: '#0d2a0d' },
  dislikeBtnActive: { backgroundColor: '#2a0d0d' },
  likeSep: { width: 1, backgroundColor: '#1e1e1e', marginVertical: 8 },
  likeCount: { color: '#888', fontSize: 14, fontWeight: '600' },
  genresRow: { marginBottom: 14 },
  genre: {
    backgroundColor: '#1f1f1f', paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, marginRight: 8,
  },
  genreText: { color: '#b3b3b3', fontSize: 12 },
  synopsis: { color: '#ccc', fontSize: 14, lineHeight: 22, marginBottom: 24 },
  versions: { marginTop: 8 },
  versionsLabel: { color: '#666', fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  versionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  versionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1f1f1f', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a',
  },
  versionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  dlBtn: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  dlProgress: { alignItems: 'center', gap: 2 },
  dlPct: { color: '#E50914', fontSize: 9, fontWeight: '700' },
});
