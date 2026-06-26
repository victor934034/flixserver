'use client';
import Image from 'next/image';
import Link from 'next/link';
import styles from './MovieCard.module.css';

export default function MovieCard({ item }) {
  const href  = item.type === 'series' ? `/serie/${item.id}` : `/filme/${item.id}`;
  const year  = item.year || item.year_start;
  const label = item.type === 'series' ? 'SÉRIE' : 'FILME';

  return (
    <Link href={href} className={styles.card}>
      <div className={styles.poster}>
        {item.poster_url ? (
          <Image
            src={item.poster_url}
            alt={item.title || ''}
            fill
            sizes="160px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className={styles.noImage}>{item.title?.[0]}</div>
        )}

        <div className={styles.typeBadge}>{label}</div>

        {item.rating && (
          <div className={styles.ratingBadge}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="#f5c518"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            {Number(item.rating).toFixed(1)}
          </div>
        )}

        <div className={styles.overlay}>
          <div className={styles.playBtn}>
            <div className={styles.playIcon} />
          </div>
          <div className={styles.info}>
            <span className={styles.cardTitle}>{item.title}</span>
            <div className={styles.cardMeta}>
              {year && <span>{year}</span>}
              {year && item.rating && <span>·</span>}
              {item.rating && <span>★ {Number(item.rating).toFixed(1)}</span>}
            </div>
            {item.genres?.length > 0 && (
              <div className={styles.cardGenres}>{item.genres.slice(0, 2).join(' · ')}</div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.label}>{item.title}</div>
    </Link>
  );
}
