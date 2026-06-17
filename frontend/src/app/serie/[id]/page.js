'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Navbar from '../../../components/Navbar';
import VideoPlayer from '../../../components/VideoPlayer';
import api from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import styles from './page.module.css';

export default function SeriePage() {
  const { id } = useParams();
  const [serie, setSerie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [season, setSeason] = useState(1);
  const [playing, setPlaying] = useState(null);
  const [error, setError] = useState(null);
  const [watchlistId, setWatchlistId] = useState(null);

  useEffect(() => {
    api.get(`/series/${id}`)
      .then(r => { setSerie(r.data); })
      .catch(() => setError('Série não encontrada'));
    api.get(`/series/${id}/episodes`)
      .then(r => setEpisodes(r.data || []))
      .catch(() => {});
    if (getToken()) {
      api.get('/watchlist')
        .then(r => {
          const entry = (r.data || []).find(w => w.content_id === id);
          if (entry) setWatchlistId(entry.id);
        })
        .catch(() => {});
    }
  }, [id]);

  async function toggleList() {
    if (!getToken()) { window.location.href = '/login'; return; }
    try {
      if (watchlistId) {
        await api.delete(`/watchlist/${watchlistId}`);
        setWatchlistId(null);
      } else {
        const r = await api.post('/watchlist', { content_type: 'series', content_id: id });
        setWatchlistId(r.data.id);
      }
    } catch {}
  }

  function saveProgress(current, total, ep) {
    if (!current || !total || !ep) return;
    api.post('/history', {
      content_type: 'episode',
      content_id: ep.id,
      series_id: id,
      progress: Math.floor(current),
      duration: Math.floor(total),
    }).catch(() => {});
  }

  if (error) return <div className={styles.error}>{error}</div>;
  if (!serie) return <div className={styles.loading}>Carregando...</div>;

  const seasons = [...new Set(episodes.map(e => e.season_number))].sort((a, b) => a - b);
  const currentEps = episodes.filter(e => e.season_number === season);

  return (
    <>
      <Navbar />
      <div className={styles.backdrop}>
        {serie.backdrop_url && (
          <Image src={serie.backdrop_url} alt={serie.title} fill style={{ objectFit: 'cover', opacity: 0.25 }} />
        )}
        <div className={styles.backdropGrad} />
      </div>

      <main className={styles.main}>
        {playing ? (
          <div className={styles.playerWrap}>
            <div className={styles.playerTitle}>
              {serie.title} — T{playing.season_number}E{playing.episode_number}: {playing.title}
            </div>
            <VideoPlayer content={playing} onProgress={(c, t) => saveProgress(c, t, playing)} />
            <button className={styles.closePlayer} onClick={() => setPlaying(null)}>✕ Fechar Player</button>
          </div>
        ) : (
          <>
            <div className={styles.hero}>
              {serie.poster_url && (
                <div className={styles.poster}>
                  <Image src={serie.poster_url} alt={serie.title} width={200} height={300} style={{ borderRadius: 8 }} />
                </div>
              )}
              <div className={styles.info}>
                <h1 className={styles.title}>{serie.title}</h1>
                {serie.original_title !== serie.title && <p className={styles.originalTitle}>{serie.original_title}</p>}
                <div className={styles.meta}>
                  {serie.year_start && <span>{serie.year_start}{serie.year_end ? `–${serie.year_end}` : ''}</span>}
                  {serie.total_seasons && <span>{serie.total_seasons} temporada{serie.total_seasons > 1 ? 's' : ''}</span>}
                  {serie.rating && <span>★ {Number(serie.rating).toFixed(1)}</span>}
                  {serie.status && <span className={styles.status}>{serie.status}</span>}
                </div>
                <div className={styles.genres}>{serie.genres?.join(' · ')}</div>
                <p className={styles.synopsis}>{serie.synopsis}</p>
                <div className={styles.actions}>
                  {currentEps[0] && (
                    <button className={styles.btnPlay} onClick={() => setPlaying(currentEps[0])}>
                      ▶ Assistir T1E1
                    </button>
                  )}
                  <button className={`${styles.btnList} ${watchlistId ? styles.inList : ''}`} onClick={toggleList}>
                    {watchlistId ? '✓ Na Minha Lista' : '+ Minha Lista'}
                  </button>
                  {serie.trailer_url && (
                    <a href={serie.trailer_url} target="_blank" rel="noreferrer" className={styles.btnTrailer}>Trailer</a>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.episodesSection}>
              <div className={styles.seasonTabs}>
                {seasons.map(s => (
                  <button
                    key={s}
                    className={`${styles.seasonTab} ${season === s ? styles.activeTab : ''}`}
                    onClick={() => setSeason(s)}
                  >
                    Temporada {s}
                  </button>
                ))}
              </div>

              {currentEps.length === 0 ? (
                <p className={styles.noEps}>Nenhum episódio disponível nessa temporada.</p>
              ) : (
                <div className={styles.epList}>
                  {currentEps.map(ep => (
                    <div key={ep.id} className={styles.epCard} onClick={() => setPlaying(ep)}>
                      <div className={styles.epThumb}>
                        {ep.thumbnail_url ? (
                          <Image src={ep.thumbnail_url} alt={ep.title} fill sizes="200px" style={{ objectFit: 'cover' }} />
                        ) : (
                          <div className={styles.epThumbPlaceholder}>▶</div>
                        )}
                        <div className={styles.playOverlay}>▶</div>
                      </div>
                      <div className={styles.epInfo}>
                        <div className={styles.epNum}>E{ep.episode_number}</div>
                        <div className={styles.epTitle}>{ep.title || `Episódio ${ep.episode_number}`}</div>
                        {ep.duration && <div className={styles.epDur}>{ep.duration} min</div>}
                        {ep.synopsis && <p className={styles.epSyn}>{ep.synopsis}</p>}
                        <div className={styles.epVersions}>
                          {ep.file_dubbing && <span className={styles.vBadge}>DUB</span>}
                          {ep.file_subtitled && <span className={styles.vBadge}>LEG</span>}
                          {ep.file_cinema && <span className={styles.vBadge}>CIN</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
