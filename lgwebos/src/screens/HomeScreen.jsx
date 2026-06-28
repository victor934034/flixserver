import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { moviesAPI, seriesAPI, watchlistAPI } from '../api/index.js';
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

// ── Portrait card (172×208) ───────────────────────────────────────────────────
function PortraitCard({ item, focused, hovered, onClick, onEnter, onLeave }) {
  const img   = item.poster_url || item.backdrop_url || item.thumbnail_url;
  const title = item.title || item.name || item.episode_title || '';
  const isHighlit = focused || hovered;

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
        transition: 'box-shadow 0.18s',
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
        transition: 'color 0.18s ease, font-weight 0.18s ease',
      }}>
        {title}
      </div>
    </div>
  );
}

// ── Landscape card (306×128) for "Continue Assistindo" ──────────────────────
function LandscapeCard({ item, focused, hovered, onClick, onEnter, onLeave }) {
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
        transition: 'box-shadow 0.18s',
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
              transition: 'width 0.3s',
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
        transition: 'color 0.18s ease',
      }}>
        {pct > 0 ? pct + '% assistido' : ''}
      </div>
    </div>
  );
}

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
        animation: 'fadein 0.5s ease',
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
              transform: focusedBtn === 0 ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.18s, outline 0.18s',
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
              transform: focusedBtn === 1 ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.18s, border-color 0.18s',
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
function SearchPanel({ onSelect, onBack }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resFoc,  setResFoc]  = useState(-1); // -1 = input focused
  const inputRef  = useRef(null);
  const gridRef   = useRef(null);
  const itemRefs  = useRef([]);
  const debRef    = useRef(null);
  const stRef     = useRef({ results: [], resFoc: -1 });
  stRef.current   = { results, resFoc };

  const COLS = 6;

  useEffect(() => { setTimeout(() => inputRef.current && inputRef.current.focus(), 80); }, []);

  useEffect(() => {
    clearTimeout(debRef.current);
    if (!query.trim()) { setResults([]); setResFoc(-1); return; }
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [mv, sr] = await Promise.all([
          moviesAPI.search(query).then(r => (r.data || []).slice(0, 18)),
          seriesAPI.search(query).then(r => (r.data || []).slice(0, 18)),
        ]);
        setResults([...mv, ...sr]);
        setResFoc(-1);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
  }, [query]);

  // Keep focused result scrolled into view
  useEffect(() => {
    if (resFoc < 0) return;
    const el = itemRefs.current[resFoc];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [resFoc]);

  useKeyDown(e => {
    const { results, resFoc } = stRef.current;
    const k = e.keyCode;
    if (k === KEY.BACK) { e.preventDefault(); onBack(); return; }

    const inputFocused = document.activeElement === inputRef.current;

    if (k === KEY.BACKSPACE && !inputFocused) { e.preventDefault(); onBack(); return; }

    if (inputFocused) {
      if (k === KEY.DOWN && results.length > 0) {
        e.preventDefault();
        inputRef.current.blur();
        setResFoc(0);
      }
      return;
    }

    // Grid navigation (COLS columns)
    if (k === KEY.UP) {
      e.preventDefault();
      if (resFoc < COLS) {
        // first row → go back to input
        setResFoc(-1);
        inputRef.current && inputRef.current.focus();
      } else {
        setResFoc(f => Math.max(0, f - COLS));
      }
    }
    if (k === KEY.DOWN) {
      e.preventDefault();
      setResFoc(f => Math.min(results.length - 1, f + COLS));
    }
    if (k === KEY.LEFT) {
      e.preventDefault();
      if (resFoc % COLS > 0) setResFoc(f => f - 1);
    }
    if (k === KEY.RIGHT) {
      e.preventDefault();
      if (resFoc % COLS < COLS - 1 && resFoc + 1 < results.length) setResFoc(f => f + 1);
    }
    if (k === KEY.ENTER) {
      e.preventDefault();
      if (results[resFoc]) onSelect(results[resFoc]);
    }
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 ' + PAD_L + 'px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '44px 0 28px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 16 }}>
          Buscar
        </div>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', opacity: 0.45 }} width="22" height="22" viewBox="0 0 24 24" fill="#fff">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Títulos, gêneros, pessoas…"
            autoComplete="off" autoCorrect="off" spellCheck={false}
            style={{
              width: '100%', padding: '18px 24px 18px 56px',
              background: 'rgba(255,255,255,0.07)',
              border: '2px solid ' + (query ? ACCENT : 'rgba(255,255,255,0.12)'),
              borderRadius: 10, color: '#fff', fontSize: 20, outline: 'none',
              fontFamily: 'inherit', fontWeight: 500,
              transition: 'border-color 0.2s',
            }}
          />
        </div>
      </div>

      {/* Results grid */}
      <div ref={gridRef} style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            Buscando…
          </div>
        )}
        {!loading && query && results.length === 0 && (
          <div style={{ padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>
            Nenhum resultado para "{query}"
          </div>
        )}
        {results.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + COLS + ', 1fr)', gap: 18 }}>
            {results.map((item, i) => {
              const isFoc = resFoc === i;
              const img   = item.poster_url || item.backdrop_url;
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
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  {img && (
                    <div style={{ width: '100%', aspectRatio: '2/3', background: '#0a0a0a', overflow: 'hidden' }}>
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: isFoc ? 700 : 500, color: isFoc ? '#fff' : 'rgba(255,255,255,0.7)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title || item.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      {item.total_seasons !== undefined ? 'Série' : 'Filme'}{item.year ? ' · ' + item.year : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
        transition: 'color 0.18s ease',
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
function buildSections(activeNav, pm, nm, ps, ns) {
  const seen  = new Set();
  const dedup = arr => arr.filter(it => {
    if (seen.has(it.id)) return false; seen.add(it.id); return true;
  }).slice(0, 20);
  if (activeNav === 'movies') {
    return { featured: pm[0] || nm[0] || null, sections: [
      { key: 'pm', title: 'Mais Assistidos', data: dedup(pm) },
      { key: 'nm', title: 'Novidades',       data: dedup(nm) },
    ].filter(s => s.data.length > 0) };
  }
  if (activeNav === 'series') {
    return { featured: ps[0] || ns[0] || null, sections: [
      { key: 'ps', title: 'Mais Assistidas', data: dedup(ps) },
      { key: 'ns', title: 'Novidades',       data: dedup(ns) },
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

  const dataCache     = useRef({});
  const prevProfileId = useRef(undefined);
  const scrollRef  = useRef(null);
  const rowEls     = useRef([]);
  const vertRafRef = useRef(null);
  const st         = useRef({});
  st.current = { focusArea, navFocus, rowFocus, colFocus, sections, featured, activeNav, bannerBtn };

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

    if (prefetchCache[activeNav] && !dataCache.current[activeNav]) {
      dataCache.current[activeNav] = prefetchCache[activeNav];
    }
    if (dataCache.current[activeNav]) {
      const c = dataCache.current[activeNav];
      setFeatured(c.featured);
      setSections(c.sections);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    const profileId = activeProfile && activeProfile.id;
    Promise.all([
      moviesAPI.popular().then(r => r.data || []),
      moviesAPI.newReleases().then(r => r.data || []),
      seriesAPI.popular().then(r => r.data || []),
      seriesAPI.newReleases().then(r => r.data || []),
      activeProfile
        ? api.get('/api/history' + (profileId ? '?profile_id=' + profileId : '')).then(r => r.data || []).catch(() => [])
        : Promise.resolve([]),
    ]).then(([pm, nm, ps, ns, hist]) => {
      const history = hist.filter(h => h.progress > 0 && h.duration > 0 && !h.completed).slice(0, 12);
      const built   = buildSections(activeNav, pm, nm, ps, ns);
      const secs    = history.length > 0
        ? [{ key: 'history', title: 'Continue Assistindo', data: history }, ...built.sections]
        : built.sections;
      dataCache.current[activeNav] = { featured: built.featured, sections: secs };
      setFeatured(built.featured);
      setSections(secs);
    }).catch(() => {}).finally(() => setLoadingData(false));
  }, [activeNav, activeProfile]);

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
    const { focusArea, navFocus, rowFocus, colFocus, sections, featured, activeNav, bannerBtn } = st.current;
    const k = e.keyCode;
    const hasBanner = activeNav !== 'minha-lista';
    const totalRows = (hasBanner ? 1 : 0) + sections.length;

    if (k === KEY.BACK) {
      e.preventDefault();
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
                    <CardRow
                      data={sec.data}
                      colFocus={colFocus}
                      isActive={isActive}
                      isLandscape={isLand}
                      onSelect={openDetail}
                    />
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
