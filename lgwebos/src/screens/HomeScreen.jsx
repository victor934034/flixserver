import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useAuth }    from '../contexts/AuthContext.jsx';
import { moviesAPI, seriesAPI } from '../api/index.js';
import Sidebar from '../components/Sidebar.jsx';
import Card    from '../components/Card.jsx';
import FocusItem from '../components/FocusItem.jsx';
import { KEY, useKeyDown } from '../hooks/useNav.js';

// ─── Content Row (reusable) ───────────────────────────────────────────────────
export function ContentRow({ title, data, onSelect, focusKey: rowKey }) {
  const { ref, focusKey } = useFocusable({ focusKey: rowKey, trackChildren: true });
  const rowRef = useRef(null);

  function handleCardFocus({ node }) {
    node?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (!data?.length) return null;
  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ marginBottom: 32 }}>
        {title && (
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 40px 14px' }}>{title}</div>
        )}
        <div
          ref={rowRef}
          style={{ display: 'flex', flexDirection: 'row', overflowX: 'auto', paddingLeft: 40, paddingRight: 40, paddingBottom: 8, scrollbarWidth: 'none' }}
        >
          {data.map(item => (
            <Card key={item.id} item={item} onSelect={onSelect} onFocus={handleCardFocus} />
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  );
}

// ─── Featured Banner ──────────────────────────────────────────────────────────
function FeaturedBanner({ item, onPlay }) {
  const { ref, focused } = useFocusable({
    focusKey: 'FEATURED',
    onEnterPress: () => onPlay(item),
  });
  if (!item) return null;
  const title = item.title || item.name || '';
  const img   = item.backdrop_url || item.poster_url;
  return (
    <div
      ref={ref}
      onClick={() => onPlay(item)}
      style={{
        position: 'relative', height: 360, flexShrink: 0,
        margin: '0 40px 0 40px', borderRadius: 16, overflow: 'hidden',
        border: focused ? '3px solid #fff' : '3px solid transparent',
        transition: 'border-color 0.15s ease',
        cursor: 'none',
      }}
    >
      {img && <img src={img} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }} />
      <div style={{ position: 'absolute', bottom: 36, left: 44 }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', maxWidth: 600, lineHeight: 1.1, textShadow: '0 2px 12px rgba(0,0,0,0.7)', marginBottom: 12 }}>{title}</div>
        {item.synopsis && (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', maxWidth: 480, lineHeight: 1.5,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.synopsis}
          </div>
        )}
        <div style={{
          marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8,
          background: focused ? '#fff' : '#E50914',
          color: focused ? '#000' : '#fff',
          borderRadius: 30, padding: '10px 28px',
          fontWeight: 800, fontSize: 15,
          transition: 'background 0.15s, color 0.15s',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Assistir agora
        </div>
      </div>
    </div>
  );
}

// ─── Suggestion item (text list) ─────────────────────────────────────────────
function SuggestionItem({ item, onSelect }) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect(item),
    onFocus: ({ node }) => node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
  });
  const isSeries = item.total_seasons !== undefined;
  return (
    <div
      ref={ref}
      onClick={() => onSelect(item)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 20px', cursor: 'none',
        background: focused ? 'rgba(255,255,255,0.08)' : 'transparent',
        borderLeft: `3px solid ${focused ? '#E50914' : 'transparent'}`,
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0 }}>{isSeries ? '📺' : '🎬'}</span>
      <span style={{
        fontSize: 14, fontWeight: focused ? 700 : 400,
        color: focused ? '#fff' : 'rgba(255,255,255,0.65)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {item.title || item.name}
      </span>
    </div>
  );
}

// ─── Search Panel ─────────────────────────────────────────────────────────────
function SearchPanel({ onSelect }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounce = useRef(null);

  const { ref: leftRef,  focusKey: leftKey  } = useFocusable({ focusKey: 'SEARCH_SUGEST', trackChildren: true });
  const { ref: rightRef, focusKey: rightKey } = useFocusable({ focusKey: 'SEARCH_CARDS',  trackChildren: true });

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [mv, sr] = await Promise.all([
          moviesAPI.search(query).then(r => r.data || []),
          seriesAPI.search(query).then(r => r.data || []),
        ]);
        setResults([...mv, ...sr]);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
  }, [query]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Large search bar */}
      <div style={{ padding: '36px 40px 20px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
               width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.38)">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar filmes e séries…"
            autoComplete="off" autoCorrect="off" spellCheck={false}
            style={{
              width: '100%', padding: '24px 60px 24px 68px',
              background: 'rgba(255,255,255,0.07)',
              border: '2px solid rgba(255,255,255,0.18)',
              borderRadius: 16, color: '#fff', fontSize: 24,
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
            onFocus={e => { e.target.style.borderColor = '#fff'; }}
            onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,0.18)'; }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              style={{
                position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
                width: 36, height: 36, cursor: 'none', color: '#fff', fontSize: 16, outline: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          )}
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>

        {/* LEFT — Sugestões (text list) */}
        <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: 1.5, padding: '14px 20px 8px' }}>
            Sugestões
          </div>
          <FocusContext.Provider value={leftKey}>
            <div ref={leftRef} style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px' }}>
                  <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#E50914', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Buscando…</span>
                </div>
              )}
              {!loading && !query && (
                <div style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Digite para buscar…</div>
              )}
              {!loading && query && results.length === 0 && (
                <div style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.28)', fontSize: 13 }}>Sem resultados</div>
              )}
              {results.map(item => (
                <SuggestionItem key={item.id} item={item} onSelect={onSelect} />
              ))}
            </div>
          </FocusContext.Provider>
        </div>

        {/* RIGHT — Filmes (card thumbnails) */}
        <FocusContext.Provider value={rightKey}>
          <div ref={rightRef} style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', paddingBottom: 40, minWidth: 0 }}>
            {results.length > 0 ? (
              <>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', padding: '14px 40px 12px', fontWeight: 600 }}>
                  {results.length} resultado{results.length !== 1 ? 's' : ''}
                </div>
                <ContentRow focusKey="ROW_SEARCH" data={results} onSelect={onSelect} />
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%', flexDirection: 'column', gap: 16 }}>
                <svg width="72" height="72" viewBox="0 0 24 24" fill="rgba(255,255,255,0.06)">
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 18 }}>
                  {query && !loading ? `Nenhum resultado para "${query}"` : 'Digite para buscar filmes e séries'}
                </span>
              </div>
            )}
          </div>
        </FocusContext.Provider>
      </div>
    </div>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  const [activeNav,  setActiveNav]  = useState('home');
  const [featured,   setFeatured]   = useState(null);
  const [sections,   setSections]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  const contentRef = useRef(null);
  const { ref: contentAreaRef, focusKey: contentFocusKey } = useFocusable({
    focusKey: 'CONTENT',
    trackChildren: true,
  });

  // Load content
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const all = await Promise.allSettled([
          moviesAPI.popular().then(r => r.data || []),
          moviesAPI.newReleases().then(r => r.data || []),
          seriesAPI.popular().then(r => r.data || []),
          seriesAPI.newReleases().then(r => r.data || []),
        ]);
        const [pm, nm, ps, ns] = all.map(r => r.status === 'fulfilled' ? r.value : []);

        const seen = new Set();
        const dedup = arr => arr.filter(it => { if (seen.has(it.id)) return false; seen.add(it.id); return true; });

        if (activeNav === 'home') {
          setFeatured(pm[0] || nm[0] || ps[0] || null);
          setSections([
            { key: 'pm', title: 'Mais Assistidos',  data: dedup(pm) },
            { key: 'ps', title: 'Séries em Alta',   data: dedup(ps) },
            { key: 'nm', title: 'Filmes Novos',     data: dedup(nm) },
            { key: 'ns', title: 'Séries Novas',     data: dedup(ns) },
          ].filter(s => s.data.length > 0));
        } else if (activeNav === 'movies') {
          setFeatured(pm[0] || nm[0] || null);
          setSections([
            { key: 'pm', title: 'Mais Assistidos', data: dedup(pm) },
            { key: 'nm', title: 'Novidades',        data: dedup(nm) },
          ].filter(s => s.data.length > 0));
        } else if (activeNav === 'series') {
          setFeatured(ps[0] || ns[0] || null);
          setSections([
            { key: 'ps', title: 'Mais Assistidas', data: dedup(ps) },
            { key: 'ns', title: 'Novidades',        data: dedup(ns) },
          ].filter(s => s.data.length > 0));
        }
      } catch {}
      finally { setLoading(false); }
    }
    if (activeNav !== 'search') load();
  }, [activeNav]);

  function openDetail(item) {
    const type = item.total_seasons !== undefined ? 'series' : 'movie';
    navigate(`/detail?type=${type}&id=${item.id}`);
  }

  function handleNavSelect(key) {
    if (key === 'logout') {
      logout();
      navigate('/login', { replace: true });
      return;
    }
    setActiveNav(key);
    setTimeout(() => setFocus(key === 'search' ? 'CONTENT' : 'FEATURED'), 80);
  }

  useKeyDown(e => {
    if (e.keyCode === KEY.BACK || e.keyCode === KEY.BACKSPACE) {
      e.preventDefault();
      setFocus('SIDEBAR');
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#141414' }}>
      {/* Sidebar */}
      <Sidebar
        activeNav={activeNav}
        onSelect={handleNavSelect}
        onLogout={() => handleNavSelect('logout')}
        onExpand={() => {}}
        onCollapse={() => {}}
      />

      {/* Main content */}
      <FocusContext.Provider value={contentFocusKey}>
        <div ref={contentAreaRef} style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
          {activeNav === 'search' ? (
            <SearchPanel onSelect={openDetail} />
          ) : loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#E50914', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Carregando…</div>
              </div>
            </div>
          ) : (
            <div
              ref={contentRef}
              style={{ height: '100%', overflowY: 'auto', paddingBottom: 48, scrollbarWidth: 'none' }}
            >
              <FeaturedBanner item={featured} onPlay={openDetail} />
              <div style={{ height: 32 }} />
              {sections.map(sec => (
                <ContentRow
                  key={sec.key}
                  focusKey={`ROW_${sec.key}`}
                  title={sec.title}
                  data={sec.data}
                  onSelect={openDetail}
                />
              ))}
            </div>
          )}
        </div>
      </FocusContext.Provider>
    </div>
  );
}
