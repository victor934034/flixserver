'use client';
import { useState, useCallback } from 'react';
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

function doUploadXHR(item, presign, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', presign.uploadUrl);
    xhr.setRequestHeader('Authorization', presign.authorizationToken);
    xhr.setRequestHeader('X-Bz-File-Name', encodeURIComponent(item.file.name));
    xhr.setRequestHeader('Content-Type', item.file.type || 'video/mp4');
    xhr.setRequestHeader('X-Bz-Content-Sha1', 'do_not_verify');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90));
    };

    xhr.onload = () => {
      if (xhr.status < 300) resolve();
      else {
        const err = new Error(`HTTP ${xhr.status}`);
        err.isServer = true;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('connection'));
    xhr.send(item.file);
  });
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [3000, 6000, 12000];

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

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

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data: presign } = await api.get('/upload/presign');

        await doUploadXHR(item, presign, (pct) => updateFile(item.id, { progress: pct }));

        updateFile(item.id, { progress: 92 });

        const cdnUrl = `${presign.cdnBase}/${item.file.name}`;
        const { data: tmdbResult } = await api.post('/tmdb/detect', { fileUrl: cdnUrl, version: item.version });

        updateFile(item.id, { status: 'done', progress: 100, result: tmdbResult, error: null });
        return;
      } catch (err) {
        const isConnection = err.message === 'connection' || !err.isServer;
        const hasRetry = isConnection && attempt < MAX_RETRIES;

        if (hasRetry) {
          const delay = RETRY_DELAYS[attempt];
          updateFile(item.id, {
            status: 'retrying',
            progress: 0,
            error: `Falha de conexão. Tentando novamente em ${delay / 1000}s... (tentativa ${attempt + 1}/${MAX_RETRIES})`,
          });
          await new Promise(r => setTimeout(r, delay));
          updateFile(item.id, { status: 'uploading', error: null });
        } else {
          updateFile(item.id, {
            status: 'error',
            error: err.message === 'connection' ? 'Falha de conexão após 3 tentativas' : err.message,
          });
          return;
        }
      }
    }
  }

  async function retryFile(item) {
    updateFile(item.id, { status: 'pending', progress: 0, error: null, result: null });
    await uploadFile({ ...item, status: 'pending' });
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
        <p className={styles.dropSub}>MP4, MKV, AVI, MOV — múltiplos arquivos aceitos</p>
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
                    </div>
                  </div>

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

                  {item.status === 'done' && <span className={styles.badgeDone}>✓ Concluído</span>}
                  {item.status === 'error' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={styles.badgeError}>✗ Erro</span>
                      <button className={styles.btnRetry} onClick={() => retryFile(item)}>↺ Tentar novamente</button>
                    </div>
                  )}
                  {item.status === 'retrying' && <span className={styles.badgeRetrying}>↺ Reconectando...</span>}
                </div>

                {(item.status === 'uploading' || item.status === 'done') && (
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${item.progress}%` }} />
                  </div>
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
