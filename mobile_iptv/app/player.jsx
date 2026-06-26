import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, StatusBar, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';

export default function PlayerScreen() {
  const { url, name, logo } = useLocalSearchParams();
  const router     = useRouter();
  const navigation = useNavigation();
  const videoRef   = useRef(null);

  const [status,   setStatus]   = useState({});
  const [error,    setError]    = useState(null);
  const [controls, setControls] = useState(true);
  const hideTimer  = useRef(null);

  // Esconde header nativo para tela cheia
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    return () => navigation.setOptions({ headerShown: true });
  }, []);

  function showControls() {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 4000);
  }

  useEffect(() => {
    showControls();
    return () => clearTimeout(hideTimer.current);
  }, []);

  const isPlaying = status.isPlaying;
  const isLoading = status.isBuffering || (!status.isLoaded && !error);

  async function togglePlay() {
    if (!videoRef.current) return;
    if (isPlaying) await videoRef.current.pauseAsync();
    else await videoRef.current.playAsync();
    showControls();
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <TouchableOpacity style={styles.videoWrap} activeOpacity={1} onPress={showControls}>
        <Video
          ref={videoRef}
          source={{ uri: url }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping={false}
          onPlaybackStatusUpdate={s => {
            setStatus(s);
            if (s.error) setError('Erro ao reproduzir: ' + s.error);
          }}
          onError={e => setError('Não foi possível reproduzir este canal.\n' + JSON.stringify(e))}
        />

        {/* Buffering */}
        {isLoading && !error && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#c91c2c" />
            <Text style={styles.bufferingText}>Carregando canal…</Text>
          </View>
        )}

        {/* Error */}
        {!!error && (
          <View style={styles.overlay}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Canal indisponível</Text>
            <Text style={styles.errorMsg}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => { setError(null); videoRef.current?.replayAsync(); }}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Controls overlay */}
        {controls && !error && (
          <View style={styles.controlsLayer} pointerEvents="box-none">
            {/* Top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <Text style={styles.backBtnText}>← Voltar</Text>
              </TouchableOpacity>
              <View style={styles.channelInfo}>
                {!!logo && <Image source={{ uri: logo }} style={styles.channelLogo} resizeMode="contain" />}
                <Text style={styles.channelName} numberOfLines={1}>{name}</Text>
              </View>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>AO VIVO</Text>
              </View>
            </View>

            {/* Center play/pause */}
            <TouchableOpacity style={styles.centerBtn} onPress={togglePlay} activeOpacity={0.8}>
              <View style={styles.playCircle}>
                <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
              </View>
            </TouchableOpacity>

            {/* Bottom bar */}
            <View style={styles.bottomBar}>
              <Text style={styles.urlText} numberOfLines={1}>{url}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoWrap: { flex: 1 },
  video: { flex: 1, backgroundColor: '#000' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  bufferingText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  errorIcon: { fontSize: 48 },
  errorTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  errorMsg: { color: '#666', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { marginTop: 8, backgroundColor: '#c91c2c', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '700' },

  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingTop: 20,
    backgroundColor: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
  },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 14 },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  channelInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  channelLogo: { width: 40, height: 30, borderRadius: 4 },
  channelName: { color: '#fff', fontWeight: '700', fontSize: 16, flex: 1 },

  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#c91c2c', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 1 },

  centerBtn: { alignSelf: 'center' },
  playCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  playIcon: { fontSize: 30, color: '#fff' },

  bottomBar: { padding: 16, paddingBottom: 20 },
  urlText: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
});
