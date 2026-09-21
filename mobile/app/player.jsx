import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, PanResponder,
  ActivityIndicator, StatusBar, useWindowDimensions,
  Animated, FlatList, Image, Share, Platform, Linking, AppState, ScrollView,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as KeepAwake from 'expo-keep-awake';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CastButton, CastState, MediaPlayerState, MediaPlayerIdleReason, SessionManager,
  useCastDevice, useCastState, useMediaStatus, useRemoteMediaClient, useStreamPosition,
} from 'react-native-google-cast';
import CachedImage from '../components/CachedImage';
import api from '../lib/api';
import { useProfile } from '../contexts/ProfileContext';
import { useDownloads } from '../contexts/DownloadContext';
import NetInfo from '@react-native-community/netinfo';
import { getPref } from '../lib/prefs';
import { normalizeVersions, altMediaUrl } from '../lib/mediaUrl';

let Brightness = null;
try { Brightness = require('expo-brightness'); } catch {}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const TIMER_OPTS = [
  { label: '15 minutos', ms: 15 * 60000 },
  { label: '30 minutos', ms: 30 * 60000 },
  { label: '45 minutos', ms: 45 * 60000 },
  { label: '1 hora', ms: 60 * 60000 },
];
const VER_LABELS = { dubbing: 'Dublado', subtitled: 'Legendado', cinema: 'Cinema / Original', '4k': '4K UHD', color: 'Colorido', bw: 'P&B' };
const VER_SHORT = { dubbing: 'DUB', subtitled: 'LEG', cinema: 'CAM', '4k': '4K', color: 'COR', bw: 'P&B' };
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
  color:     ['por', 'pt'],
  bw:        ['por', 'pt'],
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

// Content-Type que o receiver precisa pra escolher o decoder - mandar sempre
// "video/mp4" quebrava MKV/HLS na TV.
function castContentType(url) {
  const u = String(url || '').split('?')[0].toLowerCase();
  if (u.endsWith('.mkv')) return 'video/x-matroska';
  if (u.endsWith('.m3u8')) return 'application/x-mpegURL';
  if (u.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

const epHasFile = e => !!(e.file_dubbing || e.file_subtitled || e.file_cinema || e.file_color || e.file_bw);
const sortEps = list => [...list].sort((a, b) =>
  a.season_number !== b.season_number ? a.season_number - b.season_number : a.episode_number - b.episode_number
);
// Proximo/anterior episodio JOGAVEL (pula os sem arquivo) e atravessa
// temporadas - antes so olhava idx+1 e parava num episodio sem video.
function pickAdjacentEp(list, curId, dir) {
  const sorted = sortEps(list);
  const i = sorted.findIndex(e => String(e.id) === String(curId));
  if (i < 0) return null;
  for (let j = i + dir; j >= 0 && j < sorted.length; j += dir) {
    if (epHasFile(sorted[j])) return sorted[j];
  }
  return null;
}
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
  const { title, id, type, seriesId, posterUrl } = params;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Parse params (stable — route params don't change)
  const versions = useRef(normalizeVersions(params.versions ? JSON.parse(params.versions) : { dubbing: params.url })).current;
  const availVer = useRef(Object.keys(versions).filter(k => versions[k])).current;
  const initVer = useRef((params.currentVersion && versions[params.currentVersion]) ? params.currentVersion : availVer[0]).current;
  const subtitles = useRef(params.subtitles ? JSON.parse(params.subtitles) : {}).current;
  const availSubs = useRef(Object.entries(subtitles).filter(([, u]) => u)).current;
  const paramNextEp = useRef(params.nextEpisode && params.nextEpisode !== 'undefined' ? JSON.parse(params.nextEpisode) : null).current;
  const [episodes, setEpisodes] = useState([]);
  // Antes o "proximo episodio" dependia 100% do param de navegacao - qualquer
  // entrada que nao o passasse (Continuar Assistindo, notificacao, download)
  // ficava sem o botao. Agora o player calcula sozinho pela lista da serie;
  // o param so serve de resposta imediata ate a lista carregar.
  const nextEp = useMemo(() => {
    if (type === 'episode' && episodes.length) return pickAdjacentEp(episodes, id, 1);
    return paramNextEp;
  }, [type, episodes, id, paramNextEp]);
  const prevEp = useMemo(
    () => (type === 'episode' && episodes.length ? pickAdjacentEp(episodes, id, -1) : null),
    [type, episodes, id],
  );
  const introEnd = params.introEnd && params.introEnd !== 'undefined' ? Number(params.introEnd) : 0;
  const startAt = params.startAt && params.startAt !== 'undefined' ? Number(params.startAt) : 0;

  const initialSource = useRef({ uri: versions[initVer] }).current;

  // ─── expo-video player ────────────────────────────────────────────────────
  const player = useVideoPlayer(initialSource, p => {
    p.play();
    p.preservesPitch = true;
    p.timeUpdateEventInterval = 1; // era 0.5 — 2 re-renders/s no componente inteiro; 1s é suficiente
    p.showNowPlayingNotification = true;
  });

  const { currentTime = 0 } = useEvent(player, 'timeUpdate', { currentTime: 0 });
  const { isPlaying = false } = useEvent(player, 'playingChange', { isPlaying: false });
  const { status = 'idle', error: playerError } = useEvent(player, 'statusChange', { status: 'idle' });

  // ─── Google Cast (Chromecast) — hooks ─────────────────────────────────────
  const castClient = useRemoteMediaClient();
  const castState = useCastState();
  const castDevice = useCastDevice();
  const mediaStatus = useMediaStatus();
  const remotePosition = useStreamPosition();
  const isCasting = castState === CastState.CONNECTED && !!castClient;
  const remoteState = mediaStatus?.playerState;
  const remoteIsPlaying = remoteState === MediaPlayerState.PLAYING || remoteState === MediaPlayerState.BUFFERING;
  const remoteLoading = remoteState === MediaPlayerState.LOADING || remoteState === MediaPlayerState.BUFFERING;
  const remoteFinished = remoteState === MediaPlayerState.IDLE && mediaStatus?.idleReason === MediaPlayerIdleReason.FINISHED;

  // Derived values (seconds) - durante a transmissao tudo (barra, tempo,
  // "proximo episodio", historico) passa a seguir a posicao da TV, nao a do
  // player local (que fica pausado no ponto onde a transmissao comecou).
  const localDur = player.duration || 0;
  const durSec = isCasting ? (mediaStatus?.mediaInfo?.streamDuration || localDur) : localDur;
  const posSec = isCasting ? (remotePosition ?? currentTime) : currentTime;
  const uiPlaying = isCasting ? remoteIsPlaying : isPlaying;
  const remainSec = Math.max(0, durSec - posSec);
  const progress = durSec > 0 ? posSec / durSec : 0;
  const isBuffering = isCasting ? remoteLoading : status === 'loading';
  const isEnded = isCasting
    ? remoteFinished
    : (!isPlaying && durSec > 0 && currentTime > 0 && remainSec < 1.5);
  const showSkipIntro = introEnd > 0 && posSec < introEnd && posSec > 2;
  const showNextEpCard = nextEp && ((remainSec > 0 && remainSec < 30) || isEnded);
  const showNextMovieCard = !nextEp && type !== 'episode' && nextMovie && ((remainSec > 0 && remainSec < 60) || isEnded);
  const showNextCard = showNextEpCard;

  // ─── State ────────────────────────────────────────────────────────────────
  const [activeVer, setActiveVer] = useState(initVer);
  const [savedPosSec, setSavedPosSec] = useState(startAt > 5 ? startAt : null);
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
  const [activeSheetSeason, setActiveSheetSeason] = useState(1);
  const [nextMovie, setNextMovie] = useState(null);
  const { activeProfile } = useProfile();
  const { getStatus: getDownloadStatus, startDownload, deleteDownload } = useDownloads();
  const [streamBlocked, setStreamBlocked] = useState(false);
  const [streamBlockInfo, setStreamBlockInfo] = useState(null);
  const [dragProgress, setDragProgress] = useState(null);
  // Computed after dragProgress to avoid TDZ / forward-reference
  const displayProgress = dragProgress !== null ? dragProgress : progress;

  // ─── Google Cast (Chromecast) — sessão ────────────────────────────────────
  const wasCastingRef = useRef(false);
  const lastRemotePosRef = useRef(0);
  const [castError, setCastError] = useState(null);
  if (isCasting && remotePosition != null) lastRemotePosRef.current = remotePosition;

  // Legendas na TV: o receiver só entende WebVTT, e a maioria das nossas é
  // .srt — a rota /subtitle converte na hora (mesma usada no player web).
  const castSubTracks = useMemo(() => {
    const base = String(api.defaults?.baseURL || '').replace(/\/$/, '');
    return availSubs.map(([lang, url], i) => ({
      id: i + 1,
      type: 'text',
      subtype: 'subtitles',
      contentId: `${base}/subtitle?url=${encodeURIComponent(url)}`,
      contentType: 'text/vtt',
      language: lang,
      name: SUB_LABELS[lang] || lang,
    }));
  }, [availSubs]);
  const castActiveTrackIds = (subKey) => {
    const t = castSubTracks.find(x => x.language === subKey);
    return t ? [t.id] : [];
  };

  // Manda (ou troca) o vídeo na TV. Usado ao conectar e ao trocar de versão.
  const loadOnCast = (client, videoUrl, startSec) => {
    if (!videoUrl) return Promise.resolve();
    if (String(videoUrl).startsWith('file://')) {
      setCastError('Vídeos baixados só tocam no celular — abra a versão online pra transmitir.');
      return Promise.resolve();
    }
    setCastError(null);
    const isEp = type === 'episode';
    return client.loadMedia({
      mediaInfo: {
        contentUrl: videoUrl,
        contentType: castContentType(videoUrl),
        mediaTracks: castSubTracks,
        metadata: {
          type: isEp ? 'tvShow' : 'movie',
          title: String(title || ''),
          ...(isEp && seriesName ? { seriesTitle: seriesName } : {}),
          images: posterUrl ? [{ url: String(posterUrl) }] : [],
        },
      },
      startTime: Math.max(0, Math.floor(startSec || 0)),
      autoplay: true,
      activeTrackIds: castActiveTrackIds(activeSub),
    }).catch(() => setCastError('Não foi possível iniciar a transmissão. Verifique se a TV está na mesma rede.'));
  };

  // Ao conectar num Chromecast: pausa o vídeo local (senão toca nos dois ao
  // mesmo tempo) e manda a versão/posição atual pro receiver. Ao desconectar
  // (ou se a TV cair): retoma local de onde a TV parou.
  useEffect(() => {
    if (isCasting && !wasCastingRef.current) {
      wasCastingRef.current = true;
      player.pause();
      loadOnCast(castClient, versions[activeVer], currentTime);
    } else if (!isCasting && wasCastingRef.current) {
      wasCastingRef.current = false;
      const back = lastRemotePosRef.current;
      if (back > 1) player.currentTime = back;
      player.play();
    }
  }, [isCasting]);

  // Legenda escolhida no celular vale também na TV
  useEffect(() => {
    if (isCasting) castClient.setActiveTrackIds(castActiveTrackIds(activeSub)).catch(() => {});
  }, [activeSub, isCasting]);

  const seekTo = (sec) => {
    const t = Math.max(0, sec);
    if (isCasting) {
      castClient.seek({ position: t, resumeState: remoteIsPlaying ? 'play' : 'pause' }).catch(() => {});
    } else {
      player.currentTime = t;
    }
  };
  // Refs pra handlers criados uma vez só (PanResponder) enxergarem o valor atual
  const isCastingRef = useRef(false);
  isCastingRef.current = isCasting;
  const castClientRef = useRef(null);
  castClientRef.current = castClient;
  const seekToRef = useRef(null);
  seekToRef.current = seekTo;
  const durRef = useRef(0);
  durRef.current = durSec;

  const castVolume = mediaStatus?.volume ?? 1;
  const castMuted = !!mediaStatus?.isMuted;
  const changeCastVolume = (delta) => {
    if (!isCasting) return;
    const v = Math.max(0, Math.min(1, Math.round((castVolume + delta) * 10) / 10));
    castClient.setStreamVolume(v).catch(() => {});
    if (castMuted && delta > 0) castClient.setStreamMuted(false).catch(() => {});
  };
  const toggleCastMute = () => { if (isCasting) castClient.setStreamMuted(!castMuted).catch(() => {}); };
  const stopCasting = () => { SessionManager.endCurrentSession(true).catch(() => {}); };

  const displayTime     = dragProgress !== null ? dragProgress * durSec : posSec;
  const sessionId = useRef(`${Date.now()}_${Math.random().toString(36).substr(2, 9)}`).current;
  const heartbeatRef = useRef(null);
  const brightnessRef = useRef(0.8);
  const ctrlOpacity = useRef(new Animated.Value(1)).current;
  const hideTimerRef = useRef(null);
  const schedHideRef = useRef(null);
  const sleepRef = useRef(null);
  const nextCountRef = useRef(null);
  const sheetListRef = useRef(null);
  const timerEndRef = useRef(null);
  const progressBarW = useRef(0);

  // ─── Setup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    KeepAwake.activateKeepAwakeAsync('player');
    if (Platform.OS === 'android') {
      // 'overlay-swipe': some sozinha e some por cima do vídeo (sem empurrar
      // o layout); arrastar da borda mostra de novo por alguns segundos.
      NavigationBar.setPositionAsync('absolute').catch(() => {});
      NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }
    schedHide();
    Brightness?.getBrightnessAsync?.()?.then(b => { brightnessRef.current = b; setBrightness(b); }).catch(() => {});

    // Se o app for pro background (home, troca de app) enquanto assistindo e o
    // Android matar o processo, o cleanup abaixo nunca roda — a orientação
    // paisagem fica "travada" e o próximo launch abre torto em outra tela.
    // Destrava assim que sai de foreground; relock se voltar ainda no player.
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
        if (Platform.OS === 'android') NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      } else {
        ScreenOrientation.unlockAsync().catch(() => {});
      }
    });

    return () => {
      appStateSub.remove();
      StatusBar.setHidden(false, 'fade');
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
        NavigationBar.setPositionAsync('relative').catch(() => {});
      }
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
        const dur = durRef.current;
        if (dur > 0) seekToRef.current(ratio * dur);
      }
      setDragProgress(null);
      schedHideRef.current?.();
    },
    onPanResponderTerminate: () => { setDragProgress(null); },
  })).current;

  // ─── Control helpers ──────────────────────────────────────────────────────
  const schedHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    // Transmitindo, os controles ficam sempre na tela (e o controle remoto
    // da TV nao faz sentido esconder).
    if (isCasting) return;
    hideTimerRef.current = setTimeout(() => { if (!sheet) fadeCtrl(false); }, 4000);
  }, [sheet, isCasting]);
  schedHideRef.current = schedHide;

  const fadeCtrl = (show) => {
    setCtrlVisible(show);
    Animated.timing(ctrlOpacity, { toValue: show ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  };

  useEffect(() => {
    if (isCasting) { clearTimeout(hideTimerRef.current); fadeCtrl(true); }
  }, [isCasting]);

  const onTap = () => {
    if (locked) return;
    if (sheet) { setSheet(null); return; }
    if (isCasting) return;
    const next = !ctrlVisible;
    fadeCtrl(next);
    if (next) schedHide();
  };

  const togglePlay = () => {
    if (isCasting) {
      remoteIsPlaying ? castClient.pause().catch(() => {}) : castClient.play().catch(() => {});
      schedHide();
      return;
    }
    isPlaying ? player.pause() : player.play();
    schedHide();
  };

  const seekBy = (sec) => {
    if (isCasting) {
      castClient.seek({ position: sec, relative: true, resumeState: remoteIsPlaying ? 'play' : 'pause' }).catch(() => {});
      schedHide();
      return;
    }
    player.seekBy(sec);
    schedHide();
  };

  const seekToRatio = (ratio) => {
    if (durSec > 0) seekTo(Math.max(0, Math.min(1, ratio)) * durSec);
  };

  const openSheet = (name) => {
    setSheet(name);
    clearTimeout(hideTimerRef.current);
    if (!ctrlVisible) fadeCtrl(true);
  };

  // Ref holds the latest save function so the interval never needs to restart
  const saveProgressRef = useRef(null);
  saveProgressRef.current = async () => {
    const ct = isCasting ? lastRemotePosRef.current : player.currentTime;
    const dur = isCasting ? (durRef.current || 0) : (player.duration || 0);
    if (!id || ct < 5) return;
    try {
      await api.post('/history', {
        content_type: type === 'episode' ? 'episode' : 'movie',
        content_id: id,
        episode_id: type === 'episode' ? id : undefined,
        series_id: type === 'episode' ? (seriesId || undefined) : undefined,
        progress: Math.floor(ct),
        duration: Math.floor(dur),
        profile_id: activeProfile?.id || null,
      });
    } catch {}
  };
  const saveProgress = () => saveProgressRef.current?.();

  useEffect(() => {
    const t = setInterval(() => saveProgressRef.current?.(), 15000);
    return () => {
      clearInterval(t);
      saveProgressRef.current?.();
    };
  }, []);

  const switchVer = (v) => {
    if (v !== activeVer) {
      const isDualAudio = versions[v] === versions[activeVer] && audioTracks.length > 1;
      if (isDualAudio) {
        // Mesmo arquivo — só troca a faixa de áudio, sem recarregar o vídeo
        const track = findTrackForVer(audioTracks, v);
        if (track) setActiveAudio(track);
      } else {
        if (isCasting) {
          loadOnCast(castClient, versions[v], posSec);
        } else {
          setSavedPosSec(currentTime);
          player.replace({ uri: versions[v] });
        }
      }
      setActiveVer(v);
    }
    setSheet(null);
  };

  // Tenta recarregar a mesma fonte — alguns dispositivos falham na decodificação
  // de vídeo (tela preta com áudio tocando) em falhas transitórias que um reload resolve.
  const retryPlayback = () => {
    setSavedPosSec(currentTime);
    // Toque manual alterna a forma da URL (barras reais <-> %2F): resolve o
    // 404 que aparece só em alguns aparelhos.
    altToggleRef.current = !altToggleRef.current;
    player.replace({ uri: altToggleRef.current ? altMediaUrl(versions[activeVer]) : versions[activeVer] });
  };

  // 404 do player: tenta sozinho uma vez a forma alternativa da URL antes
  // de mostrar o erro pro usuário.
  const altToggleRef = useRef(false);
  const autoAltTriedRef = useRef(false);
  useEffect(() => {
    if (status !== 'error' || autoAltTriedRef.current) return;
    if (!/404|403|Source error/i.test(playerError?.message || '')) return;
    const alt = altMediaUrl(versions[activeVer]);
    if (!alt || alt === versions[activeVer]) return;
    autoAltTriedRef.current = true;
    altToggleRef.current = true;
    setSavedPosSec(currentTime);
    player.replace({ uri: alt });
  }, [status]);

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
        if (isCastingRef.current) castClientRef.current?.pause().catch(() => {});
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

  // Nome da serie vem do titulo do episodio atual ("Serie · T1E2 · Nome"),
  // pra o titulo do proximo nao perder o nome da serie.
  const seriesName = useMemo(() => {
    const m = String(title || '').match(/^(.*?)\s·\sT\d+E\d+/);
    return m ? m[1] : '';
  }, [title]);

  // Baixa o proximo episodio sozinho (opcional, so no Wi-Fi) quando passar da
  // metade do atual - assim a maratona continua mesmo se a internet cair.
  const autoDlNextRef = useRef(false);
  useEffect(() => {
    if (autoDlNextRef.current) return;
    if (type !== 'episode' || !nextEp || durSec <= 0 || posSec / durSec < 0.5) return;
    autoDlNextRef.current = true;
    (async () => {
      try {
        if (!(await getPref('autoDownloadNext'))) return;
        const net = await NetInfo.fetch();
        if (net.type !== 'wifi') return;
        const ver = nextEp[`file_${activeVer}`] ? activeVer
          : ['dubbing', 'subtitled', 'cinema', 'color', 'bw'].find(k => nextEp[`file_${k}`]);
        if (!ver) return;
        if (getDownloadStatus(nextEp.id, ver).state !== 'none') return;
        startDownload(nextEp.id, ver, nextEp[`file_${ver}`], {
          title: seriesName || String(title || ''),
          type: 'episode',
          episodeLabel: `T${nextEp.season_number}E${pad(nextEp.episode_number)}${nextEp.title ? ` · ${nextEp.title}` : ''}`,
          thumbnailUrl: nextEp.thumbnail_url,
          posterUrl: posterUrl ? String(posterUrl) : null,
          seriesId: seriesId ? String(seriesId) : null,
        });
      } catch {}
    })();
  }, [posSec, durSec, nextEp]);

  // Apaga o download quando o episodio termina (opcional).
  const autoDeletedRef = useRef(false);
  useEffect(() => {
    if (!isEnded || autoDeletedRef.current || type !== 'episode') return;
    autoDeletedRef.current = true;
    (async () => {
      try {
        if (!(await getPref('autoDeleteWatched'))) return;
        if (getDownloadStatus(id, activeVer).state === 'done') deleteDownload(id, activeVer);
      } catch {}
    })();
  }, [isEnded]);

  // Abre qualquer episodio (proximo, anterior, lista) do mesmo jeito: salva o
  // progresso, mantem a versao de audio escolhida, usa o arquivo baixado se
  // existir e ja calcula o "proximo" do novo episodio.
  const openEpisode = (ep) => {
    if (!ep || !epHasFile(ep)) return;
    clearTimeout(nextCountRef.current);
    setNextCountdown(null);
    saveProgress();
    const vers = { dubbing: ep.file_dubbing || null, subtitled: ep.file_subtitled || null, cinema: ep.file_cinema || null, color: ep.file_color || null, bw: ep.file_bw || null };
    const ver = vers[activeVer] ? activeVer : Object.keys(vers).find(k => vers[k]);
    const dl = getDownloadStatus?.(ep.id, ver);
    if (!isCasting && dl?.state === 'done' && dl.filePath) vers[ver] = dl.filePath;
    const after = pickAdjacentEp(episodes, ep.id, 1);
    const navParams = {
      url: vers[ver],
      title: `${seriesName ? seriesName + ' · ' : ''}T${ep.season_number}E${pad(ep.episode_number)}${ep.title ? ` · ${ep.title}` : ''}`,
      id: String(ep.id), type: 'episode',
      currentVersion: ver,
      versions: JSON.stringify(vers),
      subtitles: JSON.stringify({ pt: ep.subtitle_pt || null, en: ep.subtitle_en || null, es: ep.subtitle_es || null }),
    };
    if (seriesId) navParams.seriesId = seriesId;
    if (after) navParams.nextEpisode = JSON.stringify(buildNavEpParam(after));
    if (ep.intro_end) navParams.introEnd = String(ep.intro_end);
    router.replace({ pathname: '/player', params: navParams });
  };

  const goNextEp = () => openEpisode(nextEp);
  const goPrevEp = () => openEpisode(prevEp);

  const sendCastToTV = useCallback(async () => {
    const videoUrl = versions[activeVer];
    if (!videoUrl || castSent) return;
    try {
      await api.post('/cast', {
        url: videoUrl,
        title,
        position: Math.floor(posSec),
        subtitleUrl: activeSub ? subtitles[activeSub] : null,
        version: activeVer,
      });
      setCastSent(true);
      setTimeout(() => setCastSent(false), 4000);
    } catch {}
  }, [versions, activeVer, title, posSec, activeSub, subtitles, castSent]);

  const sortedEps = [...episodes].sort((a, b) =>
    a.season_number !== b.season_number ? a.season_number - b.season_number : a.episode_number - b.episode_number
  );
  const seasonNums = [...new Set(sortedEps.map(e => e.season_number))].sort((a, b) => a - b);
  const sheetSeasonEps = sortedEps.filter(e => e.season_number === activeSheetSeason);

  const buildNavEpParam = (ep) => ({
    id: ep.id,
    title: ep.title || `Episódio ${ep.episode_number}`,
    episode_number: ep.episode_number,
    season_number: ep.season_number,
    thumbnail_url: ep.thumbnail_url || null,
    file_dubbing: ep.file_dubbing || null,
    file_subtitled: ep.file_subtitled || null,
    file_cinema: ep.file_cinema || null,
    file_color: ep.file_color || null,
    file_bw: ep.file_bw || null,
    subtitle_pt: ep.subtitle_pt || null,
    subtitle_en: ep.subtitle_en || null,
    subtitle_es: ep.subtitle_es || null,
    intro_end: ep.intro_end || null,
  });

  const SheetBody = sheet === 'episodes' ? View : ScrollView;

  // Progresso por episodio (barra + "assistido") vem do historico do perfil
  const [epProgressMap, setEpProgressMap] = useState({});
  const loadEpProgress = () => {
    if (!activeProfile?.id) return;
    api.get('/history', { params: { limit: 200, profile_id: activeProfile.id } }).then(r => {
      const m = {};
      (r.data || []).forEach(h => {
        const eid = h.episode_id || (h.content_type === 'episode' ? h.content_id : null);
        if (eid && h.duration > 0) m[String(eid)] = { ratio: Math.min(h.progress / h.duration, 1), done: !!h.completed || h.progress / h.duration > 0.92 };
      });
      setEpProgressMap(m);
    }).catch(() => {});
  };

  const openEpisodesSheet = () => {
    loadEpProgress();
    const cur = sortedEps.find(e => String(e.id) === String(id));
    setActiveSheetSeason(cur?.season_number || seasonNums[0] || 1);
    openSheet('episodes');
  };

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
        surfaceType="textureView"
        fullscreenOptions={{ isFullscreenSupported: false }}
        allowsExternalPlayback={true}
        allowsPictureInPicture
        startsPictureInPictureAutomatically
        requiresLinearPlayback={false}
        bufferOptions={{
          // Android (ExoPlayer): pré-carrega até 2 min para aguentar quedas de rede
          minBufferMs: 15000,
          maxBufferMs: 120000,
          bufferForPlaybackMs: 2500,
          bufferForPlaybackAfterRebufferMs: 8000,
          // iOS (AVPlayer): aguarda buffer suficiente antes de iniciar
          preferredForwardBufferDuration: 60,
          waitsToMinimizeStalling: true,
        }}
      />

      {/* Buffering */}
      {isBuffering && status !== 'error' && (
        <View style={styles.buffering}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Erro de reprodução — antes ficava tela preta com só o áudio, sem nenhum aviso */}
      {status === 'error' && (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle-outline" size={44} color="#E50914" />
          <Text style={styles.errorTitle}>Não foi possível reproduzir o vídeo</Text>
          {!!playerError?.message && <Text style={styles.errorMsg} numberOfLines={2}>{playerError.message}</Text>}
          <View style={styles.errorBtnRow}>
            <TouchableOpacity style={styles.errorBtn} onPress={retryPlayback}>
              <Text style={styles.errorBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
            {availVer.length > 1 && (
              <TouchableOpacity style={[styles.errorBtn, styles.errorBtnOutline]} onPress={() => openSheet('audio')}>
                <Text style={styles.errorBtnText}>Trocar versão</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Legenda overlay (VTT externo parseado — sempre visível) */}
      {!isCasting && subtitleCues.length > 0 && (() => {
        const cue = subtitleCues.find(c => currentTime >= c.start && currentTime <= c.end);
        return cue ? (
          <View style={styles.subtitleOverlay} pointerEvents="none">
            <Text style={styles.subtitleText}>{cue.text}</Text>
          </View>
        ) : null;
      })()}

      {/* Tap area */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onTap} activeOpacity={1} />

      {/* Transmitindo para Chromecast — o vídeo local fica pausado; os controles
          de baixo (play, seek, barra, legenda, versão, episódios) atuam na TV.
          Aqui fica o cartão do dispositivo, volume e "parar". Renderizado
          antes dos controles pra eles ficarem por cima. */}
      {isCasting && (
        <View style={styles.castingOverlay} pointerEvents="box-none">
          <View style={styles.castCard} pointerEvents="none">
            {posterUrl
              ? <CachedImage source={{ uri: String(posterUrl) }} style={styles.castPoster} resizeMode="cover" />
              : <View style={[styles.castPoster, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="tv" size={30} color="rgba(255,255,255,0.6)" />
                </View>}
            <View style={{ flexShrink: 1 }}>
              <View style={styles.castLive}>
                <View style={[styles.castDot, { backgroundColor: castError ? '#E50914' : remoteIsPlaying ? '#46d369' : '#f5a623' }]} />
                <Text style={styles.castLiveText}>
                  {castError ? 'Erro' : remoteLoading ? 'Carregando na TV…' : remoteIsPlaying ? 'Transmitindo' : 'Pausado'}
                </Text>
              </View>
              <Text style={styles.castDevice} numberOfLines={1}>{castDevice?.friendlyName || 'Chromecast'}</Text>
              <Text style={styles.castTitle} numberOfLines={2}>{title}</Text>
            </View>
          </View>

          {!!castError && (
            <View style={styles.castErrorBox}>
              <Text style={styles.castErrorText}>{castError}</Text>
              <TouchableOpacity style={styles.castErrorBtn} onPress={stopCasting}>
                <Text style={styles.castErrorBtnText}>Assistir no celular</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Volume da TV + parar transmissão (coluna direita) */}
          <View style={styles.castSide}>
            <TouchableOpacity style={styles.castSideBtn} onPress={() => changeCastVolume(0.1)} activeOpacity={0.7}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.castSideBtn} onPress={toggleCastMute} activeOpacity={0.7}>
              <Ionicons name={castMuted || castVolume === 0 ? 'volume-mute' : 'volume-high'} size={18} color={castMuted ? '#E50914' : '#fff'} />
              <Text style={styles.castVolText}>{castMuted ? '—' : Math.round(castVolume * 100)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.castSideBtn} onPress={() => changeCastVolume(-0.1)} activeOpacity={0.7}>
              <Ionicons name="remove" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.castSideBtn, styles.castStopBtn]} onPress={stopCasting} activeOpacity={0.8}>
              <Ionicons name="stop-circle-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

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
            {!!VER_SHORT[activeVer] && (
              <View style={styles.verBadge}>
                <Text style={styles.verBadgeText}>{VER_SHORT[activeVer]}</Text>
              </View>
            )}
            <View style={styles.castHeaderBox}>
              <Ionicons name={isCasting ? 'tv' : 'tv-outline'} size={20} color={isCasting ? '#E50914' : '#fff'} />
              <CastButton style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} tintColor="transparent" />
            </View>
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
                  name={uiPlaying ? 'pause' : 'play'} size={56} color="#fff"
                  style={!uiPlaying ? { marginLeft: 5 } : undefined}
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
              onPress={() => seekTo(introEnd)}
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
                <TouchableOpacity style={styles.actionBtn} onPress={openEpisodesSheet}>
                  <Ionicons name="list-outline" size={15} color="#fff" />
                  <Text style={styles.actionBtnText}>Episódios</Text>
                </TouchableOpacity>
              </>}
              <View style={styles.actionDiv} />
              <TouchableOpacity style={styles.actionBtn} onPress={() => openSheet('cast')}>
                <Ionicons name="tv-outline" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Transmitir</Text>
              </TouchableOpacity>
              {prevEp && <>
                <View style={styles.actionDiv} />
                <TouchableOpacity style={styles.actionBtn} onPress={goPrevEp}>
                  <Ionicons name="play-skip-back-outline" size={15} color="#fff" />
                  <Text style={styles.actionBtnText}>Ep. anterior</Text>
                </TouchableOpacity>
              </>}
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
            if (nextMovie.file_color) versions.color = nextMovie.file_color;
            if (nextMovie.file_bw) versions.bw = nextMovie.file_bw;
            const firstUrl = nextMovie.file_dubbing || nextMovie.file_subtitled || nextMovie.file_cinema || nextMovie.file_color || nextMovie.file_bw;
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
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.sheet, { paddingTop: Math.max(insets.top, 10), paddingBottom: Math.max(insets.bottom, 10), paddingRight: Math.max(insets.right, 0) }]}
          >
          <SheetBody
            style={sheet === 'episodes' ? { flex: 1 } : { flex: 1 }}
            {...(sheet === 'episodes' ? {} : { showsVerticalScrollIndicator: false, contentContainerStyle: { paddingBottom: 24 } })}
          >

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

                {/* Chromecast — toque no ícone abre a lista de dispositivos nativa */}
                {!isLocal && (
                  <View style={styles.castOption}>
                    {/* O CastButton nativo ignora tintColor de forma inconsistente no
                        Android (fica cinza escuro em cima do fundo escuro, quase
                        invisivel) - por isso ele fica por cima totalmente transparente
                        so pra continuar abrindo a lista de dispositivos ao tocar,
                        enquanto o icone visivel e o nosso, com a cor que a gente
                        controla de verdade. */}
                    <View style={[styles.castIconBox, isCasting && { backgroundColor: '#E50914' }]}>
                      <Ionicons name="tv-outline" size={22} color="#fff" />
                      <CastButton style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} tintColor="transparent" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.castOptionTitle}>Chromecast</Text>
                      <Text style={styles.castOptionDesc}>
                        {isCasting
                          ? `✓ Transmitindo para ${castDevice?.friendlyName || 'a TV'}`
                          : 'Toque no ícone pra escolher um Chromecast na mesma rede.'}
                      </Text>
                    </View>
                  </View>
                )}

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

                {/* Web Video Cast */}
                {!isLocal && Platform.OS === 'android' && (
                  <TouchableOpacity
                    style={styles.castOption}
                    activeOpacity={0.8}
                    onPress={() => {
                      const v = versions[activeVer];
                      if (!v) return;
                      Share.share({ message: v, title: title });
                    }}
                  >
                    <View style={[styles.castIconBox, { backgroundColor: '#1a73e8' }]}>
                      <Ionicons name="cast-outline" size={24} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.castOptionTitle}>Web Video Cast</Text>
                      <Text style={styles.castOptionDesc}>
                        Toque para compartilhar a URL — selecione "Web Video Cast" na lista para transmitir via Chromecast, DLNA, Fire TV e outros.
                      </Text>
                    </View>
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
                  <TouchableOpacity
                    style={styles.castOption}
                    activeOpacity={0.8}
                    onPress={async () => {
                      const videoUrl = versions[activeVer];
                      if (!videoUrl) return;
                      const vlcUrl = `vlc://${videoUrl}`;
                      try {
                        await Linking.openURL(vlcUrl);
                      } catch {
                        Share.share({ message: videoUrl, title });
                      }
                    }}
                  >
                    <View style={styles.castIconBox}>
                      <Ionicons name="play-circle-outline" size={24} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.castOptionTitle}>Abrir no VLC</Text>
                      <Text style={styles.castOptionDesc}>
                        Abre o vídeo direto no VLC. Se não estiver instalado, compartilha o link para abrir em outro player.
                      </Text>
                    </View>
                  </TouchableOpacity>
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

              </>;
            })()}

            {sheet === 'episodes' && <>
              <Text style={styles.sheetTitle}>Episódios</Text>
              {sortedEps.length === 0
                ? <Text style={styles.sheetEmpty}>Carregando...</Text>
                : <>
                  {seasonNums.length > 1 && (
                    <FlatList
                      horizontal
                      data={seasonNums}
                      keyExtractor={s => String(s)}
                      showsHorizontalScrollIndicator={false}
                      style={styles.seasonTabsRow}
                      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                      renderItem={({ item: s }) => (
                        <TouchableOpacity
                          style={[styles.seasonTab, activeSheetSeason === s && styles.seasonTabActive]}
                          onPress={() => setActiveSheetSeason(s)}
                        >
                          <Text style={[styles.seasonTabText, activeSheetSeason === s && styles.seasonTabTextActive]}>
                            Temporada {s}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  )}
                  <FlatList
                    ref={sheetListRef}
                    data={sheetSeasonEps}
                    keyExtractor={e => String(e.id)}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                    onLayout={() => {
                      // Abre ja rolado no episodio que esta tocando
                      const i = sheetSeasonEps.findIndex(e => String(e.id) === String(id));
                      if (i > 0) sheetListRef.current?.scrollToIndex({ index: i, animated: false, viewPosition: 0.3 });
                    }}
                    onScrollToIndexFailed={() => {}}
                    renderItem={({ item: ep }) => {
                      const epUrl = ep.file_dubbing || ep.file_subtitled || ep.file_cinema || ep.file_color || ep.file_bw;
                      const isActive = String(ep.id) === String(id);
                      const prog = epProgressMap[String(ep.id)];
                      const ver = ep.file_dubbing ? 'dubbing' : ep.file_subtitled ? 'subtitled' : ep.file_cinema ? 'cinema' : ep.file_color ? 'color' : 'bw';
                      const isDownloaded = !!epUrl && getDownloadStatus?.(ep.id, ver)?.state === 'done';
                      return (
                        <TouchableOpacity
                          style={[styles.epRow, isActive && styles.epRowActive]}
                          disabled={!epUrl}
                          onPress={() => { setSheet(null); openEpisode(ep); }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.epThumbWrap}>
                            {ep.thumbnail_url
                              ? <CachedImage source={{ uri: ep.thumbnail_url }} style={styles.epThumb} resizeMode="cover" />
                              : <View style={styles.epThumbPlaceholder}>
                                  <Ionicons name="film-outline" size={18} color="#333" />
                                </View>}
                            {ep.duration > 0 && (
                              <View style={styles.epThumbDur}>
                                <Text style={styles.epThumbDurText}>{Math.round(ep.duration / 60)} min</Text>
                              </View>
                            )}
                            {!!prog && prog.ratio > 0.02 && (
                              <View style={styles.epProg}>
                                <View style={[styles.epProgFill, { width: `${prog.ratio * 100}%` }]} />
                              </View>
                            )}
                          </View>
                          <View style={styles.epInfo}>
                            <Text style={styles.epNum}>
                              E{pad(ep.episode_number)}{prog?.done ? '  ·  ✓ Assistido' : ''}
                            </Text>
                            <Text style={[styles.epTitle, !epUrl && { opacity: 0.3 }]} numberOfLines={2}>
                              {ep.title || `Episódio ${ep.episode_number}`}
                            </Text>
                            {!!ep.synopsis && isActive && (
                              <Text style={styles.epSynopsis} numberOfLines={2}>{ep.synopsis}</Text>
                            )}
                          </View>
                          {isActive
                            ? <Ionicons name="play-circle" size={22} color="#E50914" />
                            : !epUrl
                            ? <Ionicons name="lock-closed-outline" size={16} color="#444" />
                            : isDownloaded
                            ? <Ionicons name="checkmark-circle" size={18} color="#46d369" />
                            : null}
                        </TouchableOpacity>
                      );
                    }}
                  />
                </>
              }
            </>}

          </SheetBody>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buffering: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#000', gap: 10, paddingHorizontal: 40,
  },
  errorTitle: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  errorMsg: { color: '#888', fontSize: 12, textAlign: 'center' },
  errorBtnRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  errorBtn: { backgroundColor: '#E50914', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  errorBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  errorBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  iconPad: { padding: 10 },
  titleText: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', paddingHorizontal: 6 },
  timerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  timerBtnText: { color: '#fff', fontSize: 13 },
  castHeaderBtn: { width: 24, height: 24, marginHorizontal: 6 },
  castHeaderBox: { width: 36, height: 36, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  castingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,10,0.94)' },
  castCard: { position: 'absolute', top: 64, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 14, maxWidth: '62%' },
  castPoster: { width: 64, height: 92, borderRadius: 8, backgroundColor: '#1a1a1a' },
  castLive: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  castDot: { width: 8, height: 8, borderRadius: 4 },
  castLiveText: { color: '#aaa', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  castDevice: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  castTitle: { color: '#8a8a8a', fontSize: 12, lineHeight: 16 },
  castErrorBox: { position: 'absolute', bottom: 150, alignSelf: 'center', alignItems: 'center', gap: 10, maxWidth: '70%' },
  castErrorText: { color: '#ff8a8a', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  castErrorBtn: { backgroundColor: '#E50914', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  castErrorBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  castSide: { position: 'absolute', right: 18, top: 0, bottom: 0, justifyContent: 'center', gap: 8 },
  castSideBtn: { width: 44, minHeight: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  castVolText: { color: '#ddd', fontSize: 10, fontWeight: '700', marginTop: 1 },
  castStopBtn: { backgroundColor: 'rgba(229,9,20,0.75)', marginTop: 6 },
  verBadge: {
    backgroundColor: 'rgba(229,9,20,0.85)', borderRadius: 4,
    paddingHorizontal: 7, paddingVertical: 3, marginRight: 4,
  },
  verBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

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
  seasonTabsRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  seasonTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#222' },
  seasonTabActive: { backgroundColor: '#E50914' },
  seasonTabText: { color: '#888', fontSize: 13, fontWeight: '600' },
  seasonTabTextActive: { color: '#fff' },
  epRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  epRowActive: { backgroundColor: 'rgba(229,9,20,0.07)' },
  epThumbWrap: { width: 118, height: 66, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  epThumb: { width: '100%', height: '100%' },
  epThumbPlaceholder: { width: '100%', height: '100%', backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center' },
  epThumbDur: { position: 'absolute', right: 4, bottom: 5, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  epThumbDurText: { color: '#ddd', fontSize: 9, fontWeight: '700' },
  epProg: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  epProgFill: { height: '100%', backgroundColor: '#E50914' },
  epSynopsis: { color: '#777', fontSize: 11, lineHeight: 15, marginTop: 3 },
  epInfo: { flex: 1 },
  epNum: { color: '#555', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  epTitle: { color: '#ddd', fontSize: 13, lineHeight: 18 },
  epDuration: { color: '#555', fontSize: 11, marginTop: 3 },

  sheetBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#141414', borderTopLeftRadius: 20, borderBottomLeftRadius: 20, width: '52%', maxWidth: 460, minWidth: 300, height: '100%' },
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
