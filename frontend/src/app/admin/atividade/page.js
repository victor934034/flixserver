'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import styles from './page.module.css';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR');
}

function fmtDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AdminAtividade() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 50;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/activity', { params: { page, limit } })
      .then(r => { setItems(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.heading}>Atividade dos Usuários <span>({total})</span></h1>
      </div>
      <p className={styles.hint}>Quem assistiu o quê, quando, e em que ponto parou — mais recente primeiro.</p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Conteúdo</th>
              <th>Progresso</th>
              <th>Última vez</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const pct = item.duration > 0 ? Math.min(100, Math.round((item.progress / item.duration) * 100)) : 0;
              return (
                <tr key={item.id}>
                  <td>
                    <div className={styles.userName}>{item.user_name || 'Usuário'}</div>
                    {item.user_email && <div className={styles.userEmail}>{item.user_email}</div>}
                  </td>
                  <td>
                    <span className={styles.typeBadge}>{item.content_type === 'episode' ? 'SÉRIE' : 'FILME'}</span>
                    <div className={styles.contentTitle}>{item.title}</div>
                    {item.subtitle && <div className={styles.contentSub}>{item.subtitle}</div>}
                  </td>
                  <td>
                    <div className={styles.progressWrap}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.progressText}>
                        {fmtDuration(item.progress)} / {fmtDuration(item.duration)} ({pct}%)
                        {item.completed && <span className={styles.doneTag}> ✓ concluído</span>}
                      </span>
                    </div>
                  </td>
                  <td className={styles.dateCell}>{fmtDate(item.last_watched)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && <p className={styles.loading}>Carregando...</p>}
        {!loading && items.length === 0 && <p className={styles.loading}>Nenhuma atividade registrada ainda.</p>}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Anterior</button>
          <span className={styles.pageInfo}>{page} / {totalPages}</span>
          <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próximo ›</button>
        </div>
      )}
    </div>
  );
}
