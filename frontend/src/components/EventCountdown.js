'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ContentRow from './ContentRow';
import api from '../lib/api';
import styles from './EventCountdown.module.css';

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

// Banner com contagem regressiva pra próxima coleção-evento (ex: "Preparação
// para Vingadores: Doomsday") + a lista de filmes/séries dela logo abaixo.
// Some sozinho quando não há nenhum evento futuro cadastrado (o backend já
// filtra event_date >= hoje), sem precisar desativar nada na mão.
export default function EventCountdown() {
  const [event, setEvent] = useState(undefined); // undefined = carregando, null = nenhum
  const [parts, setParts] = useState(null);

  useEffect(() => {
    api.get('/collections/upcoming').then(r => setEvent(r.data || null)).catch(() => setEvent(null));
  }, []);

  useEffect(() => {
    if (!event?.event_date) return;
    const target = new Date(`${event.event_date}T00:00:00`).getTime();
    setParts(diffParts(target));
    const t = setInterval(() => setParts(diffParts(target)), 1000);
    return () => clearInterval(t);
  }, [event]);

  if (!event || parts?.done) return null;

  const accent = event.accent_color || '#E50914';

  return (
    <section className={styles.wrap} style={{ '--accent-color': accent }}>
      <div className={styles.banner}>
        <div className={styles.info}>
          <span className={styles.kicker}>Contagem regressiva</span>
          <h2 className={styles.title}>{event.event_label || event.name}</h2>
          {event.description && <p className={styles.desc}>{event.description}</p>}
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

      {event.items?.length > 0 && (
        <ContentRow
          title={`Maratona: ${event.name}`}
          items={event.items}
          seeAllHref={`/cronologia/${event.slug}`}
        />
      )}
    </section>
  );
}
