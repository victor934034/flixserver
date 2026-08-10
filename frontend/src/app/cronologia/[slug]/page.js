'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import MovieCard from '../../../components/MovieCard';
import api from '../../../lib/api';
import styles from './page.module.css';

export default function CronologiaDetailPage() {
  const { slug } = useParams();
  const [collection, setCollection] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/collections/${slug}`)
      .then(r => setCollection(r.data))
      .catch(() => setNotFound(true));
  }, [slug]);

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        {notFound ? (
          <p className={styles.empty}>Cronologia não encontrada.</p>
        ) : !collection ? (
          <p className={styles.loading}>Carregando...</p>
        ) : (
          <>
            <div className={styles.header}>
              <h1 className={styles.title}>{collection.name}</h1>
              {collection.description && <p className={styles.subtitle}>{collection.description}</p>}
            </div>

            {collection.items?.length === 0 ? (
              <p className={styles.empty}>Nenhum item nesta cronologia ainda.</p>
            ) : (
              <div className={styles.list}>
                {collection.items.map((item, idx) => (
                  <div key={`${item.type}-${item.id}`} className={styles.itemRow}>
                    <div className={styles.position}>{idx + 1}</div>
                    <MovieCard item={item} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
