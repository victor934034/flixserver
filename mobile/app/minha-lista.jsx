import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

export default function MinhaListaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/watchlist');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const navigate = (item) => {
    const route = item.content_type === 'movie'
      ? `/filme/${item.content_id}`
      : `/serie/${item.content_id}`;
    router.push(route);
  };

  const remove = (item) => {
    Alert.alert('Remover da lista', `Remover "${item.title || item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setRemoving(item.id);
          try {
            await api.delete(`/watchlist/${item.id}`);
            setItems(prev => prev.filter(i => i.id !== item.id));
          } catch {}
          setRemoving(null);
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const title = item.title || item.name || 'Sem título';
    const year = item.year || item.year_start;
    const isRemoving = removing === item.id;

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigate(item)}
        activeOpacity={0.7}
      >
        {item.poster_url ? (
          <Image source={{ uri: item.poster_url }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Ionicons name="film-outline" size={24} color="#444" />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <View style={styles.meta}>
            <Text style={styles.type}>
              {item.content_type === 'movie' ? 'Filme' : 'Série'}
            </Text>
            {year && <Text style={styles.year}>{year}</Text>}
          </View>
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => remove(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isRemoving
            ? <ActivityIndicator size="small" color="#E50914" />
            : <Ionicons name="heart" size={22} color="#E50914" />}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minha Lista</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E50914" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>Sua lista está vazia</Text>
          <Text style={styles.emptyHint}>
            Adicione filmes e séries tocando no ♡ na página deles
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 10,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#555', fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyHint: { color: '#333', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 12,
    padding: 12, marginBottom: 10, gap: 12,
  },
  poster: { width: 56, height: 84, borderRadius: 6 },
  posterPlaceholder: { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  meta: { flexDirection: 'row', gap: 8 },
  type: {
    color: '#E50914', fontSize: 11, fontWeight: '700',
    backgroundColor: 'rgba(229,9,20,0.1)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
  },
  year: { color: '#555', fontSize: 12, alignSelf: 'center' },
  removeBtn: { padding: 6 },
});
