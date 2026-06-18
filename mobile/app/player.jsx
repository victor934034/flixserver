import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, useWindowDimensions, Modal,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as KeepAwake from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';

const VERSION_LABELS = {
  dubbing: '🎙 Dublado',
  subtitled: '💬 Legendado',
  cinema: '🎞 Cinema',
  '4k': '4K UHD',
};

export default function PlayerScreen() {
  const params = useLocalSearchParams();
  const { title, id, type } = params;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);
  const hideTimer = useRef(null);
  const { width, height } = useWindowDimensions();

  const versions = params.versions ? JSON.parse(params.versions) : { dubbing: params.url };
  const availableVersions = Object.keys(versions).filter(k => versions[k]);
  const initVersion = params.currentVersion && versions[params.currentVersion]
    ? params.currentVersion
    : availableVersions[0];

  const subtitles = params.subtitles ? JSON.parse(params.subtitles) : {};
  const availableSubtitles = Object.entries(subtitles).filter(([, url]) => url);
  const SUB_LABELS = { pt: '🇧🇷 PT', en: '🇺🇸 EN', es: '🇪🇸 ES' };

  const [activeVersion, setActiveVersion] = useState(initVersion);
  const [status, setStatus] = useState({});
  const [showControls, setShowControls] = useState(true);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [showSubPicker, setShowSubPicker] = useState(false);
  const [activeSub, setActiveSub] = useState(null);
  const [locked, setLocked] = useState(false);
  const [savedPosition, setSavedPosition] = useState(null);

  const currentUrl = versions[activeVersion];

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
    };
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  const toggleControls = () => {
    if (locked) return;
    setShowControls(v => {
      if (!v) scheduleHide();
      return !v;
    });
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

  const switchVersion = async (version) => {
    if (version === activeVersion) { setShowVersionPicker(false); return; }
    setSavedPosition(status.positionMillis || 0);
    setActiveVersion(version);
    setShowVersionPicker(false);
    scheduleHide();
  };

  const onVideoLoad = async () => {
    if (savedPosition != null && videoRef.current) {
      await videoRef.current.setPositionAsync(savedPosition);
      setSavedPosition(null);
    }
  };

  const fmt = (ms) => {
    const s = Math.floor((ms || 0) / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const progress = status.durationMillis
    ? (status.positionMillis || 0) / status.durationMillis
    : 0;

  const seekByTap = (event) => {
    if (!videoRef.current || !status.durationMillis) return;
    const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
    videoRef.current.setPositionAsync(ratio * status.durationMillis);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000', width, height }}>
      <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={toggleControls}>
        <Video
          ref={videoRef}
          source={{ uri: currentUrl }}
          style={{ width, height }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          onPlaybackStatusUpdate={setStatus}
          onLoad={onVideoLoad}
          progressUpdateIntervalMillis={500}
          textTracks={availableSubtitles.map(([lang, url]) => ({
            title: SUB_LABELS[lang] || lang,
            language: lang,
            type: 'text/vtt',
            uri: url,
          }))}
          selectedTextTrack={activeSub
            ? { type: 'language', value: activeSub }
            : { type: 'disabled' }
          }
        />

        {status.isBuffering && !status.isPlaying && (
          <View style={styles.buffering}>
            <ActivityIndicator size="large" color="#E50914" />
          </View>
        )}

        {showControls && !locked && (
          <View style={styles.overlay}>
            <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => { saveProgress(); router.back(); }}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
              {availableVersions.length > 1 && (
                <TouchableOpacity style={styles.versionBtn} onPress={() => setShowVersionPicker(true)}>
                  <Ionicons name="musical-notes-outline" size={16} color="#fff" />
                  <Text style={styles.versionBtnText}>
                    {VERSION_LABELS[activeVersion] || activeVersion}
                  </Text>
                </TouchableOpacity>
              )}
              {availableSubtitles.length > 0 && (
                <TouchableOpacity
                  style={[styles.versionBtn, activeSub && { borderWidth: 1, borderColor: '#E50914' }]}
                  onPress={() => setShowSubPicker(true)}
                >
                  <Text style={styles.versionBtnText}>{activeSub ? SUB_LABELS[activeSub] : 'CC'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.iconBtn} onPress={() => setLocked(true)}>
                <Ionicons name="lock-open-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.center}>
              <TouchableOpacity onPress={() => seek(-10)} style={styles.seekBtn}>
                <Ionicons name="play-back" size={36} color="#fff" />
                <Text style={styles.seekLabel}>10s</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
                <Ionicons
                  name={status.isPlaying ? 'pause-circle' : 'play-circle'}
                  size={72} color="#fff"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => seek(10)} style={styles.seekBtn}>
                <Ionicons name="play-forward" size={36} color="#fff" />
                <Text style={styles.seekLabel}>10s</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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

        {locked && (
          <TouchableOpacity
            style={styles.lockOverlay}
            onPress={() => setLocked(false)}
            activeOpacity={1}
          >
            <View style={styles.unlockHint}>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.unlockText}>Toque para desbloquear</Text>
            </View>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Modal
        visible={showVersionPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVersionPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBg}
          activeOpacity={1}
          onPress={() => setShowVersionPicker(false)}
        >
          <View style={styles.versionSheet}>
            <Text style={styles.versionTitle}>Faixa de Áudio</Text>
            {availableVersions.map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.versionItem, v === activeVersion && styles.versionItemActive]}
                onPress={() => switchVersion(v)}
              >
                <Text style={[styles.versionItemText, v === activeVersion && styles.versionItemTextActive]}>
                  {VERSION_LABELS[v] || v}
                </Text>
                {v === activeVersion && <Ionicons name="checkmark" size={18} color="#E50914" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showSubPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBg}
          activeOpacity={1}
          onPress={() => setShowSubPicker(false)}
        >
          <View style={styles.versionSheet}>
            <Text style={styles.versionTitle}>Legendas</Text>
            <TouchableOpacity
              style={[styles.versionItem, !activeSub && styles.versionItemActive]}
              onPress={() => { setActiveSub(null); setShowSubPicker(false); }}
            >
              <Text style={[styles.versionItemText, !activeSub && styles.versionItemTextActive]}>
                Desativado
              </Text>
              {!activeSub && <Ionicons name="checkmark" size={18} color="#E50914" />}
            </TouchableOpacity>
            {availableSubtitles.map(([lang]) => (
              <TouchableOpacity
                key={lang}
                style={[styles.versionItem, activeSub === lang && styles.versionItemActive]}
                onPress={() => { setActiveSub(lang); setShowSubPicker(false); }}
              >
                <Text style={[styles.versionItemText, activeSub === lang && styles.versionItemTextActive]}>
                  {SUB_LABELS[lang] || lang}
                </Text>
                {activeSub === lang && <Ionicons name="checkmark" size={18} color="#E50914" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  buffering: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8, gap: 6,
  },
  iconBtn: { padding: 10 },
  titleText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  versionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  versionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  center: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 48,
  },
  seekBtn: { alignItems: 'center', gap: 4 },
  seekLabel: { color: '#ddd', fontSize: 11, fontWeight: '600' },
  playBtn: {},
  bottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 12,
  },
  time: { color: '#ddd', fontSize: 12, minWidth: 50, textAlign: 'center' },
  progressTouchable: { flex: 1, paddingVertical: 16 },
  track: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2, position: 'relative',
  },
  fill: { height: '100%', backgroundColor: '#E50914', borderRadius: 2 },
  thumb: {
    position: 'absolute', top: -6, marginLeft: -8,
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#E50914',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end', alignItems: 'flex-start',
    paddingBottom: 20, paddingLeft: 20,
  },
  unlockHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  unlockText: { color: '#fff', fontSize: 13 },
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center',
  },
  versionSheet: {
    backgroundColor: '#1c1c1c', borderRadius: 16,
    padding: 20, minWidth: 240,
  },
  versionTitle: {
    color: '#fff', fontSize: 16, fontWeight: '700',
    marginBottom: 16, textAlign: 'center',
  },
  versionItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4,
  },
  versionItemActive: { backgroundColor: 'rgba(229,9,20,0.15)' },
  versionItemText: { color: '#b3b3b3', fontSize: 15 },
  versionItemTextActive: { color: '#fff', fontWeight: '700' },
});
