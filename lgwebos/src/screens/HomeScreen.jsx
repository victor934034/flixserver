import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { moviesAPI, seriesAPI, watchlistAPI, recommendationsAPI } from '../api/index.js';
import api from '../api/index.js';
import { prefetchCache } from '../App.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { openTutorial, SURPRISE_EVENT, HOME_EVENT } from '../lib/tutorial.js';
import Surprise from '../components/Surprise.jsx';
import { useWatched } from '../lib/watched.js';
import { fetchHomeBase, fetchHomeProfile, fetchCatalog, assembleHome, filterCatalog } from '../lib/homeData.js';
import { KEY, useKeyDown } from '../hooks/useNav.js';

const NAV       = ['home', 'movies', 'series', 'minha-lista', 'search', 'iptv'];
const ACCENT    = '#c91c2c';

// Card sizes (from DC design spec)
const PORT_W    = 196;  // portrait card width
const PORT_H    = 294;  // portrait card height (2:3 poster ratio)
const CARD_GAP  = 18;
const PAD_L     = 48;   // row padding from content edge

// Filtros do catálogo (iguais ao app): data de lançamento, nota mínima e ordem
const YEAR = new Date().getFullYear();
const DATE_PRESETS = [
  { key: '',      label: 'Qualquer data',        q: {} },
  { key: '30d',   label: 'Últimos 30 dias',      q: { released_days: 30 } },
  { key: '180d',  label: 'Últimos 6 meses',      q: { released_days: 180 } },
  { key: 'year',  label: 'Este ano (' + YEAR + ')', q: { year_from: YEAR, year_to: YEAR } },
  { key: '2020s', label: 'Anos 2020',            q: { year_from: 2020, year_to: 2029 } },
  { key: '2010s', label: 'Anos 2010',            q: { year_from: 2010, year_to: 2019 } },
  { key: '2000s', label: 'Anos 2000',            q: { year_from: 2000, year_to: 2009 } },
  { key: '1990s', label: 'Anos 90',              q: { year_from: 1990, year_to: 1999 } },
];
const RATINGS = [0, 5, 6, 7, 8, 9];
const SORTS = [
  { key: 'az',      label: 'A–Z',              q: { sort: 'title', order: 'asc' } },
  { key: 'recent',  label: 'Mais recentes',    q: { sort: 'created_at', order: 'desc' } },
  { key: 'release', label: 'Lançamento',       q: { sort: 'release_date', order: 'desc' } },
  { key: 'oldest',  label: 'Mais antigos',     q: { sort: 'release_date', order: 'asc' } },
  { key: 'rating',  label: 'Melhor avaliados', q: { sort: 'rating', order: 'desc' } },
];
const MENU_LABEL = { genre: 'Categoria', date: 'Data', rating: 'Nota', sort: 'Ordem' };

// ── RAF smooth scroll ─────────────────────────────────────────────────────────
function smoothScroll(el, prop, target, rafRef) {
  if (rafRef.current) cancelAnimationFrame(rafRef.current);
  const start = el[prop];
  const dist  = Math.max(0, target) - start;
  if (Math.abs(dist) < 1) return;
  const dur = 180;
  const t0  = performance.now();
  function step(now) {
    const p = Math.min(1, (now - t0) / dur);
    const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
    el[prop] = start + dist * e;
    if (p < 1) rafRef.current = requestAnimationFrame(step);
  }
  rafRef.current = requestAnimationFrame(step);
}

// Series so mostra selo quando P&B (audio DUB/LEG/CAM varia por episodio,
// nao faz sentido resumir num card so). Filme mostra a versao mais notavel.
function getVersionBadge(item) {
  const isSeries = item.total_seasons !== undefined;
  if (isSeries) return item.has_bw ? 'P&B' : null;
  if (item.file_bw) return 'P&B';
  if (item.file_cinema) return 'CAM';
  if (item.file_dubbing) return 'DUB';
  if (item.file_subtitled) return 'LEG';
  if (item.file_4k) return '4K';
  if (item.file_color) return 'COR';
  return null;
}

// ── Portrait card (172×208) ───────────────────────────────────────────────────
const PortraitCard = React.memo(function PortraitCard({ item, focused, onClick, width, height }) {
  const W = width || PORT_W;
  const H = height || PORT_H;
  const img   = item.poster_url || item.backdrop_url || item.thumbnail_url;
  const title = item.title || item.name || item.episode_title || '';
  const isHighlit = focused;
  const versionBadge = getVersionBadge(item);
  const watchedMarks = useWatched();
  const isSerieCard = item.content_type === 'series' || item.total_seasons !== undefined;
  const seen = !item.progress && watchedMarks.has(isSerieCard ? 'series' : 'movie', item.id);

  // Sombra/glow e a transicao de scale so custam caro quando aplicadas nos
  // ~460 cards do catalogo de uma vez (box-shadow forca rasterizacao por
  // item, e "transition" promove cada card a sua propria camada de
  // composicao). Aplicando isso SO no card focado (o unico que muda), o
  // resto da grade fica estatico e barato de pintar - navegacao volta a
  // ficar fluida sem perder o efeito visual.
  return (
    <div
      onClick={onClick}
      style={isHighlit ? {
        flexShrink: 0, width: W, cursor: 'pointer', position: 'relative',
        transform: 'scale(1.07)', transition: 'transform 0.15s ease', zIndex: 5,
      } : {
        flexShrink: 0, width: W, cursor: 'pointer', position: 'relative',
      }}
    >
      {/* Image */}
      <div style={isHighlit ? {
        width: W, height: H, position: 'relative',
        borderRadius: 12, background: '#0a0a0a', overflow: 'hidden',
        boxShadow: '0 0 0 3px #fff, 0 0 26px rgba(255,255,255,0.28), 0 14px 34px rgba(0,0,0,0.6)',
      } : {
        width: W, height: H, position: 'relative',
        borderRadius: 12, background: '#0a0a0a', overflow: 'hidden',
      }}>
        {img ? (
          <img
            src={img}
            alt=""
            loading="lazy"
            decoding="async"
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg,#1c1c1c,#2a2a2a)',
          }} />
        )}

        {seen && (
          <div style={{ position: 'absolute', right: 8, bottom: 8, background: '#4ade80', color: '#052e12', borderRadius: 4, padding: '3px 7px', fontSize: 11, fontWeight: 900 }}>✓ VISTO</div>
        )}

        {/* Posição no Top 10 */}
        {item.rank && (
          <div style={{
            position: 'absolute', left: 8, bottom: 0,
            fontSize: 92, lineHeight: '86px', fontWeight: 900, color: '#fff',
            textShadow: '0 0 14px #000, 3px 3px 0 #000',
          }}>
            {item.rank}
          </div>
        )}

        {/* Selo DUB/LEG/CAM/P&B */}
        {versionBadge && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.72)', borderRadius: 4,
            padding: '3px 7px', fontSize: 10, fontWeight: 800,
            color: '#fff', letterSpacing: 0.5,
            }}>
            {versionBadge}
          </div>
        )}

        {/* Play overlay on focus/hover */}
        {isHighlit && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(255,255,255,0.93)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
            }}>
              <div style={{
                width: 0, height: 0, borderStyle: 'solid',
                borderWidth: '10px 0 10px 18px',
                borderColor: 'transparent transparent transparent #111',
                marginLeft: 4,
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Title below */}
      <div style={{
        marginTop: 9, fontSize: 13, fontWeight: isHighlit ? 700 : 400,
        color: isHighlit ? '#fff' : 'rgba(255,255,255,0.5)',
        lineHeight: 1.35,
        width: W,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {title}
      </div>
    </div>
  );
});

// ── Card Row ──────────────────────────────────────────────────────────────────
function CardRow({ data, colFocus, isActive, onSelect }) {
  const rowRef   = useRef(null);
  const rafRef   = useRef(null);
  const W = PORT_W;

  useEffect(() => {
    if (!rowRef.current || !isActive) return;
    const card = rowRef.current.children[colFocus];
    if (!card) return;
    const row   = rowRef.current;
    const cardL = card.offsetLeft;
    const cardR = cardL + W;
    const viewL = row.scrollLeft;
    const viewR = viewL + row.clientWidth;
    let target  = row.scrollLeft;
    if (cardL < viewL + PAD_L)      target = cardL - PAD_L;
    else if (cardR > viewR - PAD_L) target = cardR - row.clientWidth + PAD_L;
    if (target !== row.scrollLeft) smoothScroll(row, 'scrollLeft', target, rafRef);
  }, [colFocus, isActive, W]);

  return (
    <div
      ref={rowRef}
      style={{
        display: 'flex', flexDirection: 'row',
        overflowX: 'hidden',
        paddingLeft: PAD_L, paddingRight: PAD_L,
        paddingBottom: 24, paddingTop: 16,
        gap: CARD_GAP,
      }}
    >
      {data.map((item, ci) => {
        const focused = isActive && ci === colFocus;
        return (
          <PortraitCard
            key={item.id} item={item}
            focused={focused}
            onClick={() => onSelect(item)}
          />
        );
      })}
    </div>
  );
}

// ── Catalog grid (Filmes/Series completo) — quebra linha em vez de fileira unica,
// senao navegar 100+ itens so de LEFT/RIGHT e inviavel. Cards um pouco maiores
// que o padrao das fileiras pra preencher a largura disponivel (sem sidebar
// expandida do lado) em vez de sobrar espaco vazio.
const CATALOG_COLS = 8;
const CATALOG_CARD_W = 206;
const CATALOG_CARD_H = Math.round(CATALOG_CARD_W * PORT_H / PORT_W);

function CatalogGrid({ data, colFocus, isActive, onSelect, scrollRef, vertRafRef }) {
  const itemRefs = useRef([]);
  // Usa o mesmo smoothScroll manual (com cancelAnimationFrame) que o resto
  // do app ja usa pra rolar as fileiras - scrollIntoView() nativo NAO
  // cancela direito quando voce navega rapido (varias chamadas brigando
  // entre si), e era exatamente isso que travava a pagina ao se mover rapido.
  useEffect(() => {
    if (!isActive) return;
    const el = itemRefs.current[colFocus];
    const sc = scrollRef?.current;
    if (!el || !sc) return;
    // Posição dentro da área rolável medida pela tela (offsetTop não serve: as
    // linhas da grade têm content-visibility e viram "pai" de posicionamento)
    const elT = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    const elB = elT + el.offsetHeight;
    const scT = sc.scrollTop;
    const scB = scT + sc.clientHeight;
    let target = sc.scrollTop;
    if (elT < scT + 20)      target = elT - 20;
    else if (elB > scB - 20) target = elB - sc.clientHeight + 20;
    // Trava o alvo dentro do que da pra rolar de verdade - qualquer erro de
    // medida (offsetTop errado por layout ainda nao assentado etc.) nao pode
    // arremessar o scroll pro final/inicio do zero.
    target = Math.max(0, Math.min(target, sc.scrollHeight - sc.clientHeight));
    if (Math.abs(target - sc.scrollTop) > 1) smoothScroll(sc, 'scrollTop', target, vertRafRef);
  }, [colFocus, isActive, scrollRef, vertRafRef]);

  const rows = [];
  for (let i = 0; i < data.length; i += CATALOG_COLS) rows.push(data.slice(i, i + CATALOG_COLS));
  const rowH = CATALOG_CARD_H + 30;
  // Cada linha só é desenhada quando está perto da tela (content-visibility) —
  // com centenas de títulos isso é o que deixa a rolagem fluida. O padding
  // (compensado pela margem) evita cortar o brilho/zoom do card em foco.
  return (
    <div style={{ paddingLeft: PAD_L, paddingRight: PAD_L, paddingBottom: 24, paddingTop: 16 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{
          display: 'flex', gap: CARD_GAP,
          padding: '20px 30px', margin: '-20px -30px ' + (CARD_GAP - 20) + 'px',
          contentVisibility: 'auto', containIntrinsicSize: '1px ' + (rowH + 40) + 'px',
        }}>
          {row.map((item, k) => {
            const ci = ri * CATALOG_COLS + k;
            const focused = isActive && ci === colFocus;
            return (
              <div key={item.id} ref={el => { itemRefs.current[ci] = el; }} style={{ width: CATALOG_CARD_W, flexShrink: 0 }}>
                <PortraitCard
                  item={item} focused={focused}
                  width={CATALOG_CARD_W} height={CATALOG_CARD_H}
                  onClick={() => onSelect(item)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Hero Banner ───────────────────────────────────────────────────────────────
function HeroBanner({ item, focusedBtn, onWatch, onDetail, onSurprise }) {
  if (!item) return null;
  const title    = item.title || item.name || '';
  const backdrop = item.backdrop_url;
  const rating   = item.rating ? parseFloat(item.rating).toFixed(1) : null;

  return (
    <div style={{
      position: 'relative', height: 540, flexShrink: 0, overflow: 'hidden',
      background: '#0a0a0a',
    }}>
      {/* Backdrop — igual ao TV Android: imagem cheia com leve blur, sem
          painel de pôster separado do lado direito. */}
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
            filter: 'blur(3px)', transform: 'scale(1.02)',
          }}
        />
      )}

      {/* Gradient overlays */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 60%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0a0a0a 0%, transparent 55%)' }} />

      {/* Left side info */}
      <div style={{
        position: 'absolute', bottom: 68, left: PAD_L,
        maxWidth: 660,
      }}>
        {/* Badges row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          {item.age_rating && (
            <div style={{
              background: ACCENT, borderRadius: 4, padding: '3px 8px',
              fontSize: 12, fontWeight: 900, color: '#fff',
            }}>
              {item.age_rating}+
            </div>
          )}
          {item.year && (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{item.year}</span>
          )}
          {rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#f5c518">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f5c518' }}>{rating}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 52, fontWeight: 900, color: '#fff',
          lineHeight: 1.1, marginBottom: 14,
          textShadow: '0 2px 16px rgba(0,0,0,0.8)',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {title}
        </div>

        {/* Synopsis */}
        {item.synopsis && (
          <div style={{
            fontSize: 15, color: 'rgba(255,255,255,0.68)',
            lineHeight: 1.6, maxWidth: 560,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            marginBottom: 26,
          }}>
            {item.synopsis}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {/* Assistir */}
          <button
            onClick={onWatch}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: '#fff', color: '#0a0a0a',
              border: 'none', borderRadius: 8, padding: '15px 38px',
              fontSize: 17, fontWeight: 800, cursor: 'pointer',
              outline: focusedBtn === 0 ? '3px solid rgba(255,255,255,0.7)' : 'none',
              outlineOffset: '3px',
              boxShadow: 'none',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Assistir
          </button>

          {/* Mais Detalhes */}
          <button
            onClick={onDetail}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.12)', color: '#fff',
              border: focusedBtn === 1
                ? '2px solid rgba(255,255,255,0.85)'
                : '2px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '14px 28px',
              fontSize: 17, fontWeight: 700, cursor: 'pointer',
              outline: focusedBtn === 1 ? '3px solid rgba(255,255,255,0.7)' : 'none',
              outlineOffset: '3px',
              boxShadow: 'none',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            Mais Info
          </button>

          {/* Surpreenda-me */}
          <button
            onClick={onSurprise}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.12)', color: '#fff',
              border: focusedBtn === 2
                ? '2px solid rgba(255,255,255,0.85)'
                : '2px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '14px 28px',
              fontSize: 17, fontWeight: 700, cursor: 'pointer',
              outline: focusedBtn === 2 ? '3px solid rgba(255,255,255,0.7)' : 'none',
              outlineOffset: '3px',
              boxShadow: 'none',
            }}
          >
            🎲 Surpreenda-me
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Search Panel ──────────────────────────────────────────────────────────────
// Teclado virtual — igual ao do TV Android (nenhum controle de TV real tem
// um jeito universal de digitar num <input>, entao um teclado proprio
// navegavel por seta e o unico jeito confiavel em qualquer controle/OEM).
const KB_ROWS = [
  ['SPC', '⌫'],
  ['a', 'b', 'c', 'd', 'e', 'f'],
  ['g', 'h', 'i', 'j', 'k', 'l'],
  ['m', 'n', 'o', 'p', 'q', 'r'],
  ['s', 't', 'u', 'v', 'w', 'x'],
  ['y', 'z', '1', '2', '3', '4'],
  ['5', '6', '7', '8', '9', '0'],
];
const SEARCH_COLS = 3;
const SEARCH_LEFT_W = 370;

function SearchPanel({ onSelect, onBack, typeFilter }) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState({ movies: [], series: [] });
  const [defaultItems, setDefaultItems] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [zone,        setZone]        = useState('kb'); // 'kb' | 'sug' | 'grid'
  const [kbRow,       setKbRow]       = useState(1);
  const [kbCol,       setKbCol]       = useState(0);
  const [sugIdx,      setSugIdx]      = useState(0);
  const [gridIdx,     setGridIdx]     = useState(0);
  const itemRefs = useRef([]);
  const debRef   = useRef(null);
  const stRef    = useRef({});

  const searchItems = [...results.movies, ...results.series];
  const allItems     = query ? searchItems : defaultItems;
  const suggestions  = allItems.slice(0, 8);
  stRef.current = { query, zone, kbRow, kbCol, sugIdx, gridIdx, allItems, suggestions };

  // Catalogo pra sugestao quando ainda nao ha busca — populares de filme/serie,
  // sem misturar "continuar assistindo" (isso e progresso, nao catalogo).
  // Respeita o typeFilter (botao de busca de Filmes/Series pula direto aqui
  // ja filtrado por tipo, igual ao padrao do app Android).
  useEffect(() => {
    Promise.all([
      typeFilter !== 'series' ? moviesAPI.popular().then(r => r.data || []).catch(() => []) : Promise.resolve([]),
      typeFilter !== 'movie'  ? seriesAPI.popular().then(r => r.data || []).catch(() => []) : Promise.resolve([]),
    ]).then(([pm, ps]) => {
      const seen = new Set();
      const merged = [...pm, ...ps].filter(it => {
        if (seen.has(it.id)) return false; seen.add(it.id); return true;
      }).slice(0, 20);
      setDefaultItems(merged);
    });
  }, [typeFilter]);

  useEffect(() => {
    clearTimeout(debRef.current);
    if (!query.trim()) { setResults({ movies: [], series: [] }); return; }
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [mv, sr] = await Promise.all([
          typeFilter !== 'series' ? moviesAPI.search(query).then(r => (r.data || []).slice(0, 18)) : Promise.resolve([]),
          typeFilter !== 'movie'  ? seriesAPI.search(query).then(r => (r.data || []).slice(0, 18)) : Promise.resolve([]),
        ]);
        setResults({ movies: mv, series: sr });
      } catch { setResults({ movies: [], series: [] }); }
      finally { setLoading(false); }
    }, 250);
  }, [query, typeFilter]);

  useEffect(() => { setGridIdx(0); setSugIdx(0); }, [query]);

  useEffect(() => {
    if (zone !== 'grid') return;
    const el = itemRefs.current[gridIdx];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [gridIdx, zone]);

  function pressKey(key) {
    if (key === 'SPC') setQuery(q => q + ' ');
    else if (key === '⌫') setQuery(q => q.slice(0, -1));
    else setQuery(q => q + key);
  }

  useKeyDown(e => {
    const { zone, kbRow, kbCol, sugIdx, gridIdx, allItems, suggestions } = stRef.current;
    const k = e.keyCode;
    if (k === KEY.BACK) { e.preventDefault(); onBack(); return; }

    if (zone === 'kb') {
      if (k === KEY.LEFT)  { e.preventDefault(); if (kbCol > 0) setKbCol(c => c - 1); else onBack(); }
      if (k === KEY.RIGHT) {
        e.preventDefault();
        const rowLen = KB_ROWS[kbRow].length;
        if (kbCol < rowLen - 1) setKbCol(c => c + 1);
        else if (allItems.length > 0) { setZone('grid'); setGridIdx(0); }
      }
      if (k === KEY.UP)    { e.preventDefault(); if (kbRow > 0) { const nr = kbRow - 1; setKbRow(nr); setKbCol(c => Math.min(c, KB_ROWS[nr].length - 1)); } }
      if (k === KEY.DOWN)  {
        e.preventDefault();
        if (kbRow < KB_ROWS.length - 1) { const nr = kbRow + 1; setKbRow(nr); setKbCol(c => Math.min(c, KB_ROWS[nr].length - 1)); }
        else if (suggestions.length > 0) { setZone('sug'); setSugIdx(0); }
      }
      if (k === KEY.ENTER) { e.preventDefault(); pressKey(KB_ROWS[kbRow][kbCol]); }
      return;
    }

    if (zone === 'sug') {
      if (k === KEY.UP)    { e.preventDefault(); if (sugIdx > 0) setSugIdx(i => i - 1); else setZone('kb'); }
      if (k === KEY.DOWN)  { e.preventDefault(); if (sugIdx < suggestions.length - 1) setSugIdx(i => i + 1); }
      if (k === KEY.LEFT)  { e.preventDefault(); onBack(); }
      if (k === KEY.RIGHT) { e.preventDefault(); if (allItems.length > 0) { setZone('grid'); setGridIdx(0); } }
      if (k === KEY.ENTER) { e.preventDefault(); if (suggestions[sugIdx]) onSelect(suggestions[sugIdx]); }
      return;
    }

    // zone === 'grid'
    if (k === KEY.UP) {
      e.preventDefault();
      if (gridIdx < SEARCH_COLS) setZone('kb');
      else setGridIdx(i => Math.max(0, i - SEARCH_COLS));
    }
    if (k === KEY.DOWN) {
      e.preventDefault();
      setGridIdx(i => Math.min(allItems.length - 1, i + SEARCH_COLS));
    }
    if (k === KEY.LEFT) {
      e.preventDefault();
      if (gridIdx % SEARCH_COLS > 0) setGridIdx(i => i - 1);
      else setZone(suggestions.length > 0 ? 'sug' : 'kb');
    }
    if (k === KEY.RIGHT) {
      e.preventDefault();
      if (gridIdx % SEARCH_COLS < SEARCH_COLS - 1 && gridIdx + 1 < allItems.length) setGridIdx(i => i + 1);
    }
    if (k === KEY.ENTER) { e.preventDefault(); if (allItems[gridIdx]) onSelect(allItems[gridIdx]); }
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'radial-gradient(ellipse at 20% 0%, rgba(201,28,44,0.08) 0%, transparent 45%), #0a0a0a' }}>
      {/* Header — campo de busca com destaque visual */}
      <div style={{ padding: '30px ' + PAD_L + 'px 22px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 14,
          padding: '14px 24px', borderRadius: 14, minWidth: 420,
          background: 'rgba(255,255,255,0.05)',
          border: '2px solid ' + (zone === 'kb' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)'),
          boxShadow: zone === 'kb' ? '0 0 0 4px rgba(255,255,255,0.06)' : 'none',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.2">
            <circle cx="11" cy="11" r="7"/>
            <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
          {query ? (
            <span style={{ fontSize: 21, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {query}<span style={{ opacity: 0.5 }}> |</span>
            </span>
          ) : (
            <span style={{ fontSize: 21, color: 'rgba(255,255,255,0.35)' }}>
              {typeFilter === 'movie' ? 'Buscar filmes…' : typeFilter === 'series' ? 'Buscar séries…' : 'Digite para buscar…'}
            </span>
          )}
          {loading && <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginLeft: 4 }} />}
        </div>
      </div>

      {/* Body: teclado + sugestoes | grade */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Esquerda — teclado + sugestoes */}
        <div style={{ width: SEARCH_LEFT_W, flexShrink: 0, padding: '4px ' + PAD_L + 'px 24px', overflowY: 'auto' }}>
          <div style={{
            display: 'inline-block', padding: 14, borderRadius: 16,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {KB_ROWS.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {row.map((key, ki) => {
                  const isFoc = zone === 'kb' && kbRow === ri && kbCol === ki;
                  const wide  = key === 'SPC';
                  return (
                    <div
                      key={key}
                      onClick={() => { setZone('kb'); setKbRow(ri); setKbCol(ki); pressKey(key); }}
                      style={{
                        flex: wide ? 3 : 1, height: 44, minWidth: wide ? undefined : 44,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 9, cursor: 'pointer',
                        fontSize: 15, fontWeight: 700,
                        color: isFoc ? '#fff' : 'rgba(255,255,255,0.7)',
                        background: isFoc ? ACCENT : 'rgba(255,255,255,0.06)',
                        border: '2px solid ' + (isFoc ? '#fff' : 'transparent'),
                        boxShadow: isFoc ? '0 4px 14px rgba(201,28,44,0.5)' : 'none',
                        textTransform: key === 'SPC' ? 'uppercase' : 'none',
                        letterSpacing: key === 'SPC' ? 1 : 0,
                      }}
                    >
                      {key === 'SPC' ? 'ESPAÇO' : key}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {suggestions.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, paddingLeft: 2 }}>
                Sugestões
              </div>
              {suggestions.map((item, i) => {
                const isFoc = zone === 'sug' && sugIdx === i;
                const isS   = item.total_seasons !== undefined;
                const img   = item.poster_url || item.backdrop_url;
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelect(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                      background: isFoc ? 'rgba(255,255,255,0.10)' : 'transparent',
                      border: '2px solid ' + (isFoc ? '#fff' : 'transparent'),
                      boxShadow: isFoc ? '0 6px 18px rgba(0,0,0,0.5)' : 'none',
                      marginBottom: 3,
                    }}
                  >
                    <div style={{
                      width: 34, height: 48, borderRadius: 5, flexShrink: 0, overflow: 'hidden',
                      background: '#1c1c1c', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isFoc ? '0 0 0 2px #fff' : 'none',
                    }}>
                      {img
                        ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={isFoc ? ACCENT : '#484848'}>
                            {isS
                              ? <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v-2H3V5h18v14h-5v2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8 19h8v-2H8v2z"/>
                              : <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-2z"/>}
                          </svg>
                        )
                      }
                    </div>
                    <span style={{ fontSize: 14, color: isFoc ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: isFoc ? 700 : 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title || item.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && !!query && searchItems.length === 0 && (
            <div style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
              Nenhum resultado para "{query}"
            </div>
          )}
        </div>

        {/* Direita — grade de resultados (cards com pôster + título) */}
        <div style={{ flex: 1, padding: '4px ' + PAD_L + 'px 24px', overflowY: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
            {query
              ? (allItems.length > 0 ? `${allItems.length} resultado${allItems.length !== 1 ? 's' : ''}` : (!loading ? `Sem resultados para "${query}"` : ''))
              : 'Catálogo'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + SEARCH_COLS + ', 1fr)', gap: 22, paddingBottom: 32 }}>
            {allItems.map((item, i) => {
              const isFoc = zone === 'grid' && gridIdx === i;
              // Capa oficial primeiro — backdrop e uma cena do meio do
              // filme, nao a "logo"/capa que a pessoa espera ver no card.
              const img   = item.poster_url || item.backdrop_url;
              const isS   = item.total_seasons !== undefined;
              return (
                <div
                  key={item.id}
                  ref={el => { itemRefs.current[i] = el; }}
                  onClick={() => onSelect(item)}
                  style={{
                    display: 'flex', flexDirection: 'column', cursor: 'pointer',
                    transform: isFoc ? 'scale(1.04)' : 'scale(1)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div style={{
                    width: '100%', aspectRatio: '2/3', background: '#0a0a0a', overflow: 'hidden', position: 'relative',
                    borderRadius: 12,
                    boxShadow: isFoc ? '0 0 0 3px #fff, 0 0 22px rgba(255,255,255,0.28), 0 12px 28px rgba(0,0,0,0.6)' : 'none',
                  }}>
                    {img
                      ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1c1c1c,#2a2a2a)' }} />
                    }
                    {isFoc && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,0.93)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '10px 0 10px 17px', borderColor: 'transparent transparent transparent #111', marginLeft: 3 }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '10px 2px 0' }}>
                    <div style={{ fontSize: 13.5, fontWeight: isFoc ? 700 : 500, color: isFoc ? '#fff' : 'rgba(255,255,255,0.75)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title || item.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)' }}>
                      {isS ? 'Série' : 'Filme'}{item.year ? ' · ' + item.year : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ title, isActive, isHistory }) {
  return (
    <div style={{
      paddingLeft: PAD_L, marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {isHistory && (
        <div style={{
          width: 4, height: 22, borderRadius: 2,
          background: ACCENT, flexShrink: 0,
        }} />
      )}
      <span style={{
        fontSize: 20, fontWeight: 700,
        color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
        letterSpacing: 0.3,
      }}>
        {title}
      </span>
      {isHistory && isActive && (
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
          Continue de onde parou
        </span>
      )}
    </div>
  );
}

// ── Data builder ──────────────────────────────────────────────────────────────
function buildSections(activeNav, pm, nm, ps, ns, fullCatalog) {
  const seen  = new Set();
  const dedup = arr => arr.filter(it => {
    if (seen.has(it.id)) return false; seen.add(it.id); return true;
  }).slice(0, 20);
  // Paginas Filmes/Series mostram so o catalogo completo — sem separar em
  // Lançamentos/Populares (pedido explicito, igual TV Android e Tizen).
  if (activeNav === 'movies') {
    const all = fullCatalog || [];
    return { featured: all[0] || pm[0] || nm[0] || null, sections: [
      { key: 'all', title: 'Filmes', data: all },
    ].filter(s => s.data.length > 0) };
  }
  if (activeNav === 'series') {
    const all = fullCatalog || [];
    return { featured: all[0] || ps[0] || ns[0] || null, sections: [
      { key: 'all', title: 'Séries', data: all },
    ].filter(s => s.data.length > 0) };
  }
  return { featured: pm[0] || ps[0] || null, sections: [
    { key: 'pm', title: 'Filmes em Alta',  data: dedup(pm) },
    { key: 'ps', title: 'Séries em Alta',  data: dedup(ps) },
    { key: 'nm', title: 'Filmes Novos',    data: dedup(nm) },
    { key: 'ns', title: 'Séries Novas',    data: dedup(ns) },
  ].filter(s => s.data.length > 0) };
}

// ── HomeScreen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [surprise, setSurprise] = useState(false);
  const { logout, activeProfile, setActiveProfile } = useAuth();
  const navigate = useNavigate();

  const [activeNav,    setActiveNav]    = useState('home');
  const [featured,     setFeatured]     = useState(null);
  const [baseSections, setSections]     = useState([]);
  const [loadingData,  setLoadingData]  = useState(true);
  const [focusArea,    setFocusArea]    = useState('content');
  const [navFocus,     setNavFocus]     = useState(0);
  const [sideExpanded, setSideExpanded] = useState(false);
  const [sideHovered,  setSideHovered]  = useState(false);
  const [rowFocus,     setRowFocus]     = useState(0);
  const [colFocus,     setColFocus]     = useState(0);
  const [bannerBtn,    setBannerBtn]    = useState(0); // 0=Assistir, 1=Mais Info

  // Filtro de categoria — só pras páginas Filmes/Séries. Genero especifico de
  // cada tipo (Filme x Serie tem catalogos de genero diferentes, nao pode
  // misturar), derivado do proprio catalogo sem filtro (senao a lista de
  // opcoes encolhe pro genero atual assim que voce filtra uma vez).
  const [catalogGenres,  setCatalogGenres]  = useState({}); // { movies: [...], series: [...] }
  const [genreFilter,    setGenreFilter]    = useState(null);
  const [genreZone,      setGenreZone]      = useState('off'); // 'off' | 'button' | 'open'
  const [genreIdx,       setGenreIdx]       = useState(0); // 0 = "Todos"
  // Toolbar (Filmes/Series) tem 1 ou 2 itens: dropdown de categoria (só se
  // houver generos) e botao de busca (sempre). toolbarIdx navega entre eles
  // enquanto genreZone === 'button'.
  const [toolbarIdx,     setToolbarIdx]     = useState(0);
  const [searchTypeFilter, setSearchTypeFilter] = useState(null); // 'movie' | 'series' | null
  const [dateKey,   setDateKey]   = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortKey,   setSortKey]   = useState('az');
  const [openMenu, setOpenMenu] = useState(null); // qual dropdown está aberto
  const genres = catalogGenres[activeNav] || [];
  const toolbarItems = [...(genres.length > 0 ? ['genre'] : []), 'date', 'rating', 'sort', 'search'];
  // Dropdowns da toolbar (categoria, data, nota, ordem) — mesma lógica para todos
  const menuOptions = (key) => (
    key === 'genre'  ? [{ label: 'Todos', value: null }, ...genres.map(g => ({ label: g, value: g }))] :
    key === 'date'   ? DATE_PRESETS.map(p => ({ label: p.label, value: p.key })) :
    key === 'rating' ? RATINGS.map(x => ({ label: x ? '★ ' + x + '+' : 'Todas', value: x })) :
                       SORTS.map(p => ({ label: p.label, value: p.key }))
  );
  const menuValue  = (key) => (key === 'genre' ? genreFilter : key === 'date' ? dateKey : key === 'rating' ? minRating : sortKey);
  const menuActive = (key) => (key === 'genre' ? !!genreFilter : key === 'date' ? !!dateKey : key === 'rating' ? minRating > 0 : sortKey !== 'az');
  const menuText   = (key) => { const o = menuOptions(key).find(x => x.value === menuValue(key)); return o ? o.label : ''; };
  const applyMenu  = (key, value) => {
    if (key === 'genre')  setGenreFilter(value);
    if (key === 'date')   setDateKey(value);
    if (key === 'rating') setMinRating(value);
    if (key === 'sort')   setSortKey(value);
    setColFocus(0); setRowFocus(1);
  };
  const openMenuFor = (key) => {
    setOpenMenu(key);
    setGenreIdx(Math.max(0, menuOptions(key).findIndex(x => x.value === menuValue(key))));
    setGenreZone('open');
  };

  // Filmes/Séries: os filtros rodam aqui no aparelho (catálogo já carregado), sem rede nem spinner
  const sections = useMemo(() => {
    const isCat = activeNav === 'movies' || activeNav === 'series';
    const sec = baseSections[0];
    const k = sec && sec.key;
    // Troca de aba: por um quadro ainda vale a lista da aba anterior — não mostra
    if (!isCat) return k === 'all' ? [] : baseSections;
    if (!sec) return baseSections;
    if (k !== 'all') return [];
    return [{ ...sec, data: filterCatalog(sec.data, { genre: genreFilter, date: dateKey, rating: minRating, sort: sortKey }) }];
  }, [baseSections, activeNav, genreFilter, dateKey, minRating, sortKey]);

  const dataCache     = useRef({});

  // Atualização automática: confere a versão do catálogo e recarrega a Home sozinha
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let last = null;
    const check = async () => {
      try {
        const { data } = await api.get('/api/content-version');
        if (last !== null && data && data.v !== last) {
          dataCache.current = {};
          Object.keys(prefetchCache).forEach(k => { delete prefetchCache[k]; });
          setRefreshKey(k => k + 1);
        }
        if (data) last = data.v;
      } catch {}
    };
    check();
    const t = setInterval(check, 45000);
    return () => clearInterval(t);
  }, []);
  const prevProfileId = useRef(undefined);
  const scrollRef  = useRef(null);
  const rowEls     = useRef([]);
  const genreRowRef = useRef(null);
  const vertRafRef = useRef(null);
  const catalogMoveTimeRef = useRef(0);
  const st         = useRef({});
  st.current = { focusArea, navFocus, rowFocus, colFocus, sections, featured, activeNav, bannerBtn, genres, genreFilter, genreZone, genreIdx, toolbarIdx, toolbarItems };

  const showSidebar = sideExpanded || sideHovered || focusArea === 'sidebar';

  const openDetail = useCallback((item) => {
    if (!item) return;
    if (item.content_type === 'movie' || item.content_type === 'episode') {
      const id   = item.series_id || item.content_id || item.id; // recomendados e Top 10 só têm id
      const type = item.content_type === 'episode' ? 'series' : 'movie';
      let url = '/detail?type=' + type + '&id=' + id;
      if (item.progress > 5) url += '&startAt=' + Math.floor(item.progress);
      if (item.content_type === 'episode' && item.content_id) {
        url += '&epId=' + item.content_id;
        if (item.season_number) url += '&seasonNum=' + item.season_number;
      }
      navigate(url);
      return;
    }
    const type = item.total_seasons !== undefined ? 'series' : 'movie';
    navigate('/detail?type=' + type + '&id=' + item.id);
  }, [navigate]);

  const openWatch = useCallback((item) => {
    if (!item) return;
    const type = item.total_seasons !== undefined ? 'series' : 'movie';
    navigate('/detail?type=' + type + '&id=' + item.id);
  }, [navigate]);

  const goToNav = useCallback((idx) => {
    if (idx === NAV.length) { setActiveProfile(null); navigate('/profile-select', { replace: true }); return; }
    if (idx === NAV.length + 1) { openTutorial(); return; }
    if (idx > NAV.length)   { logout(); navigate('/login', { replace: true }); return; }
    const key = NAV[idx];
    if (key === 'iptv') { navigate('/iptv'); return; }
    setActiveNav(key);
    setFocusArea('content');
    setSideExpanded(false);
    setRowFocus(0);
    setColFocus(0);
    setBannerBtn(0);
    setGenreFilter(null);
    setDateKey(''); setMinRating(0); setSortKey('az'); setOpenMenu(null);
    setGenreZone('off');
    setGenreIdx(0);
    setToolbarIdx(0);
    setSearchTypeFilter(null);
  }, [logout, navigate, setActiveProfile]);

  // Atalhos do último passo do passo a passo: voltar ao Início e Surpreenda-me
  useEffect(() => {
    const home = () => goToNav(0);
    const draw = () => setSurprise(true);
    window.addEventListener(HOME_EVENT, home);
    window.addEventListener(SURPRISE_EVENT, draw);
    return () => { window.removeEventListener(HOME_EVENT, home); window.removeEventListener(SURPRISE_EVENT, draw); };
  }, [goToNav]);

  // Load watchlist when minha-lista is active
  useEffect(() => {
    if (activeNav !== 'minha-lista') return;
    if (dataCache.current['minha-lista']) {
      const c = dataCache.current['minha-lista'];
      setFeatured(null);
      setSections(c.sections);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    const profileId = activeProfile && activeProfile.id;
    watchlistAPI.get(profileId)
      .then(r => {
        const items = r.data || [];
        dataCache.current['minha-lista'] = {
          sections: items.length > 0
            ? [{ key: 'watchlist', title: `Minha Lista (${items.length})`, data: items }]
            : [],
        };
        setFeatured(null);
        setSections(dataCache.current['minha-lista'].sections);
      })
      .catch(() => { setSections([]); })
      .finally(() => setLoadingData(false));
  }, [activeNav, activeProfile]);

  // Conteúdo: tudo vem pré-carregado da tela de abertura (prefetchCache). Aqui só
  // lê o cache — sem rede ao navegar, e os filtros não recarregam nada.
  useEffect(() => {
    if (activeNav === 'search' || activeNav === 'minha-lista') return undefined;
    const curProfileId = activeProfile ? activeProfile.id : null;
    prevProfileId.current = curProfileId;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    let alive = true;
    const apply = (c) => {
      setFeatured(c.featured);
      setSections(c.sections);
      if (c.genres) setCatalogGenres(prev => ({ ...prev, [activeNav]: c.genres }));
      setLoadingData(false);
    };

    if (activeNav === 'home') {
      const pid = curProfileId || '';
      if (dataCache.current.home && dataCache.current.homeProfile === pid) { apply(dataCache.current.home); return undefined; }
      (async () => {
        let base = prefetchCache.homeBase;
        if (!base) { setLoadingData(true); base = await fetchHomeBase(); prefetchCache.homeBase = base; }
        let prof = prefetchCache['profile:' + pid];
        if (!prof && activeProfile) {
          setLoadingData(true);
          prof = await fetchHomeProfile(curProfileId, true);
          prefetchCache['profile:' + pid] = prof;
        }
        if (!alive) return;
        const c = assembleHome(base, prof);
        dataCache.current.home = c; dataCache.current.homeProfile = pid;
        apply(c);
      })().catch(() => { if (alive) setLoadingData(false); });
      return () => { alive = false; };
    }

    // Filmes / Séries
    const cached = dataCache.current[activeNav] || prefetchCache['catalog:' + activeNav];
    if (cached) { dataCache.current[activeNav] = cached; apply(cached); return undefined; }
    setLoadingData(true); setSections([]); setFeatured(null);
    fetchCatalog(activeNav).then(c => {
      if (!alive) return;
      prefetchCache['catalog:' + activeNav] = c; dataCache.current[activeNav] = c; apply(c);
    }).catch(() => {}).finally(() => { if (alive) setLoadingData(false); });
    return () => { alive = false; };
  }, [activeNav, activeProfile, refreshKey]);

  // Dropdown: mantém a opção em foco visível ao descer a lista
  useEffect(() => {
    if (genreZone !== 'open') return;
    const el = document.getElementById('menu-opt-' + genreIdx);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [genreIdx, genreZone]);


  // Smooth vertical scroll to keep focused row visible
  useEffect(() => {
    // Quando o foco esta na toolbar (categoria/busca) de Filmes/Series, ela
    // fica acima da grade mas nao e uma "row" no array de sections - sem
    // isso o scroll continuava alinhado ao topo da grade e a toolbar ficava
    // escondida acima da viewport, parecendo que o foco "pulou" ela.
    const el = (genreZone !== 'off' && genreRowRef.current) ? genreRowRef.current : rowEls.current[rowFocus];
    if (!el || !scrollRef.current) return;
    const sc  = scrollRef.current;
    const elT = el.offsetTop;
    const elH = el.offsetHeight;
    const elB = elT + elH;
    const scT = sc.scrollTop;
    const scB = scT + sc.clientHeight;
    let target = sc.scrollTop;
    // A "row" pode ser o catalogo inteiro de Filmes/Series (centenas de itens,
    // varios milhares de px de altura) - tentar encaixar o fim dela (elB) na
    // viewport, como se fosse uma fileira comum, jogava o scroll quase pro
    // final da lista inteira. Quando a "linha" e maior que a viewport, so
    // alinha o TOPO dela; o efeito de colFocus do CatalogGrid cuida do resto.
    if (elH > sc.clientHeight) {
      target = elT - 20;
    } else {
      if (elT < scT + 20)      target = elT - 20;
      else if (elB > scB - 20) target = elB - sc.clientHeight + 20;
    }
    target = Math.max(0, Math.min(target, sc.scrollHeight - sc.clientHeight));
    if (Math.abs(target - sc.scrollTop) > 1) smoothScroll(sc, 'scrollTop', target, vertRafRef);
  }, [rowFocus, genreZone]);

  useKeyDown(e => {
    const { focusArea, navFocus, rowFocus, colFocus, sections, featured, activeNav, bannerBtn, genres, genreIdx, genreZone, genreFilter, toolbarIdx, toolbarItems } = st.current;
    const k = e.keyCode;
    const hasBanner = activeNav !== 'minha-lista';
    const totalRows = (hasBanner ? 1 : 0) + sections.length;
    const isCatalogNav = activeNav === 'movies' || activeNav === 'series';

    if (k === KEY.BACK) {
      e.preventDefault();
      if (genreZone === 'open') { setGenreZone('button'); return; }
      if (genreZone !== 'off') { setGenreZone('off'); return; }
      if (focusArea === 'content') { setFocusArea('sidebar'); setSideExpanded(true); }
      return;
    }

    if (focusArea === 'sidebar') {
      const total = NAV.length + 3;
      if (k === KEY.UP)    { e.preventDefault(); setNavFocus(f => Math.max(0, f - 1)); }
      if (k === KEY.DOWN)  { e.preventDefault(); setNavFocus(f => Math.min(total - 1, f + 1)); }
      if (k === KEY.RIGHT) { e.preventDefault(); setFocusArea('content'); setSideExpanded(false); }
      if (k === KEY.ENTER) { e.preventDefault(); goToNav(navFocus); }
      return;
    }

    if (activeNav === 'search') return;

    // Toolbar (Filmes/Series) — dropdown de categoria (se houver generos) +
    // botao de busca, navegaveis com LEFT/RIGHT. genreZone: 'button' (foco
    // na toolbar) e 'open' (lista do dropdown navegavel). UP so move o foco
    // pra toolbar - ela NAO abre sozinho.
    if (genreZone === 'button') {
      if (k === KEY.ENTER) {
        e.preventDefault();
        const item = toolbarItems[toolbarIdx];
        if (item === 'search') {
          setSearchTypeFilter(activeNav === 'movies' ? 'movie' : 'series');
          setGenreZone('off');
          setActiveNav('search');
          setFocusArea('content');
        } else {
          openMenuFor(item);
        }
      }
      if (k === KEY.DOWN)  { e.preventDefault(); setGenreZone('off'); }
      if (k === KEY.UP)    { e.preventDefault(); if (hasBanner) { setRowFocus(0); setGenreZone('off'); } }
      if (k === KEY.RIGHT) { e.preventDefault(); setToolbarIdx(i => Math.min(toolbarItems.length - 1, i + 1)); }
      if (k === KEY.LEFT)  {
        e.preventDefault();
        if (toolbarIdx > 0) { setToolbarIdx(i => i - 1); return; }
        setGenreZone('off');
        setFocusArea('sidebar'); setSideExpanded(true); setNavFocus(Math.max(0, NAV.indexOf(activeNav)));
      }
      return;
    }
    if (genreZone === 'open') {
      const opts = menuOptions(openMenu);
      if (k === KEY.UP)    { e.preventDefault(); if (genreIdx > 0) setGenreIdx(i => i - 1); }
      if (k === KEY.DOWN)  { e.preventDefault(); if (genreIdx < opts.length - 1) setGenreIdx(i => i + 1); }
      if (k === KEY.LEFT || k === KEY.RIGHT) { e.preventDefault(); setGenreZone('button'); }
      if (k === KEY.ENTER) { e.preventDefault(); if (opts[genreIdx]) applyMenu(openMenu, opts[genreIdx].value); setGenreZone('button'); }
      return;
    }
    if (k === KEY.UP && isCatalogNav && rowFocus === 0) {
      e.preventDefault();
      setToolbarIdx(0);
      setGenreZone('button');
      return;
    }

    // Catalogo (Filmes/Series) quebra em grade — UP/DOWN andam CATALOG_COLS
    // por vez dentro da mesma "linha logica" em vez de trocar de secao.
    const catalogSecIdx = hasBanner ? rowFocus - 1 : rowFocus;
    const catalogSec = isCatalogNav ? sections[catalogSecIdx] : null;
    const isCatalogRow = catalogSec && catalogSec.key === 'all';

    // Throttle: segurar UP/DOWN dispara o repeat nativo do teclado bem mais
    // rapido do que a animacao de scroll (180ms) consegue acompanhar - cada
    // novo pulo cancelava a anterior no meio, dando a impressao de "travado"
    // e de "desceu tudo sozinho" com so um toque mais demorado no controle.
    if ((k === KEY.UP || k === KEY.DOWN) && isCatalogRow) {
      const now = Date.now();
      if (now - catalogMoveTimeRef.current < 140) { e.preventDefault(); return; }
      catalogMoveTimeRef.current = now;
    }

    if (k === KEY.UP && isCatalogRow) {
      e.preventDefault();
      if (colFocus < CATALOG_COLS) {
        setToolbarIdx(0);
        setGenreZone('button');
      } else {
        setColFocus(c => Math.max(0, c - CATALOG_COLS));
      }
      return;
    }
    if (k === KEY.DOWN && isCatalogRow) {
      e.preventDefault();
      setColFocus(c => Math.max(0, Math.min(catalogSec.data.length - 1, c + CATALOG_COLS)));
      return;
    }

    if (k === KEY.UP) {
      e.preventDefault();
      if (rowFocus > 0) { setRowFocus(f => f - 1); setColFocus(0); }
    }
    if (k === KEY.DOWN) {
      e.preventDefault();
      if (rowFocus < totalRows - 1) { setRowFocus(f => f + 1); setColFocus(0); }
    }
    if (k === KEY.LEFT) {
      e.preventDefault();
      if (hasBanner && rowFocus === 0) {
        if (bannerBtn > 0) { setBannerBtn(f => f - 1); }
        else { setFocusArea('sidebar'); setSideExpanded(true); setNavFocus(Math.max(0, NAV.indexOf(activeNav))); }
      } else if (isCatalogRow && colFocus % CATALOG_COLS === 0) {
        // Borda esquerda VISUAL da grade (nao so colFocus===0) - senao LEFT
        // no inicio de qualquer linha "voltava" pro ultimo item da linha de
        // cima em vez de ir pra sidebar, ja que colFocus e um indice unico
        // corrido por cima de varias linhas.
        setFocusArea('sidebar');
        setSideExpanded(true);
        setNavFocus(Math.max(0, NAV.indexOf(activeNav)));
      } else {
        if (colFocus > 0) {
          setColFocus(f => f - 1);
        } else {
          setFocusArea('sidebar');
          setSideExpanded(true);
          setNavFocus(Math.max(0, NAV.indexOf(activeNav)));
        }
      }
    }
    if (k === KEY.RIGHT) {
      e.preventDefault();
      if (hasBanner && rowFocus === 0) {
        setBannerBtn(f => Math.min(2, f + 1));
      } else {
        const secIdx = hasBanner ? rowFocus - 1 : rowFocus;
        const sec = sections[secIdx];
        if (sec) setColFocus(f => Math.min(f + 1, sec.data.length - 1));
      }
    }
    if (k === KEY.ENTER) {
      e.preventDefault();
      if (hasBanner && rowFocus === 0) {
        if (bannerBtn === 0) openWatch(featured);
        else if (bannerBtn === 1) openDetail(featured);
        else setSurprise(true);
        return;
      }
      const secIdx = hasBanner ? rowFocus - 1 : rowFocus;
      const sec = sections[secIdx];
      if (sec && sec.data[colFocus]) openDetail(sec.data[colFocus]);
    }
  });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0a0a0a' }}>
      {surprise && <Surprise onClose={() => setSurprise(false)} onPick={openDetail} />}
      <Sidebar
        activeNav={activeNav}
        focusIdx={focusArea === 'sidebar' ? navFocus : -1}
        expanded={showSidebar}
        onSelect={key => {
          if (key === 'iptv') { navigate('/iptv'); return; }
          if (key === 'minha-lista') delete dataCache.current['minha-lista'];
          setActiveNav(key);
          setFocusArea('content');
          setSideExpanded(false);
          setRowFocus(0);
          setColFocus(0);
          setBannerBtn(0);
          setGenreFilter(null);
          setDateKey(''); setMinRating(0); setSortKey('az');
          setGenreZone('off');
          setGenreIdx(0);
          setToolbarIdx(0);
          setSearchTypeFilter(null);
        }}
        onLogout={() => { logout(); navigate('/login', { replace: true }); }}
        onHelp={openTutorial}
        onSwitchProfile={() => { setActiveProfile(null); navigate('/profile-select', { replace: true }); }}
        activeProfile={activeProfile}
        onMouseEnter={() => setSideHovered(true)}
        onMouseLeave={() => setSideHovered(false)}
      />

      <div style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
        {activeNav === 'search' ? (
          <SearchPanel
            typeFilter={searchTypeFilter}
            onSelect={openDetail}
            onBack={() => { setFocusArea('sidebar'); setSideExpanded(true); }}
          />
        ) : loadingData && sections.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
            <div style={{ width: 48, height: 48, border: '3px solid rgba(255,255,255,0.06)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 600 }}>Carregando</div>
          </div>
        ) : (
          <div
            ref={scrollRef}
            style={{ height: '100%', overflowY: 'auto' }}
          >
            {/* Banner — row 0 (hidden for minha-lista/search) */}
            {activeNav !== 'minha-lista' && (
              <div ref={el => { rowEls.current[0] = el; }}>
                <HeroBanner
                  item={featured}
                  focusedBtn={focusArea === 'content' && rowFocus === 0 ? bannerBtn : -1}
                  onWatch={() => openWatch(featured)}
                  onDetail={() => openDetail(featured)}
                  onSurprise={() => setSurprise(true)}
                />
              </div>
            )}

            {/* Toolbar de Filmes/Séries: Categoria, Data, Nota e Ordem em dropdown + busca */}
            {(activeNav === 'movies' || activeNav === 'series') && (
              <div ref={genreRowRef} style={{ padding: '18px ' + PAD_L + 'px 4px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 30 }}>
                {toolbarItems.filter(k => k !== 'search').map(key => {
                  const isOpen = genreZone === 'open' && openMenu === key;
                  const isFoc  = genreZone !== 'off' && toolbarItems[toolbarIdx] === key;
                  return (
                    <div key={key} style={{ position: 'relative' }}>
                      <div
                        onClick={() => { setToolbarIdx(toolbarItems.indexOf(key)); if (isOpen) setGenreZone('button'); else openMenuFor(key); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 10,
                          padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                          fontSize: 14, fontWeight: 700, color: '#fff',
                          background: menuActive(key) ? 'rgba(201,28,44,0.22)' : 'rgba(255,255,255,0.08)',
                          border: '2px solid ' + (isFoc ? '#fff' : 'rgba(255,255,255,0.14)'),
                        }}
                      >
                        {MENU_LABEL[key]}: {menuText(key)}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                          <path d="M7 10l5 5 5-5z"/>
                        </svg>
                      </div>
                      {isOpen && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 40,
                          minWidth: 240, maxHeight: 420, overflowY: 'auto',
                          background: 'rgba(14,14,16,0.98)', borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.10)',
                          boxShadow: '0 20px 60px rgba(0,0,0,0.7)', padding: 8,
                        }}>
                          {menuOptions(key).map((o, i) => {
                            const isSel = genreIdx === i;
                            const isCur = o.value === menuValue(key);
                            return (
                              <div
                                key={String(o.value) + i}
                                id={'menu-opt-' + i}
                                onClick={() => { applyMenu(key, o.value); setGenreZone('button'); }}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                                  padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
                                  fontSize: 13.5, fontWeight: isCur ? 800 : 500, whiteSpace: 'nowrap',
                                  color: isSel || isCur ? '#fff' : 'rgba(255,255,255,0.6)',
                                  background: isSel ? 'rgba(255,255,255,0.10)' : 'transparent',
                                  border: '2px solid ' + (isSel ? 'rgba(255,255,255,0.5)' : 'transparent'),
                                }}
                              >
                                {o.label}
                                {isCur && <span style={{ color: ACCENT, fontSize: 15 }}>✓</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Busca — pula direto pra tela de Busca já filtrada por tipo (filme/série) */}
                <div
                  onClick={() => {
                    setSearchTypeFilter(activeNav === 'movies' ? 'movie' : 'series');
                    setGenreZone('off');
                    setActiveNav('search');
                    setFocusArea('content');
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 40, borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.08)',
                    border: '2px solid ' + (genreZone === 'button' && toolbarIdx === toolbarItems.length - 1 ? '#fff' : 'rgba(255,255,255,0.14)'),
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <circle cx="11" cy="11" r="7"/>
                    <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            )}

            {/* Minha Lista empty state */}
            {activeNav === 'minha-lista' && sections.length === 0 && !loadingData && (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
                <svg width="72" height="72" viewBox="0 0 24 24" fill="rgba(255,255,255,0.12)">
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, fontWeight: 600 }}>Sua lista está vazia</div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>Adicione filmes e séries pela tela de detalhes</div>
              </div>
            )}

            {/* Sections */}
            <div style={{ background: '#0a0a0a', paddingBottom: 64, paddingTop: activeNav === 'minha-lista' ? 48 : 0 }}>
              {sections.map((sec, si) => {
                const ri        = activeNav === 'minha-lista' ? si : si + 1;
                const isActive  = focusArea === 'content' && rowFocus === ri;
                const isHistory = sec.key === 'history';

                return (
                  <div
                    key={sec.key}
                    ref={el => { rowEls.current[ri] = el; }}
                    style={{ marginTop: si === 0 ? 12 : 8, marginBottom: 0 }}
                  >
                    <SectionLabel title={sec.title} isActive={isActive} isHistory={isHistory} />
                    {sec.key === 'all' && sec.data.length === 0 ? (
                      <div style={{ padding: '40px ' + PAD_L + 'px', color: 'rgba(255,255,255,0.4)', fontSize: 18 }}>Nenhum título com esses filtros. Mude a Categoria, Data ou Nota.</div>
                    ) : sec.key === 'all' ? (
                      <CatalogGrid
                        data={sec.data}
                        colFocus={colFocus}
                        isActive={isActive}
                        onSelect={openDetail}
                        scrollRef={scrollRef}
                        vertRafRef={vertRafRef}
                      />
                    ) : (
                      <CardRow
                        data={sec.data}
                        colFocus={colFocus}
                        isActive={isActive}
                        onSelect={openDetail}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
