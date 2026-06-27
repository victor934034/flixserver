import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, PanResponder,
  ActivityIndicator, StatusBar, useWindowDimensions,
  Animated, FlatList, Image, Share, Platform, Linking,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as KeepAwake from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';
import { useProfile } from '../contexts/ProfileContext';

let Brightness = null;
try { Brightness = require('expo-brightness'); } catch {}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const TIMER_OPTS = [
  { label: '15 minutos', ms: 15 * 60000 },
  { label: '30 minutos', ms: 30 * 60000 },
  { label: '45 minutos', ms: 45 * 60000 },
  { label: '1 hora', ms: 60 * 60000 },
];
const VER_LABELS = { dubbing: 'Dublado', subtitled: 'Legendado', cinema: 'Cinema / Original', '4k': '4K UHD' };
const SUB_LABELS = { pt: 'Português 🇧🇷', en: 'English 🇺🇸', es: 'Español 🇪🇸' };
const AUDIO_LANG = {
  por: 'Português 🇧🇷', pt: 'Português 🇧🇷',
  eng: 'English 🇺🇸',  en: 'English 🇺🇸',
  spa: 'Español 🇪🇸',  es: 'Español 🇪🇸',
  jpn: 'Japonês 🇯🇵',  ja: 'Japonês 🇯🇵',
  fre: 'Français 🇫🇷',  fr: 'Français 🇫🇷', fra: 'Français 🇫🇷',
};
// Preferência de faixa de áudio por versão (dual audio: mesmo arquivo, faixa diferente)
const VER_AUDIO_PREF = {
  dubbing:   ['por', 'pt'],
  subtitled: ['eng', 'en'],
  cinema:    ['eng', 'en'],
  '4k':      ['eng', 'en'],
};
function findTrackForVer(tracks, ver) {
  const prefs = VER_AUDIO_PREF[ver] || [];
  for (const pref of prefs) {
    const t = tracks.find(tr => (tr.language || '').toLowerCase().startsWith(pref));
    if (t) return t;
  }
  return tracks[0] || null;
}
function audioLabel(track, idx) {
  const lang = (track.language || '').toLowerCase();
  return AUDIO_LANG[lang] || track.label || `Faixa ${idx + 1}`;
}

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
const SLIDER_H = 140;

function pad(n) { return String(n).padStart(2, '0'); }
function fmtSec(sec) {
  if (!sec || sec < 0) return '0:00';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function fmtMs(ms) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${m}:${pad(s)}`;
}

export default function PlayerScreen() {
  const params = useLocalSearchParams();
  const { title, id, type, seriesId } = params;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Parse params (stable — route params don't change)
  const versions = useRef(params.versions ? JSON.parse(params.versions) : { dubbing: params.url }).current;
  const availVer = useRef(Object.keys(versions).filter(k => versions[k])).current;
  const initVer = useRef((params.currentVersion && versions[params.currentVersion]) ? params.currentVersion : availVer[0]).current;
  const subtitles = useRef(params.subtitles ? JSON.parse(params.subtitles) : {}).current;
  const availSubs = useRef(Object.entries(subtitles).filter(([, u]) => u)).current;
  const nextEp = useRef(params.nextEpisode ? JSON.parse(params.nextEpisode) : null).current;
  const introEnd = params.introEnd ? Number(params.introEnd) : 0;

  const initialSource = useRef({ uri: versions[initVer] }).current;

  // ─── expo-video player ────────────────────────────────────────────────────
  const player = useVideoPlayer(initialSource, p => {
    p.play();
    p.preservesPitch = true;
    p.timeUpdateEventInterval = 0.5;
    p.showNowPlayingNotification = true; // background playback + controles na tela de bloqueio
  });

  const { currentTime = 0 } = useEvent(player, 'timeUpdate', { currentTime: 0 });
  const { isPlaying = false } = useEvent(player, 'playingChange', { isPlaying: false });
  const { status = 'idle' } = useEvent(player, 'statusChange', { status: 'idle' });

  // Derived values (seconds)
  const durSec = player.duration || 0;
  const remainSec = Math.max(0, durSec - currentTime);
  const progress = durSec > 0 ? currentTime / durSec : 0;
  const isBuffering = status === 'loading';
  const isEnded = !isPlaying && durSec > 0 && currentTime > 0 && remainSec < 1.5;
  const showSkipIntro = introEnd > 0 && currentTime < introEnd && currentTime > 2;
  const showNextEpCard = nextEp && ((remainSec > 0 && remainSec < 30) || isEnded);
  const showNextMovieCard = !nextEp && type !== 'episode' && nextMovie && ((remainSec > 0 && remainSec < 60) || isEnded);
  const showNextCard = showNextEpCard;

  // ─── State ────────────────────────────────────────────────────────────────
  const [activeVer, setActiveVer] = useState(initVer);
  const [savedPosSec, setSavedPosSec] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudio, setActiveAudio] = useState(null);
  const [subtitleCues, setSubtitleCues] = useState([]);
  const [speed, setSpeed] = useState(1);
  const [ctrlVisible, setCtrlVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [brightness, setBrightness] = useState(0.8);
  const [sheet, setSheet] = useState(null);
  const [castSent, setCastSent] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(null);
  const [nextCountdown, setNextCountdown] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [nextMovie, setNextMovie] = useState(null);
  const { activeProfile } = useProfile();
  const [streamBlocked, setStreamBlocked] = useState(false);
  const [streamBlockInfo, setStreamBlockInfo] = useState(null);
  const [dragProgress, setDragProgress] = useState(null);
  // Computed after dragProgress to avoid TDZ / forward-reference
  const displayProgress = dragProgress !== null ? dragProgress : progress;
  const displayTime     = dragProgress !== null ? dragProgress * durSec : currentTime;
  const sessionId = useRef(`${Date.now()}_${Math.random().toString(36).substr(2, 9)}`).current;
  const heartbeatRef = useRef(null);
  const brightnessRef = useRef(0.8);
  const ctrlOpacity = useRef(new Animated.Value(1)).current;
  const hideTimerRef = useRef(null);
  const schedHideRef = useRef(null);
  const sleepRef = useRef(null);
  const nextCountRef = useRef(null);
  const timerEndRef = useRef(null);
  const progressBarW = useRef(0);

  // ─── Setup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    KeepAwake.activateKeepAwakeAsync('player');
    schedHide();
    Brightness?.getBrightnessAsync?.()?.then(b => { brightnessRef.current = b; setBrightness(b); }).catch(() => {});
    return () => {
      StatusBar.setHidden(false, 'fade');
      ScreenOrientation.unlockAsync();
      KeepAwake.deactivateKeepAwake('player');
      clearTimeout(hideTimerRef.current);
      clearInterval(sleepRef.current);
      clearTimeout(nextCountRef.current);
    };
  }, []);

  // ─── Stream concorrente ───────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    api.post('/streams/start', { session_id: sessionId, content_title: title })
      .then(() => {
        if (!alive) { api.delete(`/streams/${sessionId}`).catch(() => {}); return; }
        // heartbeat a cada 30s
        heartbeatRef.current = setInterval(() => {
          api.post(`/streams/heartbeat/${sessionId}`).catch(() => {});
        }, 30000);
      })
      .catch(e => {
        if (!alive) return;
        if (e.response?.status === 429) {
          player.pause();
          setStreamBlocked(true);
          setStreamBlockInfo(e.response.data);
        }
      });
    return () => {
      alive = false;
      clearInterval(heartbeatRef.current);
      api.delete(`/streams/${sessionId}`).catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore saved position after source replace
  useEffect(() => {
    if (status === 'readyToPlay' && savedPosSec !== null) {
      player.currentTime = savedPosSec;
      setSavedPosSec(null);
    }
  }, [status, savedPosSec]);

  // Apply speed
  useEffect(() => { player.playbackRate = speed; }, [speed]);

  // Detecta faixas de áudio quando o vídeo fica pronto (ou troca de fonte)
  // Se dual audio, pré-seleciona a faixa certa para a versão ativa
  useEffect(() => {
    if (status !== 'readyToPlay') return;
    const tracks = player.availableAudioTracks || [];
    setAudioTracks(tracks);
    if (tracks.length > 0) {
      setActiveAudio(findTrackForVer(tracks, activeVer));
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aplica a faixa de áudio selecionada — API correta: player.audioTrack
  useEffect(() => {
    if (!activeAudio) return;
    try { player.audioTrack = activeAudio; } catch {}
  }, [activeAudio]);

  // Carrega e parseia VTT externo quando legenda muda (overlay custom)
  useEffect(() => {
    if (!activeSub) { setSubtitleCues([]); return; }
    const url = subtitles[activeSub];
    if (!url) { setSubtitleCues([]); return; }
    fetch(url).then(r => r.text()).then(parseVtt).then(setSubtitleCues).catch(() => setSubtitleCues([]));
  }, [activeSub]);

  // Load episodes for sheet
  useEffect(() => {
    if (!seriesId) return;
    api.get(`/series/${seriesId}/episodes`).then(r => {
      setEpisodes(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {});
  }, [seriesId]);

  // Para filmes: busca uma recomendação ao entrar nos últimos 60s
  useEffect(() => {
    if (type === 'episode' || nextEp || !showNextMovieCard || nextMovie) return;
    api.get('/movies?page=1&limit=10&is_active=true').then(r => {
      const list = (r.data?.data || []).filter(m => String(m.id) !== String(id));
      if (list.length) setNextMovie(list[Math.floor(Math.random() * Math.min(list.length, 5))]);
    }).catch(() => {});
  }, [showNextMovieCard]);

  // Next ep countdown
  useEffect(() => {
    if (showNextCard && nextEp && nextCountdown === null) setNextCountdown(5);
    if (!showNextCard) { setNextCountdown(null); clearTimeout(nextCountRef.current); }
  }, [showNextCard]);

  useEffect(() => {
    if (nextCountdown === null) return;
    if (nextCountdown <= 0) { goNextEp(); return; }
    nextCountRef.current = setTimeout(() => setNextCountdown(c => c !== null ? c - 1 : null), 1000);
    return () => clearTimeout(nextCountRef.current);
  }, [nextCountdown]);

  // ─── Brightness pan ───────────────────────────────────────────────────────
  let bStartVal = 0.8;
  const brightnessPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { bStartVal = brightnessRef.current; },
    onPanResponderMove: (_, g) => {
      const b = Math.max(0.05, Math.min(1, bStartVal - g.dy / SLIDER_H));
      brightnessRef.current = b;
      setBrightness(b);
      Brightness?.setBrightnessAsync?.(b)?.catch?.(() => {});
    },
  })).current;

  // ─── Progress pan ─────────────────────────────────────────────────────────
  let pStartX = 0;
  const progressPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      pStartX = e.nativeEvent.locationX;
      if (progressBarW.current > 0) {
        setDragProgress(Math.max(0, Math.min(1, pStartX / progressBarW.current)));
      }
    },
    onPanResponderMove: (_, g) => {
      if (progressBarW.current > 0) {
        setDragProgress(Math.max(0, Math.min(1, (pStartX + g.dx) / progressBarW.current)));
      }
    },
    onPanResponderRelease: (_, g) => {
      if (progressBarW.current > 0) {
        const ratio = Math.max(0, Math.min(1, (pStartX + g.dx) / progressBarW.current));
        const dur = player.duration;
        if (dur > 0) player.currentTime = ratio * dur;
      }
      setDragProgress(null);
      schedHideRef.current?.();
    },
    onPanResponderTerminate: () => { setDragProgress(null); },
  })).current;

  // ─── Control helpers ──────────────────────────────────────────────────────
  const schedHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => { if (!sheet) fadeCtrl(false); }, 4000);
  }, [sheet]);
  schedHideRef.current = schedHide;

  const fadeCtrl = (show) => {
    setCtrlVisible(show);
    Animated.timing(ctrlOpacity, { toValue: show ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  };

  const onTap = () => {
    if (locked) return;
    if (sheet) { setSheet(null); return; }
    const next = !ctrlVisible;
    fadeCtrl(next);
    if (next) schedHide();
  };

  const togglePlay = () => {
    isPlaying ? player.pause() : player.play();
    schedHide();
  };

  const seekBy = (sec) => { player.seekBy(sec); schedHide(); };

  const seekToRatio = (ratio) => {
    if (durSec > 0) player.currentTime = Math.max(0, Math.min(1, ratio)) * durSec;
  };

  const openSheet = (name) => {
    setSheet(name);
    clearTimeout(hideTimerRef.current);
    if (!ctrlVisible) fadeCtrl(true);
  };

  const saveProgress = useCallback(async () => {
    if (!id || currentTime < 5) return;
    try {
      await api.post('/history', {
        content_type: type === 'episode' ? 'episode' : 'movie',
        content_id: id,
        progress: Math.floor(currentTime),
        duration: Math.floor(durSec),
        profile_id: activeProfile?.id || null,
      });
    } catch {}
  }, [id, type, currentTime, durSec, activeProfile]);

  useEffect(() => {
    const t = setInterval(saveProgress, 15000);
    return () => clearInterval(t);
  }, [saveProgress]);

  const switchVer = (v) => {
    if (v !== activeVer) {
      const isDualAudio = versions[v] === versions[activeVer] && audioTracks.length > 1;
      if (isDualAudio) {
        // Mesmo arquivo — só troca a faixa de áudio, sem recarregar o vídeo
        const track = findTrackForVer(audioTracks, v);
        if (track) setActiveAudio(track);
      } else {
        setSavedPosSec(currentTime);
        player.replace({ uri: versions[v] });
      }
      setActiveVer(v);
    }
    setSheet(null);
  };

  const startTimer = (ms) => {
    clearInterval(sleepRef.current);
    timerEndRef.current = Date.now() + ms;
    setTimerRemaining(ms);
    sleepRef.current = setInterval(() => {
      const rem = timerEndRef.current - Date.now();
      if (rem <= 0) {
        setTimerRemaining(null);
        timerEndRef.current = null;
        player.pause();
        clearInterval(sleepRef.current);
      } else { setTimerRemaining(rem); }
    }, 1000);
    setSheet(null);
  };

  const cancelTimer = () => {
    clearInterval(sleepRef.current);
    timerEndRef.current = null;
    setTimerRemaining(null);
  };

  const goNextEp = () => {
    if (!nextEp) return;
    clearTimeout(nextCountRef.current);
    setNextCountdown(null);
    saveProgress();
    const url = nextEp.file_dubbing || nextEp.file_subtitled || nextEp.file_cinema;
    if (!url) return;
    router.replace({
      pathname: '/player',
      params: {
        url, title: nextEp.title || `Episódio ${nextEp.episode_number}`,
        id: nextEp.id, type: 'episode', seriesId: seriesId || undefined,
        currentVersion: activeVer,
        versions: JSON.stringify({ dubbing: nextEp.file_dubbing || null, subtitled: nextEp.file_subtitled || null, cinema: nextEp.file_cinema || null }),
        subtitles: JSON.stringify({ pt: nextEp.subtitle_pt || null, en: nextEp.subtitle_en || null, es: nextEp.subtitle_es || null }),
        nextEpisode: nextEp.next ? JSON.stringify(nextEp.next) : undefined,
        introEnd: nextEp.intro_end ? String(nextEp.intro_end) : undefined,
      },
    });
  };

  const sendCastToTV = useCallback(async () => {
    const videoUrl = versions[activeVer];
    if (!videoUrl || castSent) return;
    try {
      await api.post('/cast', {
        url: videoUrl,
        title,
        position: Math.floor(currentTime),
        subtitleUrl: activeSub ? subtitles[activeSub] : null,
        version: activeVer,
      });
      setCastSent(true);
      setTimeout(() => setCastSent(false), 4000);
    } catch {}
  }, [versions, activeVer, title, currentTime, activeSub, subtitles, castSent]);

  const sortedEps = [...episodes].sort((a, b) =>
    a.season_number !== b.season_number ? a.season_number - b.season_number : a.episode_number - b.episode_number
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  // Overlay de limite de streams simultâneos
  if (streamBlocked) {
    const max = streamBlockInfo?.max_streams ?? 1;
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="people" size={60} color="#E50914" style={{ marginBottom: 20 }} />
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
          Limite de telas simultâneas atingido
        </Text>
        <Text style={{ color: '#aaa', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
          Seu plano permite até {max} {max === 1 ? 'tela' : 'telas'} simultânea{max !== 1 ? 's' : ''}.{'\n'}
          Já há {streamBlockInfo?.active ?? max} {streamBlockInfo?.active === 1 ? 'dispositivo reproduzindo' : 'dispositivos reproduzindo'} nesta conta.
        </Text>
        <Text style={{ color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 32 }}>
          Encerre a reprodução em outro dispositivo ou faça upgrade do seu plano para assistir em mais telas.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#E50914', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10, marginBottom: 14 }}
          onPress={() => router.replace('/subscription')}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Ver planos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ paddingHorizontal: 32, paddingVertical: 14 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#888', fontSize: 15 }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000', width, height }}>

      {/* ── Video ── */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        fullscreenOptions={{ isFullscreenSupported: false }}
        allowsExternalPlayback={true}
        requiresLinearPlayback={false}
      />

      {/* Buffering */}
      {isBuffering && (
        <View style={styles.buffering}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Legenda overlay (VTT externo parseado — sempre visível) */}
      {subtitleCues.length > 0 && (() => {
        const cue = subtitleCues.find(c => currentTime >= c.start && currentTime <= c.end);
        return cue ? (
          <View style={styles.subtitleOverlay} pointerEvents="none">
            <Text style={styles.subtitleText}>{cue.text}</Text>
          </View>
        ) : null;
      })()}

      {/* Tap area */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onTap} activeOpacity={1} />

      {/* ── CONTROLES ── */}
      {!locked && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: ctrlOpacity }]}
          pointerEvents={ctrlVisible ? 'box-none' : 'none'}
        >
          {/* TOP BAR */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 10) }]}>
            <TouchableOpacity style={styles.iconPad} onPress={() => { saveProgress(); router.back(); }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
            <TouchableOpacity style={styles.timerBtn} onPress={() => openSheet('timer')}>
              <Ionicons name="timer-outline" size={18} color="#fff" />
              <Text style={styles.timerBtnText}>
                {timerRemaining ? fmtMs(timerRemaining) : 'Temporizador'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* MIDDLE: brightness | center | spacer */}
          <View style={styles.middleRow}>
            {/* BRIGHTNESS SLIDER */}
            <View style={styles.brightnessCol} {...brightnessPan.panHandlers}>
              <Ionicons name="sunny" size={15} color="rgba(255,255,255,0.75)" />
              <View style={styles.sliderWrap}>
                <View style={styles.sliderBg} />
                <View style={[styles.sliderFill, { height: `${brightness * 100}%` }]} />
                <View style={[styles.sliderHandle, { bottom: `${Math.min(Math.max(brightness * 100, 0), 94)}%` }]} />
              </View>
            </View>

            {/* CENTER: <<10 | play | 10>> */}
            <View style={styles.centerRow}>
              <TouchableOpacity style={styles.seekBtn} onPress={() => seekBy(-10)} activeOpacity={0.7}>
                <View style={styles.seekWrap}>
                  <Ionicons name="refresh" size={50} color="rgba(255,255,255,0.9)" style={{ transform: [{ scaleX: -1 }] }} />
                  <Text style={styles.seekNum}>10</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.playPauseBtn} onPress={togglePlay} activeOpacity={0.8}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'} size={56} color="#fff"
                  style={!isPlaying ? { marginLeft: 5 } : undefined}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.seekBtn} onPress={() => seekBy(10)} activeOpacity={0.7}>
                <View style={styles.seekWrap}>
                  <Ionicons name="refresh" size={50} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.seekNum}>10</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={{ width: 44 }} />
          </View>

          {/* SKIP INTRO */}
          {showSkipIntro && (
            <TouchableOpacity
              style={styles.skipIntroBtn}
              onPress={() => player.currentTime = introEnd}
              activeOpacity={0.85}
            >
              <Text style={styles.skipIntroText}>Pular Abertura</Text>
              <Ionicons name="play-skip-forward-outline" size={13} color="#fff" />
            </TouchableOpacity>
          )}

          {/* BOTTOM */}
          <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            {/* Progress bar */}
            <View
              style={styles.progressOuter}
              onLayout={e => { progressBarW.current = e.nativeEvent.layout.width; }}
              {...progressPan.panHandlers}
            >
              <View style={styles.progressTrack} />
              <View style={[styles.progressFill, { width: `${displayProgress * 100}%` }]} />
              <View style={[styles.progressDot, { left: `${Math.min(displayProgress * 100, 99)}%` }]} />
            </View>

            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{fmtSec(displayTime)}</Text>
              <Text style={styles.timeText}>{fmtSec(durSec)}</Text>
            </View>

            {/* Action bar */}
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openSheet('speed')}>
                <Ionicons name="speedometer-outline" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>{speed}x</Text>
              </TouchableOpacity>
              <View style={styles.actionDiv} />
              <TouchableOpacity style={styles.actionBtn} onPress={() => setLocked(true)}>
                <Ionicons name="lock-open-outline" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Bloquear</Text>
              </TouchableOpacity>

              {/* Áudio: versão (Dublado/Legendado) + faixas embutidas se houver */}
              {(availVer.length > 1 || audioTracks.length > 1) && <>
                <View style={styles.actionDiv} />
                <TouchableOpacity style={styles.actionBtn} onPress={() => openSheet('audio')}>
                  <Ionicons name="musical-notes-outline" size={15} color="#fff" />
                  <Text style={styles.actionBtnText}>
                    {audioTracks.length > 1 && activeAudio
                      ? audioLabel(activeAudio, audioTracks.indexOf(activeAudio))
                      : (VER_LABELS[activeVer] || 'Áudio')}
                  </Text>
                </TouchableOpacity>
              </>}

              {/* Legenda: só aparece se houver legendas disponíveis */}
              {availSubs.length > 0 && <>
                <View style={styles.actionDiv} />
                <TouchableOpacity style={styles.actionBtn} onPress={() => openSheet('subtitles')}>
                  <Ionicons name="reader-outline" size={15} color={activeSub ? '#E50914' : '#fff'} />
                  <Text style={[styles.actionBtnText, activeSub && { color: '#E50914' }]}>
                    {activeSub ? SUB_LABELS[activeSub]?.split(' ')[0] : 'Legenda'}
                  </Text>
                </TouchableOpacity>
              </>}

              {seriesId && <>
                <View style={styles.actionDiv} />
                <TouchableOpacity style={styles.actionBtn} onPress={() => openSheet('episodes')}>
                  <Ionicons name="list-outline" size={15} color="#fff" />
                  <Text style={styles.actionBtnText}>Episódios</Text>
                </TouchableOpacity>
              </>}
              <View style={styles.actionDiv} />
              <TouchableOpacity style={styles.actionBtn} onPress={() => openSheet('cast')}>
                <Ionicons name="tv-outline" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Transmitir</Text>
              </TouchableOpacity>
              {nextEp && <>
                <View style={styles.actionDiv} />
                <TouchableOpacity style={styles.actionBtn} onPress={goNextEp}>
                  <Ionicons name="play-skip-forward-outline" size={15} color="#fff" />
                  <Text style={styles.actionBtnText}>Próx. ep.</Text>
                </TouchableOpacity>
              </>}
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── TELA BLOQUEADA ── */}
      {locked && (
        <TouchableOpacity style={styles.lockScreen} onPress={() => setLocked(false)} activeOpacity={1}>
          <View style={styles.unlockPill}>
            <Ionicons name="lock-closed" size={13} color="#fff" />
            <Text style={styles.unlockText}>Toque para desbloquear</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── PRÓXIMO EPISÓDIO ── */}
      {showNextCard && !locked && !sheet && (
        <View style={[styles.nextCard, { bottom: Math.max(insets.bottom, 14) + 78 }]}>
          {nextEp.thumbnail_url && <Image source={{ uri: nextEp.thumbnail_url }} style={styles.nextThumb} />}
          <View style={styles.nextInfo}>
            <Text style={styles.nextLabel}>PRÓXIMO EPISÓDIO</Text>
            <Text style={styles.nextTitle} numberOfLines={1}>{nextEp.title || `Episódio ${nextEp.episode_number}`}</Text>
            {nextCountdown !== null && <Text style={styles.nextCountdown}>Começa em {nextCountdown}s</Text>}
          </View>
          <View style={styles.nextBtns}>
            <TouchableOpacity style={styles.nextPlayBtn} onPress={goNextEp}>
              <Ionicons name="play" size={15} color="#000" />
            </TouchableOpacity>
            {nextCountdown !== null && (
              <TouchableOpacity style={styles.nextCancelBtn} onPress={() => { setNextCountdown(null); clearTimeout(nextCountRef.current); }}>
                <Ionicons name="close" size={13} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── PRÓXIMO FILME ── */}
      {showNextMovieCard && !locked && !sheet && nextMovie && (
        <View style={[styles.nextCard, { bottom: Math.max(insets.bottom, 14) + 78 }]}>
          {nextMovie.poster_url && <Image source={{ uri: nextMovie.poster_url }} style={styles.nextThumb} />}
          <View style={styles.nextInfo}>
            <Text style={styles.nextLabel}>EM SEGUIDA</Text>
            <Text style={styles.nextTitle} numberOfLines={1}>{nextMovie.title}</Text>
            {nextMovie.year && <Text style={styles.nextCountdown}>{nextMovie.year}</Text>}
          </View>
          <TouchableOpacity style={styles.nextPlayBtn} onPress={() => {
            saveProgress();
            const versions = {};
            if (nextMovie.file_dubbing) versions.dubbing = nextMovie.file_dubbing;
            if (nextMovie.file_subtitled) versions.subtitled = nextMovie.file_subtitled;
            if (nextMovie.file_cinema) versions.cinema = nextMovie.file_cinema;
            if (nextMovie.file_4k) versions['4k'] = nextMovie.file_4k;
            const firstUrl = nextMovie.file_dubbing || nextMovie.file_subtitled || nextMovie.file_cinema;
            if (!firstUrl) return;
            router.replace({
              pathname: '/player',
              params: {
                url: firstUrl, title: nextMovie.title, id: nextMovie.id, type: 'movie',
                versions: JSON.stringify(versions),
                subtitles: JSON.stringify({ pt: nextMovie.subtitle_pt || null, en: nextMovie.subtitle_en || null }),
              },
            });
          }}>
            <Ionicons name="play" size={15} color="#000" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── SHEETS ── */}
      {sheet && (
        <TouchableOpacity style={styles.sheetBg} onPress={() => setSheet(null)} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>

            {sheet === 'speed' && <>
              <Text style={styles.sheetTitle}>Velocidade de reprodução</Text>
              {SPEEDS.map(s => (
                <TouchableOpacity key={s} style={styles.sheetRow} onPress={() => { setSpeed(s); setSheet(null); schedHide(); }}>
                  <Text style={[styles.sheetRowText, s === speed && styles.sheetRowActive]}>{s === 1 ? 'Normal (1x)' : `${s}x`}</Text>
                  {s === speed && <Ionicons name="checkmark" size={20} color="#E50914" />}
                </TouchableOpacity>
              ))}
            </>}

            {/* Sheet Legenda: só legendas externas (.vtt) */}
            {sheet === 'subtitles' && <>
              <Text style={styles.sheetTitle}>Legenda</Text>
              <TouchableOpacity style={styles.sheetRow} onPress={() => { setActiveSub(null); setSheet(null); schedHide(); }}>
                <Text style={[styles.sheetRowText, !activeSub && styles.sheetRowActive]}>Desativado</Text>
                {!activeSub && <Ionicons name="checkmark" size={20} color="#E50914" />}
              </TouchableOpacity>
              {availSubs.map(([lang]) => (
                <TouchableOpacity key={lang} style={styles.sheetRow} onPress={() => { setActiveSub(lang); setSheet(null); schedHide(); }}>
                  <Text style={[styles.sheetRowText, activeSub === lang && styles.sheetRowActive]}>{SUB_LABELS[lang] || lang}</Text>
                  {activeSub === lang && <Ionicons name="checkmark" size={20} color="#E50914" />}
                </TouchableOpacity>
              ))}
            </>}

            {/* Sheet Áudio: versões (Dublado/Legendado/Cinema) + faixas embutidas no arquivo */}
            {sheet === 'audio' && <>
              <Text style={styles.sheetTitle}>Áudio</Text>
              {availVer.length > 1 && <>
                <Text style={styles.sheetSection}>VERSÃO</Text>
                {availVer.map(v => (
                  <TouchableOpacity key={v} style={styles.sheetRow} onPress={() => { switchVer(v); setSheet(null); schedHide(); }}>
                    <Text style={[styles.sheetRowText, v === activeVer && styles.sheetRowActive]}>{VER_LABELS[v] || v}</Text>
                    {v === activeVer && <Ionicons name="checkmark" size={20} color="#E50914" />}
                  </TouchableOpacity>
                ))}
              </>}
              {audioTracks.length > 1 && <>
                <Text style={styles.sheetSection}>FAIXA NO ARQUIVO</Text>
                {audioTracks.map((track, idx) => (
                  <TouchableOpacity
                    key={track.id ?? idx}
                    style={styles.sheetRow}
                    onPress={() => { setActiveAudio(track); setSheet(null); schedHide(); }}
                  >
                    <Text style={[styles.sheetRowText, activeAudio?.id === track.id && styles.sheetRowActive]}>
                      {audioLabel(track, idx)}
                    </Text>
                    {activeAudio?.id === track.id && <Ionicons name="checkmark" size={20} color="#E50914" />}
                  </TouchableOpacity>
                ))}
              </>}
              {availVer.length <= 1 && audioTracks.length <= 1 && (
                <Text style={styles.sheetEmpty}>Nenhuma opção disponível</Text>
              )}
            </>}

            {sheet === 'timer' && <>
              <Text style={styles.sheetTitle}>Temporizador de sono</Text>
              {timerRemaining != null && (
                <TouchableOpacity style={styles.sheetRow} onPress={cancelTimer}>
                  <Text style={[styles.sheetRowText, { color: '#E50914' }]}>Cancelar ({fmtMs(timerRemaining)} restantes)</Text>
                </TouchableOpacity>
              )}
              {TIMER_OPTS.map(opt => (
                <TouchableOpacity key={opt.ms} style={styles.sheetRow} onPress={() => startTimer(opt.ms)}>
                  <Text style={styles.sheetRowText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </>}

            {sheet === 'cast' && (() => {
              const videoUrl = versions[activeVer];
              const isLocal = videoUrl?.startsWith('file://');
              return <>
                <Text style={styles.sheetTitle}>Transmitir para TV</Text>

                {/* FlixHome TV — envia ao app LG WebOS via backend */}
                {!isLocal && (
                  <TouchableOpacity style={styles.castOption} onPress={sendCastToTV} activeOpacity={0.8}>
                    <View style={[styles.castIconBox, castSent && { backgroundColor: '#E50914' }]}>
                      <Ionicons name="tv-outline" size={24} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.castOptionTitle}>FlixHome TV</Text>
                      <Text style={styles.castOptionDesc}>
                        {castSent
                          ? '✓ Enviado! O vídeo abrirá na TV em instantes.'
                          : 'Enviar para o app FlixHome na sua LG Smart TV. A TV precisa estar com o app aberto.'}
                      </Text>
                    </View>
                    {castSent && <Ionicons name="checkmark-circle" size={22} color="#E50914" />}
                  </TouchableOpacity>
                )}

                {Platform.OS === 'ios' && (
                  <View style={styles.castOption}>
                    <View style={styles.castIconBox}>
                      <Ionicons name="radio-outline" size={24} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.castOptionTitle}>AirPlay</Text>
                      <Text style={styles.castOptionDesc}>
                        Abra a Central de Controle e toque em{' '}
                        <Text style={{ color: '#fff' }}>Espelhar tela</Text>{' '}
                        ou selecione AirPlay no menu de reprodução.
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.castOption}>
                  <View style={styles.castIconBox}>
                    <Ionicons name="phone-portrait-outline" size={24} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.castOptionTitle}>Espelhar tela</Text>
                    <Text style={styles.castOptionDesc}>
                      {Platform.OS === 'android'
                        ? 'Use a barra de notificações → "Compartilhar tela" ou "Smart View / Transmitir" para espelhar no dispositivo.'
                        : 'No iOS use a Central de Controle → "Espelhar tela".'}
                    </Text>
                  </View>
                </View>

                {!isLocal && (
                  <View style={styles.castOption}>
                    <View style={styles.castIconBox}>
                      <Ionicons name="logo-youtube" size={24} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.castOptionTitle}>Abrir no VLC / Navegador da TV</Text>
                      <Text style={styles.castOptionDesc}>
                        Compartilhe o link abaixo e abra no VLC, Kodi ou navegador da sua smart TV.
                        Compatível com todos os formatos de áudio (incluindo AAC).
                      </Text>
                    </View>
                  </View>
                )}

                {!isLocal && (
                  <TouchableOpacity
                    style={styles.shareUrlBtn}
                    onPress={() => Share.share({ message: videoUrl, title: title })}
                  >
                    <Ionicons name="share-outline" size={18} color="#fff" />
                    <Text style={styles.shareUrlText} numberOfLines={1}>
                      Compartilhar link do vídeo
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={styles.castNote}>
                  <Ionicons name="information-circle-outline" size={14} color="#555" />
                  <Text style={styles.castNoteText}>
                    Chromecast não está disponível pois alguns filmes usam áudio AAC, que é incompatível com o Cast do Google.
                  </Text>
                </View>
              </>;
            })()}

            {sheet === 'episodes' && <>
              <Text style={styles.sheetTitle}>Episódios</Text>
              {sortedEps.length === 0
                ? <Text style={styles.sheetEmpty}>Carregando...</Text>
                : <FlatList
                    data={sortedEps}
                    keyExtractor={e => e.id}
                    style={{ maxHeight: 360 }}
                    renderItem={({ item: ep }) => {
                      const epUrl = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
                      const isActive = ep.id === id;
                      return (
                        <TouchableOpacity
                          style={[styles.sheetRow, isActive && styles.sheetRowHL]}
                          disabled={!epUrl}
                          onPress={() => {
                            if (!epUrl) return;
                            setSheet(null);
                            router.replace({
                              pathname: '/player',
                              params: {
                                url: epUrl, id: ep.id, type: 'episode',
                                title: ep.title || `Episódio ${ep.episode_number}`,
                                seriesId: seriesId || undefined, currentVersion: activeVer,
                                versions: JSON.stringify({ dubbing: ep.file_dubbing || null, subtitled: ep.file_subtitled || null, cinema: ep.file_cinema || null }),
                                subtitles: JSON.stringify({ pt: ep.subtitle_pt || null, en: ep.subtitle_en || null, es: ep.subtitle_es || null }),
                                introEnd: ep.intro_end ? String(ep.intro_end) : undefined,
                              },
                            });
                          }}
                        >
                          <Text style={[styles.sheetRowText, isActive && styles.sheetRowActive, !epUrl && { opacity: 0.3 }]}>
                            T{ep.season_number}E{pad(ep.episode_number)} · {ep.title || `Episódio ${ep.episode_number}`}
                          </Text>
                          {isActive && <Ionicons name="play" size={16} color="#E50914" />}
                        </TouchableOpacity>
                      );
                    }}
                  />
              }
            </>}

          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buffering: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  iconPad: { padding: 10 },
  titleText: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', paddingHorizontal: 6 },
  timerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  timerBtnText: { color: '#fff', fontSize: 13 },

  middleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },

  brightnessCol: { width: 44, alignItems: 'center', gap: 12, paddingVertical: 20 },
  sliderWrap: { width: 4, height: SLIDER_H, position: 'relative', overflow: 'visible' },
  sliderBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 },
  sliderFill: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 2 },
  sliderHandle: {
    position: 'absolute', left: -7, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },

  centerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 44 },
  seekBtn: { padding: 10 },
  seekWrap: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  seekNum: { position: 'absolute', color: '#fff', fontSize: 12, fontWeight: '800' },
  playPauseBtn: { padding: 10 },

  skipIntroBtn: {
    position: 'absolute', right: 20, bottom: 90,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 4,
  },
  skipIntroText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  bottomArea: { paddingHorizontal: 16, paddingTop: 4 },
  progressOuter: { height: 38, justifyContent: 'center', position: 'relative' },
  progressTrack: {
    position: 'absolute', left: 0, right: 0, height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2,
  },
  progressFill: { position: 'absolute', left: 0, height: 3, backgroundColor: '#E50914', borderRadius: 2 },
  progressDot: {
    position: 'absolute', top: '50%', marginTop: -9, marginLeft: -9,
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#E50914',
    elevation: 4, shadowColor: '#E50914', shadowOpacity: 0.5, shadowRadius: 6,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, marginBottom: 6 },
  timeText: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },

  actionBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  actionBtnText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  actionDiv: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.15)' },

  lockScreen: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'flex-start', paddingBottom: 28, paddingLeft: 20 },
  unlockPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
  unlockText: { color: '#fff', fontSize: 13 },

  nextCard: {
    position: 'absolute', right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.96)',
    borderRadius: 8, overflow: 'hidden', maxWidth: 280,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', elevation: 8,
  },
  nextThumb: { width: 80, height: 52 },
  nextInfo: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 },
  nextLabel: { color: '#E50914', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 3 },
  nextTitle: { color: '#fff', fontSize: 12, fontWeight: '600' },
  nextCountdown: { color: '#aaa', fontSize: 11, marginTop: 2 },
  nextBtns: { flexDirection: 'column', paddingRight: 10, gap: 6 },
  nextPlayBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  nextCancelBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  castOption: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  castIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1f1f1f', justifyContent: 'center', alignItems: 'center', marginTop: 2, flexShrink: 0 },
  castOptionTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  castOptionDesc: { color: '#777', fontSize: 12, lineHeight: 18 },
  shareUrlBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 16, backgroundColor: '#1f1f1f', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16 },
  shareUrlText: { color: '#ccc', fontSize: 14, flex: 1 },
  castNote: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 16, alignItems: 'flex-start' },
  castNoteText: { color: '#555', fontSize: 11, lineHeight: 16, flex: 1 },

  subtitleOverlay: { position: 'absolute', bottom: 72, left: 24, right: 24, alignItems: 'center', zIndex: 10 },
  subtitleText: {
    color: '#fff', fontSize: 17, fontWeight: '600', textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 5, overflow: 'hidden', lineHeight: 24,
  },
  sheetBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#141414', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, paddingBottom: 40, maxHeight: '72%' },
  sheetTitle: {
    color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center',
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetSection: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 24 },
  sheetRowHL: { backgroundColor: 'rgba(229,9,20,0.07)' },
  sheetRowText: { color: '#bbb', fontSize: 16 },
  sheetRowActive: { color: '#fff', fontWeight: '700' },
  sheetEmpty: { color: '#555', fontSize: 14, textAlign: 'center', padding: 24 },
});
