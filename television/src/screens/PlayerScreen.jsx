import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Animated,
  Dimensions, BackHandler, Pressable,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

const { width: W, height: H } = Dimensions.get('window');
const S = Math.min(W / 1920, H / 1080);
const r = v => Math.max(1, Math.round(v * S));

const SEEK_MS    = 10_000;
const HIDE_DELAY = 5_000;
const ACCENT     = '#c91c2c';

function toHlsUrl(url) {
  if (!url) return url;
  return url.replace(/\.(mp4|mkv|avi|mov|m4v|webm|ts|wmv)$/i, '.m3u8');
}

const TRACK_META = {
  dubbing:   { label: 'Dublado',   sub: 'Áudio em português' },
  subtitled: { label: 'Legendado', sub: 'Áudio original' },
  cinema:    { label: 'Cinema',    sub: 'Sem legenda' },
  color:     { label: 'Colorido',  sub: 'Versão colorida' },
  bw:        { label: 'P&B',       sub: 'Preto e branco' },
};
const SUB_META = { pt: 'Português', en: 'English', es: 'Español', off: 'Desativado' };

function fmt(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const sec = Math.floor(ms / 1000);
  const m   = Math.floor(sec / 60);
  const h   = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}`;
  return `${m}:${String(sec % 60).padStart(2,'0')}`;
}

// ── PanelOpt ──────────────────────────────────────────────────────────────────
function PanelOpt({ label, sub, active, grabFocus, onGrabbed, onPress, onFocus }) {
  return (
    <Pressable
      focusable
      hasTVPreferredFocus={grabFocus}
      onFocus={() => { if (grabFocus) onGrabbed?.(); onFocus?.(); }}
      onPress={onPress}
      style={({ focused }) => [po.item, focused && po.itemFoc]}
    >
      <View style={po.radio}>
        {active && <View style={po.radioDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[po.label, active && po.labelActive]}>{label}</Text>
        {!!sub && <Text style={po.sub}>{sub}</Text>}
      </View>
    </Pressable>
  );
}

// ── CtrlBtn — botão circular dos controles ────────────────────────────────────
function CtrlBtn({ icon, label, onPress, onFocus, grabFocus, active }) {
  return (
    <Pressable
      focusable
      hasTVPreferredFocus={grabFocus}
      onFocus={() => { onFocus?.(); }}
      onPress={onPress}
      style={({ focused }) => [s.ctrlBtn, focused && s.ctrlBtnFoc, active && s.ctrlBtnActive]}
    >
      {({ focused }) => (
        <>
          <View style={[s.ctrlBtnCircle, focused && s.ctrlBtnCircleFoc, active && !focused && s.ctrlBtnCircleActive]}>
            <Ionicons name={icon} size={r(20)} color={active && !focused ? ACCENT : '#fff'} />
          </View>
          {!!label && (
            <Text style={[s.ctrlBtnLabel, focused && s.ctrlBtnLabelFoc]}>{label}</Text>
          )}
        </>
      )}
    </Pressable>
  );
}

// ── PlayBtn ────────────────────────────────────────────────────────────────────
function PlayBtn({ isPlaying, onPress, onFocus, grabFocus }) {
  return (
    <Pressable
      focusable
      hasTVPreferredFocus={grabFocus}
      onFocus={() => { onFocus?.(); }}
      onPress={onPress}
      style={s.playBtnWrap}
    >
      {({ focused }) => (
        <>
          <View style={[s.playBtnCircle, focused && s.playBtnCircleFoc]}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={r(32)} color="#0a0a0a" />
          </View>
          <Text style={[s.ctrlBtnLabel, focused && s.ctrlBtnLabelFoc]}>
            {isPlaying ? 'Pausar' : 'Reproduzir'}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ── PlayerScreen ───────────────────────────────────────────────────────────────
export default function PlayerScreen({ navigation, route }) {
  const {
    url:          initialUrl  = '',
    title                     = '',
    tracks                    = {},
    subtitles                 = {},
    skipIntroTo               = null,
    seriesContext             = null,
    contentMeta               = null,
    startAt                   = null,
  } = route.params ?? {};

  const availTracks = ['dubbing','subtitled','cinema','color','bw'].filter(k => !!tracks[k]);
  const availSubs   = [...['pt','en','es'].filter(k => !!subtitles[k]), 'off'];
  const initKey     = availTracks.find(k => tracks[k] === initialUrl) ?? availTracks[0] ?? 'dubbing';

  // ── Next / Prev episode ─────────────────────────────────────────────────────
  const nextEp = useMemo(() => {
    if (!seriesContext) return null;
    const { seriesTitle, episodes, currentEpId } = seriesContext;
    const idx = episodes.findIndex(e => e.id === currentEpId);
    if (idx < 0 || idx >= episodes.length - 1) return null;
    const next    = episodes[idx + 1];
    const nextUrl = next.file_dubbing || next.file_subtitled || next.file_cinema || next.file_color || next.file_bw;
    if (!nextUrl) return null;
    const epLabel = `T${next.season_number}E${String(next.episode_number).padStart(2,'0')}`;
    return {
      url: nextUrl,
      title: `${seriesTitle} · ${epLabel}${next.title ? ` · ${next.title}` : ''}`,
      tracks:    { dubbing: next.file_dubbing||null, subtitled: next.file_subtitled||null, cinema: next.file_cinema||null, color: next.file_color||null, bw: next.file_bw||null },
      subtitles: { pt: next.subtitle_pt||null, en: next.subtitle_en||null, es: next.subtitle_es||null },
      skipIntroTo: null,
      seriesContext: { ...seriesContext, currentEpId: next.id },
      contentMeta: { content_type: 'episode', content_id: next.id, episode_id: next.id, series_id: contentMeta?.series_id },
    };
  }, [seriesContext, contentMeta]);

  const prevEp = useMemo(() => {
    if (!seriesContext) return null;
    const { seriesTitle, episodes, currentEpId } = seriesContext;
    const idx = episodes.findIndex(e => e.id === currentEpId);
    if (idx <= 0) return null;
    const prev    = episodes[idx - 1];
    const prevUrl = prev.file_dubbing || prev.file_subtitled || prev.file_cinema || prev.file_color || prev.file_bw;
    if (!prevUrl) return null;
    const epLabel = `T${prev.season_number}E${String(prev.episode_number).padStart(2,'0')}`;
    return {
      url: prevUrl,
      title: `${seriesTitle} · ${epLabel}${prev.title ? ` · ${prev.title}` : ''}`,
      tracks:    { dubbing: prev.file_dubbing||null, subtitled: prev.file_subtitled||null, cinema: prev.file_cinema||null, color: prev.file_color||null, bw: prev.file_bw||null },
      subtitles: { pt: prev.subtitle_pt||null, en: prev.subtitle_en||null, es: prev.subtitle_es||null },
      skipIntroTo: null,
      seriesContext: { ...seriesContext, currentEpId: prev.id },
      contentMeta: { content_type: 'episode', content_id: prev.id, episode_id: prev.id, series_id: contentMeta?.series_id },
    };
  }, [seriesContext, contentMeta]);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const videoRef       = useRef(null);
  const hideTimer      = useRef(null);
  const switchPosRef   = useRef(startAt && startAt > 5 ? startAt * 1000 : null);
  const wasLoadedRef   = useRef(false);
  const playingRef     = useRef(false);
  const panelRef       = useRef(null);
  const positionRef    = useRef(0);
  const durationRef    = useRef(0);
  const lastTickRef    = useRef(0);
  const trackWRef      = useRef(W - r(88));

  // Animated values — atualizados via .setValue() sem causar re-render
  const progressAnim = useRef(new Animated.Value(0)).current;
  const bufferAnim   = useRef(new Animated.Value(0)).current;
  const ctrlOp       = useRef(new Animated.Value(1)).current;

  // ── State ───────────────────────────────────────────────────────────────────
  const [trackKey,    setTrackKey]   = useState(initKey);
  const [subKey,      setSubKey]     = useState('off');
  const [panel,       setPanel]      = useState(null);
  const [loaded,      setLoaded]     = useState(false);
  const [isPlaying,   setIsPlaying]  = useState(false);
  const [error,       setError]      = useState(null);
  const [displayPos,  setDisplayPos] = useState(0);  // 1Hz — para o texto de tempo
  const [displayDur,  setDisplayDur] = useState(0);
  const [panelGrab,   setPanelGrab]  = useState(false);
  const [grabPlay,    setGrabPlay]   = useState(true);
  const [grabAudio,   setGrabAudio]  = useState(false);
  const [grabSub,     setGrabSub]    = useState(false);
  const [grabPrev,    setGrabPrev]   = useState(false);
  const [grabNext,    setGrabNext]   = useState(false);

  panelRef.current = panel;

  const currentUrl   = tracks[trackKey] || initialUrl;
  const hlsFailedRef = useRef(false);
  const [videoSrc, setVideoSrc] = useState(() => toHlsUrl(currentUrl));
  const showSkip   = !!skipIntroTo && displayPos > 8000 && displayPos < skipIntroTo;

  const textTracks = availSubs
    .filter(k => k !== 'off' && subtitles[k])
    .map(k => ({ title: SUB_META[k], language: k, type: 'text/vtt', uri: subtitles[k] }));

  const selectedTextTrack = subKey === 'off' ? { type: 'disabled' } : { type: 'language', value: subKey };

  // ── Controls show / hide ────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    clearTimeout(hideTimer.current);
    Animated.timing(ctrlOp, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!panelRef.current) {
        Animated.timing(ctrlOp, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      }
    }, HIDE_DELAY);
  }, []);

  useEffect(() => {
    if (!isPlaying || panel) showControls();
    else { showControls(); scheduleHide(); }
    return () => clearTimeout(hideTimer.current);
  }, [isPlaying, panel]);

  const onBtnFocus = useCallback(() => {
    showControls();
    if (playingRef.current && !panelRef.current) scheduleHide();
  }, [showControls, scheduleHide]);

  // ── Hardware back ────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (panelRef.current) { closePanel(); return true; }
      navigation.goBack();
      return true;
    });
    return () => h.remove();
  }, []);

  // ── History ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contentMeta) return;
    const save = () => {
      const pos = positionRef.current;
      const dur = durationRef.current;
      if (pos < 5000) return;
      api.post('/history', {
        ...contentMeta,
        progress: Math.floor(pos / 1000),
        duration: Math.floor(dur / 1000),
      }).catch(() => {});
    };
    const id = setInterval(save, 30000);
    return () => { clearInterval(id); save(); };
  }, [contentMeta, currentUrl]);

  // ── Playback status ──────────────────────────────────────────────────────────
  const onPlaybackStatus = useCallback((st) => {
    if (!st.isLoaded) {
      if (st.error) {
        // HLS não gerado ainda — cai para URL direto automaticamente
        if (!hlsFailedRef.current && videoSrc !== currentUrl) {
          hlsFailedRef.current = true;
          wasLoadedRef.current = false;
          setLoaded(false);
          setError(null);
          setVideoSrc(currentUrl);
        } else {
          setError(st.error);
        }
      }
      if (wasLoadedRef.current) wasLoadedRef.current = false;
      return;
    }

    const pos = st.positionMillis || 0;
    const dur = st.durationMillis || 0;
    const buf = st.playableDurationMillis || 0;

    positionRef.current = pos;
    durationRef.current = dur;

    // Atualiza a barra de progresso diretamente — zero re-renders
    if (dur > 0) {
      progressAnim.setValue(pos / dur);
      bufferAnim.setValue(Math.min(buf / dur, 1));
    }

    // Restore position após troca de faixa de áudio
    if (!wasLoadedRef.current) {
      wasLoadedRef.current = true;
      if (switchPosRef.current !== null) {
        videoRef.current?.setPositionAsync(switchPosRef.current, { toleranceMillisBefore: 300, toleranceMillisAfter: 300 }).catch(() => {});
        switchPosRef.current = null;
      }
      setLoaded(true);
      setDisplayDur(dur);
    }

    // Só atualiza estado de playing quando muda
    if (st.isPlaying !== playingRef.current) {
      playingRef.current = st.isPlaying;
      setIsPlaying(st.isPlaying);
    }

    // Texto de tempo: throttled a 1 Hz
    const now = Date.now();
    if (now - lastTickRef.current >= 1000) {
      lastTickRef.current = now;
      setDisplayPos(pos);
    }

    if (st.didJustFinish) {
      if (nextEp) navigation.replace('Player', nextEp);
      else navigation.goBack();
    }
  }, [nextEp]);

  // ── Reset ao mudar URL ───────────────────────────────────────────────────────
  useEffect(() => {
    hlsFailedRef.current = false;
    setVideoSrc(toHlsUrl(currentUrl)); // tenta HLS primeiro
    wasLoadedRef.current = false;
    setLoaded(false);
    setError(null);
    setDisplayPos(0);
    progressAnim.setValue(0);
    bufferAnim.setValue(0);
  }, [currentUrl]);

  // ── Seek ────────────────────────────────────────────────────────────────────
  const seekBy = useCallback(async (deltaMs) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(durationRef.current, positionRef.current + deltaMs));
    try {
      await videoRef.current.setPositionAsync(target, { toleranceMillisBefore: 300, toleranceMillisAfter: 300 });
    } catch {}
  }, []);

  // ── Toggle play ──────────────────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (playingRef.current) await videoRef.current.pauseAsync();
      else await videoRef.current.playAsync();
    } catch {}
  }, []);

  // ── Panel helpers ────────────────────────────────────────────────────────────
  function openPanel(type, returnGrab) {
    setPanel(type);
    setPanelGrab(true);
    if (returnGrab === 'audio') setGrabAudio(false);
    if (returnGrab === 'sub')   setGrabSub(false);
  }

  function closePanel(returnFocusTo) {
    setPanel(null);
    setPanelGrab(false);
    if (returnFocusTo === 'audio') { setGrabAudio(true); }
    if (returnFocusTo === 'sub')   { setGrabSub(true); }
    if (returnFocusTo === 'play')  { setGrabPlay(true); }
  }

  function switchTrack(key) {
    if (key !== trackKey) {
      switchPosRef.current = positionRef.current;
      wasLoadedRef.current = false;
      setTrackKey(key);
    }
    closePanel('audio');
  }

  function switchSub(key) {
    setSubKey(key);
    closePanel('sub');
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>

      <Video
        ref={videoRef}
        source={{ uri: videoSrc }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        textTracks={textTracks.length > 0 ? textTracks : undefined}
        selectedTextTrack={textTracks.length > 0 ? selectedTextTrack : undefined}
        onPlaybackStatusUpdate={onPlaybackStatus}
      />

      {/* Loading */}
      {!error && !loaded && (
        <View style={s.center} pointerEvents="none">
          <View style={s.spinner} />
          <Text style={s.loadTxt}>Abrindo vídeo…</Text>
        </View>
      )}

      {/* Error */}
      {!!error && (
        <View style={s.center} pointerEvents="none">
          <Ionicons name="alert-circle" size={r(56)} color={ACCENT} />
          <Text style={s.errTitle}>Não foi possível reproduzir</Text>
          <Text style={s.errMsg}>{error}</Text>
          <Text style={s.errHint}>Pressione Voltar para sair</Text>
        </View>
      )}

      {/* Controls overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: ctrlOp }]} pointerEvents="box-none">

        <LinearGradient
          colors={['rgba(0,0,0,0.85)','rgba(0,0,0,0)','rgba(0,0,0,0)','rgba(0,0,0,0.75)','rgba(0,0,0,0.96)']}
          locations={[0, 0.22, 0.60, 0.82, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <View style={s.backChip} pointerEvents="none">
            <Ionicons name="arrow-back" size={r(14)} color="#fff" />
            <Text style={s.backTxt}>Voltar</Text>
          </View>
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <Text style={s.topTitle} numberOfLines={1}>{title}</Text>
            {seriesContext?.currentEpId && (() => {
              const ep = seriesContext.episodes.find(e => e.id === seriesContext.currentEpId);
              if (!ep) return null;
              return (
                <Text style={s.topSub}>
                  {`T${ep.season_number} · E${ep.episode_number}${ep.title ? ` · ${ep.title}` : ''}`}
                </Text>
              );
            })()}
          </View>
          {!!nextEp && (
            <View style={s.nextBadge} pointerEvents="none">
              <Text style={s.nextBadgeTxt}>Próximo ep. disponível</Text>
            </View>
          )}
        </View>

        {/* ── Audio panel ──────────────────────────────────────────────────── */}
        {panel === 'audio' && (
          <View style={s.panelWrap}>
            <Text style={s.panelTitle}>Idioma de Áudio</Text>
            {availTracks.map((k, i) => (
              <PanelOpt
                key={k}
                label={TRACK_META[k]?.label}
                sub={TRACK_META[k]?.sub}
                active={trackKey === k}
                grabFocus={panelGrab && i === 0}
                onGrabbed={() => setPanelGrab(false)}
                onPress={() => switchTrack(k)}
                onFocus={onBtnFocus}
              />
            ))}
          </View>
        )}

        {/* ── Subtitle panel ───────────────────────────────────────────────── */}
        {panel === 'sub' && (
          <View style={s.panelWrap}>
            <Text style={s.panelTitle}>Legenda</Text>
            {availSubs.map((k, i) => (
              <PanelOpt
                key={k}
                label={SUB_META[k]}
                active={subKey === k}
                grabFocus={panelGrab && i === 0}
                onGrabbed={() => setPanelGrab(false)}
                onPress={() => switchSub(k)}
                onFocus={onBtnFocus}
              />
            ))}
          </View>
        )}

        {/* ── Bottom controls ───────────────────────────────────────────────── */}
        <View style={s.bottom}>

          {/* Progress bar */}
          <View
            style={s.trackWrap}
            onLayout={e => { trackWRef.current = e.nativeEvent.layout.width; }}
            pointerEvents="none"
          >
            <View style={s.trackBg} />
            <Animated.View style={[s.trackBuf, {
              width: bufferAnim.interpolate({ inputRange: [0,1], outputRange: [0, trackWRef.current] }),
            }]} />
            <Animated.View style={[s.trackFill, {
              width: progressAnim.interpolate({ inputRange: [0,1], outputRange: [0, trackWRef.current] }),
            }]} />
            <Animated.View style={[s.trackDot, {
              left: progressAnim.interpolate({ inputRange: [0,1], outputRange: [0, trackWRef.current - r(9)] }),
            }]} />
          </View>

          {/* Buttons row */}
          <View style={s.btnRow}>

            {/* Tempo atual */}
            <Text style={s.timeTxt}>{fmt(displayPos)}</Text>

            {/* Controles esquerdos */}
            <View style={s.leftBtns}>
              {!!prevEp && (
                <CtrlBtn
                  icon="play-skip-back"
                  label="Anterior"
                  grabFocus={grabPrev}
                  onFocus={() => { setGrabPrev(false); onBtnFocus(); }}
                  onPress={() => navigation.replace('Player', prevEp)}
                />
              )}
              <CtrlBtn
                icon="play-back"
                label="Voltar 10s"
                onFocus={onBtnFocus}
                onPress={() => seekBy(-SEEK_MS)}
              />
              <PlayBtn
                isPlaying={isPlaying}
                grabFocus={grabPlay}
                onFocus={() => { setGrabPlay(false); onBtnFocus(); }}
                onPress={togglePlay}
              />
              <CtrlBtn
                icon="play-forward"
                label="Avançar 10s"
                onFocus={onBtnFocus}
                onPress={() => seekBy(SEEK_MS)}
              />
              {!!nextEp && (
                <CtrlBtn
                  icon="play-skip-forward"
                  label="Próximo"
                  grabFocus={grabNext}
                  onFocus={() => { setGrabNext(false); onBtnFocus(); }}
                  onPress={() => navigation.replace('Player', nextEp)}
                />
              )}
            </View>

            <View style={{ flex: 1 }} />

            {/* Controles direitos */}
            <View style={s.rightBtns}>
              {showSkip && (
                <CtrlBtn
                  icon="play-skip-forward-outline"
                  label="Pular Abertura"
                  onFocus={onBtnFocus}
                  onPress={() => seekBy(skipIntroTo - displayPos)}
                />
              )}
              {availTracks.length > 1 && (
                <CtrlBtn
                  icon="volume-high-outline"
                  label="Áudio"
                  active={panel === 'audio'}
                  grabFocus={grabAudio}
                  onFocus={() => { setGrabAudio(false); onBtnFocus(); }}
                  onPress={() => panel === 'audio' ? closePanel('play') : openPanel('audio')}
                />
              )}
              {availSubs.length > 1 && (
                <CtrlBtn
                  icon="chatbubble-ellipses-outline"
                  label="CC"
                  active={panel === 'sub'}
                  grabFocus={grabSub}
                  onFocus={() => { setGrabSub(false); onBtnFocus(); }}
                  onPress={() => panel === 'sub' ? closePanel('play') : openPanel('sub')}
                />
              )}
            </View>

            {/* Duração total */}
            <Text style={[s.timeTxt, s.timeRight]}>{fmt(displayDur)}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  center: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', gap: r(16),
  },
  spinner: {
    width: r(52), height: r(52), borderRadius: r(26),
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: ACCENT,
  },
  loadTxt:  { color: 'rgba(255,255,255,0.5)', fontSize: r(15), fontWeight: '600' },
  errTitle: { color: '#fff', fontSize: r(22), fontWeight: '800' },
  errMsg:   { color: '#888', fontSize: r(13), textAlign: 'center', maxWidth: W * 0.45 },
  errHint:  { color: '#444', fontSize: r(12), marginTop: r(4) },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: r(52), paddingTop: r(28), paddingBottom: r(10),
    gap: r(20),
  },
  backChip: {
    flexDirection: 'row', alignItems: 'center', gap: r(8),
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: r(24), paddingHorizontal: r(18), paddingVertical: r(9),
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  backTxt:  { color: '#fff', fontSize: r(13), fontWeight: '700' },
  topTitle: {
    color: '#fff', fontSize: r(17), fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: r(4),
  },
  topSub:   { color: 'rgba(255,255,255,0.5)', fontSize: r(12), marginTop: r(2) },
  nextBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: r(6), paddingHorizontal: r(14), paddingVertical: r(6),
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  nextBadgeTxt: { color: 'rgba(255,255,255,0.5)', fontSize: r(12), fontWeight: '500' },

  // Panel
  panelWrap: {
    position: 'absolute', bottom: r(195), left: r(52),
    minWidth: r(300), maxWidth: r(420),
    backgroundColor: 'rgba(12,12,14,0.97)',
    borderRadius: r(14), borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    paddingVertical: r(12), paddingHorizontal: r(8),
    shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: r(24), elevation: 12,
  },
  panelTitle: {
    fontSize: r(11), fontWeight: '800', color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase', letterSpacing: 1.5,
    paddingHorizontal: r(16), paddingBottom: r(10),
  },

  // Bottom
  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: r(52), paddingBottom: r(36),
  },

  // Progress track
  trackWrap: {
    height: r(6), marginBottom: r(24), position: 'relative',
  },
  trackBg: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: r(3),
  },
  trackBuf: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: r(3),
  },
  trackFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: ACCENT, borderRadius: r(3),
  },
  trackDot: {
    position: 'absolute', top: -(r(18) - r(6)) / 2,
    width: r(18), height: r(18), borderRadius: r(9),
    backgroundColor: '#fff',
    shadowColor: '#fff', shadowOpacity: 0.5, shadowRadius: r(8), elevation: 6,
  },

  // Button row
  btnRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: r(4),
  },
  timeTxt: {
    color: 'rgba(255,255,255,0.85)', fontSize: r(14), fontWeight: '700',
    minWidth: r(60), paddingBottom: r(6),
  },
  timeRight: { textAlign: 'right' },
  leftBtns:  { flexDirection: 'row', alignItems: 'center', gap: r(4) },
  rightBtns: { flexDirection: 'row', alignItems: 'center', gap: r(4) },

  // CtrlBtn circular
  ctrlBtn: {
    flexDirection: 'column', alignItems: 'center', gap: r(8),
    paddingHorizontal: r(6), paddingVertical: r(4),
    minWidth: r(72),
  },
  ctrlBtnFoc:    {},
  ctrlBtnActive: {},
  ctrlBtnCircle: {
    width: r(54), height: r(54), borderRadius: r(27),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'transparent',
  },
  ctrlBtnCircleFoc: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ scale: 1.12 }],
  },
  ctrlBtnCircleActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(201,28,44,0.2)',
  },
  ctrlBtnLabel: {
    fontSize: r(12), fontWeight: '600',
    color: 'rgba(255,255,255,0.45)', textAlign: 'center',
  },
  ctrlBtnLabelFoc: { color: '#fff' },

  // PlayBtn grande
  playBtnWrap: {
    flexDirection: 'column', alignItems: 'center', gap: r(10),
    paddingHorizontal: r(4),
  },
  playBtnCircle: {
    width: r(88), height: r(88), borderRadius: r(44),
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: r(16), elevation: 8,
  },
  playBtnCircleFoc: {
    backgroundColor: '#fff',
    shadowColor: '#fff', shadowOpacity: 0.35, shadowRadius: r(24), elevation: 12,
    transform: [{ scale: 1.06 }],
  },
});

// PanelOpt styles
const po = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center', gap: r(14),
    paddingHorizontal: r(20), paddingVertical: r(13),
    borderRadius: r(10), borderWidth: 2, borderColor: 'transparent',
  },
  itemFoc: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  radio: {
    width: r(20), height: r(20), borderRadius: r(10), flexShrink: 0,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: {
    width: r(8), height: r(8), borderRadius: r(4),
    backgroundColor: ACCENT,
  },
  label:       { fontSize: r(15), fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  labelActive: { color: '#fff', fontWeight: '700' },
  sub:         { fontSize: r(12), color: 'rgba(255,255,255,0.38)', marginTop: r(2) },
});
