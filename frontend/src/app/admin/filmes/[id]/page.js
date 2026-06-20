'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '../../../../lib/api';
import styles from '../novo/page.module.css';

export default function EditarFilme() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [tmdbSearch, setTmdbSearch] = useState('');
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fetchingSubs, setFetchingSubs] = useState(false);
  const [subsMsg, setSubsMsg] = useState('');

  useEffect(() => {
    api.get(`/admin/movies?q=&page=1&limit=1000`)
      .then(r => {
        const movie = (r.data.data || []).find(m => m.id === id);
        if (movie) {
          setForm({ ...movie, genres: Array.isArray(movie.genres) ? movie.genres.join(', ') : movie.genres || '' });
        } else {
          setError('Filme não encontrado');
        }
      })
      .catch(() => setError('Erro ao carregar filme'));
  }, [id]);

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function searchTMDB() {
    if (!tmdbSearch.trim()) return;
    setTmdbLoading(true);
    try {
      const { data } = await api.get(`/tmdb/search?q=${encodeURIComponent(tmdbSearch)}&type=movie`);
      if (!data) { setError('Não encontrado no TMDB'); return; }
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
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar no TMDB');
    } finally {
      setTmdbLoading(false);
    }
  }

  async function fetchSubs() {
    if (!form?.tmdb_id) { setSubsMsg('Erro: filme sem TMDB ID — busque no TMDB primeiro'); return; }
    setFetchingSubs(true);
    setSubsMsg('');
    try {
      const { data } = await api.post('/upload/fetch-subtitles', { tmdbId: form.tmdb_id, movieId: id, movieType: 'movie' });
      const found = Object.keys(data.results || {});
      if (found.length) {
        const updates = {};
        if (data.results.pt) updates.subtitle_pt = data.results.pt;
        if (data.results.en) updates.subtitle_en = data.results.en;
        if (data.results.es) updates.subtitle_es = data.results.es;
        setForm(prev => ({ ...prev, ...updates }));
        setSubsMsg(`Importadas: ${found.map(l => l.toUpperCase()).join(', ')}`);
      } else {
        setSubsMsg('Nenhuma legenda encontrada');
      }
    } catch (e) {
      setSubsMsg(`Erro: ${e.response?.data?.error || e.message}`);
    } finally {
      setFetchingSubs(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    if (!form.title?.trim()) { setError('Título é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        year: form.year ? Number(form.year) : null,
        duration: form.duration ? Number(form.duration) : null,
        rating: form.rating ? Number(form.rating) : null,
        genres: form.genres ? form.genres.split(',').map(g => g.trim()).filter(Boolean) : [],
      };
      await api.put(`/admin/movies/${id}`, payload);
      router.push('/admin/filmes');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (!form && !error) return <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>;
  if (error && !form) return <p style={{ color: '#ff6b6b' }}>{error}</p>;

  return (
    <div>
      <h1 className={styles.heading}>Editar: {form.title}</h1>

      <div className={styles.tmdbBox}>
        <label className={styles.label}>Atualizar dados do TMDB</label>
        <div className={styles.tmdbRow}>
          <input
            type="text"
            placeholder="Nome do filme..."
            value={tmdbSearch}
            onChange={e => setTmdbSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchTMDB())}
            className={styles.input}
          />
          <button onClick={searchTMDB} disabled={tmdbLoading} className={styles.btnSearch}>
            {tmdbLoading ? 'Buscando...' : 'Buscar TMDB'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.col}>
            <label className={styles.label}>Título *</label>
            <input className={styles.input} value={form.title || ''} onChange={e => set('title', e.target.value)} required />
          </div>
          <div className={styles.col}>
            <label className={styles.label}>Título original</label>
            <input className={styles.input} value={form.original_title || ''} onChange={e => set('original_title', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={styles.label}>Sinopse</label>
          <textarea className={styles.textarea} value={form.synopsis || ''} onChange={e => set('synopsis', e.target.value)} rows={4} />
        </div>

        <div className={styles.row4}>
          <div>
            <label className={styles.label}>Ano</label>
            <input className={styles.input} type="number" value={form.year || ''} onChange={e => set('year', e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Duração (min)</label>
            <input className={styles.input} type="number" value={form.duration || ''} onChange={e => set('duration', e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Nota</label>
            <input className={styles.input} type="number" step="0.1" min="0" max="10" value={form.rating || ''} onChange={e => set('rating', e.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Classificação</label>
            <select className={styles.input} value={form.age_rating || ''} onChange={e => set('age_rating', e.target.value)}>
              <option value="">—</option>
              {['L','10','12','14','16','18'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={styles.label}>Gêneros (separados por vírgula)</label>
          <input className={styles.input} value={form.genres || ''} onChange={e => set('genres', e.target.value)} placeholder="Ação, Aventura, Ficção Científica" />
        </div>

        <div className={styles.row}>
          <div className={styles.col}>
            <label className={styles.label}>URL do Poster</label>
            <input className={styles.input} value={form.poster_url || ''} onChange={e => set('poster_url', e.target.value)} />
          </div>
          <div className={styles.col}>
            <label className={styles.label}>URL do Backdrop</label>
            <input className={styles.input} value={form.backdrop_url || ''} onChange={e => set('backdrop_url', e.target.value)} />
          </div>
        </div>

        {form.poster_url && (
          <Image src={form.poster_url} alt="poster" width={100} height={150} style={{ borderRadius: 4 }} />
        )}

        <div>
          <label className={styles.label}>URL do Trailer (YouTube)</label>
          <input className={styles.input} value={form.trailer_url || ''} onChange={e => set('trailer_url', e.target.value)} />
        </div>

        <hr className={styles.divider} />
        <h3 className={styles.sectionTitle}>Arquivos de Vídeo</h3>

        {['dubbing', 'subtitled', 'cinema', '4k'].map(key => (
          <div key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <label className={styles.label} style={{ margin: 0 }}>
                {key === 'dubbing' ? 'Dublado' : key === 'subtitled' ? 'Legendado' : key === 'cinema' ? 'Cinema/Original' : '4K'}
                {' '}— URL CDN
              </label>
              {key === 'subtitled' && form.file_dubbing && (
                <button type="button" onClick={() => set('file_subtitled', form.file_dubbing)}
                  style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  = Usar Dublado (Dual Audio)
                </button>
              )}
              {key === 'cinema' && form.file_dubbing && (
                <button type="button" onClick={() => set('file_cinema', form.file_dubbing)}
                  style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  = Usar Dublado
                </button>
              )}
            </div>
            <input
              className={styles.input}
              value={form[`file_${key}`] || ''}
              onChange={e => set(`file_${key}`, e.target.value)}
            />
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h3 className={styles.sectionTitle}>Legendas (.vtt)</h3>
          <button type="button" onClick={fetchSubs} disabled={fetchingSubs} className={styles.btnSearch}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
            {fetchingSubs ? 'Buscando...' : 'Buscar legendas'}
          </button>
          {subsMsg && (
            <span style={{ fontSize: '0.75rem', color: subsMsg.startsWith('Erro') ? '#ff6b6b' : '#4caf50' }}>{subsMsg}</span>
          )}
        </div>
        {[['subtitle_pt', 'Português'], ['subtitle_en', 'Inglês'], ['subtitle_es', 'Espanhol']].map(([key, label]) => (
          <div key={key}>
            <label className={styles.label}>{label}</label>
            <input className={styles.input} value={form[key] || ''} onChange={e => set(key, e.target.value)} />
          </div>
        ))}

        <hr className={styles.divider} />
        <h3 className={styles.sectionTitle}>Destaque</h3>

        <div className={styles.checkRow}>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={!!form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Ativo (visível no site)
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={!!form.is_featured} onChange={e => set('is_featured', e.target.checked)} />
            Destaque (banner)
          </label>
        </div>
        {form.is_featured && (
          <div>
            <label className={styles.label}>Ordem no banner</label>
            <input className={styles.input} type="number" value={form.featured_order || ''} onChange={e => set('featured_order', e.target.value)} style={{ width: 100 }} />
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          <button type="button" className={styles.btnCancel} onClick={() => router.push('/admin/filmes')}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
