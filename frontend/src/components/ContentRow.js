'use client';
import MovieCard from './MovieCard';
import styles from './ContentRow.module.css';

export default function ContentRow({ title, items = [], type = 'movie', seeAllHref }) {
  if (!items.length) return null;

  const decorated = items.map(i => ({ ...i, type: i.type || type }));

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.dot} />
          <h2 className={styles.title}>
            {title}
            <span className={styles.count}>{items.length}</span>
          </h2>
        </div>
        {seeAllHref && (
          <a href={seeAllHref} className={styles.seeAll}>
            Ver tudo
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
          </a>
        )}
      </div>
      <div className={styles.scroll}>
        {decorated.map(item => (
          <MovieCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
