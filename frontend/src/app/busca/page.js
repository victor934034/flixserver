'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import MovieCard from '../../components/MovieCard';
import api from '../../lib/api';
import styles from './page.module.css';

function BuscaResultados() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const [results, setResults] = useState({ movies: [], series: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    api.get(`/search?q=${encodeURIComponent(q)}`)
      .then(r => setResults(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q]);

  const total = results.movies.length + results.series.length;

  return (
    <>
      <h1 className={styles.heading}>
        {q ? `Resultados para "${q}"` : 'Busca'}
      </h1>
      {loading && <p className={styles.loading}>Buscando...</p>}
      {!loading && q && total === 0 && (
        <p className={styles.empty}>Nenhum resultado encontrado para "{q}"</p>
      )}
      {results.movies.length > 0 && (
        <section className={styles.section}>
          <h2>Filmes</h2>
          <div className={styles.grid}>
            {results.movies.map(item => <MovieCard key={item.id} item={item} />)}
          </div>
        </section>
      )}
      {results.series.length > 0 && (
        <section className={styles.section}>
          <h2>Séries</h2>
          <div className={styles.grid}>
            {results.series.map(item => <MovieCard key={item.id} item={item} />)}
          </div>
        </section>
      )}
    </>
  );
}

export default function BuscaPage() {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <Suspense fallback={<p className={styles.loading}>Carregando...</p>}>
          <BuscaResultados />
        </Suspense>
      </main>
    </>
  );
}
