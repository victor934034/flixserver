'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api';
import s from './content.module.css';

const CHIPS = {
  movies: [['', 'all', 'Todos'], ['featured', 'featured', 'Em destaque'], ['banner', 'banner', 'No banner'], ['recent', 'recent', 'Recém adicionados'], ['no_poster', 'no_poster', 'Sem capa'], ['no_video', 'no_video', 'Sem vídeo'], ['no_subtitle', 'no_subtitle', 'Sem legenda'], ['hidden', 'hidden', 'Ocultos']],
  series: [['', 'all', 'Todos'], ['featured', 'featured', 'Em destaque'], ['banner', 'banner', 'No banner'], ['recent', 'recent', 'Recém adicionados'], ['no_poster', 'no_poster', 'Sem capa'], ['hidden', 'hidden', 'Ocultos']],
};
const PER = 30;

export default function ContentAdmin({ kind }) {
  const isMovies = kind === 'movies';
  const base = isMovies ? 'filmes' : 'series';
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('recent');
  const [sel, setSel] = useState(new Set());
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bf, setBf] = useState(null);
  const timer = useRef(null);

  const loadCounts = useCallback(() => api.get('/admin/content-counts', { params: { type: kind } }).then(r => setCounts(r.data)).catch(() => {}), [kind]);
  const load = useCallback(() => {
    setLoading(true);
    api.get(`/admin/${kind}`, { params: { page, limit: PER, q, filter, sort } })
      .then(r => { setItems(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [kind, page, q, filter, sort]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { setSel(new Set()); }, [kind, page, q, filter, sort]);
  useEffect(() => () => clearInterval(timer.current), []);

  const refresh = () => { load(); loadCounts(); };
  const toggleSel = id => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = items.length > 0 && items.every(i => sel.has(i.id));

  async function bulk(patch) {
    if (!sel.size) return;
    await api.post('/admin/bulk', { type: kind, ids: [...sel], patch }).catch(e => alert(e.response?.data?.error || 'Erro'));
    setSel(new Set()); refresh();
  }
  async function one(item, patch) {
    await api.put(`/admin/${kind}/${item.id}`, patch).catch(() => {});
    setMenu(null); refresh();
  }
  async function toggleBanner(item) {
    await api.post('/admin/bulk', { type: kind, ids: [item.id], patch: { in_banner: !item.in_banner } }).catch(() => {});
    refresh();
  }
  async function remove(item) {
    if (!confirm(`Excluir "${item.title}"?`)) return;
    await api.delete(`/admin/${kind}/${item.id}`).catch(() => {});
    setMenu(null); refresh();
  }
  async function backfill() {
    try {
      const { data } = await api.post('/admin/backfill-release-dates');
      setBf(data);
      clearInterval(timer.current);
      timer.current = setInterval(async () => {
        const r = await api.get('/admin/backfill-release-dates').catch(() => null);
        if (!r) return;
        setBf(r.data);
        if (!r.data.running) { clearInterval(timer.current); refresh(); }
      }, 2000);
    } catch (e) { alert(e.response?.data?.error || 'Erro'); }
  }

  const pages = Math.max(1, Math.ceil(total / PER));
  const year = i => i.year || i.year_start || '—';

  return (
    <div className={s.page} onClick={() => setMenu(null)}>
      <div className={s.head}>
        <h1 className={s.h1}>Conteúdo</h1>
        <div className={s.seg} role="tablist">
          <Link href="/admin/filmes" role="tab" aria-selected={isMovies} className={`${s.segBtn} ${isMovies ? s.segOn : ''}`}>Filmes</Link>
          <Link href="/admin/series" role="tab" aria-selected={!isMovies} className={`${s.segBtn} ${!isMovies ? s.segOn : ''}`}>Séries</Link>
        </div>
        <button className={s.btnGhost} onClick={backfill} disabled={bf?.running}>
          {bf?.running ? `Datas… ${bf.done}/${bf.total}` : 'Preencher datas de lançamento'}
        </button>
        {isMovies && <Link href="/admin/filmes/novo" className={s.btnRed}>+ Novo filme</Link>}
      </div>

      <div className={s.filters}>
        <input className={s.search} type="search" placeholder="Buscar por título ou TMDB ID" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} aria-label="Buscar" />
        <select className={s.select} value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} aria-label="Ordenar">
          <option value="recent">Mais recentes</option><option value="title">Título A–Z</option><option value="release">Data de lançamento</option>
        </select>
      </div>

      <div className={s.chips}>
        {CHIPS[kind].map(([v, ck, label]) => (
          <button key={v} className={`${s.chip} ${filter === v ? s.chipOn : ''}`} onClick={() => { setFilter(v); setPage(1); }}>
            {label}{counts[ck] != null && <span className={s.chipN}>{counts[ck]}</span>}
          </button>
        ))}
      </div>

      {sel.size > 0 && (
        <div className={s.bulk} role="toolbar">
          <b>{sel.size} selecionado{sel.size > 1 ? 's' : ''}</b>
          <button onClick={() => bulk({ is_featured: true })}>Destacar</button>
          <button onClick={() => bulk({ in_banner: true })}>Pôr no banner</button>
          <button onClick={() => bulk({ in_banner: false })}>Tirar do banner</button>
          <button onClick={() => bulk({ is_active: false })}>Ocultar</button>
          <button onClick={() => bulk({ is_active: true })}>Reativar</button>
          <button className={s.bulkX} onClick={() => setSel(new Set())}>Limpar</button>
        </div>
      )}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" aria-label="Selecionar todos" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(items.map(i => i.id)))} /></th>
              <th>Título</th><th>Ano</th><th>Marcadores</th>{isMovies && <th>Arquivos</th>}<th>Status</th><th style={{ width: 48 }} />
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className={sel.has(i.id) ? s.rowSel : ''}>
                <td><input type="checkbox" aria-label={`Selecionar ${i.title}`} checked={sel.has(i.id)} onChange={() => toggleSel(i.id)} /></td>
                <td>
                  <div className={s.titleCell}>
                    {i.poster_url ? <img src={i.poster_url} alt="" className={s.poster} loading="lazy" /> : <span className={`${s.poster} ${s.noPoster}`}>?</span>}
                    <div><b>{i.title}</b><small>{i.original_title && i.original_title !== i.title ? i.original_title : ''}</small></div>
                  </div>
                </td>
                <td>{year(i)}</td>
                <td>
                  <div className={s.marks}>
                    <button className={`${s.mark} ${i.is_featured ? s.markStar : ''}`} onClick={() => one(i, { is_featured: !i.is_featured })} aria-pressed={!!i.is_featured} title="Destaque">★ Destaque</button>
                    <button className={`${s.mark} ${i.in_banner ? s.markBanner : ''}`} onClick={() => toggleBanner(i)} aria-pressed={!!i.in_banner} title="Banner da Home">▭ Banner</button>
                  </div>
                </td>
                {isMovies && (
                  <td>
                    <div className={s.files}>
                      <span className={i.file_dubbing ? s.ok : s.no}>Dub {i.file_dubbing ? '✓' : '✗'}</span>
                      <span className={i.file_subtitled ? s.ok : s.no}>Leg {i.file_subtitled ? '✓' : '✗'}</span>
                      <span className={i.file_4k ? s.ok : s.no}>4K {i.file_4k ? '✓' : '✗'}</span>
                    </div>
                  </td>
                )}
                <td><span className={`${s.badge} ${i.is_active ? s.on : s.off}`}>{i.is_active ? 'Ativo' : 'Oculto'}</span></td>
                <td style={{ position: 'relative' }}>
                  <button className={s.dots} aria-label="Mais ações" onClick={e => { e.stopPropagation(); setMenu(menu === i.id ? null : i.id); }}>⋯</button>
                  {menu === i.id && (
                    <div className={s.menu} onClick={e => e.stopPropagation()}>
                      <Link href={`/admin/${base}/${i.id}`}>Editar</Link>
                      <button onClick={() => one(i, { is_active: !i.is_active })}>{i.is_active ? 'Ocultar' : 'Reativar'}</button>
                      <button className={s.danger} onClick={() => remove(i)}>Excluir</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><td colSpan={7} className={s.empty}>Nada encontrado.</td></tr>}
          </tbody>
        </table>
        {loading && <p className={s.empty}>Carregando…</p>}
      </div>

      {total > PER && (
        <div className={s.pager}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
          <span>Página {page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Próxima</button>
        </div>
      )}
    </div>
  );
}
