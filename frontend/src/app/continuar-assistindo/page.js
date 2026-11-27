'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '../../components/Navbar';
import { onePerTitle } from '../../lib/skipRules';
import api from '../../lib/api';
import { useProfile } from '../../contexts/ProfileContext';
import styles from './page.module.css';

export default function ContinuarAssistindoPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activeProfile } = useProfile();

  useEffect(() => {
    const params = activeProfile ? { profile_id: activeProfile.id } : undefined;
    api.get('/history', { params })
      .then(r => setItems(onePerTitle((r.data || []).filter(i => !i.completed))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeProfile]);

  async function remove(item) {
    if (!window.confirm(`Tirar "${item.title}" do Continuar assistindo?`)) return;
    try {
      await api.delete(`/history/${item.id}`);
      const same = o => o.id === item.id || (item.content_type === 'episode' && !!item.series_id && o.series_id === item.series_id);
      setItems(list => list.filter(o => !same(o)));
    } catch {
      window.alert('Não foi possível remover. Tente de novo.');
    }
  }

  function pct(item) {
    if (!item.duration || !item.progress) return 0;
    return Math.min(100, Math.round((item.progress / item.duration) * 100));
  }

  function fmtTime(secs) {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <h1 className={styles.title}>Continuar Assistindo</h1>

        {loading && <p className={styles.loading}>Carregando...</p>}

        {!loading && items.length === 0 && (
          <div className={styles.empty}>
            <p>Nada para continuar ainda.</p>
            <Link href="/filmes" className={styles.browseBtn}>Explorar Filmes</Link>
          </div>
        )}

        <div className={styles.grid}>
          {items.map(item => {
            const href = item.content_type === 'episode'
              ? `/serie/${item.series_id || item.content_id}`
              : `/filme/${item.content_id}`;
            const progress = pct(item);

            return (
              <div key={item.id} className={styles.cardWrap}>
              <button type="button" className={styles.removeBtn} onClick={() => remove(item)} title="Tirar da lista" aria-label={`Tirar ${item.title || 'título'} da lista`}>✕</button>
              <Link href={href} className={styles.card}>
                <div className={styles.poster}>
                  {item.poster_url ? (
                    <Image src={item.poster_url} alt={item.title || ''} fill sizes="220px" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className={styles.noImg}>▶</div>
                  )}
                  <div className={styles.overlay}>
                    <span className={styles.playIcon}>▶</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <span className={styles.cardTitle}>{item.title || 'Sem título'}</span>
                  <span className={styles.cardMeta}>
                    {item.content_type === 'episode' ? 'Série' : 'Filme'}
                    {item.progress ? ` · ${fmtTime(item.progress)}` : ''}
                    {' · '}{progress}%
                  </span>
                </div>
              </Link>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
