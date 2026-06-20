'use client';
import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../../../lib/api';
import styles from './page.module.css';

function detectName(filename) {
  const seriePatterns = [/s\d{1,2}e\d{1,2}/i, /\d{1,2}x\d{2}/i, /t\d{1,2}e\d{1,2}/i, /temporada/i];
  const type = seriePatterns.some(p => p.test(filename)) ? 'series' : 'movie';
  let name = filename.replace(/\.[^.]+$/, '');
  name = name.replace(/\./g, ' ').replace(/_/g, ' ')
    .replace(/\b(1080p|720p|4k|2160p|bluray|webrip|hdtv|x264|x265|hevc|aac|dublado|legendado|dual|br|hdr)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
  return { type, name };
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Single-file upload (< 5GB)
function doUploadXHR(item, presign, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', presign.uploadUrl);
    xhr.setRequestHeader('Authorization', presign.authorizationToken);
    xhr.setRequestHeader('X-Bz-File-Name', encodeURIComponent(item.file.name));
    xhr.setRequestHeader('Content-Type', item.file.type || 'video/mp4');
    xhr.setRequestHeader('X-Bz-Content-Sha1', 'do_not_verify');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 88));
    };
    xhr.onload = () => {
      if (xhr.status < 300) resolve();
      else reject(Object.assign(new Error(`HTTP ${xhr.status}`), { isServer: true }));
    };
    xhr.onerror = () => reject(new Error('connection'));

    signal?.addEventListener('abort', () => { xhr.abort(); reject(new Error('paused')); });
    xhr.send(item.file);
  });
}

// Qualquer arquivo > 200 MB usa upload em partes (mais resiliente a quedas de conexão).
// Abaixo disso, um único XHR é suficiente e mais simples.
const LARGE_FILE_THRESHOLD = 200 * 1024 * 1024;
const PART_SIZE = 100 * 1024 * 1024;

async function doLargeUploadXHR(item, onProgress, signal, resumeState) {
  const file = item.file;
  let fileId = resumeState?.fileId;
  let startPart = 0;

  if (fileId) {
    // Resume: quantas partes já chegaram ao B2
    const { data } = await api.post('/upload/list-parts', { fileId });
    startPart = data.parts.length;
    onProgress({ pct: Math.round((startPart / Math.ceil(file.size / PART_SIZE)) * 88), fileId, partsDone: startPart });
  } else {
    const { data: { fileId: newId } } = await api.post('/upload/start-large', {
      filename: file.name,
      contentType: file.type || 'video/mp4',
    });
    fileId = newId;
    onProgress({ pct: 0, fileId, partsDone: 0 });
  }

  const totalParts = Math.ceil(file.size / PART_SIZE);

  for (let i = startPart; i < totalParts; i++) {
    if (signal?.aborted) throw new Error('paused');

    const start = i * PART_SIZE;
    const chunk = file.slice(start, Math.min(start + PART_SIZE, file.size));
    const partNumber = i + 1;

    const { data: partInfo } = await api.post('/upload/part-url', { fileId });

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', partInfo.uploadUrl);
      xhr.setRequestHeader('Authorization', partInfo.authorizationToken);
      xhr.setRequestHeader('X-Bz-Part-Number', String(partNumber));
      // do_not_verify: B2 aceita a parte e armazena o SHA1 real internamente.
      // O backend busca esses SHA1s no finish-large via list-parts.
      xhr.setRequestHeader('X-Bz-Content-Sha1', 'do_not_verify');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round(((i + e.loaded / e.total) / totalParts) * 88);
          onProgress({ pct, fileId, partsDone: i });
        }
      };
      xhr.onload = () => {
        if (xhr.status < 300) resolve();
        else reject(Object.assign(new Error(`HTTP ${xhr.status}`), { isServer: true }));
      };
      xhr.onerror = () => reject(new Error('connection'));
      signal?.addEventListener('abort', () => { xhr.abort(); reject(new Error('paused')); });
      xhr.send(chunk);
    });

    onProgress({ pct: Math.round(((i + 1) / totalParts) * 88), fileId, partsDone: i + 1 });
  }

  // partSha1Array vazio → backend usa list-parts para pegar SHA1s reais do B2
  const { data: { cdnUrl } } = await api.post('/upload/finish-large', {
    fileId,
    filename: file.name,
    partSha1Array: [],
  });
  return cdnUrl;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [3000, 6000, 12000];

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const abortRefs = useRef({});

  const onDrop = useCallback((accepted) => {
    const items = accepted.map(file => ({
      file,
      id: Math.random().toString(36).slice(2),
      ...detectName(file.name),
      version: file.name.toLowerCase().includes('legendado') ? 'subtitled'
        : file.name.toLowerCase().includes('4k') ? '4k'
        : file.name.toLowerCase().includes('cinema') ? 'cinema'
        : 'dubbing',
      progress: 0,
      status: 'pending',
      result: null,
      error: null,
      resumeState: null, // {fileId, partsDone}
    }));
    setFiles(prev => [...prev, ...items]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mkv', '.avi', '.mov', '.m4v'] },
    multiple: true,
  });

  function updateFile(id, patch) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  async function uploadFile(item) {
    updateFile(item.id, { status: 'uploading', progress: 0, error: null });
    const isLarge = item.file.size >= LARGE_FILE_THRESHOLD;
    const controller = new AbortController();
    abortRefs.current[item.id] = controller;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        let cdnUrl;

        if (isLarge) {
          cdnUrl = await doLargeUploadXHR(
            item,
            ({ pct, fileId, partsDone }) => {
              updateFile(item.id, {
                progress: pct,
                resumeState: { fileId, partsDone },
              });
            },
            controller.signal,
            item.resumeState,
          );
        } else {
          const { data: presign } = await api.get('/upload/presign');
          await doUploadXHR(item, presign, (pct) => updateFile(item.id, { progress: pct }), controller.signal);
          cdnUrl = `${presign.cdnBase}/${encodeURIComponent(item.file.name)}`;
        }

        updateFile(item.id, { progress: 92 });
        const { data: tmdbResult } = await api.post('/tmdb/detect', { fileUrl: cdnUrl, version: item.version });
        updateFile(item.id, { status: 'done', progress: 100, result: tmdbResult, error: null });
        delete abortRefs.current[item.id];
        return;
      } catch (err) {
        if (err.message === 'paused') {
          updateFile(item.id, { status: 'paused', error: null });
          delete abortRefs.current[item.id];
          return;
        }
        const isConnection = err.message === 'connection' || (!err.isServer && !err.response);
        const hasRetry = isConnection && attempt < MAX_RETRIES;

        if (hasRetry) {
          const delay = RETRY_DELAYS[attempt];
          updateFile(item.id, {
            status: 'retrying',
            progress: 0,
            error: `Falha de conexão. Tentando novamente em ${delay / 1000}s... (${attempt + 1}/${MAX_RETRIES})`,
          });
          await new Promise(r => setTimeout(r, delay));
          updateFile(item.id, { status: 'uploading', error: null });
        } else {
          const msg = err.response?.data?.error || (err.message === 'connection' ? 'Falha de conexão após 3 tentativas' : err.message);
          updateFile(item.id, { status: 'error', error: msg });
          delete abortRefs.current[item.id];
          return;
        }
      }
    }
  }

  function pauseFile(item) {
    abortRefs.current[item.id]?.abort();
  }

  function resumeFile(item) {
    const freshItem = files.find(f => f.id === item.id);
    if (!freshItem) return;
    const controller = new AbortController();
    abortRefs.current[item.id] = controller;
    updateFile(item.id, { status: 'uploading', error: null });
    uploadFile(freshItem);
  }

  async function retryFile(item) {
    updateFile(item.id, { status: 'pending', progress: 0, error: null, result: null, resumeState: null });
    await uploadFile({ ...item, status: 'pending', resumeState: null });
  }

  async function startAll() {
    setUploading(true);
    const pending = files.filter(f => f.status === 'pending');
    const chunks = [];
    for (let i = 0; i < pending.length; i += 3) chunks.push(pending.slice(i, i + 3));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(uploadFile));
    }
    setUploading(false);
  }

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const doneCount = files.filter(f => f.status === 'done').length;

  return (
    <div>
      <h1 className={styles.heading}>Upload de Vídeos</h1>

      <div {...getRootProps()} className={`${styles.dropzone} ${isDragActive ? styles.active : ''}`}>
        <input {...getInputProps()} />
        <p className={styles.dropText}>
          {isDragActive ? 'Solte os arquivos aqui' : 'Arraste arquivos de vídeo ou clique para selecionar'}
        </p>
        <p className={styles.dropSub}>MP4, MKV, AVI, MOV — sem limite de tamanho (arquivos &gt; 5GB usam upload em partes)</p>
      </div>

      {files.length > 0 && (
        <>
          <div className={styles.summary}>
            <span>{files.length} arquivo(s) — {doneCount} concluído(s)</span>
            {pendingCount > 0 && !uploading && (
              <button className={styles.btnStart} onClick={startAll}>
                ▶ Iniciar Upload ({pendingCount})
              </button>
            )}
            {uploading && <span className={styles.uploadingBadge}>Enviando...</span>}
          </div>

          <div className={styles.fileList}>
            {files.map(item => (
              <div key={item.id} className={`${styles.fileItem} ${styles[item.status] || ''}`}>
                <div className={styles.fileHeader}>
                  <div>
                    <div className={styles.fileName}>{item.file.name}</div>
                    <div className={styles.fileMeta}>
                      <span>{item.type === 'series' ? 'Série' : 'Filme'}</span>
                      <span>·</span>
                      <span>{formatSize(item.file.size)}</span>
                      {item.file.size >= LARGE_FILE_THRESHOLD && (
                        <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>· upload em partes</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.status === 'pending' && (
                      <select
                        value={item.version}
                        onChange={e => updateFile(item.id, { version: e.target.value })}
                        className={styles.versionSelect}
                      >
                        <option value="dubbing">Dublado</option>
                        <option value="subtitled">Legendado</option>
                        <option value="cinema">Cinema</option>
                        <option value="4k">4K</option>
                      </select>
                    )}

                    {item.status === 'uploading' && item.file.size >= LARGE_FILE_THRESHOLD && (
                      <button className={styles.btnPause} onClick={() => pauseFile(item)}>⏸ Pausar</button>
                    )}

                    {item.status === 'paused' && (
                      <>
                        <span className={styles.badgePaused}>⏸ Pausado</span>
                        <button className={styles.btnResume} onClick={() => resumeFile(item)}>▶ Continuar</button>
                      </>
                    )}

                    {item.status === 'done' && <span className={styles.badgeDone}>✓ Concluído</span>}

                    {item.status === 'error' && (
                      <>
                        <span className={styles.badgeError}>✗ Erro</span>
                        <button className={styles.btnRetry} onClick={() => retryFile(item)}>↺ Tentar novamente</button>
                      </>
                    )}

                    {item.status === 'retrying' && <span className={styles.badgeRetrying}>↺ Reconectando...</span>}
                  </div>
                </div>

                {(item.status === 'uploading' || item.status === 'paused' || item.status === 'done') && (
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${item.progress}%`,
                        backgroundColor: item.status === 'paused' ? '#ffa500' : undefined,
                      }}
                    />
                  </div>
                )}

                {item.status === 'paused' && item.resumeState && (
                  <p className={styles.retryMsg}>
                    {item.resumeState.partsDone} de {Math.ceil(item.file.size / PART_SIZE)} partes concluídas —
                    clique em Continuar para retomar do ponto parado.
                  </p>
                )}

                {item.status === 'retrying' && item.error && (
                  <p className={styles.retryMsg}>{item.error}</p>
                )}

                {item.result && (
                  <div className={styles.resultBox}>
                    <span className={styles.resultOk}>✓ {item.result.success?.length || 0} importado(s)</span>
                    {item.result.notFound?.length > 0 && (
                      <span className={styles.resultWarn}> · {item.result.notFound.length} não encontrado(s) no TMDB</span>
                    )}
                  </div>
                )}

                {item.status === 'error' && item.error && <p className={styles.errorMsg}>{item.error}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
