import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { xcGetCategories } from '../utils/xcApi';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [creds, setCreds] = useState(null);
  const [noSub, setNoSub] = useState(false);
  const [noSubMsg, setNoSubMsg] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setNoSub(false);
    try {
      const { data } = await api.get('/iptv/me');
      setCreds(data);
      const cats = await xcGetCategories(data.server_url, data.xc_username, data.xc_password);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (e) {
      setNoSub(true);
      setNoSubMsg(e.response?.data?.error || e.message || 'Sem assinatura IPTV');
      setCreds(null);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase()))
    : categories;

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#c91c2c" />
      <Text style={styles.loadingText}>Conectando ao servidor IPTV…</Text>
    </View>
  );

  if (noSub) return (
    <View style={styles.center}>
      <Text style={styles.noSubIcon}>📺</Text>
      <Text style={styles.noSubTitle}>Sem acesso IPTV</Text>
      <Text style={styles.noSubText}>{noSubMsg}</Text>
      <Text style={styles.noSubHint}>Entre em contato para assinar o plano IPTV.</Text>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>📺 IPTV</Text>
          <Text style={styles.greeting}>Olá, {user?.name?.split(' ')[0] ?? 'usuário'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Buscar categoria..."
        placeholderTextColor="#444"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.category_id)}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor="#c91c2c" colors={['#c91c2c']} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.catRow}
            activeOpacity={0.7}
            onPress={() => router.push({
              pathname: '/channels',
              params: {
                category_id: item.category_id,
                category_name: item.category_name,
                server_url: creds.server_url,
                xc_username: creds.xc_username,
                xc_password: creds.xc_password,
              },
            })}
          >
            <Text style={styles.catName}>{item.category_name}</Text>
            <Text style={styles.catArrow}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma categoria encontrada</Text>
        }
        contentContainerStyle={filtered.length === 0 && styles.emptyContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  center: {
    flex: 1, backgroundColor: '#0a0a0a',
    alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: 32,
  },
  loadingText: { color: '#555', marginTop: 8, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 20,
    borderBottomWidth: 1, borderBottomColor: '#141414',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  greeting: { color: '#555', fontSize: 13, marginTop: 2 },

  logoutBtn: {
    backgroundColor: '#1a1a1a', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a',
  },
  logoutText: { color: '#888', fontSize: 13 },

  search: {
    backgroundColor: '#141414', color: '#fff', padding: 12,
    margin: 12, borderRadius: 10, borderWidth: 1, borderColor: '#222',
    fontSize: 14,
  },

  catRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#111',
  },
  catName: { flex: 1, color: '#fff', fontSize: 15 },
  catArrow: { color: '#333', fontSize: 22 },

  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { color: '#333', textAlign: 'center', fontSize: 14 },

  noSubIcon: { fontSize: 60, marginBottom: 4 },
  noSubTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  noSubText: { color: '#c91c2c', fontSize: 14, textAlign: 'center' },
  noSubHint: { color: '#444', fontSize: 13, textAlign: 'center', marginTop: 4 },
});
