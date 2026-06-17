'use client';
import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import api from '../../../lib/api';
import styles from './page.module.css';

// ─── helpers ───────────────────────────────────────────────────────────────

function Badge({ text, color }) {
  const colors = { green: '#46d369', orange: '#ffa500', red: '#E50914', blue: '#0071eb' };
  return (
    <span style={{
      background: colors[color] || '#333', color: color === 'orange' ? '#000' : '#fff',
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
    }}>
      {text}
    </span>
  );
}

function Spinner() {
  return <div className={styles.spinner} />;
}

// ─── Tab: Busca por Nome ──────────────────────────────────────────────────

function BuscaTab() {
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [mediaType, setMediaType] = useState('movie');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [version, setVersion] = useState('dubbing');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);
  const debounceRef = useRef(null);

  const search = useCallback(async (q, type, yr) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    setSelected(null);
    setSavedMsg(null);
    try {
      const params = new URLSearchParams({ q: q.trim(), type });
      if (yr) params.set('year', yr);
      const { data } = await api.get(`/tmdb/search-multiple?${params}`);
      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onQueryChange = (val) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val, mediaType, year), 500);
  };

  const onTypeChange = (val) => {
    setMediaType(val);
    if (query) search(query, val, year);
  };

  const onYearChange = (val) => {
    setYear(val);
    if (query) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(query, mediaType, val), 600);
    }
  };

  const handleSelect = async (item) => {
    setSelected({ ...item, loading: true });
    setResults([]);
    setQuery(item.title);
    setSavedMsg(null);
    try {
      const { data } = await api.get(`/tmdb/search?q=${encodeURIComponent(item.title)}&type=${mediaType}&year=${item.year || ''}`);
      setSelected(data ? { ...data, _type: mediaType } : null);
    } catch {
      setSelected(item);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const { data } = await api.post(`/tmdb/import/${selected.id || selected.tmdb_id}`, {
        type: mediaType,
        fileUrl: fileUrl.trim() || undefined,
        version,
      });
      setSavedMsg({ ok: true, title: data.data?.title || data.data?.name || 'Cadastrado!' });
      setSelected(null);
      setFileUrl('');
      setQuery('');
    } catch (e) {
      setSavedMsg({ ok: false, msg: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  const isMovie = mediaType === 'movie';
  const title = selected?.title || selected?.name;
  const yr = selected?.year || (selected?.release_date || selected?.first_air_date || '').split('-')[0];
  const dur = selected?.runtime || selected?.episode_run_time?.[0];
  const rating = selected?.vote_average || selected?.rating;

  return (
    <div className={styles.tabContent}>
      {/* Search bar */}
      <div className={styles.searchRow}>
        <div className={styles.searchInputWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder={`Nome do ${isMovie ? 'filme' : 'série'}...`}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search(query, mediaType, year)}
            autoComplete="off"
          />
          {searching && <Spinner />}
        </div>
        <select className={styles.select} value={mediaType} onChange={e => onTypeChange(e.target.value)}>
          <option value="movie">🎬 Filme</option>
          <option value="tv">📺 Série</option>
        </select>
        <input
          className={styles.yearInput}
          type="number"
          placeholder="Ano"
          value={year}
          min={1900}
          max={2030}
          onChange={e => onYearChange(e.target.value)}
        />
        <button className={styles.btnSearch} onClick={() => search(query, mediaType, year)} disabled={searching}>
          Buscar
        </button>
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className={styles.resultsBox}>
          <p className={styles.resultsHint}>Selecione o título correto:</p>
          <div className={styles.resultsGrid}>
            {results.map(r => (
              <button key={r.id} className={styles.resultCard} onClick={() => handleSelect(r)}>
                <div className={styles.resultPoster}>
                  {r.poster_url ? (
                    <img src={r.poster_url} alt={r.title} className={styles.resultImg} />
                  ) : (
                    <div className={styles.resultNoPoster}>
                      <span>🎬</span>
                    </div>
                  )}
                </div>
                <div className={styles.resultInfo}>
                  <p className={styles.resultTitle}>{r.title}</p>
                  <p className={styles.resultYear}>{r.year || '—'}</p>
                  {r.rating > 0 && <p className={styles.resultRating}>★ {r.rating}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected movie detail */}
      {selected && !selected.loading && (
        <div className={styles.selectedBox}>
          <div className={styles.selectedHeader}>
            <div className={styles.selectedPosterWrap}>
              {selected.poster_url || selected.poster_path ? (
                <img
                  src={selected.poster_url || `https://image.tmdb.org/t/p/w300${selected.poster_path}`}
                  alt={title}
                  className={styles.selectedPoster}
                />
              ) : (
                <div className={styles.noPoster}>🎬</div>
              )}
            </div>
            <div className={styles.selectedMeta}>
              <h2 className={styles.selectedTitle}>{title}</h2>
              {selected.original_title && selected.original_title !== title && (
                <p className={styles.selectedOriginal}>{selected.original_title}</p>
              )}
              <div className={styles.selectedTags}>
                {yr && <Badge text={yr} color="blue" />}
                {dur && <Badge text={`${dur}min`} color="blue" />}
                {rating > 0 && <Badge text={`★ ${parseFloat(rating).toFixed(1)}`} color="orange" />}
                {selected.age_rating && <Badge text={selected.age_rating} color="red" />}
              </div>
              {selected.genres?.length > 0 && (
                <p className={styles.selectedGenres}>
                  {selected.genres.map(g => g.name || g).join(' · ')}
                </p>
              )}
              {selected.overview && (
                <p className={styles.selectedOverview}>{selected.overview}</p>
              )}
            </div>
          </div>

          <div className={styles.fileSection}>
            <div className={styles.fileRow}>
              <div className={styles.fileField}>
                <label className={styles.label}>URL do arquivo no Backblaze (opcional)</label>
                <input
                  className={styles.input}
                  type="url"
                  placeholder="https://cineflix.victorlima0978.workers.dev/nome-do-arquivo.mkv"
                  value={fileUrl}
                  onChange={e => setFileUrl(e.target.value)}
                />
                <span className={styles.hint}>Deixe em branco para cadastrar só os metadados agora e adicionar o vídeo depois</span>
              </div>
              <div className={styles.versionField}>
                <label className={styles.label}>Versão</label>
                <select className={styles.select} value={version} onChange={e => setVersion(e.target.value)}>
                  <option value="dubbing">🎙 Dublado</option>
                  <option value="subtitled">💬 Legendado</option>
                  <option value="cinema">🎞 Cinema / Original</option>
                  <option value="4k">4K</option>
                </select>
              </div>
            </div>

            <div className={styles.saveRow}>
              <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                {saving ? <><Spinner /> Cadastrando...</> : `✓ Cadastrar ${isMovie ? 'Filme' : 'Série'}`}
              </button>
              <button className={styles.btnCancel} onClick={() => { setSelected(null); setResults([]); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {selected?.loading && (
        <div className={styles.loadingBox}>
          <Spinner /> <span>Carregando detalhes do TMDB...</span>
        </div>
      )}

      {savedMsg && (
        <div className={savedMsg.ok ? styles.alertSuccess : styles.alertError}>
          {savedMsg.ok ? `✓ "${savedMsg.title}" cadastrado com sucesso!` : `✗ Erro: ${savedMsg.msg}`}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Importar por URL ────────────────────────────────────────────────

function ImportarTab() {
  const [input, setInput] = useState('');
  const [version, setVersion] = useState('dubbing');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const urlCount = input.split('\n').filter(l => l.trim().startsWith('http')).length;

  async function handleImport() {
    const urls = input.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
    if (!urls.length) return;
    setLoading(true);
    setReport(null);
    try {
      const files = urls.map(url => ({ url, version }));
      const { data } = await api.post('/tmdb/batch', { files });
      setReport(data);
    } catch (err) {
      setReport({ error: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.batchInfo}>
        <div className={styles.infoIcon}>🤖</div>
        <div>
          <p className={styles.infoTitle}>Importação automática via Bot TMDB</p>
          <p className={styles.infoDesc}>
            Cole as URLs dos arquivos do Backblaze (uma por linha). O bot detecta automaticamente o nome
            pelo padrão do arquivo, busca no TMDB e cadastra com todos os metadados.
          </p>
          <p className={styles.infoDesc}>
            Padrões reconhecidos: <code>Filme.2024.Dublado.mkv</code> · <code>Serie.S01E01.mkv</code>
          </p>
        </div>
      </div>

      <div className={styles.batchForm}>
        <label className={styles.label}>URLs dos arquivos (uma por linha)</label>
        <textarea
          className={styles.textarea}
          rows={8}
          placeholder={`https://cineflix.victorlima0978.workers.dev/Avengers.Endgame.2019.Dublado.1080p.mkv\nhttps://cineflix.victorlima0978.workers.dev/Breaking.Bad.S01E01.Dublado.mkv`}
          value={input}
          onChange={e => setInput(e.target.value)}
        />

        <div className={styles.batchControls}>
          <div>
            <label className={styles.label}>Versão dos arquivos</label>
            <select className={styles.select} value={version} onChange={e => setVersion(e.target.value)}>
              <option value="dubbing">🎙 Dublado</option>
              <option value="subtitled">💬 Legendado</option>
              <option value="cinema">🎞 Cinema / Original</option>
              <option value="4k">4K</option>
            </select>
          </div>
          <button
            className={styles.btnImport}
            onClick={handleImport}
            disabled={loading || urlCount === 0}
          >
            {loading ? <><Spinner /> Importando...</> : `🚀 Importar ${urlCount} arquivo${urlCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {report && (
        <div className={styles.report}>
          <div className={styles.reportHeader}>
            <h3 className={styles.reportTitle}>Relatório de importação</h3>
            <div className={styles.reportSummary}>
              <span className={styles.sumOk}>✓ {report.success?.length || 0} importados</span>
              <span className={styles.sumWarn}>? {report.notFound?.length || 0} não encontrados</span>
              <span className={styles.sumErr}>✗ {report.errors?.length || 0} erros</span>
            </div>
          </div>

          {report.error && (
            <div className={styles.alertError}>{report.error}</div>
          )}

          {report.success?.length > 0 && (
            <div className={styles.reportSection}>
              <h4 className={styles.reportOk}>✓ Importados com sucesso</h4>
              <ul className={styles.reportList}>
                {report.success.map((item, i) => (
                  <li key={i} className={styles.reportItem}>
                    <span className={styles.itemBadge} style={{ background: item.type === 'movie' ? '#0071eb' : '#7b2ff7' }}>
                      {item.type === 'movie' ? 'FILME' : 'SÉRIE'}
                    </span>
                    <span className={styles.itemTitle}>{item.title}</span>
                    {item.season != null && (
                      <span className={styles.itemEp}>T{item.season}E{String(item.episode).padStart(2, '0')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.notFound?.length > 0 && (
            <div className={styles.reportSection}>
              <h4 className={styles.reportWarn}>Não encontrados no TMDB</h4>
              <ul className={styles.reportList}>
                {report.notFound.map((item, i) => (
                  <li key={i} className={styles.reportItem}>
                    <span className={styles.itemBadge} style={{ background: '#555' }}>?</span>
                    <span className={styles.itemTitle}>{item.name}</span>
                    <span className={styles.itemFaded}>{item.filename}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.errors?.length > 0 && (
            <div className={styles.reportSection}>
              <h4 className={styles.reportError}>Erros</h4>
              <ul className={styles.reportList}>
                {report.errors.map((item, i) => (
                  <li key={i} className={styles.reportItem}>
                    <span className={styles.itemBadge} style={{ background: '#E50914' }}>!</span>
                    <span className={styles.itemTitle}>{item.filename}</span>
                    <span className={styles.itemFaded}>{item.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ImportarPage() {
  const [tab, setTab] = useState('busca');

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageIcon}>🤖</div>
        <div>
          <h1 className={styles.pageTitle}>TMDB Bot</h1>
          <p className={styles.pageDesc}>Cadastre filmes e séries automaticamente com metadados do TMDB</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'busca' ? styles.tabActive : ''}`}
          onClick={() => setTab('busca')}
        >
          🔍 Busca por Nome
        </button>
        <button
          className={`${styles.tab} ${tab === 'batch' ? styles.tabActive : ''}`}
          onClick={() => setTab('batch')}
        >
          📋 Importar por URL
        </button>
      </div>

      {tab === 'busca' ? <BuscaTab /> : <ImportarTab />}
    </div>
  );
}
