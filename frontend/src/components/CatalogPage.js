'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from './Navbar';
import MovieCard from './MovieCard';
import api from '../lib/api';
import s from './CatalogPage.module.css';

const YEAR = new Date().getFullYear();
const PRESETS = [
  ['30d', 'Últimos 30 dias'], ['180d', 'Últimos 6 meses'], ['year', 'Este ano'],
  ['2010s', 'Anos 2010s'], ['2000s', 'Anos 2000s'], ['1990s', 'Anos 90'],
];
const SORTS = [['created_at', 'Mais recentes'], ['release_date', 'Lançamento'], ['rating', 'Melhor avaliados'], ['views', 'Mais assistidos'], ['title', 'A–Z']];

function dateQuery(p, key) {
  const m = /^range:(\d{4})-(\d{4})$/.exec(key || '');
  if (m) { p.set('year_from', m[1]); p.set('year_to', m[2]); return; }
  if (key === '30d') p.set('released_days', 30);
  else if (key === '180d') p.set('released_days', 180);
  else if (key === 'year') { p.set('year_from', YEAR); p.set('year_to', YEAR); }
  else if (/^\d{4}s$/.test(key)) { p.set('year_from', key.slice(0, 4)); p.set('year_to', Number(key.slice(0, 4)) + 9); }
}
const dateLabel = (k) => { const m = /^range:(\d{4})-(\d{4})$/.exec(k || ''); if (m) return `${m[1]}–${m[2]}`; const p = PRESETS.find(x => x[0] === k); return p ? p[1] : ''; };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '');

function Content({ kind, title, base, genres }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(2020);
  const [to, setTo] = useState(YEAR);

  const page = Number(sp.get('page') || 1);
  const genre = sp.get('genre') || '';
  const sel = genre ? genre.split(',').filter(Boolean) : [];
  const sort = sp.get('sort') || 'created_at';
  const date = sp.get('date') || '';
  const min = Number(sp.get('min') || 0);
  const totalPages = Math.ceil(total / 24);
  const isNew = sort === 'release_date' || /^(30d|180d|year)$/.test(date);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page, sort, limit: 24 });
    if (genre) p.set('genre', genre);
    if (min > 0) p.set('min_rating', min);
    dateQuery(p, date);
    api.get(`/${kind}?${p}`).then(r => { setItems(r.data.data || []); setTotal(r.data.total || 0); }).catch(() => {}).finally(() => setLoading(false));
  }, [page, genre, sort, date, min, kind]);
  useEffect(() => { load(); }, [load]);

  const set = (obj) => {
    const p = new URLSearchParams(sp.toString());
    Object.entries(obj).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k); });
    p.delete('page');
    router.push(`${base}?${p.toString()}`);
  };
  const goPage = (n) => { const p = new URLSearchParams(sp.toString()); p.set('page', n); router.push(`${base}?${p.toString()}`); };
  const toggleG = (g) => set({ genre: (sel.includes(g) ? sel.filter(x => x !== g) : [...sel, g]).join(',') });
  const clear = () => router.push(base);
  const hasFilters = sel.length || date || min > 0;
  const years = Array.from({ length: YEAR - 1949 }, (_, i) => YEAR - i);

  return (
    <main className={s.main}>
      <div className={s.head}>
        <div>
          <h1>{isNew ? 'Recém lançados' : title}</h1>
          <p>{isNew ? 'Ordenado pela data real de lançamento' : `${total} títulos`}</p>
        </div>
        <label className={s.sort}>Ordenar por
          <select value={sort} onChange={e => set({ sort: e.target.value === 'created_at' ? '' : e.target.value })}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className={s.chips}>
        {sel.map(g => <button key={g} onClick={() => toggleG(g)}>{g} <i>×</i></button>)}
        {date && <button onClick={() => set({ date: '' })}>{dateLabel(date)} <i>×</i></button>}
        {min > 0 && <button onClick={() => set({ min: '' })}>Nota {min},0+ <i>×</i></button>}
        {hasFilters ? <button className={s.clear} onClick={clear}>Limpar filtros</button> : null}
        <span className={s.total}>{total} títulos</span>
      </div>

      <div className={s.layout}>
        <aside className={s.side}>
          <b className={s.sl}>Ano de lançamento</b>
          <div className={s.range}>
            <select value={from} onChange={e => { const v = +e.target.value; setFrom(v); set({ date: `range:${Math.min(v, to)}-${Math.max(v, to)}` }); }}>{years.map(y => <option key={y}>{y}</option>)}</select>
            <span>—</span>
            <select value={to} onChange={e => { const v = +e.target.value; setTo(v); set({ date: `range:${Math.min(from, v)}-${Math.max(from, v)}` }); }}>{years.map(y => <option key={y}>{y}</option>)}</select>
          </div>
          {PRESETS.map(([k, l]) => (
            <label key={k} className={s.radio}><input type="radio" name="date" checked={date === k} onChange={() => set({ date: k })} /><i />{l}</label>
          ))}

          <b className={s.sl} style={{ marginTop: 22 }}>Gênero</b>
          <div className={s.gen}>{genres.map(g => <button key={g} className={sel.includes(g) ? s.genOn : ''} onClick={() => toggleG(g)}>{g}</button>)}</div>

          <div className={s.minRow}><b className={s.sl}>Nota mínima</b><span>{min > 0 ? `${min},0+` : 'Qualquer'}</span></div>
          <input type="range" min="0" max="9" step="1" value={min} onChange={e => set({ min: Number(e.target.value) || '' })} className={s.slider} />
        </aside>

        <section>
          {loading ? <p className={s.msg}>Carregando…</p> : items.length === 0 ? <p className={s.msg}>Nada encontrado com esses filtros.</p> : (
            <div className={s.grid}>
              {items.map(m => (
                <div key={m.id} className={s.cell}>
                  <div className={s.poster}>
                    {isNew && <span className={s.novo}>NOVO</span>}
                    <MovieCard item={{ ...m, type: kind === 'movies' ? 'movie' : 'series' }} />
                  </div>
                  {m.release_date && <small>Lançado em {fmtDate(m.release_date)}</small>}
                </div>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className={s.pager}>
              <button disabled={page <= 1} onClick={() => goPage(page - 1)}>‹ Anterior</button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => goPage(page + 1)}>Próximo ›</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function CatalogPage(props) {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div style={{ padding: '8rem 3rem', color: '#888' }}>Carregando…</div>}><Content {...props} /></Suspense>
    </>
  );
}
