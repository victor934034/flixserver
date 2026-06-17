'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './HeroBanner.module.css';

export default function HeroBanner({ items = [] }) {
  const [index, setIndex] = useState(0);
  if (!items.length) return null;

  const item = items[index];
  const href = item.type === 'series' ? `/serie/${item.id}` : `/filme/${item.id}`;

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
          <button className={styles.btnList}>+ Minha Lista</button>
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
