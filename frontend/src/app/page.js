'use client';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import HeroBanner from '../components/HeroBanner';
import ContentRow from '../components/ContentRow';
import api from '../lib/api';
import { getToken } from '../lib/auth';
import styles from './page.module.css';

export default function Home() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetches = [
      api.get('/featured').then(r => r.data).catch(() => []),
      api.get('/movies/section/new').then(r => r.data).catch(() => []),
      api.get('/series/section/new').then(r => r.data).catch(() => []),
      api.get('/movies/section/popular').then(r => r.data).catch(() => []),
    ];

    if (getToken()) {
      fetches.push(
        api.get('/history').then(r =>
          (r.data || [])
            .filter(h => h.progress > 0 && h.duration > 0 && !h.completed)
            .slice(0, 12)
        ).catch(() => [])
      );
    } else {
      fetches.push(Promise.resolve([]));
    }

    Promise.all(fetches).then(([featured, newMovies, newSeries, popularMovies, history]) => {
      setData({ featured, newMovies, newSeries, popularMovies, history });
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
                {[...Array(8)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
              </div>
            </div>
            <div className={styles.skeletonSection}>
              <div className={styles.skeletonLabel} />
              <div className={styles.skeletonRow}>
                {[...Array(8)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
              </div>
            </div>
          </div>
        ) : (
          <div style={!data.featured.length ? { paddingTop: '5rem' } : undefined}>
            <HeroBanner items={data.featured} />

            {data.history?.length > 0 && (
              <ContentRow
                title="Continue Assistindo"
                items={data.history.map(h => ({
                  id: h.content_id || h.id,
                  title: h.title || h.episode_title,
                  poster_url: h.poster_url || h.thumbnail_url,
                  type: h.content_type === 'episode' ? 'series' : (h.content_type || 'movie'),
                  year: h.year,
                  rating: h.rating,
                  genres: h.genres,
                }))}
                seeAllHref="/continuar-assistindo"
              />
            )}

            {data.newMovies.length > 0 && (
              <ContentRow
                title="Adicionados Recentemente"
                items={data.newMovies}
                type="movie"
                seeAllHref="/filmes"
              />
            )}
            {data.newSeries.length > 0 && (
              <ContentRow
                title="Novas Séries"
                items={data.newSeries}
                type="series"
                seeAllHref="/series"
              />
            )}
            {data.popularMovies.length > 0 && (
              <ContentRow
                title="Mais Assistidos"
                items={data.popularMovies}
                type="movie"
                seeAllHref="/filmes"
              />
            )}

            {!data.featured.length && !data.newMovies.length && !data.newSeries.length && (
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
