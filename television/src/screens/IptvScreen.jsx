import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';

const { width: W, height: H } = Dimensions.get('window');
const S = Math.min(W / 1920, H / 1080);
const r = v => Math.max(1, Math.round(v * S));
const ACCENT = '#E50914';
const COLS = 4;
const FAV = '__fav';
const COLORS = ['#1F4D32', '#7A2E14', '#2A4A7A', '#4A2A5A', '#2F6F85', '#4F7A1F', '#3F3F46', '#7A5A1F'];
const colorOf = (n) => COLORS[[...String(n || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

let _statusCache = null;
let _catCache = null;
const _chCache = {};

function TVPressable({ children, style, onPress, onLongPress, onFocus, onBlur, hasTVPreferredFocus }) {
  return (
    <Pressable focusable hasTVPreferredFocus={hasTVPreferredFocus} onFocus={onFocus} onBlur={onBlur} onPress={onPress} onLongPress={onLongPress} delayLongPress={450} style={style}>
      {children}
    </Pressable>
  );
}

function Btn({ label, red, onPress, preferred }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable hasTVPreferredFocus={preferred} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} onPress={onPress}
      style={[s.btn, red && s.btnRed, foc && s.btnFoc]}>
      <Text style={s.btnTxt}>{label}</Text>
    </TVPressable>
  );
}

function CatRow({ item, count, active, onFocus, onPress }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable onFocus={() => { setFoc(true); onFocus?.(); }} onBlur={() => setFoc(false)} onPress={onPress} style={[s.cat, active && s.catOn, foc && s.catFoc]}>
      <Text style={[s.catTxt, active && { color: '#fff', fontWeight: '800' }]} numberOfLines={1}>{item.category_id === FAV ? '★ ' : ''}{item.category_name}</Text>
      <Text style={s.catCount}>{count}</Text>
    </TVPressable>
  );
}

function ChannelCard({ ch, fav, opening, onPress, onToggleFav }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} onPress={onPress} onLongPress={onToggleFav} style={[s.ch, foc && s.chFoc]}>
      <View style={s.chTop}>
        <View style={[s.logo, { backgroundColor: colorOf(ch.name) }]}>
          {ch.stream_icon ? <Image source={{ uri: ch.stream_icon }} style={{ width: r(76), height: r(44) }} resizeMode="contain" /> : <Text style={s.logoTxt}>{String(ch.name || '?').slice(0, 5).toUpperCase()}</Text>}
        </View>
        <Text style={[s.star, fav && { color: '#FBBF24' }]}>{fav ? '★' : '☆'}</Text>
      </View>
      <Text style={s.chName} numberOfLines={1}>{ch.name}</Text>
      <Text style={s.chLive}>{opening ? 'ABRINDO…' : 'AO VIVO'}</Text>
    </TVPressable>
  );
}

export default function IptvScreen({ navigation }) {
  const [status, setStatus] = useState(_statusCache || 'loading');
  const [cats, setCats] = useState(_catCache || []);
  const [catId, setCatId] = useState(null);
  const [chans, setChans] = useState([]);
  const [loadingCh, setLoadingCh] = useState(false);
  const [favs, setFavs] = useState([]);
  const [opening, setOpening] = useState(null);

  useEffect(() => { AsyncStorage.getItem('iptv_favs').then(v => { try { setFavs(JSON.parse(v || '[]')); } catch {} }); }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/iptv/status');
        _statusCache = data.status;
        setStatus(data.status);
        if (data.status === 'active') {
          if (!_catCache) { const res = await api.get('/iptv/categories'); _catCache = Array.isArray(res.data) ? res.data : []; }
          setCats(_catCache);
          if (_catCache.length) setCatId(x => x || _catCache[0].category_id);
        }
      } catch { if (!_catCache) setStatus('none'); }
    })();
  }, []);

  useEffect(() => {
    if (!catId || catId === FAV) return;
    if (_chCache[catId]) { setChans(_chCache[catId]); return; }
    let alive = true;
    setLoadingCh(true);
    api.get('/iptv/streams', { params: { category_id: catId } })
      .then(r => { const l = Array.isArray(r.data) ? r.data : []; _chCache[catId] = l; if (alive) setChans(l); })
      .catch(() => { if (alive) setChans([]); })
      .finally(() => { if (alive) setLoadingCh(false); });
    return () => { alive = false; };
  }, [catId]);

  const list = [{ category_id: FAV, category_name: 'Favoritos' }, ...cats];
  const cur = list.find(c => c.category_id === catId) || list[1] || list[0];
  const shown = catId === FAV ? favs : chans;

  const toggleFav = (ch) => {
    setFavs(prev => {
      const next = prev.some(f => f.stream_id === ch.stream_id) ? prev.filter(f => f.stream_id !== ch.stream_id) : [...prev, { stream_id: ch.stream_id, name: ch.name, stream_icon: ch.stream_icon }];
      AsyncStorage.setItem('iptv_favs', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const openChannel = useCallback(async (ch) => {
    if (opening) return;
    setOpening(ch.stream_id);
    try {
      const { data } = await api.get(`/iptv/stream-url/${ch.stream_id}`, { params: { fmt: 'm3u8' } });
      navigation.navigate('Player', { url: data.url, title: ch.name, tracks: { dubbing: data.url }, subtitles: {}, contentMeta: null });
    } catch {}
    setOpening(null);
  }, [opening, navigation]);

  const goBack = () => navigation.goBack();

  if (status === 'loading') return <View style={s.center}><ActivityIndicator color={ACCENT} size="large" /></View>;

  if (status === 'none') return (
    <View style={s.center}>
      <View style={s.tile}><Ionicons name="tv-outline" size={r(64)} color={ACCENT} /></View>
      <Text style={s.bigTitle}>Canais ao vivo, 24h</Text>
      <Text style={s.sub}>Esportes, notícias, filmes e infantis no mesmo app. Até 2 telas.</Text>
      <View style={s.row}>
        <Btn red preferred label="Ver planos IPTV" onPress={() => navigation.navigate('Subscription', { tab: 'iptv' })} />
        <Btn label="Voltar" onPress={goBack} />
      </View>
    </View>
  );

  if (status === 'pending') return (
    <View style={s.center}>
      <Text style={s.kicker}>AGUARDANDO ATIVAÇÃO</Text>
      <Text style={s.bigTitle}>Estamos ligando seu acesso</Text>
      <Text style={s.sub}>Pagamento recebido. Normalmente leva até 30 minutos.</Text>
      <View style={s.timeline}>
        <Text style={[s.tl, { color: '#4ADE80' }]}>✓  Pagamento confirmado</Text>
        <Text style={[s.tl, { color: '#FBBF24' }]}>◔  Ativando</Text>
        <Text style={[s.tl, { color: '#777' }]}>○  Pronto para assistir</Text>
      </View>
      <Btn preferred label="Voltar ao início" onPress={goBack} />
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.side}>
        <Text style={s.logoMark}>FLIXHOME</Text>
        <FlatList data={list} keyExtractor={c => String(c.category_id)} showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <CatRow item={item} active={item.category_id === (cur && cur.category_id)} count={item.category_id === FAV ? favs.length : (_chCache[item.category_id]?.length ?? '')}
              onFocus={() => setCatId(item.category_id)} onPress={() => setCatId(item.category_id)} />
          )} />
      </View>
      <View style={s.main}>
        <View style={s.head}>
          <Text style={s.h1}>{cur ? cur.category_name : ''}</Text>
          <Text style={s.hint}>{loadingCh ? 'Carregando…' : `${shown.length} canais · segure OK para favoritar`}</Text>
        </View>
        {!loadingCh && shown.length === 0 ? (
          <Text style={s.empty}>{catId === FAV ? 'Nenhum favorito ainda. Segure OK em um canal.' : 'Nenhum canal nesta categoria.'}</Text>
        ) : (
          <FlatList key={'g' + COLS} data={shown} numColumns={COLS} keyExtractor={c => String(c.stream_id)} columnWrapperStyle={{ gap: r(18) }}
            contentContainerStyle={{ gap: r(18), paddingBottom: r(40), paddingHorizontal: r(8), paddingTop: r(8) }} showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={{ flex: 1 / COLS }}>
                <ChannelCard ch={item} fav={favs.some(f => f.stream_id === item.stream_id)} opening={opening === item.stream_id}
                  onPress={() => openChannel(item)} onToggleFav={() => toggleFav(item)} />
              </View>
            )} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: r(120), gap: r(14) },
  tile: { width: r(130), height: r(130), borderRadius: r(32), backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center', marginBottom: r(10) },
  kicker: { color: '#FBBF24', fontSize: r(22), fontWeight: '900', letterSpacing: 4 },
  bigTitle: { color: '#fff', fontSize: r(56), fontWeight: '900', textAlign: 'center' },
  sub: { color: '#A3A3A3', fontSize: r(28), textAlign: 'center', marginBottom: r(20) },
  timeline: { backgroundColor: '#141414', borderRadius: r(20), padding: r(30), gap: r(10), marginBottom: r(24), borderWidth: 1, borderColor: '#1F1F1F' },
  tl: { fontSize: r(28), fontWeight: '800' },
  row: { flexDirection: 'row', gap: r(20) },
  btn: { paddingHorizontal: r(40), paddingVertical: r(18), borderRadius: r(14), backgroundColor: '#1F1F1F', borderWidth: 3, borderColor: '#2A2A2A' },
  btnRed: { backgroundColor: ACCENT, borderColor: ACCENT },
  btnFoc: { borderColor: '#fff', transform: [{ scale: 1.06 }] },
  btnTxt: { color: '#fff', fontSize: r(26), fontWeight: '800' },
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#0A0A0A' },
  side: { width: r(320), backgroundColor: '#0F0F0F', paddingTop: r(40), paddingHorizontal: r(24), borderRightWidth: 1, borderRightColor: '#1A1A1A' },
  logoMark: { color: ACCENT, fontSize: r(22), fontWeight: '900', letterSpacing: 8, marginBottom: r(30) },
  cat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: r(16), paddingVertical: r(14), borderRadius: r(12), marginBottom: r(6), borderWidth: 3, borderColor: 'transparent' },
  catOn: { backgroundColor: 'rgba(229,9,20,0.12)' },
  catFoc: { borderColor: '#fff', transform: [{ scale: 1.03 }] },
  catTxt: { color: '#A3A3A3', fontSize: r(26), fontWeight: '600', flex: 1 },
  catCount: { color: '#777', fontSize: r(22), marginLeft: r(8) },
  main: { flex: 1, paddingTop: r(40), paddingHorizontal: r(40) },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: r(18) },
  h1: { color: '#fff', fontSize: r(52), fontWeight: '900' },
  hint: { color: '#A3A3A3', fontSize: r(24) },
  empty: { color: '#888', fontSize: r(28), marginTop: r(40) },
  ch: { padding: r(20), borderRadius: r(18), backgroundColor: '#141414', minHeight: r(150), borderWidth: 3, borderColor: 'transparent' },
  chFoc: { backgroundColor: '#262626', borderColor: '#fff', transform: [{ scale: 1.06 }], zIndex: 5 },
  chTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: r(14) },
  logo: { minWidth: r(76), height: r(50), borderRadius: r(10), alignItems: 'center', justifyContent: 'center', paddingHorizontal: r(8), overflow: 'hidden' },
  logoTxt: { color: '#fff', fontWeight: '900', fontSize: r(20) },
  star: { color: '#666', fontSize: r(30) },
  chName: { color: '#fff', fontSize: r(28), fontWeight: '800' },
  chLive: { color: '#F87171', fontSize: r(22), fontWeight: '900', marginTop: r(6) },
});
