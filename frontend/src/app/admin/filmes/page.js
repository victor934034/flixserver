'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '../../../lib/api';
import styles from './page.module.css';

export default function AdminFilmes() {
  const [movies, setMovies] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/movies?page=${page}&limit=30&q=${q}`)
      .then(r => { setMovies(r.data.data); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, q]);

  useEffect(() => { load(); }, [load]);

  async function deleteMovie(id, title) {
    if (!confirm(`Excluir "${title}"?`)) return;
    await api.delete(`/admin/movies/${id}`);
    load();
  }

  async function toggleActive(movie) {
    await api.put(`/admin/movies/${movie.id}`, { is_active: !movie.is_active });
    load();
  }

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.heading}>Filmes <span>({total})</span></h1>
        <Link href="/admin/filmes/novo" className={styles.btnNew}>+ Novo Filme</Link>
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
              <th>Dub</th>
              <th>Leg</th>
              <th>4K</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {movies.map(m => (
              <tr key={m.id}>
                <td>
                  {m.poster_url
                    ? <Image src={m.poster_url} alt={m.title} width={40} height={60} style={{ borderRadius: 3 }} />
                    : <div className={styles.noPoster}>?</div>
                  }
                </td>
                <td>
                  <div className={styles.movieTitle}>{m.title}</div>
                  <div className={styles.movieOriginal}>{m.original_title}</div>
                </td>
                <td>{m.year || '—'}</td>
                <td>{m.file_dubbing ? <span className={styles.yes}>✓</span> : <span className={styles.no}>✗</span>}</td>
                <td>{m.file_subtitled ? <span className={styles.yes}>✓</span> : <span className={styles.no}>✗</span>}</td>
                <td>{m.file_4k ? <span className={styles.yes}>✓</span> : <span className={styles.no}>✗</span>}</td>
                <td>
                  <button
                    onClick={() => toggleActive(m)}
                    className={m.is_active ? styles.statusActive : styles.statusInactive}
                  >
                    {m.is_active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td>
                  <div className={styles.actions}>
                    <Link href={`/admin/filmes/${m.id}`} className={styles.btnEdit}>Editar</Link>
                    <button onClick={() => deleteMovie(m.id, m.title)} className={styles.btnDelete}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className={styles.loading}>Carregando...</p>}
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
