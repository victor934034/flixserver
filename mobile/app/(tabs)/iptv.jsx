import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl, AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';
import api from '../../lib/api';
import { setQueue, loadFavs, saveFavs, streamUrl } from '../../lib/iptvStore';

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

  // Ao vivo: canais por categoria, favoritos e busca
  const [catId, setCatId] = useState(null);
  const [chans, setChans] = useState([]);
  const [chLoading, setChLoading] = useState(false);
  const [favs, setFavs] = useState([]);
  const [playing, setPlaying] = useState(null);
  const chCache = useRef({});

  useEffect(() => { loadFavs().then(setFavs); }, []);
  useEffect(() => { if (!catId && categories.length) setCatId(categories[0].category_id); }, [categories]);
  useEffect(() => {
    if (!catId || catId === '__fav') return;
    if (chCache.current[catId]) { setChans(chCache.current[catId]); return; }
    let alive = true;
    setChLoading(true);
    api.get('/iptv/streams', { params: { category_id: catId } })
      .then(r => { const l = Array.isArray(r.data) ? r.data : []; chCache.current[catId] = l; if (alive) setChans(l); })
      .catch(() => { if (alive) setChans([]); })
      .finally(() => { if (alive) setChLoading(false); });
    return () => { alive = false; };
  }, [catId]);

  const toggleFav = (ch) => {
    setFavs(prev => {
      const next = prev.some(f => f.stream_id === ch.stream_id) ? prev.filter(f => f.stream_id !== ch.stream_id) : [...prev, { stream_id: ch.stream_id, name: ch.name, stream_icon: ch.stream_icon }];
      saveFavs(next); return next;
    });
  };
  const base = catId === '__fav' ? favs : chans;
  const shown = search.trim() ? base.filter(c => c.name?.toLowerCase().includes(search.toLowerCase())) : base;
  const curCat = categories.find(c => c.category_id === catId);

  const openChannel = async (item, index) => {
    setPlaying(item.stream_id);
    try {
      const url = await streamUrl(item.stream_id, 'm3u8');
      setQueue(shown, index);
      router.push({ pathname: '/iptv-player', params: { url, urlTs: url.replace('.m3u8', '.ts'), name: item.name, logo: item.stream_icon || '', id: String(item.stream_id), cat: curCat?.category_name || '' } });
    } catch {}
    setPlaying(null);
  };

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
      <View style={styles.liveHead}>
        <Text style={styles.liveH1}>Ao vivo</Text>
        <View style={styles.activeBadge}><Text style={styles.activeTxt}>IPTV ativo</Text></View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#888" />
        <TextInput style={styles.searchInput} placeholder="Buscar canal" placeholderTextColor="#666" value={search} onChangeText={setSearch} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color="#888" /></TouchableOpacity> : null}
      </View>

      <View>
        <FlatList
          horizontal showsHorizontalScrollIndicator={false} data={[{ category_id: '__fav', category_name: 'Favoritos' }, ...categories]}
          keyExtractor={c => String(c.category_id)} contentContainerStyle={styles.chipsRow} style={{ flexGrow: 0 }}
          renderItem={({ item }) => {
            const fav = item.category_id === '__fav';
            const on = catId === item.category_id;
            return (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setCatId(item.category_id)}
                style={[styles.catChip, fav && styles.catFav, on && styles.catOn]}>
                {fav && <Ionicons name="star" size={15} color={on ? '#111' : '#FBBF24'} />}
                <Text style={[styles.catTxt, fav && !on && { color: '#FBBF24' }, on && { color: '#111' }]} numberOfLines={1}>{item.category_name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <Text style={styles.count}>
        {chLoading ? 'Carregando canais…' : `${shown.length} canai${shown.length === 1 ? 'l' : 's'}${curCat ? ` em ${curCat.category_name}` : ''}`}
      </Text>

      {chLoading ? (
        <View style={styles.grid2}>
          {[0, 1, 2, 3, 4, 5].map(i => <View key={i} style={[styles.chCard, { height: 128, opacity: 0.5 }]} />)}
        </View>
      ) : shown.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.tile}><Ionicons name={catId === '__fav' ? 'star-outline' : 'search'} size={30} color="#888" /></View>
          <Text style={styles.stateTitle}>{catId === '__fav' ? 'Nenhum favorito ainda' : 'Nenhum canal encontrado'}</Text>
          <Text style={styles.sub}>{catId === '__fav' ? 'Toque na ★ de um canal para ele aparecer aqui.' : 'Tente outro nome ou procure em todas as categorias.'}</Text>
          {search ? <TouchableOpacity style={styles.ghostBtn2} onPress={() => setSearch('')}><Text style={styles.ghostTxt}>Limpar busca</Text></TouchableOpacity> : null}
        </View>
      ) : (
        <FlatList
          data={shown} numColumns={2} keyExtractor={c => String(c.stream_id)}
          columnWrapperStyle={{ gap: 12 }} contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCategories(true)} tintColor="#E50914" colors={['#E50914']} />}
          renderItem={({ item, index }) => {
            const isFav = favs.some(f => f.stream_id === item.stream_id);
            return (
              <TouchableOpacity style={[styles.chCard, playing === item.stream_id && { borderColor: '#E50914' }]} activeOpacity={0.85} onPress={() => openChannel(item, index)}>
                <View style={styles.chTop}>
                  <View style={styles.logoBox}>
                    {item.stream_icon ? <Image source={{ uri: item.stream_icon }} style={{ width: 44, height: 30 }} resizeMode="contain" /> : <Text style={styles.logoTxt}>{(item.name || '?').slice(0, 5).toUpperCase()}</Text>}
                  </View>
                  <TouchableOpacity hitSlop={10} onPress={() => toggleFav(item)}><Ionicons name={isFav ? 'star' : 'star-outline'} size={22} color={isFav ? '#FBBF24' : '#888'} /></TouchableOpacity>
                </View>
                <Text style={styles.chName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.chLive}><View style={styles.liveDot} /><Text style={styles.chLiveTxt} numberOfLines={1}>{playing === item.stream_id ? 'Abrindo…' : 'Ao vivo'}</Text></View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  liveHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  liveH1:      { color: '#fff', fontSize: 30, fontWeight: '900' },
  activeBadge: { backgroundColor: 'rgba(34,197,94,0.16)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  activeTxt:   { color: '#22C55E', fontWeight: '900', fontSize: 13 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, height: 50, borderRadius: 14, backgroundColor: '#141414', borderWidth: 1, borderColor: '#262626', paddingHorizontal: 14 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, padding: 0 },
  chipsRow:    { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  catChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: '#333', backgroundColor: 'transparent' },
  catFav:      { borderColor: 'rgba(251,191,36,0.5)', backgroundColor: 'rgba(251,191,36,0.08)' },
  catOn:       { backgroundColor: '#E5E5E5', borderColor: '#E5E5E5' },
  catTxt:      { color: '#E5E5E5', fontWeight: '700', fontSize: 15, maxWidth: 160 },
  count:       { color: '#A3A3A3', fontSize: 14, paddingHorizontal: 16, marginBottom: 2 },
  grid2:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  chCard:      { flex: 1, minWidth: '45%', backgroundColor: '#141414', borderRadius: 16, padding: 14, gap: 10, borderWidth: 2, borderColor: '#1F1F1F' },
  chTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logoBox:     { minWidth: 56, height: 40, borderRadius: 8, backgroundColor: '#1F3A2A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  logoTxt:     { color: '#fff', fontWeight: '900', fontSize: 12 },
  chName:      { color: '#fff', fontSize: 17, fontWeight: '800', minHeight: 44 },
  chLive:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F87171' },
  chLiveTxt:   { color: '#A3A3A3', fontSize: 13, flex: 1 },
  emptyBox:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32, paddingBottom: 60 },
  ghostBtn2:   { height: 46, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
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
