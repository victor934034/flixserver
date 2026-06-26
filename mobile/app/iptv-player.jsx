import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Image, Animated,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as KeepAwake from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function IptvPlayerScreen() {
  const { url, name, logo } = useLocalSearchParams();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const player = useVideoPlayer({ uri: url }, p => { p.play(); });

  const { isPlaying = false } = useEvent(player, 'playingChange', { isPlaying: false });
  const { status = 'idle' }   = useEvent(player, 'statusChange',  { status: 'idle' });

  const isBuffering = (status === 'idle' || status === 'loading');
  const isError     = status === 'error';

  const ctrlOpacity  = useRef(new Animated.Value(1)).current;
  const [ctrlVisible, setCtrlVisible] = useState(true);
  const hideTimerRef = useRef(null);
  const schedHideRef = useRef(null);

  const schedHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => fadeCtrl(false), 4000);
  }, []);
  schedHideRef.current = schedHide;

  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    KeepAwake.activateKeepAwakeAsync('iptv-player');
    schedHide();
    return () => {
      StatusBar.setHidden(false, 'fade');
      ScreenOrientation.unlockAsync();
      KeepAwake.deactivateKeepAwake('iptv-player');
      clearTimeout(hideTimerRef.current);
    };
  }, []);

  const fadeCtrl = (show) => {
    setCtrlVisible(show);
    Animated.timing(ctrlOpacity, { toValue: show ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  };

  const onTap = () => {
    const next = !ctrlVisible;
    fadeCtrl(next);
    if (next) schedHideRef.current?.();
  };

  const togglePlay = () => {
    if (isPlaying) player.pause();
    else player.play();
    schedHideRef.current?.();
  };

  const retry = () => {
    player.replace({ uri: url });
    player.play();
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
      />

      {isBuffering && !isError && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.bufText}>Carregando canal…</Text>
        </View>
      )}

      {isError && (
        <View style={styles.overlay}>
          <Text style={styles.errIcon}>⚠️</Text>
          <Text style={styles.errTitle}>Canal indisponível</Text>
          <Text style={styles.errSub}>Verifique sua conexão ou tente outro canal.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.8}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tap area */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onTap} activeOpacity={1} />

      {/* Controls */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: ctrlOpacity }]}
        pointerEvents={ctrlVisible ? 'box-none' : 'none'}
      >
        {/* Dark gradient top */}
        <View style={styles.gradTop} pointerEvents="none" />
        {/* Dark gradient bottom */}
        <View style={styles.gradBottom} pointerEvents="none" />

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          {!!logo && (
            <Image source={{ uri: logo }} style={styles.channelLogo} resizeMode="contain" />
          )}
          <Text style={styles.channelName} numberOfLines={1}>{name}</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>AO VIVO</Text>
          </View>
        </View>

        {/* Center play/pause */}
        <View style={styles.center} pointerEvents="box-none">
          <TouchableOpacity style={styles.playBtn} onPress={togglePlay} activeOpacity={0.7}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={52}
              color="#fff"
              style={!isPlaying ? { marginLeft: 6 } : undefined}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={styles.liveLabel}>📡 Transmissão ao vivo</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  bufText:      { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
  errIcon:      { fontSize: 44 },
  errTitle:     { color: '#fff', fontSize: 18, fontWeight: '700' },
  errSub:       { color: '#555', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:     { backgroundColor: '#E50914', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 9, marginTop: 8 },
  retryText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  backLink:     { paddingVertical: 10 },
  backLinkText: { color: '#666', fontSize: 13 },

  gradTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 130,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  gradBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn:     { padding: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)' },
  channelLogo: { width: 44, height: 32, borderRadius: 4 },
  channelName: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  liveBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E50914', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveText:    { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 1 },

  center: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  liveLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
});
