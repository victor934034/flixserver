'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import styles from './page.module.css';

export default function MinhaListaPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/watchlist')
      .then(r => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function remove(id) {
    api.delete(`/watchlist/${id}`)
      .then(() => setItems(prev => prev.filter(i => i.id !== id)))
      .catch(() => {});
  }

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <h1 className={styles.title}>Minha Lista</h1>

        {loading && <p className={styles.loading}>Carregando...</p>}

        {!loading && items.length === 0 && (
          <div className={styles.empty}>
            <p>Sua lista está vazia.</p>
            <Link href="/filmes" className={styles.browseBtn}>Explorar Filmes</Link>
          </div>
        )}

        <div className={styles.grid}>
          {items.map(item => {
            const href = item.content_type === 'series' ? `/serie/${item.content_id}` : `/filme/${item.content_id}`;
            return (
              <div key={item.id} className={styles.card}>
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
                <button className={styles.removeBtn} onClick={() => remove(item.id)} title="Remover da lista">✕</button>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
