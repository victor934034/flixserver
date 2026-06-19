import { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDownloads, fmtBytes } from '../../contexts/DownloadContext';

const VERSION_LABELS = {
  dubbing: 'Dublado', subtitled: 'Legendado', cinema: 'Original', '4k': '4K',
};

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { downloads, active, cancelDownload, deleteDownload, totalBytes } = useDownloads();
  const [deleting, setDeleting] = useState(null);

  const activeList = Object.entries(active);

  const playOffline = (dl) => {
    router.push({
      pathname: '/player',
      params: {
        url: dl.filePath,
        title: dl.episodeLabel ? `${dl.title} · ${dl.episodeLabel}` : dl.title,
        id: dl.contentId,
        type: dl.type,
        versions: JSON.stringify({ [dl.version]: dl.filePath }),
        subtitles: JSON.stringify({}),
        ...(dl.seriesId ? { seriesId: dl.seriesId } : {}),
      },
    });
  };

  const confirmDelete = (dl) => {
    Alert.alert(
      'Excluir download',
      `Remover "${dl.title}" do armazenamento?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            setDeleting(dl.id);
            await deleteDownload(dl.contentId, dl.version);
            setDeleting(null);
          },
        },
      ]
    );
  };

  const renderActive = ([id, act]) => {
    const [contentId, version] = id.split('__');
    return (
      <View key={id} style={s.activeCard}>
        <View style={s.activeInfo}>
          <ActivityIndicator size="small" color="#E50914" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.activeTitle} numberOfLines={1}>
              {VERSION_LABELS[version] || version} · {fmtBytes(act.bytesWritten)} / {fmtBytes(act.bytesTotal)}
            </Text>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${(act.progress || 0) * 100}%` }]} />
            </View>
            <Text style={s.progressPct}>{Math.round((act.progress || 0) * 100)}%</Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.cancelBtn}
          onPress={() => {
            const [cId, ver] = id.split('__');
            cancelDownload(cId, ver);
          }}
        >
          <Ionicons name="close-circle" size={22} color="#E50914" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderDone = ({ item: dl }) => (
    <TouchableOpacity style={s.card} onPress={() => playOffline(dl)} activeOpacity={0.75}>
      <View style={s.cardThumb}>
        {dl.thumbnailUrl || dl.posterUrl ? (
          <Image source={{ uri: dl.thumbnailUrl || dl.posterUrl }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, s.thumbPlaceholder]}>
            <Ionicons name="film-outline" size={28} color="#333" />
          </View>
        )}
        <View style={s.playOverlay}>
          <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
        </View>
      </View>

      <View style={s.cardInfo}>
        <Text style={s.cardTitle} numberOfLines={2}>{dl.title}</Text>
        {dl.episodeLabel && <Text style={s.cardEp} numberOfLines={1}>{dl.episodeLabel}</Text>}
        <View style={s.cardMeta}>
          <View style={s.badge}><Text style={s.badgeText}>{VERSION_LABELS[dl.version] || dl.version}</Text></View>
          <Text style={s.cardSize}>{fmtBytes(dl.fileSize)}</Text>
        </View>
        <Text style={s.cardDate}>
          {new Date(dl.downloadedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
      </View>

      <TouchableOpacity
        style={s.deleteBtn}
        onPress={() => confirmDelete(dl)}
        disabled={deleting === dl.id}
      >
        {deleting === dl.id
          ? <ActivityIndicator size="small" color="#E50914" />
          : <Ionicons name="trash-outline" size={20} color="#E50914" />}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Downloads</Text>
        {totalBytes > 0 && (
          <Text style={s.headerSub}>{fmtBytes(totalBytes)} usados</Text>
        )}
      </View>

      {activeList.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>Em andamento</Text>
          {activeList.map(renderActive)}
        </View>
      )}

      {downloads.length === 0 && activeList.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="cloud-download-outline" size={56} color="#2a2a2a" />
          <Text style={s.emptyTitle}>Nenhum download</Text>
          <Text style={s.emptySub}>
            Baixe filmes e episódios para assistir sem internet.{'\n'}
            Os arquivos ficam ocultos no armazenamento do app.
          </Text>
        </View>
      ) : (
        <FlatList
          data={downloads}
          keyExtractor={d => d.id}
          renderItem={renderDone}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            downloads.length > 0 ? (
              <Text style={s.sectionLabel}>Baixados · {downloads.length} arquivo{downloads.length !== 1 ? 's' : ''}</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: '#555', marginTop: 2 },

  section: { paddingHorizontal: 12, marginBottom: 8 },
  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4, paddingTop: 8 },

  activeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#1f1f1f',
  },
  activeInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  activeTitle: { color: '#fff', fontSize: 13, marginBottom: 6 },
  progressBar: { height: 3, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', backgroundColor: '#E50914', borderRadius: 2 },
  progressPct: { color: '#555', fontSize: 11 },
  cancelBtn: { padding: 6 },

  card: {
    flexDirection: 'row', backgroundColor: '#111', borderRadius: 12,
    overflow: 'hidden', marginBottom: 10, borderWidth: 1, borderColor: '#1a1a1a',
  },
  cardThumb: { width: 120, height: 76, position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  cardInfo: { flex: 1, padding: 10, justifyContent: 'center' },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  cardEp: { color: '#aaa', fontSize: 12, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  badge: { backgroundColor: '#1f1f1f', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  badgeText: { color: '#bbb', fontSize: 11, fontWeight: '600' },
  cardSize: { color: '#555', fontSize: 12 },
  cardDate: { color: '#444', fontSize: 11 },
  deleteBtn: { justifyContent: 'center', paddingHorizontal: 16 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 14 },
  emptyTitle: { color: '#333', fontSize: 18, fontWeight: '700' },
  emptySub: { color: '#333', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
