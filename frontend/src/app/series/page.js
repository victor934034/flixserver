'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import MovieCard from '../../components/MovieCard';
import api from '../../lib/api';
import styles from '../filmes/page.module.css';

const GENRES = ['Ação','Aventura','Animação','Comédia','Crime','Drama','Fantasia','Ficção Científica','Horror','Mistério','Romance','Terror','Thriller'];
const SORTS = [
  { value: 'created_at', label: 'Mais Recentes' },
  { value: 'views', label: 'Mais Assistidas' },
  { value: 'rating', label: 'Melhor Avaliadas' },
  { value: 'title', label: 'A-Z' },
];

function SeriesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [series, setSeries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get('page') || 1);
  const genre = searchParams.get('genre') || '';
  const sort = searchParams.get('sort') || 'created_at';
  const totalPages = Math.ceil(total / 24);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, sort, limit: 24 });
    if (genre) params.set('genre', genre);
    api.get(`/series?${params}`)
      .then(r => { setSeries(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, genre, sort]);

  useEffect(() => { load(); }, [load]);

  function setParam(key, value) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    p.delete('page');
    router.push(`/series?${p.toString()}`);
  }

  function goPage(n) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('page', n);
    router.push(`/series?${p.toString()}`);
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Séries</h1>
        <span className={styles.count}>{total} títulos</span>
      </div>

      <div className={styles.filters}>
        <select className={styles.select} value={genre} onChange={e => setParam('genre', e.target.value)}>
          <option value="">Todos os Gêneros</option>
          {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className={styles.select} value={sort} onChange={e => setParam('sort', e.target.value)}>
          {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : series.length === 0 ? (
        <div className={styles.empty}>Nenhuma série encontrada.</div>
      ) : (
        <div className={styles.grid}>
          {series.map(s => <MovieCard key={s.id} item={{ ...s, type: 'series' }} />)}
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

export default function SeriesPage() {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <Suspense fallback={<div className={styles.loading}>Carregando...</div>}>
          <SeriesContent />
        </Suspense>
      </main>
    </>
  );
}
