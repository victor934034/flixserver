import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl, AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../lib/api';

const CACHE_KEY = 'iptv_categories_cache';
let _memCache = null;

export default function IptvScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loadKey,     setLoadKey]     = useState(0);
  const [status,      setStatus]      = useState(_memCache ? 'active' : 'loading');
  const [pendingInfo, setPendingInfo] = useState(null);
  const [categories,  setCategories]  = useState(_memCache || []);
  const [search,      setSearch]      = useState('');
  const [refreshing,  setRefreshing]  = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const statusRef   = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  const fetchCategories = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const { data } = await api.get('/iptv/categories');
      const cats = Array.isArray(data) ? data : [];
      _memCache = cats;
      setCategories(cats);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cats));
    } catch {}
    if (showRefresh) setRefreshing(false);
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/iptv/status');
      if (data.status === 'active' && statusRef.current !== 'active') {
        _memCache = null;
        setStatus('loading');
        setCategories([]);
        setLoadKey(k => k + 1);
      } else if (data.status === 'pending') {
        setPendingInfo(data);
        if (statusRef.current !== 'pending') setStatus('pending');
      } else if (data.status === 'none' && statusRef.current !== 'none') {
        _memCache = null;
        await AsyncStorage.removeItem(CACHE_KEY);
        setStatus('none');
      }
    } catch {}
  }, []);

  // Main load effect — re-runs on loadKey change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (_memCache) {
        setCategories(_memCache);
        setStatus('active');
        // Background verify
        try {
          const { data } = await api.get('/iptv/status');
          if (cancelled) return;
          if (data.status !== 'active') {
            _memCache = null;
            await AsyncStorage.removeItem(CACHE_KEY);
            setStatus(data.status === 'pending' ? 'pending' : 'none');
            if (data.status === 'pending') setPendingInfo(data);
          } else {
            fetchCategories(false);
          }
        } catch {}
        return;
      }

      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cancelled) return;
      if (cached) {
        try {
          _memCache = JSON.parse(cached);
          setCategories(_memCache);
          setStatus('active');
        } catch {}
      }

      try {
        const { data } = await api.get('/iptv/status');
        if (cancelled) return;
        if (data.status === 'active') {
          setStatus('active');
          fetchCategories(false);
        } else if (data.status === 'pending') {
          _memCache = null;
          setPendingInfo(data);
          setStatus('pending');
        } else {
          _memCache = null;
          await AsyncStorage.removeItem(CACHE_KEY);
          setStatus('none');
        }
      } catch {
        if (!cancelled && !cached) setStatus('none');
      }
    })();
    return () => { cancelled = true; };
  }, [loadKey]);

  // Poll every 30s when pending — auto-activate when admin turns it on
  useEffect(() => {
    if (status !== 'pending' && status !== 'none') return;
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [status, checkStatus]);

  // AppState listener — check on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const s = statusRef.current;
        if (s === 'pending' || s === 'none') checkStatus();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [checkStatus]);

  const reload = useCallback(() => {
    _memCache = null;
    AsyncStorage.removeItem(CACHE_KEY);
    setStatus('loading');
    setCategories([]);
    setLoadKey(k => k + 1);
  }, []);

  const filtered = search.trim()
    ? categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase()))
    : categories;

  if (status === 'loading') return (
    <View style={[styles.center, { paddingTop: insets.top }]}>
      <ActivityIndicator size="large" color="#E50914" />
    </View>
  );

  if (status === 'none') return (
    <View style={[styles.center, { paddingTop: insets.top }]}>
      <Text style={styles.icon}>📺</Text>
      <Text style={styles.title}>FlixHome IPTV</Text>
      <Text style={styles.sub}>Você ainda não tem uma assinatura IPTV ativa.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.push('/iptv-plans')}>
        <Text style={styles.btnText}>Ver planos disponíveis</Text>
      </TouchableOpacity>
    </View>
  );

  if (status === 'pending') return (
    <View style={[styles.center, { paddingTop: insets.top }]}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Pagamento confirmado!</Text>
      {pendingInfo?.plan_name && <Text style={styles.pendingPlan}>{pendingInfo.plan_name}</Text>}
      <Text style={styles.sub}>
        Sua assinatura está sendo ativada pelo administrador.{'\n'}
        Você será notificado assim que ativar.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={checkStatus}>
        <Text style={styles.btnText}>Verificar agora</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📺 IPTV</Text>
        <Text style={styles.headerSub}>{categories.length} categorias</Text>
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
            tintColor="#E50914"
            colors={['#E50914']}
          />
        }
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => router.push({
              pathname: '/iptv-channels',
              params: { category_id: item.category_id, category_name: item.category_name },
            })}
          >
            <Text style={styles.cardName} numberOfLines={2}>{item.category_name}</Text>
            <Text style={styles.cardArrow}>›</Text>
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
  container:   { flex: 1, backgroundColor: '#0a0a0a' },
  center:      { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  icon:        { fontSize: 52, marginBottom: 4 },
  title:       { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  pendingPlan: { color: '#E50914', fontWeight: '700', fontSize: 14 },
  sub:         { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  btn:         { backgroundColor: '#E50914', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 4 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  header:      { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub:   { color: '#555', fontSize: 12, marginTop: 2 },
  search:      { backgroundColor: '#141414', color: '#fff', padding: 11, marginHorizontal: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: '#222', fontSize: 14 },
  grid:        { paddingHorizontal: 8, paddingBottom: 16, gap: 8 },
  card:        { flex: 1, margin: 4, backgroundColor: '#141414', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1e1e1e', minHeight: 60 },
  cardName:    { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  cardArrow:   { color: '#444', fontSize: 18, marginLeft: 6 },
  empty:       { color: '#333', textAlign: 'center', fontSize: 14, marginTop: 40 },
});
