import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, PanResponder,
  ActivityIndicator, StatusBar, useWindowDimensions,
  Animated, FlatList, Image,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as KeepAwake from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';

// Brightness: graceful fallback if expo-brightness not installed
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
const SLIDER_H = 140;

function pad(n) { return String(n).padStart(2, '0'); }
function fmt(ms) {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
function fmtMin(ms) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${m}:${pad(s)}`;
}

export default function PlayerScreen() {
  const params = useLocalSearchParams();
  const { title, id, type, seriesId } = params;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const videoRef = useRef(null);
  const hideTimerRef = useRef(null);
  const sleepIntervalRef = useRef(null);
  const nextCountRef = useRef(null);
  const timerEndRef = useRef(null);

  // Parse params
  const versions = params.versions ? JSON.parse(params.versions) : { dubbing: params.url };
  const availVer = Object.keys(versions).filter(k => versions[k]);
  const initVer = params.currentVersion && versions[params.currentVersion] ? params.currentVersion : availVer[0];
  const subtitles = params.subtitles ? JSON.parse(params.subtitles) : {};
  const availSubs = Object.entries(subtitles).filter(([, u]) => u);
  const nextEp = params.nextEpisode ? JSON.parse(params.nextEpisode) : null;
  const introEnd = params.introEnd ? Number(params.introEnd) : 0;

  // Playback
  const [activeVer, setActiveVer] = useState(initVer);
  const [playStatus, setPlayStatus] = useState({});
  const [savedPos, setSavedPos] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [speed, setSpeed] = useState(1);

  // UI
  const [ctrlVisible, setCtrlVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [brightness, setBrightness] = useState(0.8);
  const brightnessRef = useRef(0.8);
  const ctrlOpacity = useRef(new Animated.Value(1)).current;

  // Sheets: null | 'speed' | 'episodes' | 'subtitles' | 'timer'
  const [sheet, setSheet] = useState(null);

  // Sleep timer
  const [timerRemaining, setTimerRemaining] = useState(null);

  // Next episode
  const [nextCountdown, setNextCountdown] = useState(null);

  // Episodes list
  const [episodes, setEpisodes] = useState([]);

  // Derived
  const posMs = playStatus.positionMillis || 0;
  const durMs = playStatus.durationMillis || 0;
  const progress = durMs > 0 ? posMs / durMs : 0;
  const remainMs = durMs > 0 ? durMs - posMs : 0;
  const isPlaying = playStatus.isPlaying || false;
  const isEnded = playStatus.didJustFinish || (durMs > 0 && remainMs < 600);
  const showSkipIntro = introEnd > 0 && posMs / 1000 < introEnd && posMs > 2000;
  const showNextCard = nextEp && ((remainMs > 0 && remainMs < 30000) || isEnded);
  const currentUrl = versions[activeVer];
  const progressBarW = useRef(0);

  // ─── SETUP ────────────────────────────────────────────────────────────────
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    KeepAwake.activateKeepAwakeAsync('player');
    schedHide();
    Brightness?.getBrightnessAsync?.()?.then(b => {
      brightnessRef.current = b;
      setBrightness(b);
    }).catch?.(() => {});
    return () => {
      StatusBar.setHidden(false, 'fade');
      ScreenOrientation.unlockAsync();
      KeepAwake.deactivateKeepAwake('player');
      clearTimeout(hideTimerRef.current);
      clearInterval(sleepIntervalRef.current);
      clearTimeout(nextCountRef.current);
    };
  }, []);

  // Load episodes for sheet
  useEffect(() => {
    if (!seriesId) return;
    api.get(`/series/${seriesId}/episodes`).then(r => {
      setEpisodes(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {});
  }, [seriesId]);

  // Sleep timer tick
  useEffect(() => {
    if (!timerEndRef.current) return;
    clearInterval(sleepIntervalRef.current);
    sleepIntervalRef.current = setInterval(() => {
      const rem = timerEndRef.current - Date.now();
      if (rem <= 0) {
        setTimerRemaining(null);
        timerEndRef.current = null;
        videoRef.current?.pauseAsync?.();
        clearInterval(sleepIntervalRef.current);
      } else {
        setTimerRemaining(rem);
      }
    }, 1000);
    return () => clearInterval(sleepIntervalRef.current);
  }, []);

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

  // ─── BRIGHTNESS PAN ───────────────────────────────────────────────────────
  let bStartVal = 0.8;
  const brightnessPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { bStartVal = brightnessRef.current; },
    onPanResponderMove: (_, g) => {
      const delta = -g.dy / SLIDER_H;
      const b = Math.max(0.05, Math.min(1, bStartVal + delta));
      brightnessRef.current = b;
      setBrightness(b);
      Brightness?.setBrightnessAsync?.(b)?.catch?.(() => {});
    },
  })).current;

  // ─── PROGRESS PAN ─────────────────────────────────────────────────────────
  let pStartX = 0;
  const progressPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      pStartX = e.nativeEvent.locationX;
      seekToRatio(pStartX / progressBarW.current);
    },
    onPanResponderMove: (_, g) => {
      seekToRatio((pStartX + g.dx) / progressBarW.current);
    },
  })).current;

  const seekToRatio = (ratio) => {
    if (!videoRef.current || !durMs) return;
    videoRef.current.setPositionAsync(Math.max(0, Math.min(1, ratio)) * durMs);
  };

  // ─── CONTROLS ─────────────────────────────────────────────────────────────
  const schedHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!sheet) fadeCtrl(false);
    }, 4000);
  }, [sheet]);

  const fadeCtrl = (show) => {
    setCtrlVisible(show);
    Animated.timing(ctrlOpacity, {
      toValue: show ? 1 : 0, duration: 220, useNativeDriver: true,
    }).start();
  };

  const onTap = () => {
    if (locked) return;
    if (sheet) { setSheet(null); return; }
    const next = !ctrlVisible;
    fadeCtrl(next);
    if (next) schedHide();
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    isPlaying ? await videoRef.current.pauseAsync() : await videoRef.current.playAsync();
    schedHide();
  };

  const seek = async (sec) => {
    await videoRef.current?.setPositionAsync(Math.max(0, posMs + sec * 1000));
    schedHide();
  };

  const openSheet = (name) => {
    setSheet(name);
    clearTimeout(hideTimerRef.current);
    if (!ctrlVisible) fadeCtrl(true);
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
        id: nextEp.id, type: 'episode',
        seriesId: seriesId || undefined,
        currentVersion: activeVer,
        versions: JSON.stringify({ dubbing: nextEp.file_dubbing || null, subtitled: nextEp.file_subtitled || null, cinema: nextEp.file_cinema || null }),
        subtitles: JSON.stringify({ pt: nextEp.subtitle_pt || null, en: nextEp.subtitle_en || null, es: nextEp.subtitle_es || null }),
        nextEpisode: nextEp.next ? JSON.stringify(nextEp.next) : undefined,
        introEnd: nextEp.intro_end ? String(nextEp.intro_end) : undefined,
      },
    });
  };

  const switchVer = (v) => {
    if (v !== activeVer) { setSavedPos(posMs); setActiveVer(v); }
    setSheet(null);
  };

  const startTimer = (ms) => {
    clearInterval(sleepIntervalRef.current);
    timerEndRef.current = Date.now() + ms;
    setTimerRemaining(ms);
    // Start the tick
    sleepIntervalRef.current = setInterval(() => {
      const rem = timerEndRef.current - Date.now();
      if (rem <= 0) {
        setTimerRemaining(null);
        timerEndRef.current = null;
        videoRef.current?.pauseAsync?.();
        clearInterval(sleepIntervalRef.current);
      } else {
        setTimerRemaining(rem);
      }
    }, 1000);
    setSheet(null);
  };

  const cancelTimer = () => {
    clearInterval(sleepIntervalRef.current);
    timerEndRef.current = null;
    setTimerRemaining(null);
  };

  const saveProgress = useCallback(async () => {
    if (!id || posMs < 5000) return;
    try {
      await api.post('/history', {
        content_type: type === 'episode' ? 'episode' : 'movie',
        content_id: id,
        progress: Math.floor(posMs / 1000),
        duration: Math.floor(durMs / 1000),
      });
    } catch {}
  }, [id, type, posMs, durMs]);

  useEffect(() => {
    const t = setInterval(saveProgress, 15000);
    return () => clearInterval(t);
  }, [saveProgress]);

  const onVideoLoad = async () => {
    if (savedPos != null && videoRef.current) {
      await videoRef.current.setPositionAsync(savedPos);
      setSavedPos(null);
    }
  };

  const sortedEps = [...episodes].sort((a, b) =>
    a.season_number !== b.season_number ? a.season_number - b.season_number : a.episode_number - b.episode_number
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000', width, height }}>
      {/* Video */}
      <Video
        ref={videoRef}
        source={{ uri: currentUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        rate={speed}
        shouldCorrectPitch
        onPlaybackStatusUpdate={setPlayStatus}
        onLoad={onVideoLoad}
        progressUpdateIntervalMillis={500}
        textTracks={availSubs.map(([lang, url]) => ({
          title: SUB_LABELS[lang] || lang, language: lang, type: 'text/vtt', uri: url,
        }))}
        selectedTextTrack={activeSub ? { type: 'language', value: activeSub } : { type: 'disabled' }}
      />

      {/* Buffering */}
      {playStatus.isBuffering && !isPlaying && (
        <View style={styles.buffering}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

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
                {timerRemaining ? fmtMin(timerRemaining) : 'Temporizador'}
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

            {/* CENTER: back 10 | play/pause | forward 10 */}
            <View style={styles.centerRow}>
              <TouchableOpacity style={styles.seekBtn} onPress={() => seek(-10)} activeOpacity={0.7}>
                <View style={styles.seekWrap}>
                  <Ionicons name="refresh" size={50} color="rgba(255,255,255,0.9)" style={{ transform: [{ scaleX: -1 }] }} />
                  <Text style={styles.seekNum}>10</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.playPauseBtn} onPress={togglePlay} activeOpacity={0.8}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={56}
                  color="#fff"
                  style={!isPlaying ? { marginLeft: 5 } : undefined}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.seekBtn} onPress={() => seek(10)} activeOpacity={0.7}>
                <View style={styles.seekWrap}>
                  <Ionicons name="refresh" size={50} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.seekNum}>10</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Spacer espelha coluna de brilho */}
            <View style={{ width: 44 }} />
          </View>

          {/* SKIP INTRO */}
          {showSkipIntro && (
            <TouchableOpacity
              style={styles.skipIntroBtn}
              onPress={() => videoRef.current?.setPositionAsync(introEnd * 1000)}
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
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              <View style={[styles.progressDot, { left: `${Math.min(progress * 100, 99)}%` }]} />
            </View>

            {/* Times */}
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{fmt(posMs)}</Text>
              <Text style={styles.timeText}>{fmt(durMs)}</Text>
            </View>

            {/* Action bar — estilo Netflix */}
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openSheet('speed')}>
                <Ionicons name="speedometer-outline" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Velocidade ({speed}x)</Text>
              </TouchableOpacity>

              <View style={styles.actionDiv} />

              <TouchableOpacity style={styles.actionBtn} onPress={() => setLocked(true)}>
                <Ionicons name="lock-open-outline" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Bloquear</Text>
              </TouchableOpacity>

              {seriesId && <>
                <View style={styles.actionDiv} />
                <TouchableOpacity style={styles.actionBtn} onPress={() => openSheet('episodes')}>
                  <Ionicons name="list-outline" size={15} color="#fff" />
                  <Text style={styles.actionBtnText}>Episódios</Text>
                </TouchableOpacity>
              </>}

              <View style={styles.actionDiv} />

              <TouchableOpacity style={styles.actionBtn} onPress={() => openSheet('subtitles')}>
                <Ionicons name="text-outline" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Idioma e legendas</Text>
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

      {/* ── CARD PRÓXIMO EPISÓDIO ── */}
      {showNextCard && !locked && !sheet && (
        <View style={[styles.nextCard, { bottom: Math.max(insets.bottom, 14) + 78 }]}>
          {nextEp.thumbnail_url && (
            <Image source={{ uri: nextEp.thumbnail_url }} style={styles.nextThumb} />
          )}
          <View style={styles.nextInfo}>
            <Text style={styles.nextLabel}>PRÓXIMO EPISÓDIO</Text>
            <Text style={styles.nextTitle} numberOfLines={1}>
              {nextEp.title || `Episódio ${nextEp.episode_number}`}
            </Text>
            {nextCountdown !== null && (
              <Text style={styles.nextCountdown}>Começa em {nextCountdown}s</Text>
            )}
          </View>
          <View style={styles.nextBtns}>
            <TouchableOpacity style={styles.nextPlayBtn} onPress={goNextEp}>
              <Ionicons name="play" size={15} color="#000" />
            </TouchableOpacity>
            {nextCountdown !== null && (
              <TouchableOpacity
                style={styles.nextCancelBtn}
                onPress={() => { setNextCountdown(null); clearTimeout(nextCountRef.current); }}
              >
                <Ionicons name="close" size={13} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── SHEETS ── */}
      {sheet && (
        <TouchableOpacity style={styles.sheetBg} onPress={() => setSheet(null)} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>

            {/* VELOCIDADE */}
            {sheet === 'speed' && <>
              <Text style={styles.sheetTitle}>Velocidade de reprodução</Text>
              {SPEEDS.map(s => (
                <TouchableOpacity key={s} style={styles.sheetRow} onPress={() => { setSpeed(s); setSheet(null); schedHide(); }}>
                  <Text style={[styles.sheetRowText, s === speed && styles.sheetRowActive]}>
                    {s === 1 ? 'Normal (1x)' : `${s}x`}
                  </Text>
                  {s === speed && <Ionicons name="checkmark" size={20} color="#E50914" />}
                </TouchableOpacity>
              ))}
            </>}

            {/* IDIOMA E LEGENDAS */}
            {sheet === 'subtitles' && <>
              <Text style={styles.sheetTitle}>Idioma e legendas</Text>
              {availVer.length > 0 && <>
                <Text style={styles.sheetSection}>FAIXA DE ÁUDIO</Text>
                {availVer.map(v => (
                  <TouchableOpacity key={v} style={styles.sheetRow} onPress={() => switchVer(v)}>
                    <Text style={[styles.sheetRowText, v === activeVer && styles.sheetRowActive]}>{VER_LABELS[v] || v}</Text>
                    {v === activeVer && <Ionicons name="checkmark" size={20} color="#E50914" />}
                  </TouchableOpacity>
                ))}
              </>}
              {availSubs.length > 0 && <>
                <Text style={styles.sheetSection}>LEGENDAS</Text>
                <TouchableOpacity style={styles.sheetRow} onPress={() => { setActiveSub(null); setSheet(null); }}>
                  <Text style={[styles.sheetRowText, !activeSub && styles.sheetRowActive]}>Desativado</Text>
                  {!activeSub && <Ionicons name="checkmark" size={20} color="#E50914" />}
                </TouchableOpacity>
                {availSubs.map(([lang]) => (
                  <TouchableOpacity key={lang} style={styles.sheetRow} onPress={() => { setActiveSub(lang); setSheet(null); }}>
                    <Text style={[styles.sheetRowText, activeSub === lang && styles.sheetRowActive]}>
                      {SUB_LABELS[lang] || lang}
                    </Text>
                    {activeSub === lang && <Ionicons name="checkmark" size={20} color="#E50914" />}
                  </TouchableOpacity>
                ))}
              </>}
              {availVer.length === 0 && availSubs.length === 0 && (
                <Text style={styles.sheetEmpty}>Nenhuma opção disponível</Text>
              )}
            </>}

            {/* TEMPORIZADOR */}
            {sheet === 'timer' && <>
              <Text style={styles.sheetTitle}>Temporizador de sono</Text>
              {timerRemaining != null && (
                <TouchableOpacity style={styles.sheetRow} onPress={cancelTimer}>
                  <Text style={[styles.sheetRowText, { color: '#E50914' }]}>
                    Cancelar ({fmtMin(timerRemaining)} restantes)
                  </Text>
                </TouchableOpacity>
              )}
              {TIMER_OPTS.map(opt => (
                <TouchableOpacity key={opt.ms} style={styles.sheetRow} onPress={() => startTimer(opt.ms)}>
                  <Text style={styles.sheetRowText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </>}

            {/* EPISÓDIOS */}
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
                                seriesId: seriesId || undefined,
                                currentVersion: activeVer,
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

  // TOP
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  iconPad: { padding: 10 },
  titleText: {
    flex: 1, color: '#fff', fontSize: 16, fontWeight: '700',
    textAlign: 'center', paddingHorizontal: 6,
  },
  timerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  timerBtnText: { color: '#fff', fontSize: 13 },

  // MIDDLE
  middleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },

  // BRIGHTNESS
  brightnessCol: { width: 44, alignItems: 'center', gap: 12, paddingVertical: 20 },
  sliderWrap: { width: 4, height: SLIDER_H, position: 'relative', overflow: 'visible' },
  sliderBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 },
  sliderFill: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 2 },
  sliderHandle: {
    position: 'absolute', left: -7,
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },

  // CENTER
  centerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 44 },
  seekBtn: { padding: 10 },
  seekWrap: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  seekNum: { position: 'absolute', color: '#fff', fontSize: 12, fontWeight: '800' },
  playPauseBtn: { padding: 10 },

  // SKIP INTRO
  skipIntroBtn: {
    position: 'absolute', right: 20, bottom: 90,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 4,
  },
  skipIntroText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // BOTTOM
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
    elevation: 4, shadowColor: '#E50914', shadowOpacity: 0.6, shadowRadius: 6,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, marginBottom: 6 },
  timeText: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },

  // ACTION BAR
  actionBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  actionBtnText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  actionDiv: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.15)' },

  // LOCK
  lockScreen: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'flex-start', paddingBottom: 28, paddingLeft: 20 },
  unlockPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
  unlockText: { color: '#fff', fontSize: 13 },

  // NEXT CARD
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

  // SHEETS
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
