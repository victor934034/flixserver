'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './HeroBanner.module.css';
import api from '../lib/api';
import { getToken } from '../lib/auth';

export default function HeroBanner({ items = [] }) {
  const [index, setIndex] = useState(0);
  // Map of content_id → watchlist entry id for quick lookup
  const [watchlistMap, setWatchlistMap] = useState({});
  const [toggling, setToggling] = useState(false);

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

  if (!items.length) return null;

  const item = items[index];
  const href = item.type === 'series' ? `/serie/${item.id}` : `/filme/${item.id}`;
  const watchlistId = watchlistMap[item.id];
  const inList = !!watchlistId;

  async function toggleList() {
    if (!getToken()) {
      window.location.href = '/login';
      return;
    }
    if (toggling) return;
    setToggling(true);
    try {
      if (inList) {
        await api.delete(`/watchlist/${watchlistId}`);
        setWatchlistMap(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      } else {
        const r = await api.post('/watchlist', {
          content_type: item.type || 'movie',
          content_id: item.id,
        });
        setWatchlistMap(prev => ({ ...prev, [item.id]: r.data.id }));
      }
    } catch {}
    setToggling(false);
  }

  return (
    <div className={styles.hero}>
      {item.backdrop_url && (
        <Image
          src={item.backdrop_url}
          alt={item.title}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center top' }}
        />
      )}
      <div className={styles.gradient} />

      <div className={styles.content}>
        <h1 className={styles.title}>{item.title}</h1>
        <p className={styles.synopsis}>{item.synopsis?.slice(0, 200)}{item.synopsis?.length > 200 ? '...' : ''}</p>
        <div className={styles.meta}>
          {(item.year || item.year_start) && <span>{item.year || item.year_start}</span>}
          {item.rating && <span>★ {Number(item.rating).toFixed(1)}</span>}
          {item.genres?.slice(0, 3).map(g => <span key={g}>{g}</span>)}
        </div>
        <div className={styles.buttons}>
          <Link href={href} className={styles.btnPlay}>▶ Assistir</Link>
          <button
            onClick={toggleList}
            className={`${styles.btnList} ${inList ? styles.btnListActive : ''}`}
            disabled={toggling}
          >
            {inList ? '✓ Na Lista' : '+ Minha Lista'}
          </button>
        </div>
      </div>

      {items.length > 1 && (
        <div className={styles.dots}>
          {items.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
