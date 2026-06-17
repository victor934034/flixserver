import { useState, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MovieCard from '../../components/MovieCard';
import api from '../../lib/api';

export default function BuscaScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  const search = (q) => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
        const movies = (res.data.movies || []).map(m => ({ ...m, _type: 'movie' }));
        const series = (res.data.series || []).map(s => ({ ...s, _type: 'series' }));
        setResults([...movies, ...series]);
      } catch {}
      setLoading(false);
    }, 400);
  };

  const clear = () => { setQuery(''); setResults([]); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          placeholder="Buscar filmes e séries..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={(v) => { setQuery(v); search(v); }}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clear}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color="#E50914" /></View>
      ) : results.length === 0 && query ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>Nenhum resultado para "{query}"</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => `${item._type}-${item.id}`}
          numColumns={3}
          renderItem={({ item }) => <MovieCard item={item} type={item._type} compact />}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1f1f1f', margin: 16, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a',
  },
  input: { flex: 1, color: '#fff', fontSize: 16 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: '#555', fontSize: 15 },
  grid: { paddingHorizontal: 8, paddingBottom: 16 },
});
