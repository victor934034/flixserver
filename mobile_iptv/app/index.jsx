import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

const CACHE_KEY = 'iptv_categories_cache';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [status,      setStatus]      = useState('loading');
  const [pendingInfo, setPendingInfo] = useState(null);
  const [categories,  setCategories]  = useState([]);
  const [search,      setSearch]      = useState('');
  const [refreshing,  setRefreshing]  = useState(false);
  const loaded = useRef(false);

  const fetchCategories = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const { data } = await api.get('/iptv/categories');
      const cats = Array.isArray(data) ? data : [];
      setCategories(cats);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cats));
    } catch {}
    if (showRefresh) setRefreshing(false);
  }, []);

  const load = useCallback(async () => {
    // Só mostra loading na primeira vez
    if (!loaded.current) setStatus('loading');

    try {
      const { data } = await api.get('/iptv/status');

      if (data.status === 'active') {
        // Carrega cache imediatamente
        if (!loaded.current) {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
          if (cached) {
            setCategories(JSON.parse(cached));
          }
        }
        setStatus('active');
        loaded.current = true;
        // Busca dados frescos em background (sem bloquear a UI)
        fetchCategories(false);
      } else if (data.status === 'pending') {
        setPendingInfo(data);
        setStatus('pending');
      } else {
        setStatus('none');
      }
    } catch {
      setStatus('none');
    }
  }, [fetchCategories]);

  useEffect(() => { load(); }, [load]);

  if (status === 'loading') return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#c91c2c" />
      <Text style={styles.loadingText}>Verificando assinatura…</Text>
    </View>
  );

  if (status === 'none') return (
    <View style={styles.center}>
      <Text style={styles.icon}>📺</Text>
      <Text style={styles.noSubTitle}>FlixHome IPTV</Text>
      <Text style={styles.noSubText}>Você ainda não tem uma assinatura IPTV ativa.</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/plans')}>
        <Text style={styles.primaryBtnText}>Ver planos disponíveis</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );

  if (status === 'pending') return (
    <View style={styles.center}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.pendingTitle}>Pagamento confirmado!</Text>
      <Text style={styles.pendingPlan}>{pendingInfo?.plan_name}</Text>
      <Text style={styles.pendingText}>
        Sua assinatura está sendo ativada pelo administrador.{'\n'}
        Prazo: até 24 horas após o pagamento.
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={load}>
        <Text style={styles.primaryBtnText}>Verificar novamente</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );

  const filtered = search.trim()
    ? categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📺 FlixHome IPTV</Text>
        <View style={styles.headerRight}>
          <Text style={styles.greeting}>{user?.name?.split(' ')[0] ?? 'usuário'}</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
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
        numColumns={2}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchCategories(true)}
            tintColor="#c91c2c"
            colors={['#c91c2c']}
          />
        }
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.catCard}
            activeOpacity={0.7}
            onPress={() => router.push({
              pathname: '/channels',
              params: {
                category_id:   item.category_id,
                category_name: item.category_name,
              },
            })}
          >
            <Text style={styles.catName} numberOfLines={2}>{item.category_name}</Text>
            <Text style={styles.catArrow}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma categoria encontrada</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  center: {
    flex: 1, backgroundColor: '#0a0a0a',
    alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: 32,
  },
  loadingText: { color: '#555', fontSize: 14 },
  icon: { fontSize: 52, marginBottom: 4 },

  noSubTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  noSubText:  { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  pendingTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  pendingPlan:  { color: '#c91c2c', fontWeight: '700', fontSize: 14 },
  pendingText:  { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  primaryBtn: {
    backgroundColor: '#c91c2c', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 10, marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  logoutBtn: {
    backgroundColor: '#1a1a1a', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a',
  },
  logoutText: { color: '#888', fontSize: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#141414',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:    { color: '#fff', fontSize: 18, fontWeight: '800' },
  greeting: { color: '#555', fontSize: 13 },

  search: {
    backgroundColor: '#141414', color: '#fff', padding: 10,
    marginHorizontal: 12, marginVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: '#222', fontSize: 13,
  },

  grid: { padding: 8, gap: 8 },
  catCard: {
    flex: 1, margin: 4,
    backgroundColor: '#141414', borderRadius: 10,
    padding: 14, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#1e1e1e',
    minHeight: 56,
  },
  catName:  { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  catArrow: { color: '#333', fontSize: 18, marginLeft: 6 },
  empty:    { color: '#333', textAlign: 'center', fontSize: 14, marginTop: 40 },
});
