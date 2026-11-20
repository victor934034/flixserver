'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { useProfile } from '../../contexts/ProfileContext';
import styles from './page.module.css';

export default function MinhaListaPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const { activeProfile } = useProfile();

  useEffect(() => {
    const params = activeProfile ? { profile_id: activeProfile.id } : undefined;
    api.get('/watchlist', { params })
      .then(r => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeProfile]);

  function remove(item) {
    const wid = item.watchlist_id || item.id;
    const params = activeProfile ? { profile_id: activeProfile.id } : undefined;
    api.delete(`/watchlist/${wid}`, { params })
      .then(() => setItems(prev => prev.filter(i => (i.watchlist_id || i.id) !== wid)))
      .catch(() => {});
  }

  const norm = t => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const shown = q.trim() ? items.filter(i => norm(i.title).includes(norm(q.trim()))) : items;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <h1 className={styles.title}>Minha Lista <span style={{ color: '#888', fontWeight: 600, fontSize: '0.6em' }}>({items.length} {items.length === 1 ? 'item' : 'itens'})</span></h1>
        {items.length > 0 && (
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nos favoritos" aria-label="Buscar nos favoritos"
            style={{ width: '100%', maxWidth: 420, height: 42, padding: '0 14px', margin: '0 0 20px', borderRadius: 10, border: '1px solid #2a2a2a', background: '#141414', color: '#e5e5e5', fontSize: 14, outline: 'none' }} />
        )}
        {items.length > 0 && shown.length === 0 && <p className={styles.loading}>Nenhum favorito encontrado para “{q}”.</p>}

        {loading && <p className={styles.loading}>Carregando...</p>}

        {!loading && items.length === 0 && (
          <div className={styles.empty}>
            <p>Sua lista está vazia.</p>
            <Link href="/filmes" className={styles.browseBtn}>Explorar Filmes</Link>
          </div>
        )}

        <div className={styles.grid}>
          {shown.map(item => {
            const href = item.content_type === 'series' ? `/serie/${item.content_id}` : `/filme/${item.content_id}`;
            return (
              <div key={item.watchlist_id || item.id} className={styles.card}>
                <Link href={href} className={styles.cardLink}>
                  <div className={styles.poster}>
                    {item.poster_url ? (
                      <Image src={item.poster_url} alt={item.title || ''} fill sizes="200px" style={{ objectFit: 'cover' }} />
                    ) : (
                      <div className={styles.noImg}>{item.title?.[0] || '?'}</div>
                    )}
                    <div className={styles.overlay}>
                      <span className={styles.playIcon}>▶</span>
                    </div>
                  </div>
                  <div className={styles.cardInfo}>
                    <span className={styles.cardTitle}>{item.title || 'Sem título'}</span>
                    <span className={styles.cardType}>{item.content_type === 'series' ? 'Série' : 'Filme'}</span>
                  </div>
                </Link>
                <button className={styles.removeBtn} onClick={() => remove(item)} title="Remover da lista">✕</button>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
