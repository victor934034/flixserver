'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Navbar from '../../../components/Navbar';
import VideoPlayer from '../../../components/VideoPlayer';
import api from '../../../lib/api';
import { getToken } from '../../../lib/auth';
import { useProfile } from '../../../contexts/ProfileContext';
import { useParental } from '../../../contexts/ParentalContext';
import styles from './page.module.css';

export default function SeriePage() {
  const { id } = useParams();
  const { activeProfile } = useProfile();
  const { checkAccess } = useParental();
  const [serie, setSerie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [season, setSeason] = useState(1);
  const [playing, setPlaying] = useState(null);
  const [playingResume, setPlayingResume] = useState(0);
  const [error, setError] = useState(null);
  const [watchlistId, setWatchlistId] = useState(null);
  const [epProgress, setEpProgress] = useState({}); // episode_id -> segundos assistidos
  const [nextUp, setNextUp] = useState(null); // episódio sugerido pro botão "Assistir"

  useEffect(() => {
    api.get(`/series/${id}`)
      .then(r => { setSerie(r.data); })
      .catch(() => setError('Série não encontrada'));
    api.get(`/series/${id}/episodes`)
      .then(r => setEpisodes(r.data || []))
      .catch(() => {});

    if (getToken()) {
      const params = activeProfile ? { profile_id: activeProfile.id } : undefined;
      api.get('/watchlist', { params })
        .then(r => {
          const entry = (r.data || []).find(w => w.content_id === id);
          if (entry) setWatchlistId(entry.id);
        })
        .catch(() => {});
      api.get('/history', { params })
        .then(r => {
          const forThisSeries = (r.data || []).filter(h => h.content_type === 'episode' && h.series_id === id);
          const map = {};
          forThisSeries.forEach(h => { map[h.content_id] = h.progress; });
          setEpProgress(map);
          const inProgress = forThisSeries.find(h => !h.completed && h.progress > 5);
          if (inProgress) setNextUp({ episode_id: inProgress.content_id, progress: inProgress.progress });
        })
        .catch(() => {});
    }
  }, [id, activeProfile]);

  async function toggleList() {
    if (!getToken()) { window.location.href = '/login'; return; }
    try {
      if (watchlistId) {
        await api.delete(`/watchlist/${watchlistId}`);
        setWatchlistId(null);
      } else {
        const r = await api.post('/watchlist', { content_type: 'series', content_id: id, profile_id: activeProfile?.id || null });
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
      profile_id: activeProfile?.id || null,
    }).catch(() => {});
  }

  async function playEpisode(ep) {
    const allowed = await checkAccess(serie);
    if (!allowed) return;
    setPlayingResume(epProgress[ep.id] > 5 ? epProgress[ep.id] : 0);
    setPlaying(ep);
  }

  const heroEpisode = nextUp ? episodes.find(e => e.id === nextUp.episode_id) : null;

  const sortedEpisodes = [...episodes].sort((a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number);
  const playingIdx = playing ? sortedEpisodes.findIndex(e => e.id === playing.id) : -1;
  const nextEpisode = playingIdx >= 0 ? sortedEpisodes[playingIdx + 1] || null : null;

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
            <VideoPlayer
              key={playing.id}
              content={playing}
              onProgress={(c, t) => saveProgress(c, t, playing)}
              startAt={playingResume}
              onClose={() => { setPlaying(null); setPlayingResume(0); }}
              overlayTitle={`${serie.title} — T${playing.season_number}E${playing.episode_number}: ${playing.title}`}
              onNextEpisode={nextEpisode ? () => playEpisode(nextEpisode) : undefined}
              nextEpisodeLabel={nextEpisode ? `T${nextEpisode.season_number}E${nextEpisode.episode_number}: ${nextEpisode.title}` : undefined}
            />
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
                  {(heroEpisode || currentEps[0]) && (
                    <button className={styles.btnPlay} onClick={() => playEpisode(heroEpisode || currentEps[0])}>
                      {heroEpisode
                        ? `▶ Continuar T${heroEpisode.season_number}E${heroEpisode.episode_number}`
                        : '▶ Assistir T1E1'}
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
                  {currentEps.map(ep => {
                    const prog = epProgress[ep.id];
                    const pct = prog && ep.duration ? Math.min(100, (prog / (ep.duration * 60)) * 100) : 0;
                    return (
                    <div key={ep.id} className={styles.epCard} onClick={() => playEpisode(ep)}>
                      <div className={styles.epThumb}>
                        {ep.thumbnail_url ? (
                          <Image src={ep.thumbnail_url} alt={ep.title} fill sizes="200px" style={{ objectFit: 'cover' }} />
                        ) : (
                          <div className={styles.epThumbPlaceholder}>▶</div>
                        )}
                        <div className={styles.playOverlay}>▶</div>
                        {pct > 3 && (
                          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.25)' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
                          </div>
                        )}
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
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
