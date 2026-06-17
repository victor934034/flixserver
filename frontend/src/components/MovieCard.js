'use client';
import Image from 'next/image';
import Link from 'next/link';
import styles from './MovieCard.module.css';

export default function MovieCard({ item }) {
  const href = item.type === 'series' ? `/serie/${item.id}` : `/filme/${item.id}`;
  const year = item.year || item.year_start;

  return (
    <Link href={href} className={styles.card}>
      <div className={styles.poster}>
        {item.poster_url ? (
          <Image src={item.poster_url} alt={item.title} fill sizes="200px" style={{ objectFit: 'cover' }} />
        ) : (
          <div className={styles.noImage}>{item.title?.[0]}</div>
        )}
        <div className={styles.overlay}>
          <div className={styles.info}>
            <span className={styles.title}>{item.title}</span>
            <div className={styles.meta}>
              {year && <span>{year}</span>}
              {item.rating && <span>★ {Number(item.rating).toFixed(1)}</span>}
            </div>
            <div className={styles.genres}>
              {item.genres?.slice(0, 2).join(' · ')}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
