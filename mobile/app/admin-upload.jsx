import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, AppState,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as KeepAwake from 'expo-keep-awake';

// expo-file-system v18 + SDK 54: FileSystemUploadType pode não estar no namespace padrão
const BINARY_CONTENT = FileSystem.FileSystemUploadType.BINARY_CONTENT;
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../lib/api';

const RESUME_KEY = 'admin_upload_pending';
const VIDEO_EXT = ['mp4', 'mkv', 'avi', 'mov', 'm4v', 'webm', 'ts', 'wmv', 'flv', 'mpg', 'mpeg'];

// O upload direto (presign único) usa a API simples do B2, que tem limite
// rígido de 5GB por arquivo — filme grande falhava sem aviso claro. Acima
// disso (e para ganhar velocidade via paralelismo, igual o site já faz),
// usa upload em partes.
const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024;
const PART_SIZE = 40 * 1024 * 1024;
const PARALLEL_PARTS = 4; // mais conservador que o site: memória/CPU do celular são mais limitadas

// Sobe um arquivo grande em partes paralelas direto ao B2 (mesma estratégia do site).
// Cada parte é lida em base64 (posição/tamanho) e gravada num arquivo temporário,
// porque createUploadTask precisa de um URI de arquivo — não existe Blob.slice() no RN.
async function uploadLargeMobile(target, uploadUri, onProgress, isCancelled) {
  const totalParts = Math.ceil(target.size / PART_SIZE);
  const partProgress = new Array(totalParts).fill(0);

  function report() {
    const done = partProgress.reduce((a, b) => a + b, 0);
    onProgress(Math.round((done / totalParts) * 88));
  }

  const { data: { fileId, filename: serverFilename } } = await api.post('/upload/start-large', {
    filename: target.name,
    contentType: target.mimeType || 'video/mp4',
  });

  let queueIdx = 0;
  async function worker() {
    while (true) {
      if (isCancelled()) throw new Error('cancelled');
      const i = queueIdx++;
      if (i >= totalParts) break;

      const start = i * PART_SIZE;
      const length = Math.min(PART_SIZE, target.size - start);
      const partNumber = i + 1;
      const partUri = `${FileSystem.cacheDirectory}part_${partNumber}_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`;

      let attempts = 0;
      while (true) {
        try {
          const base64 = await FileSystem.readAsStringAsync(uploadUri, {
            encoding: FileSystem.EncodingType.Base64,
            position: start,
            length,
          });
          await FileSystem.writeAsStringAsync(partUri, base64, { encoding: FileSystem.EncodingType.Base64 });

          const { data: partUrl } = await api.post('/upload/part-url', { fileId });

          const task = FileSystem.createUploadTask(
            partUrl.uploadUrl,
            partUri,
            {
              httpMethod: 'POST',
              uploadType: BINARY_CONTENT,
              headers: {
                Authorization: partUrl.authorizationToken,
                'X-Bz-Part-Number': String(partNumber),
                'X-Bz-Content-Sha1': 'do_not_verify',
              },
            },
            (prog) => {
              partProgress[i] = prog.totalBytesExpectedToSend > 0 ? prog.totalBytesSent / prog.totalBytesExpectedToSend : 0;
              report();
            }
          );
          const result = await task.uploadAsync();
          await FileSystem.deleteAsync(partUri, { idempotent: true });

          if (!result || result.status >= 300) throw new Error(`Parte ${partNumber} falhou: HTTP ${result?.status || '?'}`);
          partProgress[i] = 1;
          report();
          break; // sucesso
        } catch (err) {
          await FileSystem.deleteAsync(partUri, { idempotent: true }).catch(() => {});
          if (err.message === 'cancelled') throw err;
          if (attempts < 3) {
            attempts++;
            partProgress[i] = 0;
            await new Promise(r => setTimeout(r, 1500 * attempts));
          } else {
            throw err;
          }
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, totalParts) }, () => worker()));

  const { data: finish } = await api.post('/upload/finish-large', {
    fileId,
    filename: serverFilename,
    partSha1Array: [],
  });
  return finish.cdnUrl;
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AdminUploadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const taskRef = useRef(null);
  const cacheUriRef = useRef(null); // rastrea arquivo copiado para cache (Android)
  const cancelledRef = useRef(false); // cancelamento do upload em partes (multiplas uploadTasks paralelas)

  const [file, setFile] = useState(null);
  const [version, setVersion] = useState('dubbing');
  const [status, setStatus] = useState('idle'); // idle | preparing | uploading | done | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(RESUME_KEY).then(raw => {
      if (raw) setPending(JSON.parse(raw));
    });
  }, []);

  // Aplica o arquivo escolhido (por qualquer origem) ao estado da tela
  const applyPickedAsset = (asset) => {
    const ext = (asset.name || '').split('.').pop()?.toLowerCase();
    if (ext && !VIDEO_EXT.includes(ext)) {
      Alert.alert(
        'Arquivo não parece ser um vídeo',
        `"${asset.name}" tem extensão .${ext}. Selecione o arquivo de vídeo correto.`,
      );
      return;
    }

    // Registra URI do cache para deletar após upload
    if (asset.uri.startsWith('file://') || asset.uri.startsWith('/')) {
      cacheUriRef.current = asset.uri;
    }

    setFile(asset);
    setStatus('idle');
    setProgress(0);
    setError(null);
    setResult(null);
  };

  // Arquivos — navegador de armazenamento (Downloads, Este dispositivo, nuvem, etc.)
  const pickFromFiles = async () => {
    try {
      // copyToCacheDirectory: true garante URI file:// válida em qualquer Android
      // O Expo usa os ContentResolver nativos para copiar — único jeito confiável
      // Para arquivos grandes, o picker pode travar alguns minutos após a seleção (normal)
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      applyPickedAsset(res.assets[0]);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo.');
    }
  };

  // Galeria — vídeos salvos no dispositivo (câmera, downloads de apps, etc.)
  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para selecionar vídeos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      applyPickedAsset({
        uri: a.uri,
        name: a.fileName || a.uri.split('/').pop() || `video_${Date.now()}.mp4`,
        size: a.fileSize,
        mimeType: a.mimeType || 'video/mp4',
      });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível selecionar o vídeo da galeria.');
    }
  };

  // Abre a escolha de origem (Arquivos ou Galeria) antes de disparar o seletor certo
  const pickFile = () => {
    Alert.alert(
      'Selecionar vídeo',
      'De onde você quer escolher o arquivo?',
      [
        { text: 'Arquivos', onPress: pickFromFiles },
        { text: 'Galeria', onPress: pickFromGallery },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  const startUpload = async (overrideFile) => {
    const target = overrideFile || file;
    if (!target) return;

    setStatus('preparing');
    setProgress(0);
    setError(null);
    setResult(null);

    // ── Garante URI file:// ────────────────────────────────────────────────────
    // content:// URIs do Android não funcionam com createUploadTask nativo.
    // Mesmo com copyToCacheDirectory:true, alguns dispositivos retornam content://.
    let uploadUri = target.uri;
    if (!uploadUri.startsWith('file://') && !uploadUri.startsWith('/')) {
      const ext = (target.name || 'video.mp4').split('.').pop().toLowerCase();
      const destUri = `${FileSystem.cacheDirectory}upload_temp.${ext}`;
      try {
        await FileSystem.copyAsync({ from: uploadUri, to: destUri });
        uploadUri = destUri;
        cacheUriRef.current = destUri;
      } catch {
        setError('Não foi possível ler o arquivo. Tente selecionar o vídeo novamente.');
        setStatus('error');
        return;
      }
    }

    // ── Verifica se o arquivo ainda existe no cache ────────────────────────────
    // O cache pode ser limpo pelo Android sob pressão de memória.
    let info;
    try { info = await FileSystem.getInfoAsync(uploadUri); } catch {}
    if (!info?.exists) {
      setError('Arquivo não encontrado — pode ter expirado. Selecione o vídeo novamente.');
      setStatus('error');
      return;
    }

    setStatus('uploading');
    await KeepAwake.activateKeepAwakeAsync('admin-upload');

    try {
      await AsyncStorage.setItem(RESUME_KEY, JSON.stringify({
        name: target.name,
        size: target.size,
        uri: uploadUri,
        version,
      }));

      let cdnUrl;

      if (target.size >= LARGE_FILE_THRESHOLD) {
        cancelledRef.current = false;
        cdnUrl = await uploadLargeMobile(target, uploadUri, setProgress, () => cancelledRef.current);
        setProgress(90);
      } else {
        const { data: presign } = await api.get('/upload/presign');
        const encodedName = encodeURIComponent(target.name);

        taskRef.current = FileSystem.createUploadTask(
          presign.uploadUrl,
          uploadUri,
          {
            httpMethod: 'POST',
            uploadType: BINARY_CONTENT,
            headers: {
              Authorization: presign.authorizationToken,
              'X-Bz-File-Name': encodedName,
              'Content-Type': target.mimeType || 'video/mp4',
              'X-Bz-Content-Sha1': 'do_not_verify',
            },
          },
          (prog) => {
            const pct = prog.totalBytesExpectedToSend > 0
              ? Math.round((prog.totalBytesSent / prog.totalBytesExpectedToSend) * 88)
              : 0;
            setProgress(pct);
          }
        );

        const uploadResult = await taskRef.current.uploadAsync();

        if (!uploadResult || uploadResult.status >= 300) {
          let errMsg = `Upload falhou: HTTP ${uploadResult?.status || '?'}`;
          try {
            const body = JSON.parse(uploadResult?.body || '{}');
            if (body.message) errMsg = body.message;
          } catch {}
          throw new Error(errMsg);
        }

        setProgress(90);
        // encodedName garante URL válida para nomes com espaços ou acentos
        cdnUrl = `${presign.cdnBase}/${encodedName}`;
      }

      const { data: tmdbResult } = await api.post('/tmdb/detect', {
        fileUrl: cdnUrl,
        version,
      });

      setProgress(100);
      setStatus('done');
      setResult(tmdbResult);
      await AsyncStorage.removeItem(RESUME_KEY);
      setPending(null);
      // Limpa arquivo de cache criado para Android
      if (cacheUriRef.current) {
        FileSystem.deleteAsync(cacheUriRef.current, { idempotent: true }).catch(() => {});
        cacheUriRef.current = null;
      }
    } catch (err) {
      if (err.message !== 'Upload cancelled' && err.message !== 'cancelled') {
        const msg = err.response?.data?.error || err.message;
        setError(msg);
        setStatus('error');
      } else {
        setStatus('idle');
        setProgress(0);
      }
    } finally {
      taskRef.current = null;
      await KeepAwake.deactivateKeepAwake('admin-upload');
    }
  };

  const cancelUpload = () => {
    cancelledRef.current = true;
    taskRef.current?.cancelAsync?.();
    taskRef.current = null;
    setStatus('idle');
    setProgress(0);
    setError(null);
    if (cacheUriRef.current) {
      FileSystem.deleteAsync(cacheUriRef.current, { idempotent: true }).catch(() => {});
      cacheUriRef.current = null;
    }
  };

  const resumePending = () => {
    if (!pending) return;
    setFile({ uri: pending.uri, name: pending.name, size: pending.size });
    setVersion(pending.version || 'dubbing');
    setPending(null);
    startUpload({ uri: pending.uri, name: pending.name, size: pending.size, mimeType: 'video/mp4' });
  };

  const clearPending = async () => {
    await AsyncStorage.removeItem(RESUME_KEY);
    setPending(null);
  };

  const isUploading = status === 'uploading' || status === 'preparing';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Admin</Text>
      </View>

      {pending && status === 'idle' && (
        <View style={styles.pendingBox}>
          <View style={styles.pendingInfo}>
            <Ionicons name="alert-circle-outline" size={20} color="#ffa500" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.pendingTitle}>Upload interrompido</Text>
              <Text style={styles.pendingName} numberOfLines={1}>{pending.name}</Text>
              <Text style={styles.pendingSize}>{formatSize(pending.size)}</Text>
            </View>
          </View>
          <View style={styles.pendingBtns}>
            <TouchableOpacity style={styles.btnResume} onPress={resumePending}>
              <Ionicons name="refresh" size={14} color="#000" />
              <Text style={styles.btnResumeText}>Retomar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnClearPending} onPress={clearPending}>
              <Text style={styles.btnClearPendingText}>Descartar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.pickBtn, isUploading && styles.disabled]}
          onPress={pickFile}
          disabled={isUploading}
        >
          <Ionicons name="document-outline" size={24} color={isUploading ? '#333' : '#E50914'} />
          <Text style={[styles.pickBtnText, isUploading && { color: '#444' }]}>
            {file ? 'Trocar arquivo' : 'Selecionar vídeo'}
          </Text>
        </TouchableOpacity>
        {!file && !isUploading && (
          <Text style={styles.pickHint}>Após selecionar um vídeo grande, aguarde alguns instantes enquanto o arquivo é preparado.</Text>
        )}

        {file && (
          <View style={styles.fileCard}>
            <Ionicons name="videocam-outline" size={20} color="#666" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
              <Text style={styles.fileMeta}>{formatSize(file.size)}</Text>
            </View>
          </View>
        )}
      </View>

      {file && !isUploading && status !== 'done' && (
        <View style={styles.section}>
          <Text style={styles.label}>Versão do vídeo</Text>
          {[
            { value: 'dubbing', label: 'Dublado', icon: 'musical-notes-outline' },
            { value: 'subtitled', label: 'Legendado', icon: 'text-outline' },
            { value: 'cinema', label: 'Cinema / Original', icon: 'film-outline' },
            { value: '4k', label: '4K', icon: 'cube-outline' },
          ].map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.versionRow, version === opt.value && styles.versionRowActive]}
              onPress={() => setVersion(opt.value)}
            >
              <Ionicons name={opt.icon} size={18} color={version === opt.value ? '#E50914' : '#666'} />
              <Text style={[styles.versionLabel, version === opt.value && { color: '#fff' }]}>
                {opt.label}
              </Text>
              {version === opt.value && <Ionicons name="checkmark" size={16} color="#E50914" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {status === 'preparing' && (
        <View style={styles.section}>
          <Text style={styles.progressLabel}>Preparando arquivo…</Text>
        </View>
      )}

      {status === 'uploading' && (
        <View style={styles.section}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Enviando... {progress}%</Text>
            <TouchableOpacity onPress={cancelUpload}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressNote}>
            O upload continua em segundo plano mesmo se você sair do app (iOS).
          </Text>
        </View>
      )}

      {file && !isUploading && status !== 'done' && (
        <TouchableOpacity style={styles.btnUpload} onPress={() => startUpload()}>
          <Ionicons name="cloud-upload-outline" size={20} color="#000" />
          <Text style={styles.btnUploadText}>Iniciar Upload</Text>
        </TouchableOpacity>
      )}

      {status === 'error' && (
        <View style={styles.section}>
          <View style={styles.errorBox}>
            <Ionicons name="close-circle-outline" size={20} color="#E50914" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <TouchableOpacity style={styles.btnRetry} onPress={() => startUpload()}>
            <Text style={styles.btnRetryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'done' && result && (
        <View style={styles.section}>
          <View style={styles.doneBox}>
            <Ionicons name="checkmark-circle" size={28} color="#46d369" style={{ marginBottom: 8 }} />
            <Text style={styles.doneTitle}>Upload concluído!</Text>
            {result.success?.length > 0 ? (
              result.success.map((item, i) => (
                <Text key={i} style={styles.doneItem}>
                  ✓ {item.title || item.name}
                  {item.season != null ? ` T${item.season}E${String(item.episode).padStart(2,'0')}` : ''}
                </Text>
              ))
            ) : (
              <Text style={styles.doneWarn}>Arquivo enviado, mas não encontrado no TMDB.</Text>
            )}
            {result.notFound?.length > 0 && (
              <Text style={styles.doneWarn}>Não encontrado no TMDB: {result.notFound.map(n => n.name).join(', ')}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.btnNew} onPress={() => {
            setFile(null);
            setStatus('idle');
            setProgress(0);
            setResult(null);
            setError(null);
          }}>
            <Text style={styles.btnNewText}>Novo upload</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 16,
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  pendingBox: {
    margin: 16, padding: 16, backgroundColor: '#1a1200',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,165,0,0.3)',
  },
  pendingInfo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  pendingTitle: { color: '#ffa500', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  pendingName: { color: '#ccc', fontSize: 13 },
  pendingSize: { color: '#666', fontSize: 12, marginTop: 2 },
  pendingBtns: { flexDirection: 'row', gap: 10 },
  btnResume: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffa500', paddingVertical: 10, borderRadius: 8, gap: 6,
  },
  btnResumeText: { color: '#000', fontWeight: '700', fontSize: 14 },
  btnClearPending: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
    borderWidth: 1, borderColor: '#333',
  },
  btnClearPendingText: { color: '#666', fontSize: 14 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111', borderWidth: 2, borderColor: '#E50914',
    borderStyle: 'dashed', borderRadius: 12, paddingVertical: 32, gap: 12,
  },
  pickBtnText: { color: '#E50914', fontSize: 16, fontWeight: '600' },
  pickHint: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  disabled: { borderColor: '#222' },
  fileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 10,
    padding: 14, marginTop: 12,
  },
  fileName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  fileMeta: { color: '#555', fontSize: 12, marginTop: 2 },
  label: {
    color: '#555', fontSize: 11, fontWeight: '600',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  versionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 10, padding: 14,
    marginBottom: 8, gap: 12,
  },
  versionRowActive: { backgroundColor: 'rgba(229,9,20,0.1)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.4)' },
  versionLabel: { flex: 1, color: '#666', fontSize: 15 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelText: { color: '#E50914', fontSize: 13 },
  track: { height: 6, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#E50914', borderRadius: 3 },
  progressNote: { color: '#444', fontSize: 11, marginTop: 8, lineHeight: 16 },
  btnUpload: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E50914', marginHorizontal: 16, paddingVertical: 16,
    borderRadius: 12, gap: 8,
  },
  btnUploadText: { color: '#000', fontSize: 16, fontWeight: '700' },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(229,9,20,0.1)', borderRadius: 10, padding: 14, gap: 10,
  },
  errorText: { flex: 1, color: '#ff6b6b', fontSize: 13, lineHeight: 18 },
  btnRetry: {
    marginTop: 12, backgroundColor: '#1a1a1a', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: '#333',
  },
  btnRetryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  doneBox: {
    backgroundColor: 'rgba(70,211,105,0.08)', borderRadius: 12,
    padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(70,211,105,0.3)',
  },
  doneTitle: { color: '#46d369', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  doneItem: { color: '#ccc', fontSize: 14, textAlign: 'center', marginTop: 4 },
  doneWarn: { color: '#ffa500', fontSize: 12, textAlign: 'center', marginTop: 6 },
  btnNew: {
    marginTop: 16, backgroundColor: '#111', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#222',
  },
  btnNewText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
