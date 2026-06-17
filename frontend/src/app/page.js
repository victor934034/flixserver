'use client';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import HeroBanner from '../components/HeroBanner';
import ContentRow from '../components/ContentRow';
import api from '../lib/api';
import styles from './page.module.css';

export default function Home() {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/featured').then(r => r.data).catch(() => []),
      api.get('/movies/section/new').then(r => r.data).catch(() => []),
      api.get('/series/section/new').then(r => r.data).catch(() => []),
      api.get('/movies/section/popular').then(r => r.data).catch(() => []),
    ]).then(([featured, newMovies, newSeries, popularMovies]) => {
      setData({ featured, newMovies, newSeries, popularMovies });
    });
  }, []);

  return (
    <>
      <Navbar />
      <main>
        {!data ? (
          <div className={styles.skeleton}>
            <div className={styles.skeletonHero} />
            <div className={styles.skeletonSection}>
              <div className={styles.skeletonLabel} />
              <div className={styles.skeletonRow}>
                {[...Array(7)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
              </div>
            </div>
            <div className={styles.skeletonSection}>
              <div className={styles.skeletonLabel} />
              <div className={styles.skeletonRow}>
                {[...Array(7)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
              </div>
            </div>
          </div>
        ) : (
          <div style={!data.featured.length ? { paddingTop: '5rem' } : undefined}>
            <HeroBanner items={data.featured} />
            {data.newMovies.length > 0 && (
              <ContentRow title="Adicionados Recentemente" items={data.newMovies} type="movie" />
            )}
            {data.newSeries.length > 0 && (
              <ContentRow title="Novas Séries" items={data.newSeries} type="series" />
            )}
            {data.popularMovies.length > 0 && (
              <ContentRow title="Mais Assistidos" items={data.popularMovies} type="movie" />
            )}
            {!data.featured.length && !data.newMovies.length && !data.newSeries.length && !data.popularMovies.length && (
              <div className={styles.empty}>
                <p>Nenhum conteúdo disponível ainda.</p>
                <p>Adicione filmes e séries pelo painel de administração.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
