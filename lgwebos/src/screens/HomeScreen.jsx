import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { moviesAPI, seriesAPI, watchlistAPI, genresAPI } from '../api/index.js';
import api from '../api/index.js';
import { prefetchCache } from '../App.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { KEY, useKeyDown } from '../hooks/useNav.js';

const NAV       = ['home', 'movies', 'series', 'search', 'iptv', 'minha-lista'];
const ACCENT    = '#c91c2c';

// Card sizes (from DC design spec)
const PORT_W    = 172;  // portrait card width
const PORT_H    = 208;  // portrait card height
const LAND_W    = 306;  // landscape card (continue watching)
const LAND_H    = 128;
const CARD_GAP  = 14;
const PAD_L     = 48;   // row padding from content edge

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
const PortraitCard = React.memo(function PortraitCard({ item, focused, hovered, onClick, onEnter, onLeave }) {
  const img   = item.poster_url || item.backdrop_url || item.thumbnail_url;
  const title = item.title || item.name || item.episode_title || '';
  const isHighlit = focused || hovered;
  const versionBadge = getVersionBadge(item);

  return (
    <div
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        flexShrink: 0, width: PORT_W, cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Image */}
      <div style={{
        width: PORT_W, height: PORT_H, position: 'relative',
        borderRadius: 8, background: '#0a0a0a', overflow: 'hidden',
        boxShadow: isHighlit ? 'inset 0 0 0 3px #fff' : 'none',
      }}>
        {img ? (
          <img
            src={img}
            alt=""
            style={{
              width: '100%', height: '100%', objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg,#1c1c1c,#2a2a2a)',
          }} />
        )}

        {/* Genre tag */}
        {item.genres && item.genres[0] && !isHighlit && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(0,0,0,0.72)', borderRadius: 4,
            padding: '3px 7px', fontSize: 10, fontWeight: 700,
            color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5,
            }}>
            {item.genres[0]}
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
        width: PORT_W,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {title}
      </div>
    </div>
  );
});

// ── Landscape card (306×128) for "Continue Assistindo" ──────────────────────
const LandscapeCard = React.memo(function LandscapeCard({ item, focused, hovered, onClick, onEnter, onLeave }) {
  const img   = item.backdrop_url || item.thumbnail_url || item.poster_url;
  const title = item.title || item.name || item.episode_title || '';
  const pct   = item.progress > 0 && item.duration > 0
    ? Math.min(100, Math.round((item.progress / item.duration) * 100)) : 0;
  const isHighlit = focused || hovered;

  return (
    <div
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        flexShrink: 0, width: LAND_W, cursor: 'pointer',
        position: 'relative',
      }}
    >
      <div style={{
        width: LAND_W, height: LAND_H, position: 'relative',
        borderRadius: 8, overflow: 'hidden',
        boxShadow: isHighlit ? 'inset 0 0 0 3px #fff' : 'none',
      }}>
        {img ? (
          <img
            src={img}
            alt=""
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

        {/* Gradient overlay + title */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '55%', borderRadius: '0 0 8px 8px',
          background: 'linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 100%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 24, left: 10, right: 10,
          fontSize: 12, fontWeight: 700, color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </div>

        {/* Progress bar */}
        {pct > 0 && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 4, borderRadius: '0 0 8px 8px',
            background: 'rgba(255,255,255,0.18)',
          }}>
            <div style={{
              height: '100%', width: pct + '%',
              background: ACCENT, borderRadius: '0 0 0 8px',
            }} />
          </div>
        )}

        {/* Play overlay */}
        {isHighlit && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 8,
            background: 'rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.93)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 0, height: 0, borderStyle: 'solid',
                borderWidth: '8px 0 8px 15px',
                borderColor: 'transparent transparent transparent #111',
                marginLeft: 3,
              }} />
            </div>
          </div>
        )}
      </div>

      <div style={{
        marginTop: 8, fontSize: 12, fontWeight: isHighlit ? 700 : 400,
        color: isHighlit ? '#fff' : 'rgba(255,255,255,0.45)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {pct > 0 ? pct + '% assistido' : ''}
      </div>
    </div>
  );
});

// ── Card Row ──────────────────────────────────────────────────────────────────
function CardRow({ data, colFocus, isActive, isLandscape, onSelect }) {
  const rowRef   = useRef(null);
  const rafRef   = useRef(null);
  const [hov, setHov] = useState(-1);
  const W = isLandscape ? LAND_W : PORT_W;

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
        if (isLandscape) {
          return (
            <LandscapeCard
              key={item.id} item={item}
              focused={focused} hovered={hov === ci}
              onClick={() => onSelect(item)}
              onEnter={() => setHov(ci)}
              onLeave={() => setHov(-1)}
            />
          );
        }
        return (
          <PortraitCard
            key={item.id} item={item}
            focused={focused} hovered={hov === ci}
            onClick={() => onSelect(item)}
            onEnter={() => setHov(ci)}
            onLeave={() => setHov(-1)}
          />
        );
      })}
    </div>
  );
}

// ── Catalog grid (Filmes/Series completo) — quebra linha em vez de fileira unica,
// senao navegar 100+ itens so de LEFT/RIGHT e inviavel.
const CATALOG_COLS = 8;
function CatalogGrid({ data, colFocus, isActive, onSelect }) {
  const itemRefs = useRef([]);
  useEffect(() => {
    if (!isActive) return;
    const el = itemRefs.current[colFocus];
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [colFocus, isActive]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(' + CATALOG_COLS + ', ' + PORT_W + 'px)',
      gap: CARD_GAP,
      paddingLeft: PAD_L, paddingRight: PAD_L, paddingBottom: 24, paddingTop: 16,
    }}>
      {data.map((item, ci) => {
        const focused = isActive && ci === colFocus;
        return (
          <div key={item.id} ref={el => { itemRefs.current[ci] = el; }}>
            <PortraitCard
              item={item} focused={focused} hovered={false}
              onClick={() => onSelect(item)}
              onEnter={() => {}} onLeave={() => {}}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Hero Banner (left info + right poster) ───────────────────────────────────
function HeroBanner({ item, focusedBtn, onWatch, onDetail }) {
  if (!item) return null;
  const title    = item.title || item.name || '';
  const backdrop = item.backdrop_url;
  const poster   = item.poster_url || item.backdrop_url;
  const isSeries = item.total_seasons !== undefined;
  const rating   = item.rating ? parseFloat(item.rating).toFixed(1) : null;

  return (
    <div style={{
      position: 'relative', height: 612, flexShrink: 0, overflow: 'hidden',
      background: 'linear-gradient(135deg,#0c1520 0%,#140820 45%,#0a1618 80%,#0a0a0a 100%)',
    }}>
      {/* Backdrop blurred bg */}
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', display: 'block', opacity: 0.18,
            transform: 'scale(1.02)',
          }}
        />
      )}

      {/* Gradient overlays — merged into one pass for GPU efficiency */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,12,20,0.98) 0%, rgba(10,12,20,0.92) 35%, rgba(10,12,20,0.45) 65%, transparent 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0a0a0a 0%, transparent 40%)' }} />

      {/* Right poster */}
      {poster && (
        <div style={{
          position: 'absolute', right: 140, top: 40, bottom: 40,
          width: 380,
        }}>
          <img
            src={poster}
            alt=""
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              borderRadius: 12,
              display: 'block',
            }}
          />
          {/* Fade left edge of poster into bg */}
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: '55%',
            background: 'linear-gradient(to right, rgba(10,10,10,1) 0%, rgba(10,10,10,0) 100%)',
            borderRadius: '12px 0 0 12px',
          }} />
        </div>
      )}

      {/* Left side info */}
      <div style={{
        position: 'absolute', bottom: 68, left: PAD_L,
        maxWidth: 660,
      }}>
        {/* Badges row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            background: ACCENT, color: '#fff',
            fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
            padding: '4px 10px', borderRadius: 5,
            textTransform: 'uppercase',
          }}>
            {isSeries ? 'SÉRIE' : 'FILME'}
          </div>
          {rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#f5c518">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f5c518' }}>{rating}</span>
            </div>
          )}
          {item.year && (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{item.year}</span>
          )}
          {isSeries && item.total_seasons && (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
              {item.total_seasons} temporada{item.total_seasons > 1 ? 's' : ''}
            </span>
          )}
          {item.age_rating && (
            <div style={{
              border: '1.5px solid rgba(255,255,255,0.35)',
              borderRadius: 4, padding: '2px 7px',
              fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            }}>
              {item.age_rating}
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 72, fontWeight: 900, color: '#fff',
          lineHeight: 1.0, marginBottom: 18,
          textShadow: '0 4px 32px rgba(0,0,0,0.9)',
          letterSpacing: -2,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {title}
        </div>

        {/* Synopsis */}
        {item.synopsis && (
          <div style={{
            fontSize: 16, color: 'rgba(255,255,255,0.68)',
            lineHeight: 1.7, maxWidth: 560,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            marginBottom: 32,
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

function SearchPanel({ onSelect, onBack }) {
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
  useEffect(() => {
    Promise.all([
      moviesAPI.popular().then(r => r.data || []).catch(() => []),
      seriesAPI.popular().then(r => r.data || []).catch(() => []),
    ]).then(([pm, ps]) => {
      const seen = new Set();
      const merged = [...pm, ...ps].filter(it => {
        if (seen.has(it.id)) return false; seen.add(it.id); return true;
      }).slice(0, 20);
      setDefaultItems(merged);
    });
  }, []);

  useEffect(() => {
    clearTimeout(debRef.current);
    if (!query.trim()) { setResults({ movies: [], series: [] }); return; }
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [mv, sr] = await Promise.all([
          moviesAPI.search(query).then(r => (r.data || []).slice(0, 18)),
          seriesAPI.search(query).then(r => (r.data || []).slice(0, 18)),
        ]);
        setResults({ movies: mv, series: sr });
      } catch { setResults({ movies: [], series: [] }); }
      finally { setLoading(false); }
    }, 400);
  }, [query]);

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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header — query digitada */}
      <div style={{ padding: '32px ' + PAD_L + 'px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill={ACCENT}>
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        {query ? (
          <span style={{ fontSize: 22, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {query}<span style={{ opacity: 0.5 }}> |</span>
          </span>
        ) : (
          <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.35)' }}>Digite para buscar…</span>
        )}
        {loading && <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginLeft: 6 }} />}
      </div>

      {/* Body: teclado + sugestoes | grade */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Esquerda — teclado + sugestoes */}
        <div style={{ width: SEARCH_LEFT_W, flexShrink: 0, padding: '24px ' + PAD_L + 'px', overflowY: 'auto' }}>
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
                      flex: wide ? 3 : 1, height: 44,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 7, cursor: 'pointer',
                      fontSize: 15, fontWeight: 700,
                      color: isFoc ? '#fff' : 'rgba(255,255,255,0.7)',
                      background: isFoc ? ACCENT : 'rgba(255,255,255,0.06)',
                      border: '2px solid ' + (isFoc ? '#fff' : 'transparent'),
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

          {suggestions.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                Sugestões
              </div>
              {suggestions.map((item, i) => {
                const isFoc = zone === 'sug' && sugIdx === i;
                const isS   = item.total_seasons !== undefined;
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelect(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', borderRadius: 7, cursor: 'pointer',
                      background: isFoc ? 'rgba(255,255,255,0.10)' : 'transparent',
                      border: '2px solid ' + (isFoc ? 'rgba(255,255,255,0.4)' : 'transparent'),
                      marginBottom: 2,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={isFoc ? ACCENT : '#484848'}>
                      {isS
                        ? <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v-2H3V5h18v14h-5v2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8 19h8v-2H8v2z"/>
                        : <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-2z"/>}
                    </svg>
                    <span style={{ fontSize: 13.5, color: isFoc ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: isFoc ? 700 : 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

        {/* Direita — grade 3 colunas */}
        <div style={{ flex: 1, padding: '24px ' + PAD_L + 'px 24px 0', overflowY: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
            {query
              ? (allItems.length > 0 ? `${allItems.length} resultado${allItems.length !== 1 ? 's' : ''}` : (!loading ? `Sem resultados para "${query}"` : ''))
              : 'Catálogo'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + SEARCH_COLS + ', 1fr)', gap: 18, paddingBottom: 32 }}>
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
                    display: 'flex', flexDirection: 'column',
                    borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                    background: isFoc ? 'rgba(255,255,255,0.09)' : 'transparent',
                    border: '2px solid ' + (isFoc ? '#fff' : 'rgba(255,255,255,0.06)'),
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '16/9', background: '#0a0a0a', overflow: 'hidden', position: 'relative' }}>
                    {img
                      ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1c1c1c,#2a2a2a)' }} />
                    }
                    {isFoc && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.93)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '9px 0 9px 16px', borderColor: 'transparent transparent transparent #111', marginLeft: 3 }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: isFoc ? 700 : 500, color: isFoc ? '#fff' : 'rgba(255,255,255,0.7)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title || item.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
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
  const { logout, activeProfile, setActiveProfile } = useAuth();
  const navigate = useNavigate();

  const [activeNav,    setActiveNav]    = useState('home');
  const [featured,     setFeatured]     = useState(null);
  const [sections,     setSections]     = useState([]);
  const [loadingData,  setLoadingData]  = useState(true);
  const [focusArea,    setFocusArea]    = useState('content');
  const [navFocus,     setNavFocus]     = useState(0);
  const [sideExpanded, setSideExpanded] = useState(false);
  const [sideHovered,  setSideHovered]  = useState(false);
  const [rowFocus,     setRowFocus]     = useState(0);
  const [colFocus,     setColFocus]     = useState(0);
  const [bannerBtn,    setBannerBtn]    = useState(0); // 0=Assistir, 1=Mais Info

  // Filtro de categoria — só pras páginas Filmes/Séries.
  const [genres,         setGenres]         = useState([]);
  const [genreFilter,    setGenreFilter]    = useState(null);
  const [genreRowActive, setGenreRowActive] = useState(false);
  const [genreIdx,       setGenreIdx]       = useState(0); // 0 = "Todos"

  const dataCache     = useRef({});
  const prevProfileId = useRef(undefined);
  const scrollRef  = useRef(null);
  const rowEls     = useRef([]);
  const vertRafRef = useRef(null);
  const st         = useRef({});
  st.current = { focusArea, navFocus, rowFocus, colFocus, sections, featured, activeNav, bannerBtn, genres, genreFilter, genreRowActive, genreIdx };

  useEffect(() => {
    genresAPI.list().then(r => setGenres(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const showSidebar = sideExpanded || sideHovered || focusArea === 'sidebar';

  const openDetail = useCallback((item) => {
    if (!item) return;
    if (item.content_type === 'movie' || item.content_type === 'episode') {
      const id   = item.series_id || item.content_id;
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
    setGenreRowActive(false);
    setGenreIdx(0);
  }, [logout, navigate, setActiveProfile]);

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
            ? [{ key: 'watchlist', title: 'Minha Lista', data: items }]
            : [],
        };
        setFeatured(null);
        setSections(dataCache.current['minha-lista'].sections);
      })
      .catch(() => { setSections([]); })
      .finally(() => setLoadingData(false));
  }, [activeNav, activeProfile]);

  // Load content
  useEffect(() => {
    if (activeNav === 'search') return;
    if (activeNav === 'minha-lista') return;

    // Quando o perfil muda, invalida o cache para rebuscar o histórico correto
    const curProfileId = activeProfile?.id ?? null;
    if (prevProfileId.current !== undefined && prevProfileId.current !== curProfileId) {
      dataCache.current = {};
    }
    prevProfileId.current = curProfileId;

    const cacheKey = (activeNav === 'movies' || activeNav === 'series')
      ? activeNav + '|' + (genreFilter || '')
      : activeNav;

    if (prefetchCache[cacheKey] && !dataCache.current[cacheKey]) {
      dataCache.current[cacheKey] = prefetchCache[cacheKey];
    }
    if (dataCache.current[cacheKey]) {
      const c = dataCache.current[cacheKey];
      setFeatured(c.featured);
      setSections(c.sections);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    const profileId = activeProfile && activeProfile.id;
    const catalogParams = { limit: 500, sort: 'title', order: 'asc', ...(genreFilter ? { genre: genreFilter } : {}) };
    const fullCatalogReq = activeNav === 'movies'
      ? moviesAPI.list(catalogParams).then(r => r.data?.data || []).catch(() => [])
      : activeNav === 'series'
        ? seriesAPI.list(catalogParams).then(r => r.data?.data || []).catch(() => [])
        : Promise.resolve(null);
    Promise.all([
      moviesAPI.popular().then(r => r.data || []),
      moviesAPI.newReleases().then(r => r.data || []),
      seriesAPI.popular().then(r => r.data || []),
      seriesAPI.newReleases().then(r => r.data || []),
      activeProfile
        ? api.get('/api/history' + (profileId ? '?profile_id=' + profileId : '')).then(r => r.data || []).catch(() => [])
        : Promise.resolve([]),
      fullCatalogReq,
    ]).then(([pm, nm, ps, ns, hist, fullCatalog]) => {
      const history = hist.filter(h => h.progress > 0 && h.duration > 0 && !h.completed).slice(0, 12);
      const built   = buildSections(activeNav, pm, nm, ps, ns, fullCatalog);
      // Filmes/Series: so o catalogo, "Continue Assistindo" fica de fora
      // (pedido explicito - essas paginas devem ter so a listagem completa).
      const secs    = (history.length > 0 && activeNav !== 'movies' && activeNav !== 'series')
        ? [{ key: 'history', title: 'Continue Assistindo', data: history }, ...built.sections]
        : built.sections;
      dataCache.current[cacheKey] = { featured: built.featured, sections: secs };
      setFeatured(built.featured);
      setSections(secs);
    }).catch(() => {}).finally(() => setLoadingData(false));
  }, [activeNav, activeProfile, genreFilter]);

  // Smooth vertical scroll to keep focused row visible
  useEffect(() => {
    const el = rowEls.current[rowFocus];
    if (!el || !scrollRef.current) return;
    const sc  = scrollRef.current;
    const elT = el.offsetTop;
    const elB = elT + el.offsetHeight;
    const scT = sc.scrollTop;
    const scB = scT + sc.clientHeight;
    let target = sc.scrollTop;
    if (elT < scT + 20)      target = elT - 20;
    else if (elB > scB - 20) target = elB - sc.clientHeight + 20;
    if (target !== sc.scrollTop) smoothScroll(sc, 'scrollTop', target, vertRafRef);
  }, [rowFocus]);

  useKeyDown(e => {
    const { focusArea, navFocus, rowFocus, colFocus, sections, featured, activeNav, bannerBtn, genres, genreIdx, genreRowActive, genreFilter } = st.current;
    const openGenreDropdown = () => {
      const idx = genreFilter ? genres.indexOf(genreFilter) + 1 : 0;
      setGenreIdx(idx >= 0 ? idx : 0);
      setGenreRowActive(true);
    };
    const k = e.keyCode;
    const hasBanner = activeNav !== 'minha-lista';
    const totalRows = (hasBanner ? 1 : 0) + sections.length;
    const isCatalogNav = activeNav === 'movies' || activeNav === 'series';

    if (k === KEY.BACK) {
      e.preventDefault();
      if (genreRowActive) { setGenreRowActive(false); return; }
      if (focusArea === 'content') { setFocusArea('sidebar'); setSideExpanded(true); }
      return;
    }

    if (focusArea === 'sidebar') {
      const total = NAV.length + 2;
      if (k === KEY.UP)    { e.preventDefault(); setNavFocus(f => Math.max(0, f - 1)); }
      if (k === KEY.DOWN)  { e.preventDefault(); setNavFocus(f => Math.min(total - 1, f + 1)); }
      if (k === KEY.RIGHT) { e.preventDefault(); setFocusArea('content'); setSideExpanded(false); }
      if (k === KEY.ENTER) { e.preventDefault(); goToNav(navFocus); }
      return;
    }

    if (activeNav === 'search') return;

    // Dropdown de categoria (Filmes/Series) — "Todos" + um item por genero.
    if (genreRowActive) {
      if (k === KEY.UP)    { e.preventDefault(); if (genreIdx > 0) setGenreIdx(i => i - 1); }
      if (k === KEY.DOWN)  { e.preventDefault(); if (genreIdx < genres.length) setGenreIdx(i => i + 1); }
      if (k === KEY.LEFT)  { e.preventDefault(); setGenreRowActive(false); }
      if (k === KEY.ENTER) { e.preventDefault(); setGenreFilter(genreIdx === 0 ? null : genres[genreIdx - 1]); setGenreRowActive(false); }
      return;
    }
    if (k === KEY.UP && isCatalogNav && rowFocus === 0 && genres.length > 0) {
      e.preventDefault();
      openGenreDropdown();
      return;
    }

    // Catalogo (Filmes/Series) quebra em grade — UP/DOWN andam CATALOG_COLS
    // por vez dentro da mesma "linha logica" em vez de trocar de secao.
    const catalogSecIdx = hasBanner ? rowFocus - 1 : rowFocus;
    const catalogSec = isCatalogNav ? sections[catalogSecIdx] : null;
    const isCatalogRow = catalogSec && catalogSec.key === 'all';

    if (k === KEY.UP && isCatalogRow) {
      e.preventDefault();
      if (colFocus < CATALOG_COLS) {
        if (genres.length > 0) openGenreDropdown();
        else { setRowFocus(0); setColFocus(0); }
      } else {
        setColFocus(c => Math.max(0, c - CATALOG_COLS));
      }
      return;
    }
    if (k === KEY.DOWN && isCatalogRow) {
      e.preventDefault();
      setColFocus(c => Math.min(catalogSec.data.length - 1, c + CATALOG_COLS));
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
        setBannerBtn(f => Math.min(1, f + 1));
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
        else openDetail(featured);
        return;
      }
      const secIdx = hasBanner ? rowFocus - 1 : rowFocus;
      const sec = sections[secIdx];
      if (sec && sec.data[colFocus]) openDetail(sec.data[colFocus]);
    }
  });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0a0a0a' }}>
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
          setGenreRowActive(false);
          setGenreIdx(0);
        }}
        onLogout={() => { logout(); navigate('/login', { replace: true }); }}
        onSwitchProfile={() => { setActiveProfile(null); navigate('/profile-select', { replace: true }); }}
        activeProfile={activeProfile}
        onMouseEnter={() => setSideHovered(true)}
        onMouseLeave={() => setSideHovered(false)}
      />

      <div style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
        {activeNav === 'search' ? (
          <SearchPanel
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
                />
              </div>
            )}

            {/* Dropdown de categoria — só Filmes/Séries. Sobe com UP a partir do
                banner/topo do catalogo, abre um painel na lateral com a lista. */}
            {(activeNav === 'movies' || activeNav === 'series') && genres.length > 0 && (
              <div style={{ padding: '18px ' + PAD_L + 'px 4px', position: 'relative' }}>
                <div
                  onClick={() => {
                    const idx = genreFilter ? genres.indexOf(genreFilter) + 1 : 0;
                    setGenreIdx(idx >= 0 ? idx : 0);
                    setGenreRowActive(v => !v);
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, color: '#fff',
                    background: 'rgba(255,255,255,0.08)',
                    border: '2px solid ' + (genreRowActive ? '#fff' : 'rgba(255,255,255,0.14)'),
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round"/>
                  </svg>
                  Categoria: {genreFilter || 'Todos'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" style={{ transform: genreRowActive ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M7 10l5 5 5-5z"/>
                  </svg>
                </div>

                {genreRowActive && (
                  <div style={{
                    position: 'absolute', top: '100%', left: PAD_L, marginTop: 6, zIndex: 40,
                    minWidth: 240, maxHeight: 420, overflowY: 'auto',
                    background: 'rgba(14,14,16,0.98)', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.10)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.7)', padding: 8,
                  }}>
                    {['Todos', ...genres].map((g, i) => {
                      const isSel = genreIdx === i;
                      const isActiveFilter = i === 0 ? !genreFilter : genreFilter === g;
                      return (
                        <div
                          key={g}
                          onClick={() => { setGenreFilter(i === 0 ? null : g); setGenreRowActive(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
                            fontSize: 13.5, fontWeight: isActiveFilter ? 800 : 500,
                            color: isSel ? '#fff' : isActiveFilter ? '#fff' : 'rgba(255,255,255,0.6)',
                            background: isSel ? 'rgba(255,255,255,0.10)' : 'transparent',
                            border: '2px solid ' + (isSel ? 'rgba(255,255,255,0.5)' : 'transparent'),
                          }}
                        >
                          {g}
                          {isActiveFilter && <span style={{ color: ACCENT, fontSize: 15 }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
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
                const isLand    = isHistory;

                return (
                  <div
                    key={sec.key}
                    ref={el => { rowEls.current[ri] = el; }}
                    style={{ marginTop: si === 0 ? 12 : 8, marginBottom: 0 }}
                  >
                    <SectionLabel title={sec.title} isActive={isActive} isHistory={isHistory} />
                    {sec.key === 'all' ? (
                      <CatalogGrid
                        data={sec.data}
                        colFocus={colFocus}
                        isActive={isActive}
                        onSelect={openDetail}
                      />
                    ) : (
                      <CardRow
                        data={sec.data}
                        colFocus={colFocus}
                        isActive={isActive}
                        isLandscape={isLand}
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
