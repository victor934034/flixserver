'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import styles from './page.module.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const cards = stats ? [
    { label: 'Filmes', value: stats.movies, color: '#E50914' },
    { label: 'Séries', value: stats.series, color: '#0071eb' },
    { label: 'Episódios', value: stats.episodes, color: '#46d369' },
    { label: 'Usuários', value: stats.users, color: '#ffa500' },
    { label: 'Filmes sem vídeo', value: stats.movies_missing_video, color: '#ff6b35', alert: stats.movies_missing_video > 0 },
  ] : [];

  return (
    <div>
      <h1 className={styles.heading}>Dashboard</h1>
      <div className={styles.grid}>
        {cards.map(c => (
          <div key={c.label} className={`${styles.card} ${c.alert ? styles.alertCard : ''}`}>
            <span className={styles.cardValue} style={{ color: c.color }}>{c.value ?? '—'}</span>
            <span className={styles.cardLabel}>{c.label}</span>
          </div>
        ))}
      </div>
      {!stats && <p className={styles.loading}>Carregando estatísticas...</p>}
    </div>
  );
}
