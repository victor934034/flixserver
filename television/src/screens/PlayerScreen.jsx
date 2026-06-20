import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Animated,
  Dimensions, BackHandler, ActivityIndicator, Pressable,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');
const S   = Math.min(W / 1920, H / 1080);
const r   = v => Math.max(1, Math.round(v * S));

const SEEK_MS    = 10_000;
const HIDE_DELAY = 5_000;

const TRACK_META = {
  dubbing:   { label: 'Dublado',   sub: 'Áudio em português' },
  subtitled: { label: 'Legendado', sub: 'Áudio original + legenda' },
  cinema:    { label: 'Cinema',    sub: 'Sem legenda' },
};

const SUB_META = {
  pt:  'Português',
  en:  'English',
  es:  'Español',
  off: 'Desativado',
};

function fmtTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const sec = Math.floor(ms / 1000);
  const m   = Math.floor(sec / 60);
  const h   = Math.floor(m / 60);
  if (h > 0)
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

// ─── Panel option ─────────────────────────────────────────────────────────────
function PanelOpt({ label, sub, active, grabFocus, onGrabbed, onPress, onFocus }) {
  return (
    <Pressable
      focusable
      hasTVPreferredFocus={grabFocus}
      onFocus={() => { if (grabFocus) onGrabbed(); onFocus?.(); }}
      onPress={onPress}
      style={({ focused }) => [po.item, active && po.itemActive, focused && po.itemFoc]}
    >
      <View style={po.checkWrap}>
        {active && <Ionicons name="checkmark" size={r(16)} color="#E50914" />}
      </View>
      <View style={po.textWrap}>
        <Text style={[po.label, active && po.labelActive]}>{label}</Text>
        {!!sub && <Text style={po.sub}>{sub}</Text>}
      </View>
    </Pressable>
  );
}

// ─── PlayerScreen ─────────────────────────────────────────────────────────────
export default function PlayerScreen({ navigation, route }) {
  const {
    url:           initialUrl,
    title          = '',
    tracks         = {},
    subtitles      = {},
    skipIntroTo    = null,   // ms — seek target for "Pular Abertura"
    seriesContext  = null,   // { seriesTitle, backdropUrl, episodes[], currentEpId }
  } = route.params ?? {};

  // ── Available options ──────────────────────────────────────────────────────
  const availTracks = ['dubbing', 'subtitled', 'cinema']
    .filter(k => !!tracks[k])
    .map(k => ({ key: k, ...TRACK_META[k] }));

  const availSubs = [
    ...['pt', 'en', 'es'].filter(k => !!subtitles[k]).map(k => ({ key: k, label: SUB_META[k] })),
    { key: 'off', label: SUB_META.off },
  ];

  // ── Next episode (computed from seriesContext so the chain is infinite) ────
  const nextEp = useMemo(() => {
    if (!seriesContext) return null;
    const { seriesTitle, backdropUrl, episodes, currentEpId } = seriesContext;
    const idx  = episodes.findIndex(e => e.id === currentEpId);
    if (idx < 0 || idx >= episodes.length - 1) return null;
    const next    = episodes[idx + 1];
    const nextUrl = next.file_dubbing || next.file_subtitled || next.file_cinema;
    if (!nextUrl) return null;
    const epLabel = `T${next.season_number}E${String(next.episode_number).padStart(2, '0')}`;
    return {
      url:          nextUrl,
      title:        `${seriesTitle} · ${epLabel}${next.title ? ` · ${next.title}` : ''}`,
      poster:       next.thumbnail_url || backdropUrl,
      tracks:       { dubbing: next.file_dubbing || null, subtitled: next.file_subtitled || null, cinema: next.file_cinema || null },
      subtitles:    { pt: next.subtitle_pt || null, en: next.subtitle_en || null, es: next.subtitle_es || null },
      skipIntroTo:  90_000,
      seriesContext: { ...seriesContext, currentEpId: next.id },
    };
  }, [seriesContext]);

  // ── Initial track key ──────────────────────────────────────────────────────
  const initKey = availTracks.find(t => tracks[t.key] === initialUrl)?.key
                ?? availTracks[0]?.key
                ?? 'dubbing';

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef      = useRef(null);
  const hideTimer     = useRef(null);
  const seekTargetRef = useRef(null);
  const switchPosRef  = useRef(null);
  const wasLoadedRef  = useRef(false);
  const panelRef      = useRef(null); // mirror of panel state for timer callback

  // ── State ──────────────────────────────────────────────────────────────────
  const [status,    setStatus]    = useState({});
  const [error,     setError]     = useState(null);
  const [trackW,    setTrackW]    = useState(W - r(80));
  const [trackKey,  setTrackKey]  = useState(initKey);
  const [subKey,    setSubKey]    = useState('off');
  const [panel,     setPanel]     = useState(null);   // null | 'audio' | 'sub'
  const [panelGrab, setPanelGrab] = useState(false);
  const [grabPlay,  setGrabPlay]  = useState(true);
  const [grabAudio, setGrabAudio] = useState(false);
  const [grabSub,   setGrabSub]   = useState(false);

  const ctrlOp = useRef(new Animated.Value(1)).current;

  panelRef.current = panel;

  // ── Derived ────────────────────────────────────────────────────────────────
  const isPlaying   = status.isPlaying             ?? false;
  const isLoaded    = status.isLoaded              ?? false;
  const position    = status.positionMillis        ?? 0;
  const duration    = status.durationMillis        ?? 0;
  const buffered    = status.playableDurationMillis ?? 0;
  const progress    = duration > 0 ? position / duration : 0;
  const bufProg     = duration > 0 ? buffered / duration : 0;
  const dotX        = trackW * progress;
  const bufDotX     = trackW * Math.min(bufProg, 1);
  const currentUrl  = tracks[trackKey] || initialUrl;

  // Subtitle text tracks for expo-av (VTT)
  const textTracks = availSubs
    .filter(s => s.key !== 'off' && subtitles[s.key])
    .map(s => ({ title: s.label, language: s.key, type: 'text/vtt', uri: subtitles[s.key] }));

  const selectedTextTrack = subKey === 'off'
    ? { type: 'disabled' }
    : { type: 'language', value: subKey };

  // ── Hardware back ──────────────────────────────────────────────────────────
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (panelRef.current) { closePanel(); return true; }
      navigation.goBack();
      return true;
    });
    return () => h.remove();
  }, []);

  // ── Controls show / hide ───────────────────────────────────────────────────
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!panelRef.current) {
        Animated.timing(ctrlOp, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      }
    }, HIDE_DELAY);
  }, [ctrlOp]);

  const showControls = useCallback(() => {
    clearTimeout(hideTimer.current);
    Animated.timing(ctrlOp, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [ctrlOp]);

  useEffect(() => {
    if (!isPlaying || panel) {
      showControls();
    } else {
      showControls();
      scheduleHide();
    }
    return () => clearTimeout(hideTimer.current);
  }, [isPlaying, panel]);

  const onBtnFocus = useCallback(() => {
    showControls();
    if (isPlaying && !panelRef.current) scheduleHide();
  }, [showControls, scheduleHide, isPlaying]);

  // ── Panel helpers ──────────────────────────────────────────────────────────
  function openPanel(type) {
    setPanel(type);
    setPanelGrab(true);
  }

  function closePanel(returnFocusTo) {
    setPanel(null);
    setPanelGrab(false);
    if (returnFocusTo === 'audio') setGrabAudio(true);
    if (returnFocusTo === 'sub')   setGrabSub(true);
  }

  // ── Audio track switch ─────────────────────────────────────────────────────
  function switchTrack(key) {
    if (key !== trackKey) {
      switchPosRef.current  = position;
      wasLoadedRef.current  = false;
      setTrackKey(key);
    }
    closePanel('audio');
  }

  // ── Subtitle switch ────────────────────────────────────────────────────────
  function switchSub(key) {
    setSubKey(key);
    closePanel('sub');
  }

  // ── Seek ───────────────────────────────────────────────────────────────────
  const seekBy = useCallback(async (deltaMs) => {
    if (!videoRef.current) return;
    const base   = seekTargetRef.current ?? position;
    const target = Math.max(0, Math.min(duration || 0, base + deltaMs));
    seekTargetRef.current = target;
    try {
      await videoRef.current.setPositionAsync(target, {
        toleranceMillisBefore: 300,
        toleranceMillisAfter:  300,
      });
    } catch {}
  }, [position, duration]);

  // ── Play / Pause ───────────────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) await videoRef.current.pauseAsync();
      else           await videoRef.current.playAsync();
    } catch {}
  }, [isPlaying]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const showPauseIcon = !isLoaded ? false : !isPlaying;

  return (
    <View style={s.root}>

      {/* Video */}
      <Video
        ref={videoRef}
        source={{ uri: currentUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        textTracks={textTracks.length > 0 ? textTracks : undefined}
        selectedTextTrack={textTracks.length > 0 ? selectedTextTrack : undefined}
        onPlaybackStatusUpdate={st => {
          if (st.isLoaded === false && st.error) { setError(st.error); return; }

          // Restore position after track switch
          if (st.isLoaded && !wasLoadedRef.current) {
            wasLoadedRef.current = true;
            if (switchPosRef.current !== null) {
              videoRef.current?.setPositionAsync(switchPosRef.current).catch(() => {});
              switchPosRef.current = null;
            }
          }
          if (!st.isLoaded) wasLoadedRef.current = false;

          setStatus(st);

          if (seekTargetRef.current !== null &&
              Math.abs((st.positionMillis ?? 0) - seekTargetRef.current) < 2000) {
            seekTargetRef.current = null;
          }
          if (st.didJustFinish) navigation.goBack();
        }}
      />

      {/* Error */}
      {!!error && (
        <View style={s.centerOverlay} pointerEvents="none">
          <Ionicons name="alert-circle" size={r(56)} color="#E50914" />
          <Text style={s.errTitle}>Não foi possível reproduzir</Text>
          <Text style={s.errMsg}>{error}</Text>
          <Text style={s.errHint}>Pressione Voltar para sair</Text>
        </View>
      )}

      {/* Loading — only while expo-av hasn't loaded the source yet */}
      {!error && !isLoaded && (
        <View style={s.centerOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={s.loadTxt}>Abrindo vídeo…</Text>
        </View>
      )}

      {/* Center play icon when paused */}
      {showPauseIcon && !panel && (
        <View style={s.centerOverlay} pointerEvents="none">
          <View style={s.pauseCircle}>
            <Ionicons name="play" size={r(48)} color="#fff" />
          </View>
        </View>
      )}

      {/* Controls overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: ctrlOp }]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.78)', 'rgba(0,0,0,0.97)']}
          locations={[0, 0.22, 0.62, 0.80, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          {/* Left: back + title */}
          <View style={s.topLeft} pointerEvents="none">
            <View style={s.backChip}>
              <Ionicons name="arrow-back" size={r(15)} color="#fff" />
              <Text style={s.backTxt}>Voltar</Text>
            </View>
            <Text style={s.topTitle} numberOfLines={1}>{title}</Text>
          </View>

          {/* Right: audio + subtitle buttons */}
          <View style={s.topRight}>
            {availTracks.length > 1 && (
              <Pressable
                focusable
                hasTVPreferredFocus={grabAudio}
                onFocus={() => { setGrabAudio(false); onBtnFocus(); }}
                onPress={() => openPanel('audio')}
                style={({ focused }) => [
                  s.topBtn,
                  focused && s.topBtnFoc,
                  panel === 'audio' && s.topBtnOpen,
                ]}
              >
                <Ionicons name="volume-high-outline" size={r(17)} color="#fff" />
                <Text style={s.topBtnTxt}>{TRACK_META[trackKey]?.label ?? 'Áudio'}</Text>
                <Ionicons name={panel === 'audio' ? 'chevron-up' : 'chevron-down'} size={r(13)} color="rgba(255,255,255,0.55)" />
              </Pressable>
            )}

            {availSubs.length > 1 && (
              <Pressable
                focusable
                hasTVPreferredFocus={grabSub}
                onFocus={() => { setGrabSub(false); onBtnFocus(); }}
                onPress={() => openPanel('sub')}
                style={({ focused }) => [
                  s.topBtn,
                  focused && s.topBtnFoc,
                  panel === 'sub' && s.topBtnOpen,
                ]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={r(17)} color="#fff" />
                <Text style={s.topBtnTxt}>{subKey === 'off' ? 'Legenda' : SUB_META[subKey]}</Text>
                <Ionicons name={panel === 'sub' ? 'chevron-up' : 'chevron-down'} size={r(13)} color="rgba(255,255,255,0.55)" />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Audio panel ──────────────────────────────────────────────────── */}
        {panel === 'audio' && (
          <View style={s.panelAnchor}>
            <View style={s.panel}>
              <Text style={s.panelTitle}>Idioma de Áudio</Text>
              {availTracks.map((t, i) => (
                <PanelOpt
                  key={t.key}
                  label={t.label}
                  sub={t.sub}
                  active={trackKey === t.key}
                  grabFocus={panelGrab && i === 0}
                  onGrabbed={() => setPanelGrab(false)}
                  onPress={() => switchTrack(t.key)}
                  onFocus={onBtnFocus}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Subtitle panel ───────────────────────────────────────────────── */}
        {panel === 'sub' && (
          <View style={s.panelAnchor}>
            <View style={s.panel}>
              <Text style={s.panelTitle}>Legenda</Text>
              {availSubs.map((sub, i) => (
                <PanelOpt
                  key={sub.key}
                  label={sub.label}
                  active={subKey === sub.key}
                  grabFocus={panelGrab && i === 0}
                  onGrabbed={() => setPanelGrab(false)}
                  onPress={() => switchSub(sub.key)}
                  onFocus={onBtnFocus}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Bottom controls ───────────────────────────────────────────────── */}
        <View style={s.bottom}>
          {/* Progress bar */}
          <View
            style={s.trackWrap}
            onLayout={e => setTrackW(e.nativeEvent.layout.width)}
            pointerEvents="none"
          >
            <View style={s.trackBg} />
            <View style={[s.trackBuf, { width: bufDotX }]} />
            <View style={[s.trackFill, { width: dotX }]} />
            <View style={[s.trackDot, { left: Math.max(0, dotX - r(8)) }]} />
          </View>

          {/* Times + buttons */}
          <View style={s.btnRow}>
            <Text style={s.timeTxt}>{fmtTime(position)}</Text>

            <Pressable
              focusable
              onPress={() => seekBy(-SEEK_MS)}
              onFocus={onBtnFocus}
              style={({ focused }) => [s.ctrlBtn, focused && s.ctrlBtnFoc]}
            >
              <Ionicons name="play-back" size={r(20)} color="#fff" />
              <Text style={s.ctrlBtnTxt}>−10s</Text>
            </Pressable>

            <Pressable
              focusable
              hasTVPreferredFocus={grabPlay}
              onFocus={() => { setGrabPlay(false); onBtnFocus(); }}
              onPress={togglePlay}
              style={({ focused }) => [s.ctrlBtn, s.ctrlBtnMain, focused && s.ctrlBtnMainFoc]}
            >
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={r(28)} color="#fff" />
            </Pressable>

            <Pressable
              focusable
              onPress={() => seekBy(SEEK_MS)}
              onFocus={onBtnFocus}
              style={({ focused }) => [s.ctrlBtn, focused && s.ctrlBtnFoc]}
            >
              <Ionicons name="play-forward" size={r(20)} color="#fff" />
              <Text style={s.ctrlBtnTxt}>+10s</Text>
            </Pressable>

            {/* Pular Abertura — visible while position is before skipIntroTo */}
            {!!skipIntroTo && position > 8_000 && position < skipIntroTo && (
              <Pressable
                focusable
                onPress={() => seekBy(skipIntroTo - position)}
                onFocus={onBtnFocus}
                style={({ focused }) => [s.ctrlBtn, s.ctrlBtnSkip, focused && s.ctrlBtnSkipFoc]}
              >
                <Ionicons name="play-skip-forward-outline" size={r(18)} color="#fff" />
                <Text style={s.ctrlBtnTxt}>Pular abertura</Text>
              </Pressable>
            )}

            {/* Próximo Episódio */}
            {!!nextEp && (
              <Pressable
                focusable
                onPress={() => navigation.replace('Player', nextEp)}
                onFocus={onBtnFocus}
                style={({ focused }) => [s.ctrlBtn, s.ctrlBtnNext, focused && s.ctrlBtnNextFoc]}
              >
                <Text style={s.ctrlBtnTxt}>Próximo ep.</Text>
                <Ionicons name="play-skip-forward" size={r(18)} color="#fff" />
              </Pressable>
            )}

            <Text style={[s.timeTxt, s.timeRight]}>{fmtTime(duration)}</Text>
          </View>

          <View style={s.hintRow} pointerEvents="none">
            <Text style={s.hintTxt}>◀ ▶  navegar  ·  OK  selecionar  ·  ← botão Voltar para sair</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Centered overlays (loading / error / pause icon)
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', gap: r(14),
  },
  loadTxt:  { color: 'rgba(255,255,255,0.6)', fontSize: r(15), fontWeight: '600' },
  errTitle: { color: '#fff', fontSize: r(20), fontWeight: '800', textAlign: 'center' },
  errMsg:   { color: '#888', fontSize: r(13), textAlign: 'center', maxWidth: W * 0.45 },
  errHint:  { color: '#444', fontSize: r(12), marginTop: r(4) },
  pauseCircle: {
    width: r(96), height: r(96), borderRadius: r(48),
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: r(44), paddingTop: r(28), paddingBottom: r(10),
    gap: r(20),
  },
  topLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: r(16) },
  backChip: {
    flexDirection: 'row', alignItems: 'center', gap: r(6),
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: r(20), paddingHorizontal: r(14), paddingVertical: r(7),
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  backTxt:  { color: '#fff', fontSize: r(13), fontWeight: '700' },
  topTitle: {
    flex: 1, color: '#fff', fontSize: r(17), fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: r(4),
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: r(10) },
  topBtn: {
    flexDirection: 'row', alignItems: 'center', gap: r(7),
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: r(20), paddingHorizontal: r(16), paddingVertical: r(8),
    borderWidth: 2, borderColor: 'transparent',
  },
  topBtnFoc: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: '#fff',
    transform: [{ scale: 1.06 }],
  },
  topBtnOpen: {
    backgroundColor: 'rgba(229,9,20,0.20)',
    borderColor: '#E50914',
  },
  topBtnTxt: { color: '#fff', fontSize: r(13), fontWeight: '700' },

  // Dropdown panel (anchored top-right)
  panelAnchor: {
    position: 'absolute', top: r(74), right: r(44),
  },
  panel: {
    backgroundColor: 'rgba(14,14,14,0.97)',
    borderRadius: r(12),
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    minWidth: r(260),
    paddingVertical: r(8),
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: r(24), elevation: 12,
  },
  panelTitle: {
    color: 'rgba(255,255,255,0.40)', fontSize: r(11),
    fontWeight: '800', letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: r(18), paddingVertical: r(8),
  },

  // Bottom area
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: r(44), paddingBottom: r(34),
  },

  // Progress track
  trackWrap: { height: r(4), marginBottom: r(18), position: 'relative' },
  trackBg: {
    position: 'absolute', left: 0, right: 0, top: 0,
    height: r(4), backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: r(2),
  },
  trackBuf: {
    position: 'absolute', left: 0, top: 0,
    height: r(4), backgroundColor: 'rgba(255,255,255,0.32)', borderRadius: r(2),
  },
  trackFill: {
    position: 'absolute', left: 0, top: 0,
    height: r(4), backgroundColor: '#E50914', borderRadius: r(2),
  },
  trackDot: {
    position: 'absolute', top: -(r(16) - r(4)) / 2,
    width: r(16), height: r(16), borderRadius: r(8),
    backgroundColor: '#E50914',
    shadowColor: '#E50914', shadowOpacity: 0.8, shadowRadius: r(8), elevation: 6,
  },

  // Button row
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: r(10) },
  timeTxt: { color: '#fff', fontSize: r(14), fontWeight: '700', minWidth: r(52) },
  timeRight: { textAlign: 'right' },

  ctrlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: r(8),
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: r(24), paddingHorizontal: r(20), paddingVertical: r(12),
    borderWidth: 2, borderColor: 'transparent',
  },
  ctrlBtnFoc: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: '#fff',
    transform: [{ scale: 1.06 }],
  },
  ctrlBtnMain: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(229,9,20,0.80)',
    borderColor: 'transparent',
  },
  ctrlBtnMainFoc: {
    backgroundColor: '#E50914',
    borderColor: '#fff',
    transform: [{ scale: 1.06 }],
    shadowColor: '#E50914', shadowOpacity: 0.65, shadowRadius: r(16), elevation: 8,
  },
  ctrlBtnTxt: { color: '#fff', fontSize: r(13), fontWeight: '700' },
  ctrlBtnSkip: {
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ctrlBtnSkipFoc: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: '#fff',
    transform: [{ scale: 1.06 }],
  },
  ctrlBtnNext: {
    borderColor: 'transparent',
    backgroundColor: 'rgba(229,9,20,0.22)',
  },
  ctrlBtnNextFoc: {
    backgroundColor: '#E50914',
    borderColor: '#fff',
    transform: [{ scale: 1.06 }],
    shadowColor: '#E50914', shadowOpacity: 0.6, shadowRadius: r(14), elevation: 7,
  },

  // Hint
  hintRow: { alignItems: 'center', marginTop: r(10) },
  hintTxt: { color: 'rgba(255,255,255,0.28)', fontSize: r(11) },
});

// Panel option styles
const po = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: r(18), paddingVertical: r(12),
    borderRadius: r(8), gap: r(12),
    borderWidth: 2, borderColor: 'transparent',
  },
  itemActive: {},
  itemFoc: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: '#fff',
  },
  checkWrap: { width: r(20), alignItems: 'center' },
  textWrap:  { flex: 1 },
  label: { color: 'rgba(255,255,255,0.70)', fontSize: r(15), fontWeight: '600' },
  labelActive: { color: '#fff' },
  sub:   { color: 'rgba(255,255,255,0.38)', fontSize: r(12), marginTop: r(2) },
});
