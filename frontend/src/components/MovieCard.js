'use client';
import Image from 'next/image';
import Link from 'next/link';
import styles from './MovieCard.module.css';

// Series so mostra selo quando P&B (audio DUB/LEG/CAM varia por episodio,
// nao faz sentido resumir num card so). Filme mostra a versao mais notavel.
function getVersionBadge(item, isSeries) {
  if (isSeries) return item.has_bw ? 'P&B' : null;
  if (item.file_bw) return 'P&B';
  if (item.file_cinema) return 'CAM';
  if (item.file_dubbing) return 'DUB';
  if (item.file_subtitled) return 'LEG';
  if (item.file_4k) return '4K';
  if (item.file_color) return 'COR';
  return null;
}

export default function MovieCard({ item }) {
  const isSeries = item.type === 'series';
  const href  = isSeries ? `/serie/${item.id}` : `/filme/${item.id}`;
  const year  = item.year || item.year_start;
  const label = isSeries ? 'SÉRIE' : 'FILME';
  const versionBadge = getVersionBadge(item, isSeries);

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

        {versionBadge && <div className={styles.verBadge}>{versionBadge}</div>}

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
