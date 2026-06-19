import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableHighlight, Animated,
  Dimensions, BackHandler, useTVEventHandler,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');
const HIDE_DELAY = 4000;

function fmtTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function PlayerScreen({ navigation, route }) {
  const { url, title, poster } = route.params;

  const videoRef = useRef(null);
  const [status, setStatus] = useState({});
  const [showCtrl, setShowCtrl] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const ctrlOpacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef(null);

  const isPlaying = status.isPlaying ?? false;
  const position = status.positionMillis ?? 0;
  const duration = status.durationMillis ?? 0;
  const progress = duration > 0 ? position / duration : 0;

  // ── Back button ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => handler.remove();
  }, []);

  // ── Show / hide controls ───────────────────────────────────────────────────
  const showControls = useCallback(() => {
    clearTimeout(hideTimer.current);
    setShowCtrl(true);
    Animated.timing(ctrlOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(hideControls, HIDE_DELAY);
  }, []);

  const hideControls = useCallback(() => {
    Animated.timing(ctrlOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
      setShowCtrl(false)
    );
  }, []);

  useEffect(() => {
    showControls();
    return () => clearTimeout(hideTimer.current);
  }, []);

  // ── Seek ────────────────────────────────────────────────────────────────────
  const seekBy = useCallback(async (deltaMs) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(duration, position + deltaMs));
    await videoRef.current.setPositionAsync(target);
    showControls();
  }, [position, duration, showControls]);

  // ── Play / pause ────────────────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    if (isPlaying) await videoRef.current.pauseAsync();
    else await videoRef.current.playAsync();
    showControls();
  }, [isPlaying, showControls]);

  // ── TV remote events ────────────────────────────────────────────────────────
  useTVEventHandler(evt => {
    if (!evt?.eventType) return;
    switch (evt.eventType) {
      case 'select':
      case 'playPause':
        togglePlay();
        break;
      case 'left':
        seekBy(-15000);
        break;
      case 'right':
        seekBy(15000);
        break;
      case 'up':
      case 'down':
        showControls();
        break;
      case 'back':
        navigation.goBack();
        break;
    }
  });

  return (
    <View style={styles.container}>
      {/* Video */}
      <Video
        ref={videoRef}
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        onPlaybackStatusUpdate={s => {
          setStatus(s);
          if (s.didJustFinish) navigation.goBack();
        }}
      />

      {/* Controls overlay */}
      <Animated.View style={[styles.overlay, { opacity: ctrlOpacity }]} pointerEvents="none">
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.backArea}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </View>
          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
        </View>

        {/* Center icon */}
        <View style={styles.centerIcon}>
          <Ionicons
            name={isPlaying ? 'pause-circle' : 'play-circle'}
            size={72}
            color="rgba(255,255,255,0.85)"
          />
        </View>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <Text style={styles.timeText}>{fmtTime(position)}</Text>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.progressDot, { left: `${progress * 100}%` }]} />
          </View>

          <Text style={styles.timeText}>{fmtTime(duration)}</Text>
        </View>

        {/* Hint */}
        <View style={styles.hintRow}>
          <Text style={styles.hint}>◀  -15s</Text>
          <Text style={styles.hint}>OK  Play/Pause</Text>
          <Text style={styles.hint}>+15s  ▶</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 20,
    background: 'transparent',
    backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
  },
  backArea: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20, padding: 8, marginRight: 20,
  },
  titleText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Center
  centerIcon: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    top: 80, bottom: 120,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 48,
    gap: 16,
  },
  timeText: { color: '#fff', fontSize: 16, fontWeight: '600', minWidth: 56 },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#E50914',
    borderRadius: 2,
  },
  progressDot: {
    position: 'absolute',
    top: -6,
    width: 16, height: 16,
    borderRadius: 8,
    backgroundColor: '#E50914',
    marginLeft: -8,
  },

  // Hints
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    paddingBottom: 24,
  },
  hint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
});
