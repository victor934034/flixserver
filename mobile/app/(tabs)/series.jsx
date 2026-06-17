import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MovieCard from '../../components/MovieCard';
import api from '../../lib/api';

export default function SeriesScreen() {
  const insets = useSafeAreaInsets();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/series?limit=60')
      .then(r => setSeries(r.data.items ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.header}>Séries</Text>
      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color="#E50914" /></View>
      ) : (
        <FlatList
          data={series}
          keyExtractor={item => item.id}
          numColumns={3}
          renderItem={({ item }) => <MovieCard item={item} type="series" compact />}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
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
