'use client';
import { useCallback, useEffect, useState } from 'react';
import api from '../../../lib/api';
import s from './bt.module.css';

export default function BannersTrial() {
  return (
    <div className={s.wrap}>
      <Banners />
    </div>
  );
}

function Banners() {
  const [items, setItems] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [drag, setDrag] = useState(null);
  const [msg, setMsg] = useState('');
  const [view, setView] = useState('tv');
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);

  const load = useCallback(() => api.get('/admin/banners').then(r => { setItems(r.data || []); setDirty(false); }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(async () => {
      const [m, se] = await Promise.all([
        api.get('/admin/movies', { params: { q, limit: 5 } }).catch(() => ({ data: { data: [] } })),
        api.get('/admin/series', { params: { q, limit: 5 } }).catch(() => ({ data: { data: [] } })),
      ]);
      setFound([...(m.data.data || []).map(x => ({ ...x, type: 'movie' })), ...(se.data.data || []).map(x => ({ ...x, type: 'series' }))].filter(x => !x.in_banner));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const move = (from, to) => {
    if (from == null || to == null || from === to) return;
    setItems(list => { const n = [...list]; const [it] = n.splice(from, 1); n.splice(to, 0, it); return n; });
    setDirty(true);
  };
  async function saveOrder() {
    try { await api.put('/admin/banners/order', { items: items.map(i => ({ id: i.id, type: i.type })) }); setMsg('Ordem salva'); setDirty(false); } catch { setMsg('Erro ao salvar'); }
    setTimeout(() => setMsg(''), 1800);
  }
  async function remove(it) {
    await api.post('/admin/bulk', { type: it.type === 'series' ? 'series' : 'movies', ids: [it.id], patch: { in_banner: false } }).catch(() => {});
    load();
  }
  async function add(it) {
    await api.post('/admin/bulk', { type: it.type === 'series' ? 'series' : 'movies', ids: [it.id], patch: { in_banner: true } }).catch(() => {});
    setQ(''); setFound([]); load();
  }

  const first = items[0];
  return (
    <section className={s.card}>
      <div className={s.cardHead}>
        <h2>Banners da Home</h2>
        {msg && <span className={s.ok}>{msg}</span>}
        <button className={s.btnRed} disabled={!dirty} onClick={saveOrder}>Salvar ordem</button>
      </div>
      <p className={s.hint}>Arraste para reordenar. O primeiro aparece primeiro na Home do app, TV e site.</p>

      <div className={s.addBox}>
        <input type="search" placeholder="Adicionar ao banner: buscar filme ou série" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar para adicionar" />
        {found.length > 0 && (
          <ul className={s.found}>
            {found.map(f => <li key={f.type + f.id}><button onClick={() => add(f)}>+ {f.title} <small>{f.type === 'series' ? 'Série' : 'Filme'}</small></button></li>)}
          </ul>
        )}
      </div>

      <div className={s.cols}>
        <ol className={s.list}>
          {items.length === 0 && <li className={s.empty}>Nenhum banner. Adicione acima ou marque “Banner” na lista de conteúdo.</li>}
          {items.map((it, idx) => (
            <li key={it.type + it.id} className={`${s.item} ${drag === idx ? s.dragging : ''}`} draggable
              onDragStart={() => setDrag(idx)} onDragOver={e => { e.preventDefault(); if (drag != null && drag !== idx) { move(drag, idx); setDrag(idx); } }} onDragEnd={() => setDrag(null)}>
              <span className={s.grip} aria-hidden>⋮⋮</span>
              <span className={s.num}>{idx + 1}</span>
              {it.backdrop_url || it.poster_url ? <img src={it.backdrop_url || it.poster_url} alt="" className={s.thumb} /> : <span className={s.thumb} />}
              <div className={s.meta}><b>{it.title}</b><small>{it.type === 'series' ? 'Série' : 'Filme'}{it.year ? ` · ${it.year}` : ''}</small></div>
              <span className={s.arrows}>
                <button aria-label="Subir" disabled={idx === 0} onClick={() => move(idx, idx - 1)}>↑</button>
                <button aria-label="Descer" disabled={idx === items.length - 1} onClick={() => move(idx, idx + 1)}>↓</button>
              </span>
              <button className={s.rm} aria-label={`Remover ${it.title}`} onClick={() => remove(it)}>✕</button>
            </li>
          ))}
        </ol>

        <div className={s.preview}>
          <div className={s.seg}>
            <button className={view === 'tv' ? s.segOn : ''} onClick={() => setView('tv')}>TV</button>
            <button className={view === 'phone' ? s.segOn : ''} onClick={() => setView('phone')}>Celular</button>
          </div>
          <div className={`${s.screen} ${view === 'phone' ? s.phone : ''}`} style={first?.backdrop_url ? { backgroundImage: `linear-gradient(0deg,#0A0A0A 8%,transparent 70%),url(${first.backdrop_url})` } : undefined}>
            <div className={s.ptxt}><b>{first?.title || 'Sem banner'}</b>{first && <span>▶ Assistir</span>}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
