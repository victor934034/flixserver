import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const STORE_KEY = 'flixhome_dl_v1';
const DL_DIR = FileSystem.documentDirectory + 'flixhome_dl/';

const DownloadCtx = createContext(null);

function extFromUrl(url) {
  try {
    const path = new URL(url.split('?')[0]).pathname;
    const ext = path.split('.').pop().toLowerCase();
    return ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v', 'ts'].includes(ext) ? ext : 'mp4';
  } catch { return 'mp4'; }
}

function dlId(contentId, version) { return `${contentId}__${version}`; }

export function DownloadProvider({ children }) {
  const [downloads, setDownloads] = useState([]);   // completed
  const [active, setActive]       = useState({});    // id → { progress, bytesWritten, bytesTotal, status }
  const resumables = useRef({});

  useEffect(() => { boot(); }, []);

  const boot = async () => {
    try {
      const info = await FileSystem.getInfoAsync(DL_DIR);
      if (!info.exists) await FileSystem.makeDirectoryAsync(DL_DIR, { intermediates: true });
      // Hide from Android gallery
      if (Platform.OS === 'android') {
        const nm = DL_DIR + '.nomedia';
        const ni = await FileSystem.getInfoAsync(nm);
        if (!ni.exists) await FileSystem.writeAsStringAsync(nm, '');
      }
    } catch {}

    try {
      const raw = await AsyncStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const alive = (await Promise.all(
        saved.map(async d => {
          const fi = await FileSystem.getInfoAsync(d.filePath).catch(() => ({ exists: false }));
          return fi.exists ? d : null;
        })
      )).filter(Boolean);
      setDownloads(alive);
      if (alive.length !== saved.length) persist(alive);
    } catch {}
  };

  const persist = async (list) => {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(list));
  };

  const getStatus = useCallback((contentId, version) => {
    const id = dlId(contentId, version);
    const done = downloads.find(d => d.id === id);
    const act  = active[id];
    if (done) return { state: 'done', progress: 1, filePath: done.filePath, download: done };
    if (act)  return { state: act.status === 'error' ? 'error' : 'downloading', progress: act.progress ?? 0, ...act };
    return { state: 'none', progress: 0 };
  }, [downloads, active]);

  const startDownload = useCallback(async (contentId, version, url, meta) => {
    const id = dlId(contentId, version);
    if (active[id] || downloads.find(d => d.id === id)) return;

    const ext  = extFromUrl(url);
    const path = DL_DIR + id + '.' + ext;

    setActive(p => ({ ...p, [id]: { progress: 0, status: 'downloading', bytesWritten: 0, bytesTotal: 0 } }));

    const res = FileSystem.createDownloadResumable(
      url,
      path,
      { headers: {} },
      (prog) => {
        const progress = prog.totalBytesExpectedToWrite > 0
          ? prog.totalBytesWritten / prog.totalBytesExpectedToWrite : 0;
        setActive(p => ({
          ...p,
          [id]: { ...p[id], progress, bytesWritten: prog.totalBytesWritten, bytesTotal: prog.totalBytesExpectedToWrite },
        }));
      }
    );
    resumables.current[id] = res;

    try {
      const result = await res.downloadAsync();
      if (!result?.uri) throw new Error('no uri');
      const newDl = {
        id,
        contentId,
        version,
        title: meta.title || 'Sem título',
        type: meta.type || 'movie',
        posterUrl: meta.posterUrl || null,
        thumbnailUrl: meta.thumbnailUrl || null,
        filePath: result.uri,
        fileSize: 0,
        downloadedAt: new Date().toISOString(),
        seriesId: meta.seriesId || null,
        episodeLabel: meta.episodeLabel || null,
      };
      // get file size
      try {
        const fi = await FileSystem.getInfoAsync(result.uri, { size: true });
        newDl.fileSize = fi.size || 0;
      } catch { newDl.fileSize = 0; }

      setDownloads(prev => {
        const next = [...prev, newDl];
        persist(next);
        return next;
      });
    } catch (e) {
      if (!String(e?.message).includes('cancel')) {
        setActive(p => ({ ...p, [id]: { ...p[id], status: 'error' } }));
        return;
      }
    } finally {
      delete resumables.current[id];
      setActive(p => { const n = { ...p }; delete n[id]; return n; });
    }
  }, [active, downloads]);

  const cancelDownload = useCallback(async (contentId, version) => {
    const id = dlId(contentId, version);
    const r = resumables.current[id];
    if (r) { try { await r.cancelAsync(); } catch {} delete resumables.current[id]; }
    setActive(p => { const n = { ...p }; delete n[id]; return n; });
  }, []);

  const deleteDownload = useCallback(async (contentId, version) => {
    const id = dlId(contentId, version);
    const dl = downloads.find(d => d.id === id);
    if (dl) { try { await FileSystem.deleteAsync(dl.filePath, { idempotent: true }); } catch {} }
    setDownloads(prev => {
      const next = prev.filter(d => d.id !== id);
      persist(next);
      return next;
    });
  }, [downloads]);

  const totalBytes = downloads.reduce((s, d) => s + (d.fileSize || 0), 0);

  return (
    <DownloadCtx.Provider value={{ downloads, active, getStatus, startDownload, cancelDownload, deleteDownload, totalBytes }}>
      {children}
    </DownloadCtx.Provider>
  );
}

export function useDownloads() { return useContext(DownloadCtx); }

export function fmtBytes(bytes) {
  if (!bytes) return '0 MB';
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
