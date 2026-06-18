'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, useWindowDimensions,
  Animated, Pressable, Image,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as KeepAwake from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';

const VERSION_LABELS = {
  dubbing:   '🎙 Dublado',
  subtitled: '💬 Legendado',
  cinema:    '🎞 Cinema',
  '4k':      '4K UHD',
};
const SUB_LABELS = { pt: 'Português 🇧🇷', en: 'English 🇺🇸', es: 'Español 🇪🇸' };

function fmt(ms) {
  const s = Math.floor((ms || 0) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

export default function PlayerScreen() {
  const params = useLocalSearchParams();
  const { title, id, type } = params;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);
  const hideTimer = useRef(null);
  const countdownTimer = useRef(null);
  const { width, height } = useWindowDimensions();

  const versions = params.versions ? JSON.parse(params.versions) : { dubbing: params.url };
  const availableVersions = Object.keys(versions).filter(k => versions[k]);
  const initVersion = params.currentVersion && versions[params.currentVersion]
    ? params.currentVersion : availableVersions[0];

  const subtitles = params.subtitles ? JSON.parse(params.subtitles) : {};
  const availableSubs = Object.entries(subtitles).filter(([, u]) => u);

  const nextEpisode = params.nextEpisode ? JSON.parse(params.nextEpisode) : null;
  const introEnd = params.introEnd ? Number(params.introEnd) : 0; // segundos

  const [activeVersion, setActiveVersion] = useState(initVersion);
  const [status, setStatus] = useState({});
  const [showControls, setShowControls] = useState(true);
  const [showVersionSheet, setShowVersionSheet] = useState(false);
  const [showSubSheet, setShowSubSheet] = useState(false);
  const [activeSub, setActiveSub] = useState(null);
  const [locked, setLocked] = useState(false);
  const [savedPosition, setSavedPosition] = useState(null);
  const [countdown, setCountdown] = useState(null); // null | number (5→0)
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  const posMs = status.positionMillis || 0;
  const durMs = status.durationMillis || 0;
  const progress = durMs > 0 ? posMs / durMs : 0;
  const remainingMs = durMs - posMs;
  const isPlaying = status.isPlaying;
  const isEnded = status.didJustFinish || (durMs > 0 && remainingMs < 500);

  // Pular abertura: aparece nos primeiros `introEnd` segundos
  const showSkipIntro = introEnd > 0 && posMs / 1000 < introEnd && posMs > 3000;
  // Card de próximo ep: aparece nos últimos 30s ou quando acabou
  const showNextCard = nextEpisode && (remainingMs > 0 && remainingMs < 30000 || isEnded);

  const currentUrl = versions[activeVersion];

  // Setup inicial
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    KeepAwake.activateKeepAwakeAsync();
    scheduleHide();
    return () => {
      StatusBar.setHidden(false, 'fade');
      ScreenOrientation.unlockAsync();
      KeepAwake.deactivateKeepAwake();
      clearTimeout(hideTimer.current);
      clearInterval(countdownTimer.current);
    };
  }, []);

  // Countdown ao fim do episódio
  useEffect(() => {
    if (showNextCard && nextEpisode && countdown === null) {
      setCountdown(5);
    }
    if (!showNextCard) {
      setCountdown(null);
      clearInterval(countdownTimer.current);
    }
  }, [showNextCard]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { goNextEpisode(); return; }
    countdownTimer.current = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000);
    return () => clearTimeout(countdownTimer.current);
  }, [countdown]);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!showVersionSheet && !showSubSheet) showControlsAnimated(false);
    }, 4000);
  }, [showVersionSheet, showSubSheet]);

  function showControlsAnimated(show) {
    setShowControls(show);
    Animated.timing(controlsOpacity, {
      toValue: show ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  const toggleControls = () => {
    if (locked) return;
    if (showVersionSheet || showSubSheet) {
      setShowVersionSheet(false);
      setShowSubSheet(false);
      return;
    }
    const next = !showControls;
    showControlsAnimated(next);
    if (next) scheduleHide();
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    isPlaying ? await videoRef.current.pauseAsync() : await videoRef.current.playAsync();
    scheduleHide();
  };

  const seek = async (seconds) => {
    if (!videoRef.current) return;
    const pos = Math.max(0, posMs + seconds * 1000);
    await videoRef.current.setPositionAsync(pos);
    scheduleHide();
  };

  const seekByTap = (event) => {
    if (!videoRef.current || !durMs) return;
    const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
    videoRef.current.setPositionAsync(ratio * durMs);
  };

  const skipIntro = async () => {
    await videoRef.current?.setPositionAsync(introEnd * 1000);
  };

  const goNextEpisode = () => {
    if (!nextEpisode) return;
    clearInterval(countdownTimer.current);
    setCountdown(null);
    const url = nextEpisode.file_dubbing || nextEpisode.file_subtitled || nextEpisode.file_cinema;
    if (!url) return;
    saveProgress();
    router.replace({
      pathname: '/player',
      params: {
        url,
        title: nextEpisode.title,
        id: nextEpisode.id,
        type: 'episode',
        currentVersion: activeVersion,
        versions: JSON.stringify({
          dubbing: nextEpisode.file_dubbing || null,
          subtitled: nextEpisode.file_subtitled || null,
          cinema: nextEpisode.file_cinema || null,
        }),
        subtitles: JSON.stringify({
          pt: nextEpisode.subtitle_pt || null,
          en: nextEpisode.subtitle_en || null,
          es: nextEpisode.subtitle_es || null,
        }),
        nextEpisode: nextEpisode.next ? JSON.stringify(nextEpisode.next) : undefined,
        introEnd: nextEpisode.intro_end ? String(nextEpisode.intro_end) : undefined,
      },
    });
  };

  const switchVersion = async (v) => {
    if (v === activeVersion) { setShowVersionSheet(false); return; }
    setSavedPosition(posMs);
    setActiveVersion(v);
    setShowVersionSheet(false);
    scheduleHide();
  };

  const switchSub = (lang) => {
    setActiveSub(lang);
    setShowSubSheet(false);
    const tracks = videoRef.current?.props?.textTracks || [];
    // expo-av handles this via selectedTextTrack prop
    scheduleHide();
  };

  const saveProgress = useCallback(async () => {
    if (!id || !posMs) return;
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
    const interval = setInterval(saveProgress, 10000);
    return () => clearInterval(interval);
  }, [saveProgress]);

  const onVideoLoad = async () => {
    if (savedPosition != null && videoRef.current) {
      await videoRef.current.setPositionAsync(savedPosition);
      setSavedPosition(null);
    }
  };

  const anySheet = showVersionSheet || showSubSheet;

  return (
    <View style={{ flex: 1, backgroundColor: '#000', width, height }}>
      {/* Vídeo */}
      <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls}>
        <Video
          ref={videoRef}
          source={{ uri: currentUrl }}
          style={{ width, height }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          onPlaybackStatusUpdate={setStatus}
          onLoad={onVideoLoad}
          progressUpdateIntervalMillis={500}
          textTracks={availableSubs.map(([lang, url]) => ({
            title: SUB_LABELS[lang] || lang,
            language: lang,
            type: 'text/vtt',
            uri: url,
          }))}
          selectedTextTrack={activeSub
            ? { type: 'language', value: activeSub }
            : { type: 'disabled' }}
        />
        {status.isBuffering && !isPlaying && (
          <View style={styles.buffering}>
            <ActivityIndicator size="large" color="#E50914" />
          </View>
        )}
      </Pressable>

      {/* Overlay de controles */}
      {!locked && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: controlsOpacity }]} pointerEvents={showControls ? 'box-none' : 'none'}>

          {/* TOP BAR */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => { saveProgress(); router.back(); }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.titleBlock}>
              <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
            </View>

            {/* Legenda */}
            {availableSubs.length > 0 && (
              <TouchableOpacity
                style={[styles.topBtn, activeSub && styles.topBtnActive]}
                onPress={() => { setShowSubSheet(v => !v); setShowVersionSheet(false); scheduleHide(); }}
              >
                <Text style={styles.topBtnText}>CC</Text>
              </TouchableOpacity>
            )}

            {/* Versão */}
            {availableVersions.length > 1 && (
              <TouchableOpacity
                style={styles.topBtn}
                onPress={() => { setShowVersionSheet(v => !v); setShowSubSheet(false); scheduleHide(); }}
              >
                <Ionicons name="musical-notes-outline" size={16} color="#fff" />
              </TouchableOpacity>
            )}

            {/* Lock */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => setLocked(true)}>
              <Ionicons name="lock-open-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* CENTER */}
          <Pressable style={styles.centerArea} onPress={toggleControls}>
            <View style={styles.centerBtns}>
              <TouchableOpacity onPress={() => seek(-10)} style={styles.seekBtn}>
                <Ionicons name="play-back" size={30} color="#fff" />
                <Text style={styles.seekLabel}>10</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={togglePlay} style={styles.playBtn} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
                <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={68} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => seek(10)} style={styles.seekBtn}>
                <Ionicons name="play-forward" size={30} color="#fff" />
                <Text style={styles.seekLabel}>10</Text>
              </TouchableOpacity>
            </View>
          </Pressable>

          {/* BOTTOM BAR */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.time}>{fmt(posMs)}</Text>

            {/* Barra de progresso */}
            <TouchableOpacity style={styles.progressTouchable} onPress={seekByTap} activeOpacity={1}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress * 100}%` }]} />
                <View style={[styles.thumb, { left: `${Math.min(progress * 100, 98)}%` }]} />
              </View>
            </TouchableOpacity>

            <Text style={styles.time}>{fmt(durMs)}</Text>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                const v = videoRef.current;
                if (v) {
                  // Toggle entre 16:9 e fullscreen
                  ScreenOrientation.lockAsync(
                    ScreenOrientation.OrientationLock.LANDSCAPE
                  );
                }
              }}
            >
              <Ionicons name="expand-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Botão de unlock (tela bloqueada) */}
      {locked && (
        <TouchableOpacity style={styles.lockOverlay} onPress={() => setLocked(false)} activeOpacity={1}>
          <View style={styles.unlockHint}>
            <Ionicons name="lock-closed" size={16} color="#fff" />
            <Text style={styles.unlockText}>Toque para desbloquear</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* PULAR ABERTURA */}
      {showSkipIntro && !anySheet && (
        <TouchableOpacity style={styles.skipIntroBtn} onPress={skipIntro} activeOpacity={0.85}>
          <Text style={styles.skipIntroText}>Pular Abertura</Text>
          <Ionicons name="play-skip-forward" size={14} color="#fff" />
        </TouchableOpacity>
      )}

      {/* PRÓXIMO EPISÓDIO — card canto inferior direito */}
      {showNextCard && !anySheet && (
        <View style={[styles.nextCard, { bottom: Math.max(insets.bottom, 16) + 56 }]}>
          {nextEpisode.thumbnail_url && (
            <Image source={{ uri: nextEpisode.thumbnail_url }} style={styles.nextThumb} />
          )}
          <View style={styles.nextInfo}>
            <Text style={styles.nextLabel}>PRÓXIMO EPISÓDIO</Text>
            <Text style={styles.nextTitle} numberOfLines={1}>{nextEpisode.title || `Episódio ${nextEpisode.episode_number}`}</Text>
            {countdown !== null && (
              <Text style={styles.nextCountdown}>Começa em {countdown}s</Text>
            )}
          </View>
          <View style={styles.nextBtns}>
            <TouchableOpacity style={styles.nextPlayBtn} onPress={goNextEpisode}>
              <Ionicons name="play" size={16} color="#000" />
            </TouchableOpacity>
            {countdown !== null && (
              <TouchableOpacity style={styles.nextCancelBtn} onPress={() => { setCountdown(null); clearInterval(countdownTimer.current); }}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* SHEET — Legendas */}
      {showSubSheet && (
        <Pressable style={styles.sheetBg} onPress={() => setShowSubSheet(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Legendas</Text>
            <TouchableOpacity
              style={[styles.sheetItem, !activeSub && styles.sheetItemActive]}
              onPress={() => switchSub(null)}
            >
              <Text style={[styles.sheetItemText, !activeSub && styles.sheetItemTextActive]}>Desativado</Text>
              {!activeSub && <Ionicons name="checkmark" size={18} color="#E50914" />}
            </TouchableOpacity>
            {availableSubs.map(([lang]) => (
              <TouchableOpacity
                key={lang}
                style={[styles.sheetItem, activeSub === lang && styles.sheetItemActive]}
                onPress={() => switchSub(lang)}
              >
                <Text style={[styles.sheetItemText, activeSub === lang && styles.sheetItemTextActive]}>
                  {SUB_LABELS[lang] || lang}
                </Text>
                {activeSub === lang && <Ionicons name="checkmark" size={18} color="#E50914" />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      )}

      {/* SHEET — Versão de áudio */}
      {showVersionSheet && (
        <Pressable style={styles.sheetBg} onPress={() => setShowVersionSheet(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Faixa de Áudio</Text>
            {availableVersions.map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.sheetItem, v === activeVersion && styles.sheetItemActive]}
                onPress={() => switchVersion(v)}
              >
                <Text style={[styles.sheetItemText, v === activeVersion && styles.sheetItemTextActive]}>
                  {VERSION_LABELS[v] || v}
                </Text>
                {v === activeVersion && <Ionicons name="checkmark" size={18} color="#E50914" />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buffering: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },

  // TOP BAR
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 4,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
    backgroundColor: 'rgba(0,0,0,0)',
    backgroundImage: undefined,
  },
  iconBtn: { padding: 10 },
  titleBlock: { flex: 1, paddingHorizontal: 4 },
  titleText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  topBtn: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  topBtnActive: { borderColor: '#E50914', backgroundColor: 'rgba(229,9,20,0.2)' },
  topBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // CENTER
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerBtns: { flexDirection: 'row', alignItems: 'center', gap: 44 },
  seekBtn: { alignItems: 'center', gap: 2 },
  seekLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700' },
  playBtn: {},

  // BOTTOM BAR
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  time: { color: '#ddd', fontSize: 11, minWidth: 44, textAlign: 'center' },
  progressTouchable: { flex: 1, paddingVertical: 16 },
  track: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2, position: 'relative',
  },
  fill: { height: '100%', backgroundColor: '#E50914', borderRadius: 2 },
  thumb: {
    position: 'absolute', top: -7, marginLeft: -8,
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },

  // LOCK
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end', alignItems: 'flex-start',
    paddingBottom: 24, paddingLeft: 20,
  },
  unlockHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
  },
  unlockText: { color: '#fff', fontSize: 13 },

  // PULAR ABERTURA
  skipIntroBtn: {
    position: 'absolute',
    right: 20, bottom: 80,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 6,
  },
  skipIntroText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // PRÓXIMO EPISÓDIO
  nextCard: {
    position: 'absolute', right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    maxWidth: 280,
  },
  nextThumb: { width: 80, height: 52 },
  nextInfo: { flex: 1, paddingHorizontal: 10, paddingVertical: 8 },
  nextLabel: { color: '#E50914', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 3 },
  nextTitle: { color: '#fff', fontSize: 12, fontWeight: '600' },
  nextCountdown: { color: '#aaa', fontSize: 11, marginTop: 2 },
  nextBtns: { flexDirection: 'column', paddingRight: 8, gap: 6 },
  nextPlayBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  nextCancelBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },

  // SHEETS
  sheetBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 32, paddingHorizontal: 0,
    minHeight: 200,
  },
  sheetTitle: {
    color: '#fff', fontSize: 16, fontWeight: '700',
    textAlign: 'center', marginBottom: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
  },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 24,
  },
  sheetItemActive: { backgroundColor: 'rgba(229,9,20,0.08)' },
  sheetItemText: { color: '#aaa', fontSize: 16 },
  sheetItemTextActive: { color: '#fff', fontWeight: '700' },
});
