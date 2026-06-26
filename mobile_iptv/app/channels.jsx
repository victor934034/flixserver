import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import api from '../lib/api';

export default function ChannelsScreen() {
  const { category_id, category_name } = useLocalSearchParams();
  const router     = useRouter();
  const navigation = useNavigation();

  const [channels,    setChannels]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [search,      setSearch]      = useState('');
  const [loadingPlay, setLoadingPlay] = useState(null);

  useEffect(() => {
    navigation.setOptions({ title: category_name || 'Canais' });
  }, [category_name]);

  useEffect(() => {
    api.get('/iptv/streams', { params: { category_id } })
      .then(r => setChannels(Array.isArray(r.data) ? r.data : []))
      .catch(e => setError(e.response?.data?.error || 'Erro ao carregar canais'))
      .finally(() => setLoading(false));
  }, []);

  async function openChannel(item) {
    setLoadingPlay(item.stream_id);
    try {
      const { data } = await api.get(`/iptv/stream-url/${item.stream_id}`);
      router.push({
        pathname: '/player',
        params: { url: data.url, name: item.name, logo: item.stream_icon || '' },
      });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível abrir o canal.');
    } finally {
      setLoadingPlay(null);
    }
  }

  const filtered = search.trim()
    ? channels.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))
    : channels;

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#c91c2c" />
      <Text style={styles.loadingText}>Carregando canais…</Text>
    </View>
  );

  if (error) return (
    <View style={styles.center}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder={`Buscar em ${category_name || 'canais'}...`}
        placeholderTextColor="#444"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.stream_id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => openChannel(item)}
            disabled={loadingPlay === item.stream_id}
          >
            {item.stream_icon ? (
              <Image source={{ uri: item.stream_icon }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={[styles.logo, styles.logoFallback]}>
                <Text style={styles.logoFallbackText}>📺</Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            {loadingPlay === item.stream_id
              ? <ActivityIndicator size="small" color="#c91c2c" />
              : <Text style={styles.arrow}>▶</Text>
            }
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>Nenhum canal encontrado</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0a0a' },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60 },
  loadingText:{ color: '#555', fontSize: 14 },
  errorIcon:  { fontSize: 40 },
  errorText:  { color: '#f44336', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },

  search: {
    backgroundColor: '#141414', color: '#fff', padding: 12,
    margin: 12, borderRadius: 10, borderWidth: 1, borderColor: '#222',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111', gap: 12,
  },
  logo:            { width: 52, height: 38, borderRadius: 4, backgroundColor: '#141414' },
  logoFallback:    { alignItems: 'center', justifyContent: 'center' },
  logoFallbackText:{ fontSize: 22 },
  name:  { flex: 1, color: '#fff', fontSize: 14 },
  arrow: { color: '#c91c2c', fontSize: 16 },
  empty: { color: '#333', fontSize: 14 },
});
