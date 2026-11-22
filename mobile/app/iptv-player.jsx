import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, Animated, PanResponder,
  ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as KeepAwake from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { iptvQueue, streamUrl } from '../lib/iptvStore';
import api from '../lib/api';

// Chromecast: o módulo nativo só existe em build (não no Expo Go) — sem ele o botão some e o player segue normal.
const isExpoGo = require('expo-constants').default?.executionEnvironment === 'storeClient';
let CastButton = () => null;
let CastState = {};
let SessionManager = { endCurrentSession: async () => {} };
let useCastDevice = () => null;
let useCastState = () => null;
let useRemoteMediaClient = () => null;
if (!isExpoGo) {
  try {
    const cast = require('react-native-google-cast');
    CastButton = cast.CastButton;
    CastState = cast.CastState;
    SessionManager = cast.SessionManager;
    useCastDevice = cast.useCastDevice;
    useCastState = cast.useCastState;
    useRemoteMediaClient = cast.useRemoteMediaClient;
  } catch {}
}

const ACCENT = '#E50914';

// Player de canal ao vivo (design): barra superior com AO VIVO, troca de canal por swipe ↑↓,
// gaveta de canais e tela de erro com "Tentar outro servidor"
export default function IptvPlayerScreen() {
  const { url, urlTs, name, logo, cat } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [cur, setCur] = useState({ name: String(name || ''), logo: String(logo || ''), url: String(url || ''), urlTs: String(urlTs || ''), index: iptvQueue.index });
  const [attempt, setAttempt] = useState(0); // 0 m3u8, 1 ts
  const [failed, setFailed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [hint, setHint] = useState(null); // { name, num, dir }

  // ─── Chromecast: a TV busca o canal sozinha (só o endereço sai do celular) ───
  const castClient = useRemoteMediaClient();
  const castState = useCastState();
  const castDevice = useCastDevice();
  const isCasting = castState === CastState.CONNECTED && !!castClient;
  const [castErr, setCastErr] = useState(null);
  const wasCasting = useRef(false);
  const curRef = useRef(null);

  curRef.current = cur;

  const player = useVideoPlayer({ uri: cur.url }, p => {
    // buffer maior pra ao vivo: evita "carregando" a cada micro-travada da rede
    try { p.bufferOptions = { preferredForwardBufferDuration: 20, minBufferForPlayback: 2, waitsToMinimizeStalling: true }; } catch {}
    p.play();
  });
  const playedOnce = useRef(false);
  const { isPlaying = false } = useEvent(player, 'playingChange', { isPlaying: false });
  const { status = 'idle' } = useEvent(player, 'statusChange', { status: 'idle' });
  useEffect(() => { if (status === 'readyToPlay') playedOnce.current = true; }, [status]);
  // 1ª abertura: tela de carregando. Depois de já ter tocado, travadas viram só um aviso discreto.
  const isBuffering = (status === 'idle' || status === 'loading') && !playedOnce.current;
  const rebuffering = (status === 'loading') && playedOnce.current;
  const isError = status === 'error';

  // Manda o canal (ou troca de canal) para a TV. O endereço passa pelo servidor (HTTPS + CORS), que o Chromecast exige.
  const sendToCast = useCallback(async (client, ch) => {
    try {
      setCastErr(null);
      const sid = ch.stream_id != null ? ch.stream_id : (iptvQueue.list[ch.index] || {}).stream_id;
      if (sid == null) throw new Error('canal sem id');
      const { data } = await api.get(`/iptv/cast-url/${sid}`);
      await client.loadMedia({
        mediaInfo: {
          contentUrl: data.url,
          contentType: 'application/x-mpegURL',
          streamType: 'live',
          metadata: { type: 'generic', title: String(ch.name || ''), images: ch.logo ? [{ url: String(ch.logo) }] : [] },
        },
        autoplay: true,
      });
    } catch {
      setCastErr('Não foi possível transmitir este canal. Confira se a TV está na mesma rede e tente de novo.');
    }
  }, []);

  // Ao conectar: pausa o canal no celular (senão toca nos dois) e manda pra TV. Ao desconectar: volta a tocar aqui.
  useEffect(() => {
    if (isCasting && !wasCasting.current) {
      wasCasting.current = true;
      try { player.pause(); } catch {}
      sendToCast(castClient, curRef.current);
    } else if (!isCasting && wasCasting.current) {
      wasCasting.current = false;
      setCastErr(null);
      try { player.play(); } catch {}
    }
  }, [isCasting]);

  const ctrl = useRef(new Animated.Value(1)).current;
  const [ctrlOn, setCtrlOn] = useState(true);
  const hideT = useRef(null);
  const hintT = useRef(null);

  const fade = (show) => { setCtrlOn(show); Animated.timing(ctrl, { toValue: show ? 1 : 0, duration: 220, useNativeDriver: true }).start(); };
  const schedHide = useCallback(() => { clearTimeout(hideT.current); hideT.current = setTimeout(() => fade(false), 4000); }, []);

  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    KeepAwake.activateKeepAwakeAsync('iptv-player');
    schedHide();
    return () => {
      StatusBar.setHidden(false, 'fade');
      ScreenOrientation.unlockAsync();
      KeepAwake.deactivateKeepAwake('iptv-player');
      clearTimeout(hideT.current); clearTimeout(hintT.current);
    };
  }, []);

  // m3u8 falhou -> tenta .ts automaticamente; depois mostra o erro
  useEffect(() => {
    if (!isError) return;
    if (attempt === 0 && cur.urlTs && cur.urlTs !== cur.url) { setAttempt(1); player.replace({ uri: cur.urlTs }); player.play(); }
    else setFailed(true);
  }, [isError]);
  useEffect(() => { if (status === 'readyToPlay') setFailed(false); }, [status]);

  const load = async (item, index) => {
    setFailed(false); setAttempt(0); playedOnce.current = false;
    try {
      const u = await streamUrl(item.stream_id, 'm3u8');
      setCur({ name: item.name, logo: item.stream_icon || '', url: u, urlTs: u.replace('.m3u8', '.ts'), index });
      iptvQueue.index = index;
      if (isCasting) {
        sendToCast(castClient, { name: item.name, logo: item.stream_icon || '', stream_id: item.stream_id });
      } else {
        player.replace({ uri: u }); player.play();
      }
    } catch { setFailed(true); }
  };
  const go = (delta) => {
    const list = iptvQueue.list; if (!list.length) return;
    const i = (cur.index + delta + list.length) % list.length;
    const item = list[i];
    setHint({ name: item.name, num: 100 + i + 1, dir: delta > 0 ? '↓' : '↑', logo: item.stream_icon });
    clearTimeout(hintT.current); hintT.current = setTimeout(() => setHint(null), 1400);
    load(item, i);
  };
  const retryAnother = () => { // "outro servidor": alterna o formato do stream (m3u8 <-> ts)
    setFailed(false);
    const next = attempt === 0 ? cur.urlTs : cur.url;
    setAttempt(a => (a === 0 ? 1 : 0));
    player.replace({ uri: next || cur.url }); player.play();
  };
  const retry = () => { setFailed(false); player.replace({ uri: attempt === 0 ? cur.url : cur.urlTs }); player.play(); };

  // swipe vertical troca de canal
  const goRef = useRef(go); goRef.current = go;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 28 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
    onPanResponderRelease: (_, g) => { if (g.dy < -50) goRef.current(1); else if (g.dy > 50) goRef.current(-1); },
  })).current;

  const onTap = () => { if (drawer) { setDrawer(false); return; } const n = !ctrlOn; fade(n); if (n) schedHide(); };
  const togglePlay = () => { if (isPlaying) player.pause(); else player.play(); schedHide(); };

  const q = iptvQueue.list;
  const next = q.length ? q[(cur.index + 1) % q.length] : null;
  const W = Dimensions.get('window');

  return (
    <View style={s.root} {...pan.panHandlers}>
      <StatusBar hidden />
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} surfaceType="textureView" />

      {isBuffering && !failed && !isCasting && (
        <View style={s.overlay} pointerEvents="none"><ActivityIndicator size="large" color={ACCENT} /><Text style={s.bufText}>Carregando canal…</Text></View>
      )}

      {rebuffering && !failed && !isCasting && (
        <View style={s.rebuf} pointerEvents="none"><ActivityIndicator size="small" color="#fff" /><Text style={s.rebufTxt}>Ajustando a conexão…</Text></View>
      )}

      {failed && (
        <View style={s.errRoot}>
          <View style={[s.errTop, { paddingTop: Math.max(insets.top, 12) }]}>
            <TouchableOpacity style={s.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
            <Text style={s.errName}>{cur.name}</Text>
            <View style={s.weak}><Ionicons name="cellular" size={14} color="#FBBF24" /><Text style={s.weakTxt}>Rede fraca</Text></View>
          </View>
          <View style={s.errBody}>
            <View style={s.errIcon}><Ionicons name="tv-outline" size={30} color="#F87171" /></View>
            <Text style={s.errTitle}>Este canal não abriu</Text>
            <Text style={s.errSub}>O servidor atual não respondeu. Outro servidor costuma resolver.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity style={s.redBtn} onPress={retryAnother}><Text style={s.btnTxt}>Tentar outro servidor</Text></TouchableOpacity>
              <TouchableOpacity style={s.ghost} onPress={retry}><Text style={s.btnTxt}>Tentar de novo</Text></TouchableOpacity>
              <TouchableOpacity style={s.ghost} onPress={() => router.back()}><Text style={s.btnTxt}>Ver canais</Text></TouchableOpacity>
            </View>
            <Text style={s.errCode}>Servidor {attempt + 1} de 2 · código ERR_STREAM_TIMEOUT</Text>
          </View>
        </View>
      )}

      {!failed && <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onTap} activeOpacity={1} />}

      {/* próximo/anterior canal */}
      {hint && (
        <View style={s.hint} pointerEvents="none">
          {hint.logo ? <Image source={{ uri: hint.logo }} style={s.hintLogo} resizeMode="contain" /> : <View style={[s.hintLogo, { backgroundColor: '#1F3A2A' }]} />}
          <View><Text style={s.hintK}>Canal {hint.dir} · {hint.num}</Text><Text style={s.hintN}>{hint.name}</Text></View>
        </View>
      )}

      {isCasting && !failed && (
        <View style={s.castOverlay} pointerEvents="box-none">
          <View style={s.castIcon}><Ionicons name="tv-outline" size={34} color="#fff" /></View>
          <Text style={s.castTitle}>Transmitindo para {(castDevice && castDevice.friendlyName) || 'a TV'}</Text>
          <Text style={s.castSub} numberOfLines={1}>{cur.name}</Text>
          {castErr ? <Text style={s.castErr}>{castErr}</Text> : null}
          <TouchableOpacity style={[s.redBtn, { marginTop: 8 }]} onPress={() => SessionManager.endCurrentSession()}><Text style={s.btnTxt}>Parar transmissão</Text></TouchableOpacity>
          {q.length > 1 && <Text style={s.swipe}>Deslize ↑↓ para trocar de canal na TV</Text>}
        </View>
      )}

      {!failed && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: ctrl }]} pointerEvents={ctrlOn ? 'box-none' : 'none'}>
          <View style={[s.top, { paddingTop: Math.max(insets.top, 10) }]}>
            <TouchableOpacity style={s.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#fff" /></TouchableOpacity>
            {cur.logo ? <Image source={{ uri: cur.logo }} style={s.logo} resizeMode="contain" /> : null}
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{cur.name}</Text>
              {cat ? <Text style={s.cat} numberOfLines={1}>{cat}</Text> : null}
            </View>
            <View style={s.liveBadge}><View style={s.liveDot} /><Text style={s.liveTxt}>AO VIVO</Text></View>
            <View style={[s.listBtn, isCasting && { backgroundColor: ACCENT }]}>
              <Ionicons name="tv-outline" size={21} color="#fff" />
              {/* O botão nativo fica por cima, transparente: abre a lista de Chromecasts ao tocar */}
              <CastButton style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} tintColor="transparent" />
            </View>
            {q.length > 1 && <TouchableOpacity style={s.listBtn} onPress={() => { setDrawer(true); }}><Ionicons name="list" size={22} color="#fff" /></TouchableOpacity>}
          </View>

          <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity onPress={togglePlay} style={s.pp}><Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" /></TouchableOpacity>
            <View style={s.quality}><Ionicons name="cellular" size={14} color="#22C55E" /><Text style={s.qTxt}>Ao vivo · {attempt === 0 ? 'HLS' : 'TS'}</Text></View>
            <View style={{ flex: 1 }} />
            {q.length > 1 && <Text style={s.swipe}>Deslize ↑↓ para trocar</Text>}
          </View>
        </Animated.View>
      )}

      {/* gaveta de canais */}
      {drawer && (
        <View style={[s.drawer, { width: Math.min(340, W.width * 0.5), paddingTop: Math.max(insets.top, 12) }]}>
          <View style={s.dHead}>
            <Text style={s.dTitle} numberOfLines={1}>{cat || 'Canais'}</Text>
            <TouchableOpacity style={s.dClose} onPress={() => setDrawer(false)}><Ionicons name="close" size={20} color="#fff" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
            {q.map((c, i) => (
              <TouchableOpacity key={c.stream_id} style={[s.dRow, i === cur.index && s.dRowOn]} onPress={() => { setDrawer(false); if (i !== cur.index) load(c, i); }} activeOpacity={0.8}>
                <Text style={s.dNum}>{100 + i + 1}</Text>
                {c.stream_icon ? <Image source={{ uri: c.stream_icon }} style={s.dLogo} resizeMode="contain" /> : <View style={[s.dLogo, { backgroundColor: '#1F3A2A' }]} />}
                <Text style={s.dName} numberOfLines={1}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  rebuf: { position: 'absolute', top: 70, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(20,20,20,0.85)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  rebufTxt: { color: '#E5E5E5', fontSize: 12, fontWeight: '700' },
  bufText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 30, backgroundColor: 'rgba(0,0,0,0.5)' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 48, height: 34, borderRadius: 6 },
  name: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cat: { color: '#A3A3A3', fontSize: 13 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  listBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 30, backgroundColor: 'rgba(0,0,0,0.5)' },
  pp: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  quality: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 14, height: 36 },
  qTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  swipe: { color: '#A3A3A3', fontSize: 13 },
  hint: { position: 'absolute', alignSelf: 'center', top: '30%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(20,20,20,0.92)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  hintLogo: { width: 48, height: 34, borderRadius: 6 },
  hintK: { color: '#A3A3A3', fontSize: 12 }, hintN: { color: '#fff', fontWeight: '800', fontSize: 16 },
  drawer: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(14,14,14,0.97)', paddingHorizontal: 14, borderLeftWidth: 1, borderLeftColor: '#222' },
  dHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dTitle: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  dClose: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  dRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent' },
  dRowOn: { borderColor: ACCENT, backgroundColor: 'rgba(229,9,20,0.08)' },
  dNum: { color: '#888', width: 34, fontWeight: '700' },
  dLogo: { width: 40, height: 28, borderRadius: 6 },
  dName: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 },
  castOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 30 },
  castIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  castTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 6 },
  castSub: { color: '#A3A3A3', fontSize: 15 },
  castErr: { color: '#FBBF24', fontSize: 13, textAlign: 'center', maxWidth: 420 },
  errRoot: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  errTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  errName: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 16 },
  weak: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(251,191,36,0.16)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  weakTxt: { color: '#FBBF24', fontWeight: '800', fontSize: 12 },
  errBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  errIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(239,68,68,0.14)', alignItems: 'center', justifyContent: 'center' },
  errTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  errSub: { color: '#A3A3A3', fontSize: 14, textAlign: 'center' },
  redBtn: { height: 46, paddingHorizontal: 20, borderRadius: 12, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  ghost: { height: 46, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  errCode: { color: '#666', fontSize: 12, marginTop: 4 },
});
