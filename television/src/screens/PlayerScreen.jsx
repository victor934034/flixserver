import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Animated,
  Dimensions, BackHandler, Pressable,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useProfile } from '../contexts/ProfileContext';

const { width: W, height: H } = Dimensions.get('window');
const S = Math.min(W / 1920, H / 1080);
const r = v => Math.max(1, Math.round(v * S));

const SEEK_MS    = 10_000;
const HIDE_DELAY = 5_000;
const ACCENT     = '#c91c2c';

// Parseia VTT externo para overlay manual de legenda (expo-video não tem seleção nativa de textTracks)
function parseVtt(text) {
  const cues = [];
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const tl = lines.find(l => l.includes('-->'));
    if (!tl) continue;
    function toSec(s) {
      const p = s.trim().split(':');
      return p.length === 3
        ? Number(p[0]) * 3600 + Number(p[1]) * 60 + parseFloat(p[2])
        : Number(p[0]) * 60 + parseFloat(p[1]);
    }
    const [s, e] = tl.split('-->').map(toSec);
    const txt = lines.slice(lines.indexOf(tl) + 1).join('\n')
      .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
    if (txt && !isNaN(s) && !isNaN(e)) cues.push({ start: s, end: e, text: txt });
  }
  return cues;
}

const VER_SHORT = { dubbing: 'DUB', subtitled: 'LEG', cinema: 'CAM', '4k': '4K', color: 'COR', bw: 'P&B' };
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
  const { activeProfile } = useProfile();
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

  const currentUrl   = tracks[trackKey] || initialUrl;

  // ── Refs ────────────────────────────────────────────────────────────────────
  const hideTimer      = useRef(null);
  const switchPosRef   = useRef(startAt && startAt > 5 ? startAt * 1000 : null);
  const wasLoadedRef   = useRef(false);
  const endedRef       = useRef(false);
  const playingRef     = useRef(false);
  const panelRef       = useRef(null);
  const positionRef    = useRef(0);
  const durationRef    = useRef(0);
  const trackWRef      = useRef(W - r(88));

  // Animated values — atualizados via .setValue() sem causar re-render
  const progressAnim = useRef(new Animated.Value(0)).current;
  const bufferAnim   = useRef(new Animated.Value(0)).current;
  const ctrlOp       = useRef(new Animated.Value(1)).current;

  // ── expo-video player ──────────────────────────────────────────────────────
  const initialSource = useRef({ uri: currentUrl }).current;
  const player = useVideoPlayer(initialSource, p => {
    p.play();
    p.timeUpdateEventInterval = 1;
  });
  const { currentTime = 0 } = useEvent(player, 'timeUpdate', { currentTime: 0 });
  const { isPlaying = false } = useEvent(player, 'playingChange', { isPlaying: false });
  const { status = 'idle', error: playerError } = useEvent(player, 'statusChange', { status: 'idle' });

  // ── State ───────────────────────────────────────────────────────────────────
  const [trackKey,    setTrackKey]   = useState(initKey);
  const [subKey,      setSubKey]     = useState('off');
  const [panel,       setPanel]      = useState(null);
  const [loaded,      setLoaded]     = useState(false);
  const [error,       setError]      = useState(null);
  const [displayPos,  setDisplayPos] = useState(0);  // 1Hz — para o texto de tempo
  const [displayDur,  setDisplayDur] = useState(0);
  const [subtitleCues, setSubtitleCues] = useState([]);
  const [panelGrab,   setPanelGrab]  = useState(false);
  const [grabPlay,    setGrabPlay]   = useState(true);
  const [grabAudio,   setGrabAudio]  = useState(false);
  const [grabSub,     setGrabSub]    = useState(false);
  const [grabPrev,    setGrabPrev]   = useState(false);
  const [grabNext,    setGrabNext]   = useState(false);

  panelRef.current = panel;
  playingRef.current = isPlaying;

  const showSkip = !!skipIntroTo && displayPos > 8000 && displayPos < skipIntroTo;

  // Carrega e parseia VTT externo quando a legenda muda (overlay manual)
  useEffect(() => {
    if (subKey === 'off' || !subtitles[subKey]) { setSubtitleCues([]); return; }
    let alive = true;
    fetch(subtitles[subKey]).then(r => r.text()).then(parseVtt).then(cues => { if (alive) setSubtitleCues(cues); }).catch(() => { if (alive) setSubtitleCues([]); });
    return () => { alive = false; };
  }, [subKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progresso e duração — dirigido pelo evento timeUpdate (1x/s)
  useEffect(() => {
    const posMs = currentTime * 1000;
    const durMs = (player.duration || 0) * 1000;
    positionRef.current = posMs;
    durationRef.current = durMs;
    if (durMs > 0) progressAnim.setValue(Math.min(1, posMs / durMs));
    setDisplayPos(posMs);
    setDisplayDur(prev => (durMs > 0 && prev !== durMs ? durMs : prev));
  }, [currentTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detecção de fim de vídeo — reativa a isPlaying, sem closures obsoletas
  const isEnded = displayDur > 0 && displayPos > 0 && !isPlaying && (displayDur - displayPos) < 1200;
  useEffect(() => {
    if (isEnded && !endedRef.current) {
      endedRef.current = true;
      if (nextEp) navigation.replace('Player', nextEp);
      else navigation.goBack();
    }
  }, [isEnded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fica pronto para tocar — marca carregado e restaura posição salva (troca de faixa / retomar)
  useEffect(() => {
    if (status === 'readyToPlay' && !wasLoadedRef.current) {
      wasLoadedRef.current = true;
      setLoaded(true);
      setError(null);
      if (switchPosRef.current !== null) {
        player.currentTime = switchPosRef.current / 1000;
        switchPosRef.current = null;
      }
    }
    if (status === 'error') {
      setError(playerError?.message || 'Erro ao carregar o vídeo');
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

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
        profile_id: activeProfile?.id || null,
      }).catch(() => {});
    };
    const id = setInterval(save, 30000);
    return () => { clearInterval(id); save(); };
  }, [contentMeta, currentUrl, activeProfile]);

  // ── Seek ────────────────────────────────────────────────────────────────────
  const seekBy = useCallback((deltaMs) => {
    const target = Math.max(0, Math.min(durationRef.current, positionRef.current + deltaMs));
    try { player.currentTime = target / 1000; } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle play ──────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    try {
      if (playingRef.current) player.pause();
      else player.play();
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      endedRef.current = false;
      setLoaded(false);
      setError(null);
      setTrackKey(key);
      player.replace({ uri: tracks[key] });
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

      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        surfaceType="textureView"
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

      {/* Legenda (VTT externo parseado — expo-video não seleciona textTracks nativamente) */}
      {subtitleCues.length > 0 && (() => {
        const cue = subtitleCues.find(c => currentTime >= c.start && currentTime <= c.end);
        return cue ? (
          <View style={s.subtitleOverlay} pointerEvents="none">
            <Text style={s.subtitleText}>{cue.text}</Text>
          </View>
        ) : null;
      })()}

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
          {!!VER_SHORT[trackKey] && (
            <View style={s.verBadge} pointerEvents="none">
              <Text style={s.verBadgeTxt}>{VER_SHORT[trackKey]}</Text>
            </View>
          )}
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

  subtitleOverlay: { position: 'absolute', bottom: r(140), left: r(80), right: r(80), alignItems: 'center', zIndex: 10 },
  subtitleText: {
    color: '#fff', fontSize: r(20), fontWeight: '600', textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: r(16), paddingVertical: r(6),
    borderRadius: r(6), overflow: 'hidden', lineHeight: r(28),
  },

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
  verBadge: {
    backgroundColor: 'rgba(201,28,44,0.85)',
    borderRadius: r(6), paddingHorizontal: r(12), paddingVertical: r(6), marginRight: r(10),
  },
  verBadgeTxt: { color: '#fff', fontSize: r(12), fontWeight: '800', letterSpacing: 0.5 },
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
