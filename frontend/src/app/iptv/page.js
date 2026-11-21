'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { getToken } from '../../lib/auth';
import s from './live.module.css';

const FAV = '__fav';
const COLORS = ['#1F4D32', '#7A2E14', '#2A4A7A', '#4A2A5A', '#2F6F85', '#4F7A1F', '#3F3F46', '#7A5A1F'];
const colorOf = (n) => COLORS[[...String(n || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const loadFavs = () => { try { return JSON.parse(localStorage.getItem('iptv_favs') || '[]'); } catch { return []; } };

export default function IptvPage() {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // loading | none | pending | active
  const [pending, setPending] = useState(null);
  const [cats, setCats] = useState([]);
  const [catId, setCatId] = useState(null);
  const [chans, setChans] = useState([]);
  const [loadingCh, setLoadingCh] = useState(false);
  const [search, setSearch] = useState('');
  const [favs, setFavs] = useState([]);
  const [opening, setOpening] = useState(null);
  const cache = useMemo(() => ({}), []);

  const checkStatus = useCallback(() => {
    api.get('/iptv/status').then(r => {
      setStatus(r.data.status);
      if (r.data.status === 'pending') setPending(r.data);
      if (r.data.status === 'active') {
        api.get('/iptv/categories').then(c => { const l = Array.isArray(c.data) ? c.data : []; setCats(l); if (l.length) setCatId(x => x || l[0].category_id); }).catch(() => {});
      }
    }).catch(() => setStatus('none'));
  }, []);

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    setFavs(loadFavs());
    checkStatus();
  }, [router, checkStatus]);

  useEffect(() => {
    if (status !== 'pending') return undefined;
    const t = setInterval(checkStatus, 30000);
    return () => clearInterval(t);
  }, [status, checkStatus]);

  useEffect(() => {
    if (!catId || catId === FAV) return;
    if (cache[catId]) { setChans(cache[catId]); return; }
    setLoadingCh(true);
    api.get('/iptv/streams', { params: { category_id: catId } })
      .then(r => { const l = Array.isArray(r.data) ? r.data : []; cache[catId] = l; setChans(l); })
      .catch(() => setChans([])).finally(() => setLoadingCh(false));
  }, [catId, cache]);

  const base = catId === FAV ? favs : chans;
  const shown = search.trim() ? base.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase())) : base;
  const cur = catId === FAV ? { category_name: 'Favoritos' } : cats.find(c => c.category_id === catId);

  function toggleFav(ch, e) {
    e.stopPropagation();
    const next = favs.some(f => f.stream_id === ch.stream_id) ? favs.filter(f => f.stream_id !== ch.stream_id) : [...favs, { stream_id: ch.stream_id, name: ch.name, stream_icon: ch.stream_icon }];
    setFavs(next); try { localStorage.setItem('iptv_favs', JSON.stringify(next)); } catch {}
  }

  async function openChannel(ch, index) {
    setOpening(ch.stream_id);
    try {
      const { data } = await api.get(`/iptv/stream-url/${ch.stream_id}`, { params: { fmt: 'm3u8' } });
      try { sessionStorage.setItem('iptv_queue', JSON.stringify({ list: shown.slice(0, 300), index, cat: cur?.category_name || '' })); } catch {}
      router.push(`/iptv/player?${new URLSearchParams({ url: data.url, name: ch.name || '', logo: ch.stream_icon || '', id: String(ch.stream_id) })}`);
    } catch { alert('Não foi possível abrir o canal.'); }
    setOpening(null);
  }

  return (
    <>
      <Navbar />
      <main className={s.main}>
        {status === 'loading' && <p className={s.msg}>Carregando…</p>}

        {status === 'none' && (
          <div className={s.center}>
            <div className={s.tile}>📺</div>
            <h1>Canais ao vivo, 24h</h1>
            <p>Esportes, notícias, filmes e infantis no mesmo app. Até 2 telas.</p>
            <Link href="/iptv/planos" className={s.btn}>Ver planos IPTV</Link>
          </div>
        )}

        {status === 'pending' && (
          <div className={s.center}>
            <span className={s.kicker}>AGUARDANDO ATIVAÇÃO</span>
            <h1>{pending?.plan_name || 'IPTV'} <span className={s.pend}>Pendente</span></h1>
            <p>Pagamento recebido. Estamos ligando seu acesso — a página atualiza sozinha.</p>
            <ol className={s.timeline}>
              <li className={s.done}><i>✓</i><div><b>Pagamento confirmado</b>{pending?.ordered_at && <small>{new Date(pending.ordered_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>}</div></li>
              <li className={s.doing}><i>◔</i><div><b>Ativando</b><small>Normalmente em até 30 min</small></div></li>
              <li><i>○</i><div><b>Pronto para assistir</b></div></li>
            </ol>
            <button className={s.btn} onClick={checkStatus}>Verificar agora</button>
          </div>
        )}

        {status === 'active' && (
          <>
            <div className={s.head}>
              <h1>Ao vivo</h1>
              <span className={s.badge}>IPTV ativo</span>
              <div className={s.searchBox}><span>⌕</span><input placeholder="Buscar canal ou programa" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
            <div className={s.layout}>
              <aside className={s.side}>
                <button className={`${s.cat} ${catId === FAV ? s.catOn : ''}`} onClick={() => setCatId(FAV)}><span>★ Favoritos</span><em>{favs.length}</em></button>
                {cats.map(c => (
                  <button key={c.category_id} className={`${s.cat} ${catId === c.category_id ? s.catOn : ''}`} onClick={() => setCatId(c.category_id)}>
                    <span>{c.category_name}</span><em>{cache[c.category_id]?.length ?? ''}</em>
                  </button>
                ))}
              </aside>
              <section>
                <div className={s.secHead}><h2>{cur?.category_name || ''}</h2><span>{loadingCh ? 'Carregando…' : `${shown.length} canais`}</span></div>
                {!loadingCh && shown.length === 0 ? (
                  <p className={s.msg}>{catId === FAV ? 'Nenhum favorito ainda. Clique na ★ de um canal.' : 'Nenhum canal encontrado.'}</p>
                ) : (
                  <div className={s.grid}>
                    {shown.map((ch, i) => {
                      const fav = favs.some(f => f.stream_id === ch.stream_id);
                      return (
                        <div key={ch.stream_id} className={s.ch} role="button" tabIndex={0} onClick={() => openChannel(ch, i)} onKeyDown={e => { if (e.key === 'Enter') openChannel(ch, i); }}>
                          <div className={s.chTop}>
                            <div className={s.logo} style={{ background: colorOf(ch.name) }}>
                              {ch.stream_icon ? <img src={ch.stream_icon} alt="" onError={e => { e.target.style.display = 'none'; }} /> : String(ch.name || '?').slice(0, 5).toUpperCase()}
                            </div>
                            <button className={`${s.star} ${fav ? s.starOn : ''}`} onClick={e => toggleFav(ch, e)} aria-label="Favoritar">{fav ? '★' : '☆'}</button>
                          </div>
                          <b>{ch.name}</b>
                          <span className={s.live}>{opening === ch.stream_id ? 'ABRINDO…' : 'AO VIVO'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </>
  );
}
