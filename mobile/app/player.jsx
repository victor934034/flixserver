import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ActivityIndicator, StatusBar, PanResponder,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';

const { width, height } = Dimensions.get('window');

export default function PlayerScreen() {
  const { url, title, id, type, audioUrl } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);
  const hideTimer = useRef(null);

  const [status, setStatus] = useState({});
  const [showControls, setShowControls] = useState(true);
  const [muted, setMuted] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(url);

  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    scheduleHide();
    return () => {
      StatusBar.setHidden(false, 'fade');
      clearTimeout(hideTimer.current);
    };
  }, []);

  const scheduleHide = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  };

  const toggleControls = () => {
    setShowControls(v => !v);
    if (!showControls) scheduleHide();
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    status.isPlaying
      ? await videoRef.current.pauseAsync()
      : await videoRef.current.playAsync();
    scheduleHide();
  };

  const seek = async (seconds) => {
    if (!videoRef.current) return;
    const pos = Math.max(0, (status.positionMillis || 0) + seconds * 1000);
    await videoRef.current.setPositionAsync(pos);
    scheduleHide();
  };

  const saveProgress = useCallback(async () => {
    if (!id || !status.positionMillis) return;
    try {
      await api.post('/history', {
        content_type: type === 'episode' ? 'episode' : 'movie',
        content_id: id,
        progress: Math.floor(status.positionMillis / 1000),
        duration: Math.floor((status.durationMillis || 0) / 1000),
      });
    } catch {}
  }, [id, type, status.positionMillis, status.durationMillis]);

  useEffect(() => {
    const interval = setInterval(saveProgress, 10000);
    return () => clearInterval(interval);
  }, [saveProgress]);

  const fmt = (ms) => {
    const s = Math.floor((ms || 0) / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${pad(m % 60)}:${pad(s % 60)}`;
    return `${m}:${pad(s % 60)}`;
  };
  const pad = (n) => String(n).padStart(2, '0');

  const progress = status.durationMillis
    ? (status.positionMillis || 0) / status.durationMillis
    : 0;

  const seekByTap = (event) => {
    if (!videoRef.current || !status.durationMillis) return;
    const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
    videoRef.current.setPositionAsync(ratio * status.durationMillis);
  };

  return (
    <View style={styles.root}>
      <TouchableOpacity activeOpacity={1} style={styles.videoWrap} onPress={toggleControls}>
        <Video
          ref={videoRef}
          source={{ uri: currentUrl }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isMuted={muted}
          onPlaybackStatusUpdate={setStatus}
          progressUpdateIntervalMillis={500}
        />

        {status.isBuffering && (
          <View style={styles.buffering}>
            <ActivityIndicator size="large" color="#E50914" />
          </View>
        )}

        {showControls && (
          <View style={styles.overlay}>
            {/* Top bar */}
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => { saveProgress(); router.back(); }}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setMuted(m => !m)}>
                <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Double-tap zones for seek */}
            <View style={styles.doubleTapRow} pointerEvents="none" />

            {/* Center controls */}
            <View style={styles.center}>
              <TouchableOpacity onPress={() => seek(-10)} style={styles.seekBtn}>
                <Ionicons name="play-back" size={36} color="#fff" />
                <Text style={styles.seekLabel}>10s</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
                <Ionicons
                  name={status.isPlaying ? 'pause-circle' : 'play-circle'}
                  size={70} color="#fff"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => seek(10)} style={styles.seekBtn}>
                <Ionicons name="play-forward" size={36} color="#fff" />
                <Text style={styles.seekLabel}>10s</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom bar */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.time}>{fmt(status.positionMillis)}</Text>
              <TouchableOpacity
                style={styles.progressTouchable}
                onPress={seekByTap}
                activeOpacity={1}
              >
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${progress * 100}%` }]} />
                  <View style={[styles.thumb, { left: `${Math.min(progress * 100, 98)}%` }]} />
                </View>
              </TouchableOpacity>
              <Text style={styles.time}>{fmt(status.durationMillis)}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  videoWrap: { flex: 1 },
  video: { width, height },
  buffering: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 8,
  },
  iconBtn: { padding: 10 },
  titleText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', marginHorizontal: 8 },
  doubleTapRow: { flex: 1 },
  center: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 44,
  },
  seekBtn: { alignItems: 'center', gap: 3 },
  seekLabel: { color: '#ccc', fontSize: 11, fontWeight: '600' },
  playBtn: {},
  bottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 10,
  },
  time: { color: '#ddd', fontSize: 12, minWidth: 46, textAlign: 'center' },
  progressTouchable: { flex: 1, paddingVertical: 16 },
  track: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2, position: 'relative',
  },
  fill: { height: '100%', backgroundColor: '#E50914', borderRadius: 2 },
  thumb: {
    position: 'absolute', top: -6, marginLeft: -8,
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#E50914',
  },
});
