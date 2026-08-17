'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { getToken } from '../../lib/auth';
import styles from './page.module.css';

export default function IptvPage() {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // loading | none | pending | active
  const [pendingInfo, setPendingInfo] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [search, setSearch] = useState('');

  const fetchCategories = useCallback(() => {
    setLoadingCats(true);
    api.get('/iptv/categories')
      .then(r => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false));
  }, []);

  const checkStatus = useCallback(() => {
    api.get('/iptv/status')
      .then(r => {
        setStatus(r.data.status);
        if (r.data.status === 'pending') setPendingInfo(r.data);
        if (r.data.status === 'active') fetchCategories();
      })
      .catch(() => setStatus('none'));
  }, [fetchCategories]);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    checkStatus();
  }, [router, checkStatus]);

  const filtered = search.trim()
    ? categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        {status === 'loading' && <p className={styles.loading}>Carregando...</p>}

        {status === 'none' && (
          <div className={styles.center}>
            <span className={styles.icon}>📺</span>
            <h1 className={styles.title}>Flixhome IPTV</h1>
            <p className={styles.sub}>Você ainda não tem uma assinatura IPTV ativa.</p>
            <Link href="/iptv/planos" className={styles.btn}>Ver planos disponíveis</Link>
          </div>
        )}

        {status === 'pending' && (
          <div className={styles.center}>
            <span className={styles.icon}>⏳</span>
            <h1 className={styles.title}>Pagamento confirmado!</h1>
            {pendingInfo?.plan_name && <p className={styles.pendingPlan}>{pendingInfo.plan_name}</p>}
            <p className={styles.sub}>
              Sua assinatura está sendo ativada pelo administrador.<br />
              Você será notificado assim que ativar.
            </p>
            <button className={styles.btn} onClick={checkStatus}>Verificar agora</button>
          </div>
        )}

        {status === 'active' && (
          <>
            <div className={styles.header}>
              <h1 className={styles.title}>📺 IPTV</h1>
              <span className={styles.count}>{categories.length} categorias</span>
            </div>

            <input
              className={styles.search}
              placeholder="Buscar categoria..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            {loadingCats ? (
              <p className={styles.loading}>Carregando categorias...</p>
            ) : filtered.length === 0 ? (
              <p className={styles.empty}>Nenhuma categoria encontrada</p>
            ) : (
              <div className={styles.grid}>
                {filtered.map(c => (
                  <Link
                    key={c.category_id}
                    href={`/iptv/${c.category_id}?name=${encodeURIComponent(c.category_name || '')}`}
                    className={styles.card}
                  >
                    <span className={styles.cardName}>{c.category_name}</span>
                    <span className={styles.cardArrow}>›</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
