'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './HeroBanner.module.css';
import api from '../lib/api';
import { getToken } from '../lib/auth';

const INTERVAL = 8000;

export default function HeroBanner({ items = [] }) {
  const [index, setIndex]       = useState(0);
  const [watchlistMap, setWatchlistMap] = useState({});
  const [toggling, setToggling] = useState(false);
  const timerRef = useRef(null);
  const keyRef   = useRef(0); // force re-mount animation

  useEffect(() => {
    if (!getToken()) return;
    api.get('/watchlist')
      .then(r => {
        const map = {};
        (r.data || []).forEach(w => { map[w.content_id] = w.id; });
        setWatchlistMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => {
      keyRef.current += 1;
      setIndex(i => (i + 1) % items.length);
    }, INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [items.length]);

  function goTo(i) {
    clearInterval(timerRef.current);
    keyRef.current += 1;
    setIndex(i);
    if (items.length > 1) {
      timerRef.current = setInterval(() => {
        keyRef.current += 1;
        setIndex(idx => (idx + 1) % items.length);
      }, INTERVAL);
    }
  }

  if (!items.length) return null;

  const item = items[index];
  const href = item.type === 'series' ? `/serie/${item.id}` : `/filme/${item.id}`;
  const watchlistId = watchlistMap[item.id];
  const inList = !!watchlistId;
  const isSeries = item.type === 'series';

  async function toggleList() {
    if (!getToken()) { window.location.href = '/login'; return; }
    if (toggling) return;
    setToggling(true);
    try {
      if (inList) {
        await api.delete(`/watchlist/${watchlistId}`);
        setWatchlistMap(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      } else {
        const r = await api.post('/watchlist', { content_type: item.type || 'movie', content_id: item.id });
        setWatchlistMap(prev => ({ ...prev, [item.id]: r.data.id }));
      }
    } catch {}
    setToggling(false);
  }

  return (
    <div className={styles.hero}>
      {items.map((it, i) => (
        <div key={it.id} className={`${styles.slide} ${i === index ? styles.slideActive : ''}`}>
          <div className={styles.bg}>
            {it.backdrop_url && (
              <Image
                src={it.backdrop_url}
                alt={it.title}
                fill
                priority={i === 0}
                sizes="100vw"
                style={{ objectFit: 'cover', objectPosition: 'center top' }}
              />
            )}
          </div>
          <div className={styles.gradient} />
        </div>
      ))}

      {/* Info content — always shows current item */}
      <div className={styles.content}>
        <div className={styles.typeBadge}>
          {isSeries ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
          )}
          {isSeries ? 'Série' : 'Filme'}
          {item.year || item.year_start ? ` · ${item.year || item.year_start}` : ''}
        </div>

        <h1 className={styles.title}>{item.title}</h1>

        <div className={styles.meta}>
          {item.rating && (
            <>
              <span className={styles.metaRating}>★ {Number(item.rating).toFixed(1)}</span>
              <span className={styles.metaDot}>·</span>
            </>
          )}
          {item.duration && <span>{item.duration} min</span>}
          {item.duration && item.genres?.length > 0 && <span className={styles.metaDot}>·</span>}
          {isSeries && item.total_seasons && <span>{item.total_seasons} temporada{item.total_seasons > 1 ? 's' : ''}</span>}
        </div>

        {item.genres?.length > 0 && (
          <div className={styles.genres}>
            {item.genres.slice(0, 4).map(g => (
              <span key={g} className={styles.genrePill}>{g}</span>
            ))}
          </div>
        )}

        {item.synopsis && (
          <p className={styles.synopsis}>{item.synopsis}</p>
        )}

        <div className={styles.buttons}>
          <Link href={href} className={styles.btnPlay}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Assistir
          </Link>
          <button
            onClick={toggleList}
            className={`${styles.btnList} ${inList ? styles.btnListActive : ''}`}
            disabled={toggling}
          >
            {inList ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                Na Lista
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                Minha Lista
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress indicators */}
      {items.length > 1 && (
        <div className={styles.indicators}>
          {items.map((_, i) => (
            <button
              key={i}
              className={`${styles.indicator} ${i === index ? styles.indicatorActive : i < index ? styles.indicatorDone : ''}`}
              style={i === index ? { '--dur': INTERVAL + 'ms' } : undefined}
              onClick={() => goTo(i)}
            >
              <div className={styles.indicatorFill} key={`${i}-${i === index ? keyRef.current : 'x'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
