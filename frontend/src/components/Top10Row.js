'use client';
import MovieCard from './MovieCard';
import row from './ContentRow.module.css';
import s from './Extras.module.css';

// Fileira numerada com os mais assistidos da semana
export default function Top10Row({ items = [] }) {
  // com menos de 3 a lista não diz nada
  if (items.length < 3) return null;
  return (
    <section className={row.section}>
      <div className={row.header}>
        <div className={row.titleWrap}>
          <div className={row.dot} />
          <h2 className={row.title}>Top 10 da semana</h2>
        </div>
      </div>
      <div className={row.scroll}>
        {items.map(item => (
          <div key={`${item.content_type}:${item.id}`} className={s.topItem}>
            <span className={s.rank} aria-label={`${item.rank}º lugar`}>{item.rank}</span>
            <MovieCard item={{ ...item, type: item.content_type }} />
          </div>
        ))}
      </div>
    </section>
  );
}
