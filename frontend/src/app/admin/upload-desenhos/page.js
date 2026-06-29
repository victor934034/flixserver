'use client';
import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../../../lib/api';
import styles from './page.module.css';

// ─── Upload helpers (same logic as /admin/upload) ────────────────────────────

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

const LARGE_FILE_THRESHOLD = 200 * 1024 * 1024;
const PART_SIZE = 100 * 1024 * 1024;
const PARALLEL_PARTS = 6;

function doUploadXHR(file, presign, onProgress, signal) {
  let _bps = 0, _t = Date.now(), _b = 0;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', presign.uploadUrl);
    xhr.setRequestHeader('Authorization', presign.authorizationToken);
    xhr.setRequestHeader('X-Bz-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.setRequestHeader('X-Bz-Content-Sha1', 'do_not_verify');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const now = Date.now();
        const dt = (now - _t) / 1000;
        if (dt >= 0.5) { _bps = _bps * 0.6 + ((e.loaded - _b) / dt) * 0.4; _t = now; _b = e.loaded; }
        onProgress({ pct: Math.round((e.loaded / e.total) * 95), speed: _bps });
      }
    };
    xhr.onload = () => xhr.status < 300 ? resolve() : reject(Object.assign(new Error(`HTTP ${xhr.status}`), { isServer: true }));
    xhr.onerror = () => reject(new Error('connection'));
    signal?.addEventListener('abort', () => { xhr.abort(); reject(new Error('paused')); });
    xhr.send(file);
  });
}

async function doLargeUploadXHR(file, onProgress, signal, resumeState) {
  let fileId = resumeState?.fileId;
  let serverFilename = null;
  const totalParts = Math.ceil(file.size / PART_SIZE);
  const partProg = new Array(totalParts).fill(0);
  const partBytes = new Array(totalParts).fill(0);
  const toUpload = [];

  if (fileId) {
    const { data } = await api.post('/upload/list-parts', { fileId });
    const done = new Set(data.parts.map(p => p.partNumber));
    for (let i = 0; i < totalParts; i++) {
      if (done.has(i + 1)) { partProg[i] = 1; partBytes[i] = PART_SIZE; }
      else toUpload.push(i);
    }
    onProgress({ pct: Math.round(((totalParts - toUpload.length) / totalParts) * 95), fileId, speed: 0 });
  } else {
    const { data: { fileId: newId, filename: sName } } = await api.post('/upload/start-large', {
      filename: file.name, contentType: file.type || 'video/mp4',
    });
    fileId = newId; serverFilename = sName;
    for (let i = 0; i < totalParts; i++) toUpload.push(i);
    onProgress({ pct: 0, fileId, speed: 0 });
  }

  let _bps = 0, _speedT = Date.now(), _speedB = 0;
  function reportProgress() {
    const done = partProg.reduce((s, p) => s + p, 0);
    const totalLoaded = partBytes.reduce((s, b) => s + b, 0);
    const now = Date.now(); const dt = (now - _speedT) / 1000;
    if (dt >= 0.5) { _bps = _bps * 0.6 + ((totalLoaded - _speedB) / dt) * 0.4; _speedT = now; _speedB = totalLoaded; }
    onProgress({ pct: Math.round((done / totalParts) * 95), fileId, speed: _bps });
  }

  const parallelCount = Math.min(PARALLEL_PARTS, toUpload.length);
  if (parallelCount > 0) {
    const initUrls = await Promise.all(
      Array.from({ length: parallelCount }, () => api.post('/upload/part-url', { fileId }).then(r => r.data))
    );
    let queueIdx = 0;
    async function worker(url) {
      while (true) {
        if (signal?.aborted) throw new Error('paused');
        const qi = queueIdx++;
        if (qi >= toUpload.length) break;
        const i = toUpload[qi];
        const start = i * PART_SIZE;
        const chunk = file.slice(start, Math.min(start + PART_SIZE, file.size));
        let attempts = 0;
        while (true) {
          try {
            await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', url.uploadUrl);
              xhr.setRequestHeader('Authorization', url.authorizationToken);
              xhr.setRequestHeader('X-Bz-Part-Number', String(i + 1));
              xhr.setRequestHeader('X-Bz-Content-Sha1', 'do_not_verify');
              xhr.upload.onprogress = (e) => { if (e.lengthComputable) { partBytes[i] = e.loaded; partProg[i] = e.loaded / e.total; reportProgress(); } };
              xhr.onload = () => { if (xhr.status < 300) { partProg[i] = 1; resolve(); } else reject(Object.assign(new Error(`HTTP ${xhr.status}`), { status: xhr.status })); };
              xhr.onerror = () => reject(Object.assign(new Error('connection'), { status: 0 }));
              signal?.addEventListener('abort', () => { xhr.abort(); reject(new Error('paused')); });
              xhr.send(chunk);
            });
            break;
          } catch (err) {
            if (err.message === 'paused') throw err;
            if (attempts++ < 3) { await new Promise(r => setTimeout(r, 1500 * attempts)); const { data } = await api.post('/upload/part-url', { fileId }); url = data; }
            else throw err;
          }
        }
      }
    }
    await Promise.all(initUrls.map(url => worker(url)));
  }

  const { data: { cdnUrl } } = await api.post('/upload/finish-large', {
    fileId, filename: serverFilename || file.name, partSha1Array: [],
  });
  return cdnUrl;
}

async function uploadFileToCDN(file, onProgress, signal, resumeState) {
  if (file.size >= LARGE_FILE_THRESHOLD) {
    return await doLargeUploadXHR(file, onProgress, signal, resumeState);
  }
  const { data: presign } = await api.get('/upload/presign');
  await doUploadXHR(file, presign, onProgress, signal);
  return `${presign.cdnBase}/${encodeURIComponent(file.name)}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UploadDesenhosPage() {
  const [step, setStep] = useState('search'); // 'search' | 'seasons' | 'episodes'
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [noResults, setNoResults] = useState(false);

  const [series, setSeries] = useState(null);   // { tmdb_id, db_id, title, poster_url, total_seasons }
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);

  const [episodes, setEpisodes] = useState([]);  // TMDB episodes, augmented with { file, status, progress, error, ... }
  const [loadingEps, setLoadingEps] = useState(false);
  const [version, setVersion] = useState('dubbing');
  const [uploading, setUploading] = useState(false);

  const abortRefs = useRef({});
  const fileInputRefs = useRef({});  // ep_number → input element

  // ── Search ──
  async function handleSearch(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setNoResults(false);
    setResults([]);
    try {
      const { data } = await api.get('/tmdb/search-multiple', { params: { q: query.trim(), type: 'tv' } });
      setResults(data || []);
      setNoResults(!data || data.length === 0);
    } catch {
      setNoResults(true);
    } finally {
      setSearching(false);
    }
  }

  // ── Select series → get seasons ──
  async function handleSelectSeries(r) {
    setResults([]);
    setNoResults(false);
    try {
      // Ensure series exists in DB
      const importRes = await api.post(`/tmdb/import/${r.id}`, { type: 'series' });
      const db_id = importRes.data?.data?.id;

      // Get seasons from TMDB
      const { data } = await api.get(`/tmdb/tv-seasons/${r.id}`);
      setSeries({ tmdb_id: r.id, db_id, title: r.title, poster_url: r.poster_url, year: r.year });
      setSeasons(data.seasons || []);
      setStep('seasons');
    } catch (err) {
      alert('Erro ao carregar série: ' + (err.response?.data?.error || err.message));
    }
  }

  // ── Select season → get episodes ──
  async function handleSelectSeason(season) {
    setSelectedSeason(season);
    setLoadingEps(true);
    try {
      const { data } = await api.get(`/tmdb/tv-season/${series.tmdb_id}/${season.season_number}`);
      setEpisodes((data.episodes || []).map(ep => ({
        ...ep,
        file: null,
        status: 'pending',
        progress: 0,
        error: null,
        cdnUrl: null,
        resumeState: null,
        speed: 0,
      })));
      setStep('episodes');
    } catch (err) {
      alert('Erro ao carregar episódios: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingEps(false);
    }
  }

  // ── Assign dropped files ──
  const onDrop = useCallback((acceptedFiles) => {
    const sorted = [...acceptedFiles].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setEpisodes(prev => {
      const updated = [...prev];
      const pending = updated.filter(ep => !ep.file && ep.status === 'pending');
      sorted.forEach((file, i) => {
        if (i < pending.length) {
          const idx = updated.indexOf(pending[i]);
          if (idx !== -1) updated[idx] = { ...updated[idx], file };
        }
      });
      return updated;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mkv', '.avi', '.mov', '.m4v'] },
    multiple: true,
    noClick: false,
  });

  function assignFileToEp(epNum, file) {
    setEpisodes(prev => prev.map(ep =>
      ep.episode_number === epNum ? { ...ep, file } : ep
    ));
  }

  function clearEpFile(epNum) {
    setEpisodes(prev => prev.map(ep =>
      ep.episode_number === epNum ? { ...ep, file: null } : ep
    ));
  }

  function updateEp(epNum, patch) {
    setEpisodes(prev => prev.map(ep =>
      ep.episode_number === epNum ? { ...ep, ...patch } : ep
    ));
  }

  // ── Upload all assigned episodes ──
  async function startUpload() {
    const toUpload = episodes.filter(ep => ep.file && ep.status === 'pending');
    if (toUpload.length === 0) return;
    setUploading(true);

    for (const ep of toUpload) {
      const controller = new AbortController();
      abortRefs.current[ep.episode_number] = controller;
      updateEp(ep.episode_number, { status: 'uploading', progress: 0, error: null });

      try {
        const cdnUrl = await uploadFileToCDN(
          ep.file,
          ({ pct, fileId, speed }) => updateEp(ep.episode_number, { progress: pct, speed, resumeState: fileId ? { fileId } : ep.resumeState }),
          controller.signal,
          ep.resumeState,
        );

        // Save episode in DB
        const epData = {
          series_id: series.db_id,
          season_number: selectedSeason.season_number,
          episode_number: ep.episode_number,
          title: ep.title,
          synopsis: ep.description || null,
          thumbnail_url: ep.thumbnail_url || null,
          duration: ep.runtime ? ep.runtime * 60 : null,
          is_active: true,
          [`file_${version}`]: cdnUrl,
        };

        await api.post('/admin/episodes', epData);
        updateEp(ep.episode_number, { status: 'done', progress: 100, cdnUrl, error: null });
        delete abortRefs.current[ep.episode_number];
      } catch (err) {
        if (err.message === 'paused') {
          updateEp(ep.episode_number, { status: 'paused', error: null });
        } else {
          const msg = err.response?.data?.error || err.message;
          updateEp(ep.episode_number, { status: 'error', error: msg });
        }
        delete abortRefs.current[ep.episode_number];
      }
    }

    setUploading(false);
  }

  // ── Counts ──
  const assignedCount = episodes.filter(ep => ep.file).length;
  const doneCount = episodes.filter(ep => ep.status === 'done').length;
  const pendingWithFile = episodes.filter(ep => ep.file && ep.status === 'pending').length;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className={styles.heading}>Upload de Desenhos</h1>
      <p className={styles.subheading}>
        Pesquise a série no TMDB, selecione a temporada e faça upload dos episódios com metadados automáticos.
      </p>

      {/* ── Step: search ── */}
      {step === 'search' && (
        <>
          <form onSubmit={handleSearch} className={styles.searchRow}>
            <input
              className={styles.searchInput}
              placeholder="Nome da série (ex: Avatar A Lenda de Aang)"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button type="submit" className={styles.btnSearch} disabled={searching}>
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {noResults && <p className={styles.noResults}>Nenhuma série encontrada. Tente outro nome.</p>}

          {results.length > 0 && (
            <div className={styles.resultsGrid}>
              {results.map(r => (
                <div key={r.id} className={styles.resultCard} onClick={() => handleSelectSeries(r)}>
                  {r.poster_url
                    ? <img src={r.poster_url} alt={r.title} className={styles.resultPoster} />
                    : <div className={styles.resultPoster} style={{ background: '#1a1a1a' }} />
                  }
                  <div className={styles.resultInfo}>
                    <div className={styles.resultTitle}>{r.title}</div>
                    {r.year && <div className={styles.resultYear}>{r.year}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Step: seasons ── */}
      {step === 'seasons' && series && (
        <>
          <div className={styles.breadcrumb}>
            <button onClick={() => { setStep('search'); setSeries(null); setSeasons([]); }}>← Voltar</button>
          </div>

          <div className={styles.seriesBanner}>
            {series.poster_url
              ? <img src={series.poster_url} alt={series.title} className={styles.seriesBannerPoster} />
              : <div className={styles.seriesBannerPoster} />
            }
            <div>
              <div className={styles.seriesBannerTitle}>{series.title}</div>
              <div className={styles.seriesBannerSub}>{series.year} · {seasons.length} temporada(s)</div>
            </div>
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Selecione a temporada que deseja fazer upload:
          </p>

          <div className={styles.seasonsGrid}>
            {seasons.map(s => (
              <div key={s.season_number} className={styles.seasonCard} onClick={() => handleSelectSeason(s)}>
                <div className={styles.seasonNum}>T{s.season_number}</div>
                <div className={styles.seasonEpCount}>{s.episode_count} ep</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Step: episodes ── */}
      {step === 'episodes' && series && selectedSeason && (
        <>
          <div className={styles.breadcrumb}>
            <button onClick={() => { setStep('search'); setSeries(null); setSeasons([]); setEpisodes([]); }}>Início</button>
            <span>›</span>
            <button onClick={() => { setStep('seasons'); setEpisodes([]); setSelectedSeason(null); }}>{series.title}</button>
            <span>›</span>
            <span>Temporada {selectedSeason.season_number}</span>
          </div>

          <div className={styles.seriesBanner}>
            {series.poster_url
              ? <img src={series.poster_url} alt={series.title} className={styles.seriesBannerPoster} />
              : <div className={styles.seriesBannerPoster} />
            }
            <div>
              <div className={styles.seriesBannerTitle}>{series.title} — Temporada {selectedSeason.season_number}</div>
              <div className={styles.seriesBannerSub}>{selectedSeason.episode_count} episódios · {doneCount} enviados</div>
            </div>
          </div>

          {loadingEps ? (
            <p className={styles.loading}>Carregando episódios...</p>
          ) : (
            <>
              {/* Drop zone */}
              <div {...getRootProps()} className={`${styles.dropzone} ${isDragActive ? styles.active : ''}`}>
                <input {...getInputProps()} />
                <p className={styles.dropText}>
                  {isDragActive
                    ? 'Solte os arquivos aqui'
                    : 'Arraste os arquivos de vídeo — serão atribuídos em ordem de nome'}
                </p>
                <p className={styles.dropSub}>
                  {assignedCount > 0 ? `${assignedCount} arquivo(s) atribuído(s)` : 'MP4, MKV, AVI, MOV'}
                </p>
              </div>

              {/* Controls */}
              <div className={styles.controlsRow}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Versão:</label>
                <select className={styles.versionSelect} value={version} onChange={e => setVersion(e.target.value)}>
                  <option value="dubbing">Dublado</option>
                  <option value="subtitled">Legendado</option>
                  <option value="cinema">Cinema</option>
                  <option value="4k">4K</option>
                </select>

                {pendingWithFile > 0 && !uploading && (
                  <button className={styles.btnStart} onClick={startUpload}>
                    ▶ Iniciar Upload ({pendingWithFile})
                  </button>
                )}
                {uploading && <span style={{ marginLeft: 'auto', color: 'var(--warning)', fontWeight: 600, fontSize: '0.9rem' }}>Enviando...</span>}
              </div>

              {/* Episode list */}
              <div className={styles.epList}>
                {episodes.map(ep => (
                  <div
                    key={ep.episode_number}
                    className={`${styles.epRow} ${ep.status === 'done' ? styles.done : ''} ${ep.status === 'error' ? styles.error : ''} ${ep.file && ep.status === 'pending' ? styles.hasFile : ''}`}
                  >
                    {ep.thumbnail_url
                      ? <img src={ep.thumbnail_url} alt="" className={styles.epThumb} />
                      : <div className={styles.epThumbPlaceholder} />
                    }

                    <div className={styles.epInfo}>
                      <div className={styles.epNum}>Ep {ep.episode_number}</div>
                      <div className={styles.epTitle}>{ep.title || `Episódio ${ep.episode_number}`}</div>
                      {ep.status === 'pending' && ep.file && (
                        <div className={styles.epFile}>
                          {ep.file.name} · {formatSize(ep.file.size)}
                        </div>
                      )}
                      {ep.status === 'pending' && !ep.file && (
                        <div className={styles.epNoFile}>Sem arquivo</div>
                      )}
                      {ep.status === 'uploading' && (
                        <div className={styles.progressWrap}>
                          <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: `${ep.progress}%` }} />
                          </div>
                          <div className={styles.progressMeta}>
                            {ep.speed > 512 && <span className={styles.progressSpeed}>{formatSpeed(ep.speed)}</span>}
                            <span>{ep.progress}%</span>
                          </div>
                        </div>
                      )}
                      {ep.status === 'error' && ep.error && (
                        <div className={styles.errorMsg}>{ep.error}</div>
                      )}
                    </div>

                    <div className={styles.epActions}>
                      {ep.status === 'done' && <span className={styles.badgeDone}>✓ Enviado</span>}
                      {ep.status === 'uploading' && <span className={styles.badgeUploading}>{ep.progress}%</span>}
                      {ep.status === 'pending' && (
                        <>
                          {/* Hidden file input per episode */}
                          <input
                            type="file"
                            accept="video/*,.mkv"
                            style={{ display: 'none' }}
                            ref={el => { fileInputRefs.current[ep.episode_number] = el; }}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) assignFileToEp(ep.episode_number, f);
                              e.target.value = '';
                            }}
                          />
                          <button
                            className={styles.btnPickFile}
                            onClick={() => fileInputRefs.current[ep.episode_number]?.click()}
                          >
                            Selecionar
                          </button>
                          {ep.file && (
                            <button className={styles.btnClear} onClick={() => clearEpFile(ep.episode_number)} title="Remover arquivo">
                              ×
                            </button>
                          )}
                        </>
                      )}
                      {ep.status === 'error' && (
                        <button
                          className={styles.btnPickFile}
                          onClick={() => updateEp(ep.episode_number, { status: 'pending', error: null, progress: 0 })}
                        >
                          Tentar novamente
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
