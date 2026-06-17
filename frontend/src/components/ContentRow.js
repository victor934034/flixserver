'use client';
import MovieCard from './MovieCard';
import styles from './ContentRow.module.css';

export default function ContentRow({ title, items = [], type = 'movie' }) {
  if (!items.length) return null;

  const decorated = items.map(i => ({ ...i, type: i.type || type }));

  return (
    <section className={styles.row}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.scroll}>
        {decorated.map(item => (
          <MovieCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
