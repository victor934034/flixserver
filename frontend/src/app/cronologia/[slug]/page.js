'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '../../../components/Navbar';
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
            <div
              className={styles.hero}
              style={collection.cover_url ? { backgroundImage: `url(${collection.cover_url})` } : undefined}
            >
              <div className={styles.heroOverlay} />
              <div className={styles.heroContent}>
                <span className={styles.heroKicker}>Cronologia</span>
                <h1 className={styles.title}>{collection.name}</h1>
                {collection.description && <p className={styles.subtitle}>{collection.description}</p>}
                {collection.items?.length > 0 && (
                  <span className={styles.count}>{collection.items.length} título{collection.items.length !== 1 ? 's' : ''} em ordem</span>
                )}
              </div>
            </div>

            {collection.items?.length === 0 ? (
              <p className={styles.empty}>Nenhum item nesta cronologia ainda.</p>
            ) : (
              <div className={styles.timeline}>
                {collection.items.map((item, idx) => {
                  const href = item.type === 'series' ? `/serie/${item.id}` : `/filme/${item.id}`;
                  const year = item.year || item.year_start;
                  return (
                    <div key={`${item.type}-${item.id}`} className={styles.timelineRow}>
                      <div className={styles.markerCol}>
                        <div className={styles.marker}>{idx + 1}</div>
                        {idx < collection.items.length - 1 && <div className={styles.connector} />}
                      </div>

                      <Link href={href} className={styles.card}>
                        <div className={styles.poster}>
                          {item.poster_url ? (
                            <Image src={item.poster_url} alt={item.title} fill sizes="120px" style={{ objectFit: 'cover' }} />
                          ) : (
                            <div className={styles.noImage}>{item.title?.[0]}</div>
                          )}
                        </div>
                        <div className={styles.info}>
                          <div className={styles.infoTop}>
                            <span className={styles.typeBadge}>{item.type === 'series' ? 'SÉRIE' : 'FILME'}</span>
                            {year && <span className={styles.year}>{year}</span>}
                            {item.rating > 0 && <span className={styles.rating}>★ {Number(item.rating).toFixed(1)}</span>}
                          </div>
                          <h3 className={styles.cardTitle}>{item.title}</h3>
                          {item.note && <p className={styles.note}>{item.note}</p>}
                          {item.synopsis && <p className={styles.synopsis}>{item.synopsis}</p>}
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
