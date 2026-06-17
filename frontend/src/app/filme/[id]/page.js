'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Navbar from '../../../components/Navbar';
import VideoPlayer from '../../../components/VideoPlayer';
import api from '../../../lib/api';
import styles from './page.module.css';

export default function FilmePage() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/movies/${id}`)
      .then(r => setMovie(r.data))
      .catch(() => setError('Filme não encontrado'));
  }, [id]);

  function saveProgress(current, total) {
    if (!current || !total) return;
    api.post('/history', {
      content_type: 'movie',
      content_id: id,
      progress: Math.floor(current),
      duration: Math.floor(total),
    }).catch(() => {});
  }

  if (error) return <div className={styles.error}>{error}</div>;
  if (!movie) return <div className={styles.loading}>Carregando...</div>;

  return (
    <>
      <Navbar />
      <div className={styles.backdrop}>
        {movie.backdrop_url && (
          <Image src={movie.backdrop_url} alt={movie.title} fill style={{ objectFit: 'cover', opacity: 0.3 }} />
        )}
        <div className={styles.backdropGrad} />
      </div>

      <main className={styles.main}>
        {playing ? (
          <div className={styles.playerWrap}>
            <VideoPlayer content={movie} onProgress={saveProgress} />
            <button className={styles.closePlayer} onClick={() => setPlaying(false)}>✕ Fechar Player</button>
          </div>
        ) : (
          <div className={styles.hero}>
            {movie.poster_url && (
              <div className={styles.poster}>
                <Image src={movie.poster_url} alt={movie.title} width={220} height={330} style={{ borderRadius: 8 }} />
              </div>
            )}
            <div className={styles.info}>
              <h1 className={styles.title}>{movie.title}</h1>
              {movie.original_title !== movie.title && (
                <p className={styles.originalTitle}>{movie.original_title}</p>
              )}
              <div className={styles.meta}>
                {movie.year && <span>{movie.year}</span>}
                {movie.duration && <span>{movie.duration} min</span>}
                {movie.rating && <span>★ {Number(movie.rating).toFixed(1)}</span>}
                {movie.age_rating && <span className={`badge-${movie.age_rating}`}>{movie.age_rating}</span>}
              </div>
              <div className={styles.genres}>
                {movie.genres?.join(' · ')}
              </div>
              <p className={styles.synopsis}>{movie.synopsis}</p>
              <div className={styles.actions}>
                {(movie.file_dubbing || movie.file_subtitled || movie.file_cinema || movie.file_4k) ? (
                  <button className={styles.btnPlay} onClick={() => setPlaying(true)}>▶ Assistir</button>
                ) : (
                  <span className={styles.noVideo}>Vídeo não disponível</span>
                )}
                {movie.trailer_url && (
                  <a href={movie.trailer_url} target="_blank" rel="noreferrer" className={styles.btnTrailer}>
                    Trailer
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
