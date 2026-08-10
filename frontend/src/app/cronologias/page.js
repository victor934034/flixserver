'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import styles from './page.module.css';

export default function CronologiasPage() {
  const [collections, setCollections] = useState(null);

  useEffect(() => {
    api.get('/collections').then(r => setCollections(r.data || [])).catch(() => setCollections([]));
  }, []);

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Cronologias</h1>
          <p className={styles.subtitle}>Coleções e ordens de exibição recomendadas, como universos e franquias.</p>
        </div>

        {!collections ? (
          <p className={styles.loading}>Carregando...</p>
        ) : collections.length === 0 ? (
          <p className={styles.empty}>Nenhuma cronologia disponível ainda.</p>
        ) : (
          <div className={styles.grid}>
            {collections.map(c => (
              <Link key={c.id} href={`/cronologia/${c.slug}`} className={styles.card}>
                <div className={styles.cover}>
                  {c.cover_url ? (
                    <Image src={c.cover_url} alt={c.name} fill sizes="280px" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className={styles.noImage}>{c.name?.[0]}</div>
                  )}
                </div>
                <div className={styles.cardTitle}>{c.name}</div>
                {c.description && <div className={styles.cardDesc}>{c.description}</div>}
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
