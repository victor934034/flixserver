'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import styles from '../filmes/novo/page.module.css';

const STATUS_LABEL = {
  pending:  { label: 'Pendente',  color: '#ff9800' },
  approved: { label: 'Aprovado',  color: '#4caf50' },
  rejected: { label: 'Rejeitado', color: '#f44336' },
  added:    { label: 'Adicionado', color: '#2196f3' },
};

const TYPE_LABEL = { movie: 'Filme', series: 'Série' };

export default function SugestoesPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');
  const [updating, setUpdating] = useState('');
  const [msg, setMsg]           = useState('');

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : {};
      const { data } = await api.get('/suggestions', { params });
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id, status) {
    setUpdating(id + status);
    setMsg('');
    try {
      await api.put(`/suggestions/${id}`, { status });
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
      setMsg('Atualizado!');
    } catch (e) {
      setMsg('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setUpdating('');
    }
  }

  async function remove(id) {
    if (!confirm('Excluir esta sugestão?')) return;
    try {
      await api.delete(`/suggestions/${id}`);
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch {}
  }

  const counts = suggestions.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h1 className={styles.heading}>Sugestões</h1>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[{ v: '', label: 'Todas' }, ...Object.entries(STATUS_LABEL).map(([v, { label }]) => ({ v, label }))].map(({ v, label }) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            style={{
              padding: '7px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: filter === v ? '#E50914' : '#1a1a1a',
              color: filter === v ? '#fff' : '#aaa',
            }}>
            {label} {v && counts[v] != null ? `(${counts[v] || 0})` : `(${suggestions.length})`}
          </button>
        ))}
        {msg && <span style={{ color: msg.startsWith('Erro') ? '#ff6b6b' : '#4caf50', alignSelf: 'center', fontSize: 13 }}>{msg}</span>}
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>Carregando...</p>
      ) : suggestions.length === 0 ? (
        <p style={{ color: '#555', fontSize: 15 }}>Nenhuma sugestão {filter ? `com status "${STATUS_LABEL[filter]?.label}"` : ''}.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {suggestions.map(s => {
            const st = STATUS_LABEL[s.status] || STATUS_LABEL.pending;
            return (
              <div key={s.id} style={{
                background: '#1a1a1a', borderRadius: 12, padding: 16,
                border: '1px solid #2a2a2a', display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                {/* Poster */}
                {s.poster_url ? (
                  <img src={s.poster_url} alt="" style={{ width: 52, height: 74, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 52, height: 74, borderRadius: 6, background: '#111', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 22 }}>
                    🎬
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{s.title}</span>
                    {s.year && <span style={{ color: '#666', fontSize: 13 }}>{s.year}</span>}
                    <span style={{ background: '#111', color: '#888', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>
                      {TYPE_LABEL[s.type] || s.type}
                    </span>
                    <span style={{ background: st.color + '22', color: st.color, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10 }}>
                      {st.label}
                    </span>
                  </div>

                  <div style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>
                    Por <strong style={{ color: '#aaa' }}>{s.user_name || s.user_email}</strong>
                    {s.user_name && s.user_email && <span style={{ color: '#555' }}> · {s.user_email}</span>}
                    {' · '}{new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>

                  {s.message && (
                    <div style={{ color: '#aaa', fontSize: 13, fontStyle: 'italic', background: '#111', padding: '8px 12px', borderRadius: 6, marginBottom: 8 }}>
                      "{s.message}"
                    </div>
                  )}

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {s.status !== 'added' && (
                      <ActionBtn label="✅ Adicionado" color="#2196f3" loading={updating === s.id + 'added'} onClick={() => setStatus(s.id, 'added')} />
                    )}
                    {s.status !== 'approved' && s.status !== 'added' && (
                      <ActionBtn label="👍 Aprovar" color="#4caf50" loading={updating === s.id + 'approved'} onClick={() => setStatus(s.id, 'approved')} />
                    )}
                    {s.status !== 'rejected' && (
                      <ActionBtn label="❌ Rejeitar" color="#f44336" loading={updating === s.id + 'rejected'} onClick={() => setStatus(s.id, 'rejected')} />
                    )}
                    {s.tmdb_id && (
                      <a
                        href={`https://www.themoviedb.org/${s.type === 'series' ? 'tv' : 'movie'}/${s.tmdb_id}`}
                        target="_blank" rel="noreferrer"
                        style={{ padding: '5px 12px', borderRadius: 6, background: '#01b4e4', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                        Ver no TMDB
                      </a>
                    )}
                    <button
                      onClick={() => remove(s.id)}
                      style={{ padding: '5px 12px', borderRadius: 6, background: '#2a2a2a', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer' }}>
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
        background: color + '22', color, fontSize: 12, fontWeight: 600,
        opacity: loading ? 0.6 : 1,
      }}>
      {loading ? '...' : label}
    </button>
  );
}
