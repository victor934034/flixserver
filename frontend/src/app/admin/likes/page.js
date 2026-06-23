'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';

function pct(likes, dislikes) {
  const t = likes + dislikes;
  return t > 0 ? Math.round((likes / t) * 100) : 0;
}

function RatioBar({ likes, dislikes }) {
  const p = pct(likes, dislikes);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: '#1a1a1a', overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', borderRadius: 3, backgroundColor: p >= 70 ? '#46d369' : p >= 40 ? '#ffa500' : '#E50914', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 12, color: p >= 70 ? '#46d369' : p >= 40 ? '#ffa500' : '#E50914', fontWeight: 700, minWidth: 34, textAlign: 'right' }}>{p}%</span>
    </div>
  );
}

function Verdict({ ratio }) {
  if (ratio >= 80) return <span style={{ color: '#46d369', fontSize: 11, fontWeight: 700, background: '#46d36920', padding: '2px 8px', borderRadius: 6 }}>ÓTIMO</span>;
  if (ratio >= 60) return <span style={{ color: '#4caf50', fontSize: 11, fontWeight: 700, background: '#4caf5020', padding: '2px 8px', borderRadius: 6 }}>BOM</span>;
  if (ratio >= 40) return <span style={{ color: '#ffa500', fontSize: 11, fontWeight: 700, background: '#ffa50020', padding: '2px 8px', borderRadius: 6 }}>REGULAR</span>;
  return <span style={{ color: '#E50914', fontSize: 11, fontWeight: 700, background: '#E5091420', padding: '2px 8px', borderRadius: 6 }}>RUIM</span>;
}

export default function AdminLikes() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'movie' | 'series'
  const [sort, setSort] = useState('ratio'); // 'ratio' | 'likes' | 'dislikes' | 'total'

  useEffect(() => {
    api.get('/admin/likes/stats')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#555' }}>Carregando...</p>;
  if (!data) return <p style={{ color: '#E50914' }}>Erro ao carregar dados.</p>;

  const { items, byGenre, totals } = data;
  const totalAll = totals.likes + totals.dislikes;

  const filtered = items
    .filter(i => filter === 'all' || i.type === filter)
    .sort((a, b) => {
      if (sort === 'ratio') return b.ratio - a.ratio || b.total - a.total;
      if (sort === 'likes') return b.likes - a.likes;
      if (sort === 'dislikes') return b.dislikes - a.dislikes;
      return b.total - a.total;
    });

  const best = [...items].sort((a, b) => b.ratio - a.ratio || b.total - a.total).slice(0, 3);
  const worst = [...items].filter(i => i.total >= 3).sort((a, b) => a.ratio - b.ratio || b.total - a.total).slice(0, 3);

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Likes & Dislikes</h1>
      <p style={{ color: '#555', fontSize: 14, marginBottom: 28 }}>Análise de avaliações dos usuários por conteúdo e gênero.</p>

      {/* ── Totais ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        {[
          { label: 'Total de votos', value: totalAll, color: '#fff' },
          { label: '👍 Likes', value: totals.likes, color: '#46d369' },
          { label: '👎 Dislikes', value: totals.dislikes, color: '#E50914' },
          { label: 'Aprovação geral', value: `${pct(totals.likes, totals.dislikes)}%`, color: pct(totals.likes, totals.dislikes) >= 60 ? '#46d369' : '#ffa500' },
        ].map(c => (
          <div key={c.label} style={{ background: '#111', borderRadius: 14, padding: '18px 20px', border: '1px solid #1e1e1e' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, marginBottom: 4 }}>{c.value ?? '—'}</div>
            <div style={{ fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Por gênero ── */}
      {byGenre.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ color: '#777', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Por categoria / gênero</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {byGenre.map(g => (
              <div key={g.genre} style={{ background: '#111', borderRadius: 12, padding: '14px 16px', border: '1px solid #1e1e1e' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: '#ccc', fontWeight: 600, fontSize: 14 }}>{g.genre}</span>
                  <Verdict ratio={g.ratio} />
                </div>
                <RatioBar likes={g.likes} dislikes={g.dislikes} />
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <span style={{ color: '#46d369', fontSize: 12 }}>👍 {g.likes}</span>
                  <span style={{ color: '#E50914', fontSize: 12 }}>👎 {g.dislikes}</span>
                  <span style={{ color: '#555', fontSize: 12, marginLeft: 'auto' }}>{g.total} votos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Best & Worst ── */}
      {(best.length > 0 || worst.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 36 }}>
          <div style={{ background: '#0f1f0f', borderRadius: 14, padding: 20, border: '1px solid #1e3a1e' }}>
            <h2 style={{ color: '#46d369', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>🏆 Mais amados</h2>
            {best.map((item, i) => (
              <div key={item.content_id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ color: '#46d369', fontSize: 18, fontWeight: 900, width: 24 }}>{i + 1}</span>
                {item.poster_url && <img src={item.poster_url} style={{ width: 36, height: 52, borderRadius: 4, objectFit: 'cover' }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
                  <RatioBar likes={item.likes} dislikes={item.dislikes} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: '#1f0f0f', borderRadius: 14, padding: 20, border: '1px solid #3a1e1e' }}>
            <h2 style={{ color: '#E50914', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>📉 Menos amados</h2>
            {worst.length === 0
              ? <p style={{ color: '#333', fontSize: 13 }}>Mínimo 3 votos para aparecer aqui.</p>
              : worst.map((item, i) => (
                <div key={item.content_id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ color: '#E50914', fontSize: 18, fontWeight: 900, width: 24 }}>{i + 1}</span>
                  {item.poster_url && <img src={item.poster_url} style={{ width: 36, height: 52, borderRadius: 4, objectFit: 'cover' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
                    <RatioBar likes={item.likes} dislikes={item.dislikes} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Tabela completa ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ color: '#777', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
            Todos os conteúdos <span style={{ color: '#333' }}>({filtered.length})</span>
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['all', 'Todos'], ['movie', 'Filmes'], ['series', 'Séries']].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: filter === v ? '#E50914' : '#1a1a1a', color: filter === v ? '#fff' : '#555' }}>{l}</button>
            ))}
            <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '5px 10px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#aaa', fontSize: 12, cursor: 'pointer' }}>
              <option value="ratio">Aprovação</option>
              <option value="likes">Mais likes</option>
              <option value="dislikes">Mais dislikes</option>
              <option value="total">Mais votados</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: '#333', fontSize: 14 }}>Nenhum voto registrado ainda.</p>
        ) : (
          <div style={{ background: '#0d0d0d', borderRadius: 14, border: '1px solid #1a1a1a', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  {['#', 'Conteúdo', 'Tipo', '👍', '👎', 'Total', 'Aprovação', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', color: '#444', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', textAlign: h === '#' ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={item.content_id} style={{ borderBottom: '1px solid #111' }}>
                    <td style={{ padding: '12px 16px', color: '#444', fontSize: 13, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {item.poster_url && <img src={item.poster_url} style={{ width: 28, height: 40, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />}
                        <div>
                          <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                          {item.genres?.length > 0 && <div style={{ color: '#444', fontSize: 11, marginTop: 2 }}>{item.genres.slice(0, 2).join(' · ')}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#555', fontSize: 12 }}>{item.type === 'movie' ? 'Filme' : 'Série'}</td>
                    <td style={{ padding: '12px 16px', color: '#46d369', fontSize: 13, fontWeight: 700 }}>{item.likes}</td>
                    <td style={{ padding: '12px 16px', color: '#E50914', fontSize: 13, fontWeight: 700 }}>{item.dislikes}</td>
                    <td style={{ padding: '12px 16px', color: '#555', fontSize: 13 }}>{item.total}</td>
                    <td style={{ padding: '12px 16px', minWidth: 140 }}>
                      <RatioBar likes={item.likes} dislikes={item.dislikes} />
                    </td>
                    <td style={{ padding: '12px 16px' }}><Verdict ratio={item.ratio} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
