import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl, AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';

const CACHE_KEY = 'iptv_categories_cache';
let _memCache = null;

function TLItem({ state, title, sub, last }) {
  const color = state === 'done' ? '#22C55E' : state === 'doing' ? '#FBBF24' : '#555';
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: color, backgroundColor: state === 'done' ? '#22C55E' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {state === 'done' && <Ionicons name="checkmark" size={14} color="#0a0a0a" />}
        </View>
        {!last && <View style={{ width: 2, flex: 1, minHeight: 26, backgroundColor: state === 'done' ? '#22C55E' : '#333' }} />}
      </View>
      <View style={{ paddingBottom: last ? 0 : 14 }}>
        <Text style={{ color: state === 'todo' ? '#888' : state === 'doing' ? '#FBBF24' : '#fff', fontWeight: '800', fontSize: 15 }}>{title}</Text>
        {sub ? <Text style={{ color: '#888', fontSize: 12.5, marginTop: 2 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

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
    <View style={[styles.stateRoot, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 }]}>
      <Text style={styles.stateKicker}>SEM IPTV</Text>
      <Text style={styles.stateH1}>IPTV ao vivo</Text>
      <View style={styles.stateMid}>
        <View style={styles.tile}><Ionicons name="tv-outline" size={44} color="#E50914" /></View>
        <Text style={styles.stateTitle}>Canais ao vivo, 24h</Text>
        <Text style={styles.sub}>Esportes, notícias, filmes e infantis no mesmo app. Até 2 telas.</Text>
      </View>
      <TouchableOpacity style={styles.bigBtn} onPress={() => router.push('/iptv-plans')} activeOpacity={0.9}>
        <Text style={styles.bigBtnTxt}>Ver planos IPTV</Text>
      </TouchableOpacity>
    </View>
  );

  if (status === 'pending') return (
    <View style={[styles.stateRoot, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 }]}>
      <Text style={styles.stateKicker}>AGUARDANDO ATIVAÇÃO</Text>
      <View style={styles.pendHead}>
        <Text style={styles.stateH1}>{pendingInfo?.plan_name || 'IPTV'}</Text>
        <View style={styles.pendBadge}><Text style={styles.pendTxt}>Pendente</Text></View>
      </View>
      <Text style={[styles.sub, { textAlign: 'left', marginTop: 8 }]}>Pagamento recebido. Estamos ligando seu acesso — você recebe uma notificação quando estiver pronto.</Text>
      <View style={styles.timeline}>
        <TLItem state="done" title="Pagamento confirmado" sub={pendingInfo?.ordered_at ? new Date(pendingInfo.ordered_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''} />
        <TLItem state="doing" title="Ativando" sub="Normalmente em até 30 min" />
        <TLItem state="todo" title="Pronto para assistir" last />
      </View>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.bigBtn} onPress={checkStatus} activeOpacity={0.9}><Text style={styles.bigBtnTxt}>Verificar agora</Text></TouchableOpacity>
      <TouchableOpacity style={styles.ghostBtn} onPress={() => router.push('/ajuda')}><Text style={styles.ghostTxt}>Falar com o suporte</Text></TouchableOpacity>
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
  stateRoot:   { flex: 1, backgroundColor: '#0A0A0A', paddingHorizontal: 16 },
  stateKicker: { color: '#888', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  stateH1:     { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 4 },
  stateMid:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  tile:        { width: 96, height: 96, borderRadius: 24, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  stateTitle:  { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  bigBtn:      { height: 56, borderRadius: 14, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center' },
  bigBtnTxt:   { color: '#fff', fontSize: 17, fontWeight: '800' },
  ghostBtn:    { height: 52, borderRadius: 14, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  ghostTxt:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  pendHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendBadge:   { backgroundColor: 'rgba(251,191,36,0.16)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  pendTxt:     { color: '#FBBF24', fontWeight: '900', fontSize: 11 },
  timeline:    { marginTop: 22, backgroundColor: '#141414', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1F1F1F' },
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
