'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import Navbar from '../../components/Navbar';
import MovieCard from '../../components/MovieCard';
import api from '../../lib/api';
import styles from './page.module.css';

const GENRES = ['Ação','Aventura','Animação','Comédia','Crime','Documentário','Drama','Fantasia','Ficção Científica','Horror','Mistério','Romance','Terror','Thriller'];
const SORTS = [
  { value: 'created_at', label: 'Adicionados recentemente' },
  { value: 'release_date', label: 'Lançamento mais recente' },
  { value: 'views', label: 'Mais Assistidos' },
  { value: 'rating', label: 'Melhor Avaliados' },
  { value: 'title', label: 'A-Z' },
];

const YEAR = new Date().getFullYear();
const DATE_PRESETS = [
  { value: '', label: 'Qualquer data' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '180d', label: 'Últimos 6 meses' },
  { value: 'year', label: `Este ano (${YEAR})` },
  { value: '2020s', label: 'Anos 2020' },
  { value: '2010s', label: 'Anos 2010' },
  { value: '2000s', label: 'Anos 2000' },
  { value: '1990s', label: 'Anos 90' },
];
function applyPreset(params, key) {
  if (key === '30d') params.set('released_days', 30);
  else if (key === '180d') params.set('released_days', 180);
  else if (key === 'year') { params.set('year_from', YEAR); params.set('year_to', YEAR); }
  else if (/^\d{4}s$/.test(key)) { params.set('year_from', key.slice(0, 4)); params.set('year_to', Number(key.slice(0, 4)) + 9); }
}

function FilmesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [movies, setMovies] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get('page') || 1);
  const genre = searchParams.get('genre') || '';
  const sort = searchParams.get('sort') || 'created_at';
  const date = searchParams.get('date') || '';

  const totalPages = Math.ceil(total / 24);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, sort, limit: 24 });
    if (genre) params.set('genre', genre);
    applyPreset(params, date);
    api.get(`/movies?${params}`)
      .then(r => { setMovies(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, genre, sort, date]);

  useEffect(() => { load(); }, [load]);

  function setParam(key, value) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    p.delete('page');
    router.push(`/filmes?${p.toString()}`);
  }

  function goPage(n) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('page', n);
    router.push(`/filmes?${p.toString()}`);
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Filmes</h1>
        <span className={styles.count}>{total} títulos</span>
      </div>

      <div className={styles.filters}>
        <select className={styles.select} value={genre} onChange={e => setParam('genre', e.target.value)}>
          <option value="">Todos os Gêneros</option>
          {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className={styles.select} value={date} onChange={e => setParam('date', e.target.value)}>
          {DATE_PRESETS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select className={styles.select} value={sort} onChange={e => setParam('sort', e.target.value)}>
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : movies.length === 0 ? (
        <div className={styles.empty}>Nenhum filme encontrado.</div>
      ) : (
        <div className={styles.grid}>
          {movies.map(m => <MovieCard key={m.id} item={{ ...m, type: 'movie' }} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} disabled={page <= 1} onClick={() => goPage(page - 1)}>‹ Anterior</button>
          <span className={styles.pageInfo}>{page} / {totalPages}</span>
          <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => goPage(page + 1)}>Próximo ›</button>
        </div>
      )}
    </>
  );
}

export default function FilmesPage() {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <Suspense fallback={<div className={styles.loading}>Carregando...</div>}>
          <FilmesContent />
        </Suspense>
      </main>
    </>
  );
}
