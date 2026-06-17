import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HeroBanner from '../../components/HeroBanner';
import ContentRow from '../../components/ContentRow';
import api from '../../lib/api';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [featured, setFeatured] = useState([]);
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/featured').catch(() => ({ data: [] })),
      api.get('/movies?limit=20').catch(() => ({ data: [] })),
      api.get('/series?limit=20').catch(() => ({ data: [] })),
    ]).then(([fRes, mRes, sRes]) => {
      setFeatured(fRes.data || []);
      setMovies(mRes.data.items ?? mRes.data);
      setSeries(sRes.data.items ?? sRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  const hero = featured[0] || movies[0];
  const topMovies = [...movies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
    >
      {hero && <HeroBanner item={hero} />}
      <View style={styles.rows}>
        <ContentRow title="Filmes" items={movies} type="movie" />
        <ContentRow title="Séries" items={series} type="series" />
        {topMovies.length > 0 && (
          <ContentRow title="Mais Assistidos" items={topMovies} type="movie" />
        )}
      </View>
      <View style={{ height: insets.bottom + 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loader: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  rows: { marginTop: -32 },
});
