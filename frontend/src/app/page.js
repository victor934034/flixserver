'use client';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import HeroBanner from '../components/HeroBanner';
import TrialBar from '../components/TrialBar';
import ContentRow from '../components/ContentRow';
import SurpriseButton from '../components/SurpriseButton';
import Top10Row from '../components/Top10Row';
import api from '../lib/api';
import { getToken } from '../lib/auth';
import { useProfile } from '../contexts/ProfileContext';
import styles from './page.module.css';

export default function Home() {
  const [data, setData] = useState(null);
  const { activeProfile } = useProfile();

  const [reloadKey, setReloadKey] = useState(0);
  const [top10, setTop10] = useState([]);

  // Carrega à parte: não atrasa o resto da página
  useEffect(() => {
    if (!getToken()) return;
    api.get('/recommendations/top10').then(r => setTop10(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [reloadKey]);

  // Atualiza sozinho quando o admin adiciona conteúdo/troca banner
  useEffect(() => {
    let last = null;
    const check = async () => {
      try {
        const { data } = await api.get('/content-version');
        if (last !== null && data?.v !== last) setReloadKey(k => k + 1);
        last = data?.v;
      } catch {}
    };
    check();
    const t = setInterval(check, 45000);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    const fetches = [
      api.get('/featured').then(r => r.data).catch(() => []),
      api.get('/movies/section/new').then(r => r.data).catch(() => []),
      api.get('/series/section/new').then(r => r.data).catch(() => []),
      api.get('/movies/section/popular').then(r => r.data).catch(() => []),
      api.get('/movies/section/released').then(r => r.data).catch(() => []),
      api.get('/series/section/released').then(r => r.data).catch(() => []),
    ];

    if (getToken()) {
      const params = activeProfile ? { profile_id: activeProfile.id } : undefined;
      fetches.push(
        api.get('/history', { params }).then(r =>
          (r.data || [])
            .filter(h => h.progress > 0 && h.duration > 0 && !h.completed)
            // uma entrada por filme/série (fica a assistida por último)
            .filter((h, i, all) => all.findIndex(o => (o.series_id || o.content_id) === (h.series_id || h.content_id)) === i)
            .slice(0, 12)
        ).catch(() => [])
      );
    } else {
      fetches.push(Promise.resolve([]));
    }

    if (getToken() && activeProfile) {
      fetches.push(api.get('/recommendations', { params: { profile_id: activeProfile.id, limit: 20 } }).then(r => r.data || []).catch(() => []));
    } else {
      fetches.push(Promise.resolve([]));
    }

    Promise.all(fetches).then(([featured, newMovies, newSeries, popularMovies, relM, relS, history, recommended]) => {
      const released = [
        ...(relM || []).map(x => ({ ...x, type: 'movie' })),
        ...(relS || []).map(x => ({ ...x, type: 'series' })),
      ].sort((a, b) => String(b.release_date).localeCompare(String(a.release_date))).slice(0, 20);
      const recs = (recommended || []).map(x => ({ ...x, type: x.content_type === 'movie' ? 'movie' : 'series' }));
      setData({ featured, newMovies, newSeries, popularMovies, history, released, recs });
    });
  }, [activeProfile, reloadKey]);

  async function removeFromContinue(item) {
    if (!window.confirm(`Tirar "${item.title}" do Continuar assistindo?`)) return;
    try {
      await api.delete(`/history/${item.historyId}`);
      setData(d => ({ ...d, history: d.history.filter(h => h.id !== item.historyId) }));
    } catch {
      window.alert('Não foi possível remover. Tente de novo.');
    }
  }

  return (
    <>
      <Navbar />
      <TrialBar />
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

            <SurpriseButton />

            {data.history?.length > 0 && (
              <ContentRow
                title="Continue Assistindo"
                items={data.history.map(h => ({
                  id: (h.content_type === 'episode' && h.series_id) || h.content_id,
                  historyId: h.id,
                  title: h.title || h.episode_title,
                  poster_url: h.poster_url || h.thumbnail_url,
                  type: h.content_type === 'episode' ? 'series' : (h.content_type || 'movie'),
                  year: h.year,
                  rating: h.rating,
                  genres: h.genres,
                }))}
                seeAllHref="/continuar-assistindo"
                onRemove={removeFromContinue}
              />
            )}

            <Top10Row items={top10} />

            {data.released?.length > 0 && (
              <ContentRow title="Recém lançados" items={data.released} />
            )}
            {data.recs?.length > 0 && (
              <ContentRow title="Recomendados para você" items={data.recs} />
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
