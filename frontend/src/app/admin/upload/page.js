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

function formatSpeed(bps) {
  if (!bps || bps < 0) return '';
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
}

function formatETA(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds) || seconds > 86400) return '';
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  if (seconds < 3600) return `~${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `~${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// Single-file upload (< 200 MB)
function doUploadXHR(item, presign, b2FileName, onProgress, signal) {
  let _bps = 0, _t = Date.now(), _b = 0;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', presign.uploadUrl);
    xhr.setRequestHeader('Authorization', presign.authorizationToken);
    xhr.setRequestHeader('X-Bz-File-Name', encodeURIComponent(b2FileName || item.file.name));
    xhr.setRequestHeader('Content-Type', item.file.type || 'video/mp4');
    xhr.setRequestHeader('X-Bz-Content-Sha1', 'do_not_verify');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const now = Date.now();
        const dt = (now - _t) / 1000;
        if (dt >= 0.5) {
          _bps = _bps * 0.6 + ((e.loaded - _b) / dt) * 0.4;
          _t = now; _b = e.loaded;
        }
        onProgress({ pct: Math.round((e.loaded / e.total) * 88), speed: _bps });
      }
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
// 6 streams simultâneos direto ao B2 (não passa pelo backend).
// Janela deslizante: quando uma parte termina, a próxima começa imediatamente.
const PARALLEL_PARTS = 6;

async function doLargeUploadXHR(item, onProgress, signal, resumeState) {
  const file = item.file;
  let fileId = resumeState?.fileId;
  let serverFilename = null;

  const totalParts = Math.ceil(file.size / PART_SIZE);
  const partProg = new Array(totalParts).fill(0);
  const partBytes = new Array(totalParts).fill(0); // bytes carregados por parte (para velocidade)

  // Fila de índices de partes que precisam ser enviadas.
  // Resume usa números reais de parte (não contagem) para detectar buracos
  // deixados por uploads paralelos que falharam no meio.
  const toUpload = [];
  if (fileId) {
    const { data } = await api.post('/upload/list-parts', { fileId });
    const done = new Set(data.parts.map(p => p.partNumber)); // números 1-based
    for (let i = 0; i < totalParts; i++) {
      if (done.has(i + 1)) { partProg[i] = 1; partBytes[i] = PART_SIZE; }
      else toUpload.push(i);
    }
    onProgress({ pct: Math.round(((totalParts - toUpload.length) / totalParts) * 88), fileId, partsDone: totalParts - toUpload.length, totalParts, speed: 0 });
  } else {
    const { data: { fileId: newId, filename: sName } } = await api.post('/upload/start-large', {
      filename: file.name,
      contentType: file.type || 'video/mp4',
    });
    fileId = newId;
    serverFilename = sName;
    for (let i = 0; i < totalParts; i++) toUpload.push(i);
    onProgress({ pct: 0, fileId, partsDone: 0, totalParts, speed: 0 });
  }

  // Rastreamento de velocidade com média exponencial (suaviza picos)
  let _bps = 0, _speedT = Date.now(), _speedB = 0;

  function reportProgress() {
    const done = partProg.reduce((s, p) => s + p, 0);
    const partsDone = partProg.filter(p => p >= 1).length;

    const totalLoaded = partBytes.reduce((s, b) => s + b, 0);
    const now = Date.now();
    const dt = (now - _speedT) / 1000;
    if (dt >= 0.5) {
      const sample = (totalLoaded - _speedB) / dt;
      _bps = _bps * 0.6 + sample * 0.4; // EMA suaviza variações
      _speedT = now;
      _speedB = totalLoaded;
    }

    onProgress({ pct: Math.round((done / totalParts) * 88), fileId, partsDone, totalParts, speed: _bps });
  }

  const parallelCount = Math.min(PARALLEL_PARTS, toUpload.length);
  if (parallelCount > 0) {
    // Uma URL por worker, reutilizada para todas as suas partes.
    // B2 permite reuso — reduz chamadas ao backend de N partes para PARALLEL_PARTS.
    const initUrls = await Promise.all(
      Array.from({ length: parallelCount }, () =>
        api.post('/upload/part-url', { fileId }).then(r => r.data)
      )
    );

    let queueIdx = 0; // ponteiro atômico na fila toUpload

    async function worker(partUrl) {
      let url = partUrl;
      while (true) {
        if (signal?.aborted) throw new Error('paused');
        const qi = queueIdx++;
        if (qi >= toUpload.length) break;
        const i = toUpload[qi]; // índice real da parte (0-based)

        const start = i * PART_SIZE;
        const chunk = file.slice(start, Math.min(start + PART_SIZE, file.size));
        const partNumber = i + 1;
        let attempts = 0;

        while (true) {
          try {
            await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', url.uploadUrl);
              xhr.setRequestHeader('Authorization', url.authorizationToken);
              xhr.setRequestHeader('X-Bz-Part-Number', String(partNumber));
              // do_not_verify: B2 armazena SHA1 real; backend busca via list-parts.
              xhr.setRequestHeader('X-Bz-Content-Sha1', 'do_not_verify');

              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  partBytes[i] = e.loaded;
                  partProg[i] = e.loaded / e.total;
                  reportProgress();
                }
              };
              xhr.onload = () => {
                if (xhr.status < 300) { partProg[i] = 1; resolve(); }
                else reject(Object.assign(new Error(`HTTP ${xhr.status}`), { status: xhr.status }));
              };
              // onerror inclui ERR_CONNECTION_REFUSED, pod B2 offline, etc.
              xhr.onerror = () => reject(Object.assign(new Error('connection'), { status: 0 }));
              signal?.addEventListener('abort', () => { xhr.abort(); reject(new Error('paused')); });
              xhr.send(chunk);
            });
            break; // sucesso
          } catch (err) {
            if (err.message === 'paused') throw err;
            // Qualquer erro de rede ou 503: tenta até 3x com nova URL do B2
            if (attempts < 3) {
              attempts++;
              partProg[i] = 0; // zera progresso para não mostrar barra incompleta
              await new Promise(r => setTimeout(r, 1500 * attempts));
              const { data } = await api.post('/upload/part-url', { fileId });
              url = data;
            } else {
              throw err;
            }
          }
        }
      }
    }

    await Promise.all(initUrls.map(url => worker(url)));
  }

  // partSha1Array vazio → backend usa list-parts para pegar SHA1s reais do B2
  const { data: { cdnUrl } } = await api.post('/upload/finish-large', {
    fileId,
    filename: serverFilename || file.name,
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
      speed: 0,          // bytes/s
      totalParts: null,  // total de partes (null = arquivo pequeno)
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
            ({ pct, fileId, partsDone, totalParts, speed }) => {
              updateFile(item.id, {
                progress: pct,
                resumeState: { fileId, partsDone },
                totalParts,
                speed,
              });
            },
            controller.signal,
            item.resumeState,
          );
        } else {
          const { data: presign } = await api.get('/upload/presign', { params: { filename: item.file.name } });
          const b2Name = presign.b2FileName || item.file.name;
          await doUploadXHR(item, presign, b2Name, ({ pct, speed }) => updateFile(item.id, { progress: pct, speed }), controller.signal);
          cdnUrl = `${presign.cdnBase}/${encodeURIComponent(b2Name)}`;
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
                        <option value="color">Colorido</option>
                        <option value="bw">Preto e Branco</option>
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

                {item.status === 'uploading' && (
                  <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: '0.72rem', color: '#888' }}>
                    {item.speed > 512 && (
                      <span style={{ color: '#46d369', fontWeight: 600 }}>{formatSpeed(item.speed)}</span>
                    )}
                    {item.speed > 512 && item.progress > 0 && item.progress < 88 && (() => {
                      const loaded = (item.progress / 88) * item.file.size;
                      const eta = formatETA((item.file.size - loaded) / item.speed);
                      return eta ? <span>{eta}</span> : null;
                    })()}
                    {item.totalParts && item.resumeState && (
                      <span>Parte {item.resumeState.partsDone + 1}/{item.totalParts}</span>
                    )}
                    {item.progress > 0 && (
                      <span>{item.progress}%</span>
                    )}
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
