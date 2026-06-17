'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '../../../../lib/api';
import styles from './page.module.css';

const EMPTY = {
  title: '', original_title: '', synopsis: '', year: '', duration: '', rating: '',
  genres: '', poster_url: '', backdrop_url: '', trailer_url: '', age_rating: '',
  file_dubbing: '', file_subtitled: '', file_cinema: '', file_4k: '',
  subtitle_pt: '', subtitle_en: '', subtitle_es: '',
  is_active: true, is_featured: false,
};

export default function NovoFilme() {
  const [form, setForm] = useState(EMPTY);
  const [tmdbSearch, setTmdbSearch] = useState('');
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbSuggestions, setTmdbSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const debounceRef = useRef(null);

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleTmdbInput(value) {
    setTmdbSearch(value);
    clearTimeout(debounceRef.current);
    if (!value.trim() || value.length < 2) { setTmdbSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/tmdb/search-multiple?q=${encodeURIComponent(value)}&type=movie`);
        setTmdbSuggestions(data || []);
      } catch { setTmdbSuggestions([]); }
    }, 350);
  }

  async function pickTmdbSuggestion(item) {
    setTmdbSuggestions([]);
    setTmdbSearch(item.title);
    setTmdbLoading(true);
    try {
      const { data } = await api.get(`/tmdb/search?q=${encodeURIComponent(item.title)}&type=movie&year=${item.year || ''}`);
      if (!data) { setError('Não encontrado no TMDB'); return; }
      applyTmdbData(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar no TMDB');
    } finally {
      setTmdbLoading(false);
    }
  }

  async function searchTMDB() {
    if (!tmdbSearch.trim()) return;
    setTmdbSuggestions([]);
    setTmdbLoading(true);
    try {
      const { data } = await api.get(`/tmdb/search?q=${encodeURIComponent(tmdbSearch)}&type=movie`);
      if (!data) { setError('Não encontrado no TMDB'); return; }
      applyTmdbData(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar no TMDB');
    } finally {
      setTmdbLoading(false);
    }
  }

  function applyTmdbData(data) {
    setForm(prev => ({
      ...prev,
      tmdb_id: data.id,
      title: data.title || prev.title,
      original_title: data.original_title || prev.original_title,
      synopsis: data.overview || prev.synopsis,
      year: data.release_date ? data.release_date.split('-')[0] : prev.year,
      duration: data.runtime || prev.duration,
      rating: data.vote_average ? Number(data.vote_average).toFixed(1) : prev.rating,
      genres: data.genres?.map(g => g.name).join(', ') || prev.genres,
      poster_url: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : prev.poster_url,
      backdrop_url: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : prev.backdrop_url,
      trailer_url: data.videos?.results?.find(v => v.type === 'Trailer')
        ? `https://www.youtube.com/watch?v=${data.videos.results.find(v => v.type === 'Trailer').key}`
        : prev.trailer_url,
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Título é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        year: form.year ? Number(form.year) : null,
        duration: form.duration ? Number(form.duration) : null,
        rating: form.rating ? Number(form.rating) : null,
        genres: form.genres ? form.genres.split(',').map(g => g.trim()).filter(Boolean) : [],
      };
      await api.post('/admin/movies', payload);
      router.push('/admin/filmes');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className={styles.heading}>Novo Filme</h1>

      <div className={styles.tmdbBox}>
        <label className={styles.label}>Buscar no TMDB (preenche automaticamente)</label>
        <div className={styles.tmdbRow} style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Nome do filme..."
            value={tmdbSearch}
            onChange={e => handleTmdbInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchTMDB())}
            className={styles.input}
            autoComplete="off"
          />
          <button onClick={searchTMDB} disabled={tmdbLoading} className={styles.btnSearch}>
            {tmdbLoading ? 'Buscando...' : 'Buscar'}
          </button>
          {tmdbSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 80, zIndex: 50,
              background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
              overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {tmdbSuggestions.map(s => (
                <button key={s.id} onClick={() => pickTmdbSuggestion(s)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 12px', background: 'none', border: 'none',
                  borderBottom: '1px solid #2a2a2a', cursor: 'pointer', textAlign: 'left',
                  color: '#fff',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#242424'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  {s.poster_url && <img src={s.poster_url} alt="" style={{ width: 32, height: 48, borderRadius: 3, objectFit: 'cover' }} />}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{s.year} · {s.rating ? `★ ${s.rating}` : ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.col}>
            <label className={styles.label}>Título *</label>
            <input className={styles.input} value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>
          <div className={styles.col}>
            <label className={styles.label}>Título original</label>
            <input className={styles.input} value={form.original_title} onChange={e => set('original_title', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={styles.label}>Sinopse</label>
          <textarea className={styles.textarea} value={form.synopsis} onChange={e => set('synopsis', e.target.value)} rows={4} />
        </div>

        <div className={styles.row4}>
          <div>
            <label className={styles.label}>Ano</label>
            <input className={styles.input} type="number" value={form.year} onChange={e => set('year', e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Duração (min)</label>
            <input className={styles.input} type="number" value={form.duration} onChange={e => set('duration', e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Nota</label>
            <input className={styles.input} type="number" step="0.1" min="0" max="10" value={form.rating} onChange={e => set('rating', e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Classificação</label>
            <select className={styles.input} value={form.age_rating} onChange={e => set('age_rating', e.target.value)}>
              <option value="">—</option>
              {['L','10','12','14','16','18'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={styles.label}>Gêneros (separados por vírgula)</label>
          <input className={styles.input} value={form.genres} onChange={e => set('genres', e.target.value)} placeholder="Ação, Aventura, Ficção Científica" />
        </div>

        <div className={styles.row}>
          <div className={styles.col}>
            <label className={styles.label}>URL do Poster</label>
            <input className={styles.input} value={form.poster_url} onChange={e => set('poster_url', e.target.value)} />
          </div>
          <div className={styles.col}>
            <label className={styles.label}>URL do Backdrop</label>
            <input className={styles.input} value={form.backdrop_url} onChange={e => set('backdrop_url', e.target.value)} />
          </div>
        </div>

        {form.poster_url && (
          <Image src={form.poster_url} alt="poster" width={100} height={150} style={{ borderRadius: 4 }} />
        )}

        <div>
          <label className={styles.label}>URL do Trailer (YouTube)</label>
          <input className={styles.input} value={form.trailer_url} onChange={e => set('trailer_url', e.target.value)} />
        </div>

        <hr className={styles.divider} />
        <h3 className={styles.sectionTitle}>Arquivos de Vídeo</h3>

        {['dubbing', 'subtitled', 'cinema', '4k'].map(key => (
          <div key={key}>
            <label className={styles.label}>
              {key === 'dubbing' ? 'Dublado' : key === 'subtitled' ? 'Legendado' : key === 'cinema' ? 'Cinema/Original' : '4K'}
              {' '}— URL Backblaze CDN
            </label>
            <input
              className={styles.input}
              value={form[`file_${key}`]}
              onChange={e => set(`file_${key}`, e.target.value)}
              placeholder={`https://cineflix.victorlima0978.workers.dev/arquivo.mp4`}
            />
          </div>
        ))}

        <h3 className={styles.sectionTitle}>Legendas (.vtt)</h3>
        {[['subtitle_pt', 'Português'], ['subtitle_en', 'Inglês'], ['subtitle_es', 'Espanhol']].map(([key, label]) => (
          <div key={key}>
            <label className={styles.label}>{label}</label>
            <input className={styles.input} value={form[key]} onChange={e => set(key, e.target.value)} placeholder="URL do arquivo .vtt" />
          </div>
        ))}

        <div className={styles.checkRow}>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Ativo (visível no site)
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} />
            Destaque (aparecer no banner)
          </label>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Filme'}
          </button>
          <button type="button" className={styles.btnCancel} onClick={() => router.back()}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
