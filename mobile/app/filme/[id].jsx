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

export default function FilmeDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/movies/${id}`)
      .then(r => setMovie(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const play = (version) => {
    const urls = {
      dubbing: movie.file_dubbing,
      subtitled: movie.file_subtitled,
      cinema: movie.file_cinema,
      '4k': movie.file_4k,
    };
    const url = urls[version];
    if (!url) return;
    router.push({ pathname: '/player', params: { url, title: movie.title, id: movie.id, type: 'movie' } });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#E50914" /></View>;
  if (!movie) return <View style={styles.center}><Text style={styles.notFound}>Filme não encontrado</Text></View>;

  const hasAny = movie.file_dubbing || movie.file_subtitled || movie.file_cinema || movie.file_4k;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={{ height: height * 0.42 }}>
        <Image source={{ uri: movie.backdrop_url || movie.poster_url }} style={styles.backdrop} />
        <LinearGradient colors={['rgba(0,0,0,0.2)', '#0a0a0a']} style={styles.gradient} />
        <TouchableOpacity style={[styles.back, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.row}>
          {movie.poster_url && (
            <Image source={{ uri: movie.poster_url }} style={styles.poster} />
          )}
          <View style={styles.meta}>
            <Text style={styles.title}>{movie.title}</Text>
            <View style={styles.tags}>
              {movie.year && <Text style={styles.tag}>{movie.year}</Text>}
              {movie.duration && <Text style={styles.tag}>{Math.floor(movie.duration / 60)}h {movie.duration % 60}m</Text>}
              {movie.age_rating && <Text style={[styles.tag, styles.ageTag]}>{movie.age_rating}</Text>}
            </View>
            {movie.rating && (
              <Text style={styles.rating}>★ {Number(movie.rating).toFixed(1)}</Text>
            )}
          </View>
        </View>

        {movie.genres?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genresRow}>
            {movie.genres.map(g => (
              <View key={g} style={styles.genre}><Text style={styles.genreText}>{g}</Text></View>
            ))}
          </ScrollView>
        )}

        {movie.synopsis && <Text style={styles.synopsis}>{movie.synopsis}</Text>}

        {hasAny && (
          <View style={styles.buttons}>
            {movie.file_dubbing && (
              <TouchableOpacity style={styles.btnPrimary} onPress={() => play('dubbing')}>
                <Ionicons name="play" size={16} color="#000" />
                <Text style={styles.btnPrimaryText}>Dublado</Text>
              </TouchableOpacity>
            )}
            {movie.file_subtitled && (
              <TouchableOpacity style={styles.btnOutline} onPress={() => play('subtitled')}>
                <Ionicons name="play-outline" size={16} color="#fff" />
                <Text style={styles.btnOutlineText}>Legendado</Text>
              </TouchableOpacity>
            )}
            {movie.file_cinema && (
              <TouchableOpacity style={styles.btnOutline} onPress={() => play('cinema')}>
                <Ionicons name="film-outline" size={16} color="#fff" />
                <Text style={styles.btnOutlineText}>Cinema</Text>
              </TouchableOpacity>
            )}
            {movie.file_4k && (
              <TouchableOpacity style={styles.btnOutline} onPress={() => play('4k')}>
                <Text style={styles.btnOutlineText}>4K</Text>
              </TouchableOpacity>
            )}
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
  backdrop: { width: '100%', height: '100%' },
  gradient: { ...StyleSheet.absoluteFillObject },
  back: {
    position: 'absolute', left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 8,
  },
  body: { paddingHorizontal: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', marginBottom: 16 },
  poster: { width: 90, height: 135, borderRadius: 8, marginRight: 14, marginTop: -20 },
  meta: { flex: 1, justifyContent: 'flex-end' },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  tag: { color: '#b3b3b3', fontSize: 13 },
  ageTag: { borderWidth: 1, borderColor: '#555', paddingHorizontal: 6, borderRadius: 3 },
  rating: { color: '#ffa500', fontSize: 14, fontWeight: '600' },
  genresRow: { marginBottom: 14 },
  genre: {
    backgroundColor: '#1f1f1f', paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, marginRight: 8,
  },
  genreText: { color: '#b3b3b3', fontSize: 12 },
  synopsis: { color: '#ccc', fontSize: 14, lineHeight: 22, marginBottom: 24 },
  buttons: { gap: 12 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', paddingVertical: 14, borderRadius: 8, gap: 8,
  },
  btnPrimaryText: { color: '#000', fontSize: 15, fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 14,
    borderRadius: 8, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  btnOutlineText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
