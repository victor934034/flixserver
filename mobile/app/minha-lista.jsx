import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

const H_PADDING = 16;
const GAP = 10;

// ID da linha na tabela watchlist (o `id` do item é o do filme/série)
const wid = (item) => item.watchlist_id || item.id;

export default function MinhaListaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

  const numColumns = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  const cardWidth = (width - H_PADDING * 2 - GAP * (numColumns - 1)) / numColumns;

  const load = useCallback(async () => {
    try {
      const res = await api.get('/watchlist');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {}
    setLoading(false);
  }, []);

  // Recarrega sempre que a tela ganha foco (ex.: voltou da página do filme)
  useFocusEffect(useCallback(() => { load(); }, [load]));

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
          const id = wid(item);
          setRemoving(id);
          try {
            await api.delete(`/watchlist/${id}`);
            setItems(prev => prev.filter(i => wid(i) !== id));
          } catch {
            Alert.alert('Erro', 'Não foi possível remover. Tente novamente.');
          }
          setRemoving(null);
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const title = item.title || item.name || 'Sem título';
    const year = item.year || item.year_start;
    const isRemoving = removing === wid(item);

    return (
      <TouchableOpacity
        style={[styles.card, { width: cardWidth }]}
        onPress={() => navigate(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.posterWrap, { height: cardWidth * 1.5 }]}>
          {item.poster_url ? (
            <Image source={{ uri: item.poster_url }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]}>
              <Ionicons name="film-outline" size={28} color="#444" />
            </View>
          )}
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => remove(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isRemoving
              ? <ActivityIndicator size="small" color="#E50914" />
              : <Ionicons name="heart" size={18} color="#E50914" />}
          </TouchableOpacity>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>
              {item.content_type === 'movie' ? 'Filme' : 'Série'}
            </Text>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {year ? <Text style={styles.year}>{year}</Text> : null}
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
          key={`cols-${numColumns}`}
          data={items}
          numColumns={numColumns}
          keyExtractor={item => String(wid(item))}
          renderItem={renderItem}
          columnWrapperStyle={{ gap: GAP }}
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
  list: { paddingHorizontal: H_PADDING, paddingBottom: 40 },
  card: { marginBottom: 16 },
  posterWrap: {
    width: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: '#1a1a1a',
  },
  poster: { width: '100%', height: '100%' },
  posterPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  removeBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute', left: 6, bottom: 6,
    backgroundColor: 'rgba(229,9,20,0.9)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  typeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  title: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 6, lineHeight: 16 },
  year: { color: '#666', fontSize: 11, marginTop: 2 },
});
