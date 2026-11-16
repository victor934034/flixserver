// Conversa do chat de suporte no app (usuário e admin).
// Tempo real por long polling: o servidor segura a requisição até chegar
// mensagem nova (ou ~20s) — chega na hora, sem ficar consultando sem parar.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, Alert, Linking, Modal, ActivityIndicator, AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import api from '../lib/api';

const MAX_MB = 100;

function fmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === now.toDateString()) return hm;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
}

function fmtSize(b) {
  if (!b) return '';
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function guessKind(mime, name) {
  if (/^image\//.test(mime || '') || /\.(jpe?g|png|gif|webp|heic)$/i.test(name || '')) return 'image';
  if (/^video\//.test(mime || '') || /\.(mp4|mov|m4v|webm|3gp|mkv)$/i.test(name || '')) return 'video';
  return 'file';
}

function VideoModal({ url, onClose }) {
  const player = useVideoPlayer(url, p => { p.play(); });
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls allowsFullscreen />
        <TouchableOpacity style={styles.viewerClose} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function Attachment({ m, onOpenImage, onOpenVideo }) {
  const url = m.attachment_url || m.localUri;
  if (!url) return null;
  if (m.attachment_type === 'image') {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => onOpenImage(url)}>
        <Image source={{ uri: url }} style={styles.media} resizeMode="cover" />
      </TouchableOpacity>
    );
  }
  if (m.attachment_type === 'video') {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => m.attachment_url && onOpenVideo(m.attachment_url)} style={[styles.media, styles.videoBox]}>
        <Ionicons name="play-circle" size={52} color="#fff" />
        <Text style={styles.videoName} numberOfLines={1}>{m.attachment_name || 'vídeo'}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={styles.file} onPress={() => m.attachment_url && Linking.openURL(m.attachment_url)} activeOpacity={0.8}>
      <Ionicons name="document-attach-outline" size={24} color="#fff" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.fileName} numberOfLines={1}>{m.attachment_name || 'arquivo'}</Text>
        <Text style={styles.fileSize}>{fmtSize(m.attachment_size)}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * props: listUrl, sendUrl, me ('user'|'admin'), emptyText, header (elemento opcional)
 */
export default function ChatThread({ listUrl, sendUrl, me, emptyText }) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(null); // { uri, name, mimeType, size, kind }
  const [viewImage, setViewImage] = useState(null);
  const [viewVideo, setViewVideo] = useState(null);
  const listRef = useRef(null);
  const lastAtRef = useRef(null);
  const wakeRef = useRef(0);

  const merge = useCallback((incoming) => {
    if (!incoming?.length) return;
    setMessages(prev => {
      const ids = new Set(prev.filter(m => m.id).map(m => m.id));
      const fresh = incoming.filter(m => !ids.has(m.id));
      if (!fresh.length) return prev;
      const drop = new Set();
      for (const f of fresh) {
        const t = prev.find(m => m.tempId && !drop.has(m.tempId) && m.status !== 'error'
          && m.sender === f.sender && (m.body || '') === (f.body || '') && !!m.attachment_type === !!f.attachment_type);
        if (t) drop.add(t.tempId);
      }
      return [...prev.filter(m => !drop.has(m.tempId)), ...fresh];
    });
    const last = incoming[incoming.length - 1];
    if (!lastAtRef.current || last.created_at > lastAtRef.current) lastAtRef.current = last.created_at;
  }, []);

  // Carga inicial + long polling (pausa com o app em segundo plano)
  useEffect(() => {
    let alive = true;
    let ctrl = null;
    let active = AppState.currentState === 'active';
    const sub = AppState.addEventListener('change', s => {
      const nowActive = s === 'active';
      if (nowActive && !active) wakeRef.current++;
      active = nowActive;
      if (!nowActive) ctrl?.abort();
    });

    (async () => {
      try {
        const { data } = await api.get(listUrl);
        if (!alive) return;
        merge(Array.isArray(data) ? data : data.messages || []);
      } catch {}
      if (alive) setLoading(false);

      let failures = 0;
      while (alive) {
        if (!active) { await new Promise(r => setTimeout(r, 1000)); continue; }
        ctrl = new AbortController();
        try {
          const { data } = await api.get(listUrl, {
            params: { after: lastAtRef.current || new Date(0).toISOString(), wait: 1 },
            signal: ctrl.signal,
            timeout: 35000,
          });
          if (!alive) break;
          merge(Array.isArray(data) ? data : data.messages || []);
          failures = 0;
        } catch {
          if (!alive) break;
          if (!active) continue;
          failures++;
          await new Promise(r => setTimeout(r, Math.min(10000, 1000 * failures)));
        }
      }
    })();

    return () => { alive = false; ctrl?.abort(); sub.remove(); };
  }, [listUrl, merge]);

  const scrollToEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

  const choose = () => {
    Alert.alert('Anexar', 'O que você quer enviar?', [
      { text: 'Foto ou vídeo', onPress: pickMedia },
      { text: 'Câmera', onPress: takePhoto },
      { text: 'Arquivo', onPress: pickDoc },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const accept = (asset) => {
    if (asset.size && asset.size > MAX_MB * 1024 * 1024) {
      Alert.alert('Arquivo muito grande', `O limite é ${MAX_MB} MB.`);
      return;
    }
    setPending(asset);
  };

  async function pickMedia() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão', 'Permita acesso às fotos para anexar.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const name = a.fileName || `${a.type === 'video' ? 'video' : 'foto'}_${Date.now()}.${a.type === 'video' ? 'mp4' : 'jpg'}`;
    const mimeType = a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg');
    accept({ uri: a.uri, name, mimeType, size: a.fileSize, kind: guessKind(mimeType, name) });
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão', 'Permita acesso à câmera.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    accept({ uri: a.uri, name: a.fileName || `foto_${Date.now()}.jpg`, mimeType: a.mimeType || 'image/jpeg', size: a.fileSize, kind: 'image' });
  }

  async function pickDoc() {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    accept({ uri: a.uri, name: a.name, mimeType: a.mimeType || 'application/octet-stream', size: a.size, kind: guessKind(a.mimeType, a.name) });
  }

  async function send() {
    const body = text.trim();
    if (!body && !pending) return;
    const att = pending;
    const tempId = `tmp_${Date.now()}`;
    setMessages(prev => [...prev, {
      tempId, sender: me, body, created_at: new Date().toISOString(), status: 'sending', progress: 0,
      attachment_type: att?.kind, attachment_name: att?.name, attachment_size: att?.size,
      localUri: att && att.kind === 'image' ? att.uri : null,
    }]);
    setText('');
    setPending(null);
    scrollToEnd();

    const form = new FormData();
    form.append('body', body);
    if (att) form.append('file', { uri: att.uri, name: att.name, type: att.mimeType });

    try {
      const { data } = await api.post(sendUrl, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        transformRequest: (d) => d,
        onUploadProgress: (p) => {
          if (!p.total) return;
          const pct = Math.round((p.loaded / p.total) * 100);
          setMessages(prev => prev.map(m => m.tempId === tempId ? { ...m, progress: pct, status: pct >= 100 && att ? 'scanning' : 'sending' } : m));
        },
      });
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev.filter(m => m.tempId !== tempId);
        return prev.map(m => m.tempId === tempId ? data : m);
      });
      if (!lastAtRef.current || data.created_at > lastAtRef.current) lastAtRef.current = data.created_at;
    } catch (err) {
      const msg = err.response?.data?.error || 'Não foi possível enviar';
      setMessages(prev => prev.map(m => m.tempId === tempId ? { ...m, status: 'error', errorMsg: msg } : m));
    }
  }

  const renderItem = ({ item: m }) => {
    const mine = m.sender === me;
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Attachment m={m} onOpenImage={setViewImage} onOpenVideo={setViewVideo} />
          {!!m.body && <Text style={styles.text}>{m.body}</Text>}
          {m.status === 'error' ? (
            <TouchableOpacity onPress={() => { setMessages(prev => prev.filter(x => x.tempId !== m.tempId)); setText(m.body || ''); }}>
              <Text style={styles.errorMeta}>⚠ {m.errorMsg} · tocar para editar</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.meta}>
              {m.status === 'sending' && (m.attachment_type ? `Enviando ${m.progress || 0}%` : 'Enviando...')}
              {m.status === 'scanning' && 'Verificando vírus...'}
              {!m.status && fmtTime(m.created_at)}
              {!m.status && mine && (m.is_read ? '  ✓✓' : '  ✓')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#E50914" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id || m.tempId}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, messages.length === 0 && { flex: 1 }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={44} color="#333" />
              <Text style={styles.empty}>{emptyText || 'Nenhuma mensagem ainda.'}</Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          windowSize={11}
        />
      )}

      {pending && (
        <View style={styles.pending}>
          {pending.kind === 'image'
            ? <Image source={{ uri: pending.uri }} style={styles.pendingThumb} />
            : <Ionicons name={pending.kind === 'video' ? 'videocam' : 'document'} size={22} color="#ccc" />}
          <Text style={styles.pendingName} numberOfLines={1}>{pending.name}{pending.size ? ` · ${fmtSize(pending.size)}` : ''}</Text>
          <TouchableOpacity onPress={() => setPending(null)} hitSlop={10}>
            <Ionicons name="close-circle" size={22} color="#888" />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={choose}>
          <Ionicons name="attach" size={22} color="#fff" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Mensagem"
          placeholderTextColor="#666"
          multiline
          maxLength={4000}
          onFocus={scrollToEnd}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && !pending && { opacity: 0.4 }]}
          onPress={send}
          disabled={!text.trim() && !pending}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {viewImage && (
        <Modal visible animationType="fade" onRequestClose={() => setViewImage(null)} statusBarTranslucent>
          <View style={styles.viewer}>
            <Image source={{ uri: viewImage }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewImage(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
      {viewVideo && <VideoModal url={viewVideo} onClose={() => setViewVideo(null)} />}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty: { color: '#666', textAlign: 'center', marginTop: 12, lineHeight: 20 },
  list: { padding: 12, paddingBottom: 6 },
  row: { flexDirection: 'row', marginVertical: 3 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 5, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#b0070f', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#222', borderBottomLeftRadius: 4 },
  text: { color: '#fff', fontSize: 15, lineHeight: 20 },
  meta: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, alignSelf: 'flex-end', marginTop: 3 },
  errorMeta: { color: '#ffd0d0', fontSize: 11, marginTop: 4 },
  media: { width: 220, height: 220, borderRadius: 10, marginBottom: 6, backgroundColor: '#111' },
  videoBox: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  videoName: { color: '#ccc', fontSize: 11, marginTop: 6, paddingHorizontal: 8 },
  file: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10, padding: 10, marginBottom: 6, minWidth: 200,
  },
  fileName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  fileSize: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  pending: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#161616', borderTopWidth: 1, borderTopColor: '#222',
  },
  pendingThumb: { width: 36, height: 36, borderRadius: 6 },
  pendingName: { flex: 1, color: '#ccc', fontSize: 13 },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8,
    backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#1f1f1f',
  },
  attachBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, minHeight: 42, maxHeight: 120, backgroundColor: '#1c1c1c', color: '#fff',
    borderRadius: 21, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerClose: { position: 'absolute', top: 44, right: 16, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 22 },
});
