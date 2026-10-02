'use client';
import { useEffect, useState } from 'react';
import styles from './CountdownBanner.module.css';

function diffParts(targetMs) {
  const diff = Math.max(0, targetMs - Date.now());
  const sec = Math.floor(diff / 1000);
  return {
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
    done: diff <= 0,
  };
}

// Banner de contagem regressiva pra coleção/cronologia marcada como evento
// (event_date no banco). Puramente apresentacional — recebe a coleção já
// carregada (sem fetch próprio), e some sozinho quando a data passar.
export default function CountdownBanner({ collection }) {
  const [parts, setParts] = useState(null);

  useEffect(() => {
    if (!collection?.event_date) return;
    const target = new Date(`${collection.event_date}T00:00:00`).getTime();
    setParts(diffParts(target));
    const t = setInterval(() => setParts(diffParts(target)), 1000);
    return () => clearInterval(t);
  }, [collection?.event_date]);

  if (!collection?.event_date || parts?.done) return null;

  const accent = collection.accent_color || '#E50914';

  return (
    <div className={styles.banner} style={{ '--accent-color': accent }}>
      <div className={styles.info}>
        <span className={styles.kicker}>Contagem regressiva</span>
        <h2 className={styles.title}>{collection.event_label || collection.name}</h2>
      </div>
      {parts && (
        <div className={styles.timer}>
          {[['dias', parts.days], ['horas', parts.hours], ['min', parts.minutes], ['seg', parts.seconds]].map(([label, val]) => (
            <div key={label} className={styles.unit}>
              <span className={styles.unitValue}>{String(val).padStart(2, '0')}</span>
              <span className={styles.unitLabel}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
