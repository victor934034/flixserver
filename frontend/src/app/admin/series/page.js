'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '../../../lib/api';
import styles from '../filmes/page.module.css';

export default function AdminSeries() {
  const [series, setSeries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/series?page=${page}&limit=30&q=${q}`)
      .then(r => { setSeries(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, q]);

  useEffect(() => { load(); }, [load]);

  async function deleteSerie(id, title) {
    if (!confirm(`Excluir "${title}"?`)) return;
    await api.delete(`/admin/series/${id}`);
    load();
  }

  async function toggleActive(s) {
    await api.put(`/admin/series/${s.id}`, { is_active: !s.is_active });
    load();
  }

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.heading}>Séries <span>({total})</span></h1>
      </div>

      <input
        type="search"
        placeholder="Buscar por título..."
        value={q}
        onChange={e => { setQ(e.target.value); setPage(1); }}
        className={styles.search}
      />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Poster</th>
              <th>Título</th>
              <th>Ano</th>
              <th>Temporadas</th>
              <th>Status</th>
              <th>Ativo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {series.map(s => (
              <tr key={s.id}>
                <td>
                  {s.poster_url
                    ? <Image src={s.poster_url} alt={s.title} width={40} height={60} style={{ borderRadius: 3 }} />
                    : <div className={styles.noPoster}>?</div>
                  }
                </td>
                <td>
                  <div className={styles.movieTitle}>{s.title}</div>
                  <div className={styles.movieOriginal}>{s.original_title}</div>
                </td>
                <td>{s.year_start || '—'}{s.year_end ? `–${s.year_end}` : ''}</td>
                <td>{s.total_seasons ?? '—'}</td>
                <td>{s.status || '—'}</td>
                <td>
                  <button
                    onClick={() => toggleActive(s)}
                    className={s.is_active ? styles.statusActive : styles.statusInactive}
                  >
                    {s.is_active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td>
                  <div className={styles.actions}>
                    <Link href={`/admin/series/${s.id}`} className={styles.btnEdit}>Editar</Link>
                    <button onClick={() => deleteSerie(s.id, s.title)} className={styles.btnDelete}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className={styles.loading}>Carregando...</p>}
        {!loading && series.length === 0 && <p className={styles.loading}>Nenhuma série cadastrada.</p>}
      </div>

      {total > 30 && (
        <div className={styles.pagination}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
          <span>Página {page} de {Math.ceil(total / 30)}</span>
          <button disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(p => p + 1)}>Próxima</button>
        </div>
      )}
    </div>
  );
}
