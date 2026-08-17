'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import api from '../../../lib/api';
import styles from './page.module.css';

function IptvCategoryContent() {
  const { categoryId } = useParams();
  const searchParams = useSearchParams();
  const categoryName = searchParams.get('name') || 'Canais';
  const router = useRouter();

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [opening, setOpening] = useState(null);

  function load() {
    setLoading(true);
    setError('');
    api.get('/iptv/streams', { params: { category_id: categoryId } })
      .then(r => setChannels(Array.isArray(r.data) ? r.data : []))
      .catch(err => setError(err.response?.data?.error || 'Erro ao carregar canais'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openChannel(item) {
    setOpening(item.stream_id);
    try {
      const { data } = await api.get(`/iptv/stream-url/${item.stream_id}`, { params: { fmt: 'm3u8' } });
      const params = new URLSearchParams({ url: data.url, name: item.name || '', logo: item.stream_icon || '' });
      router.push(`/iptv/player?${params.toString()}`);
    } catch {
      alert('Não foi possível abrir o canal.');
    } finally {
      setOpening(null);
    }
  }

  const filtered = search.trim()
    ? channels.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))
    : channels;

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => router.push('/iptv')}>‹</button>
          <h1 className={styles.title}>{categoryName}</h1>
          {channels.length > 0 && <span className={styles.count}>{channels.length}</span>}
        </div>

        {loading ? (
          <p className={styles.loading}>Carregando canais...</p>
        ) : error ? (
          <div className={styles.center}>
            <p className={styles.error}>{error}</p>
            <button className={styles.retry} onClick={load}>Tentar novamente</button>
          </div>
        ) : (
          <>
            <input
              className={styles.search}
              placeholder={`Buscar em ${categoryName}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {filtered.length === 0 ? (
              <p className={styles.empty}>Nenhum canal encontrado</p>
            ) : (
              <div className={styles.list}>
                {filtered.map(item => (
                  <button
                    key={item.stream_id}
                    className={styles.row}
                    onClick={() => openChannel(item)}
                    disabled={opening === item.stream_id}
                  >
                    {item.stream_icon ? (
                      <img src={item.stream_icon} alt="" className={styles.logo} />
                    ) : (
                      <div className={`${styles.logo} ${styles.logoFallback}`}>📺</div>
                    )}
                    <span className={styles.name}>{item.name}</span>
                    <span className={styles.arrow}>{opening === item.stream_id ? '...' : '▶'}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

export default function IptvCategoryPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Carregando...</div>}>
      <IptvCategoryContent />
    </Suspense>
  );
}
