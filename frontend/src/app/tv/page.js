'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import styles from './tv.module.css';

// ── Inline SVG icons ─────────────────────────────────────────────────────────

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
);
const IconMovies = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M18 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zM8 7l-1.5-2H8.5L10 7H8zm4 0l-1.5-2h2l1.5 2h-2zm4 0l-1.5-2H16l1.5 2H16zM5 9h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9z"/>
  </svg>
);
const IconSeries = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
  </svg>
);
const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M8 5v14l11-7z"/>
  </svg>
);
const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
);

// ── Nav config ───────────────────────────────────────────────────────────────

const NAV = [
  { id: 'home',   label: 'Início',   Icon: IconHome },
  { id: 'movies', label: 'Filmes',   Icon: IconMovies },
  { id: 'series', label: 'Séries',   Icon: IconSeries },
  { id: 'search', label: 'Buscar',   Icon: IconSearch },
];

// ── Focus areas ──────────────────────────────────────────────────────────────

const A = { SIDEBAR: 'sidebar', HERO: 'hero', ROWS: 'rows' };

// ── Component ────────────────────────────────────────────────────────────────

export default function TVPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hero, setHero]       = useState(null);
  const [rows, setRows]       = useState([]);

  // focus state
  const [area,       setArea]       = useState(A.HERO);
  const [navIdx,     setNavIdx]     = useState(0);
  const [heroBtn,    setHeroBtn]    = useState(0); // 0=play, 1=info
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rowIdx,     setRowIdx]     = useState(0);
  const [colIdx,     setColIdx]     = useState(0);

  // refs for scroll-into-view
  const cardRefs = useRef({});
  const rowsEl   = useRef(null);

  // ── Data fetch ─────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      api.get('/featured').then(r => r.data).catch(() => []),
      api.get('/movies/section/new').then(r => r.data).catch(() => []),
      api.get('/series/section/new').then(r => r.data).catch(() => []),
      api.get('/movies/section/popular').then(r => r.data).catch(() => []),
      api.get('/series/section/popular').then(r => r.data).catch(() => []),
    ]).then(([featured, newMovies, newSeries, popMovies, popSeries]) => {
      const arr = (v) => (Array.isArray(v) ? v : (v?.data ?? v?.items ?? []));
      const F  = arr(featured);
      const NM = arr(newMovies);
      const NS = arr(newSeries);
      const PM = arr(popMovies);
      const PS = arr(popSeries);

      // hero: first featured with backdrop, else first item
      const pool = [...F, ...PM, ...PS].filter(x => x.backdrop_url || x.poster_url);
      setHero(pool[0] ?? F[0] ?? null);

      const build = (title, items) => items.length ? { title, items } : null;
      setRows([
        build('Em Destaque',           F),
        build('Novos Filmes',          NM),
        build('Novas Séries',          NS),
        build('Mais Vistos — Filmes',  PM),
        build('Mais Vistos — Séries',  PS),
      ].filter(Boolean));
    }).finally(() => setLoading(false));
  }, []);

  // ── Scroll focused card into view ─────────────────────────────────────────

  useEffect(() => {
    if (area !== A.ROWS) return;
    const el = cardRefs.current[`${rowIdx}-${colIdx}`];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [area, rowIdx, colIdx]);

  // When focus moves into rows, also scroll the rows container
  useEffect(() => {
    if (area !== A.ROWS) return;
    const el = cardRefs.current[`${rowIdx}-${colIdx}`];
    if (el && rowsEl.current) {
      const top = el.closest('[data-row]')?.offsetTop ?? 0;
      rowsEl.current.scrollTo({ top: top - 20, behavior: 'smooth' });
    }
  }, [rowIdx]);

  // ── Keyboard handler ──────────────────────────────────────────────────────

  const handleKey = useCallback((e) => {
    const k = e.key;
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Backspace','Escape'].includes(k)) return;
    e.preventDefault();

    // ── Sidebar ──
    if (area === A.SIDEBAR) {
      if (k === 'ArrowUp')    setNavIdx(i => Math.max(0, i - 1));
      if (k === 'ArrowDown')  setNavIdx(i => Math.min(NAV.length - 1, i + 1));
      if (k === 'ArrowRight') { setSidebarOpen(false); setArea(A.HERO); setHeroBtn(0); }
      if (k === 'Enter') {
        setSidebarOpen(false);
        setArea(A.HERO);
        setHeroBtn(0);
      }
      return;
    }

    // ── Hero ──
    if (area === A.HERO) {
      if (k === 'ArrowLeft') {
        if (heroBtn > 0) { setHeroBtn(b => b - 1); return; }
        setSidebarOpen(true);
        setArea(A.SIDEBAR);
        return;
      }
      if (k === 'ArrowRight') { setHeroBtn(b => Math.min(1, b + 1)); return; }
      if (k === 'ArrowDown')  { setArea(A.ROWS); setRowIdx(0); setColIdx(0); return; }
      if (k === 'Enter') {
        if (heroBtn === 0) playItem(hero);
        else if (hero) {
          const isSeries = hero.total_seasons != null || hero.year_start != null;
          router.push(isSeries ? `/serie/${hero.id}` : `/filme/${hero.id}`);
        }
      }
      return;
    }

    // ── Rows ──
    if (area === A.ROWS) {
      const cur = rows[rowIdx];
      if (!cur) return;

      if (k === 'ArrowLeft') {
        if (colIdx > 0) { setColIdx(c => c - 1); return; }
        setSidebarOpen(true);
        setArea(A.SIDEBAR);
        return;
      }
      if (k === 'ArrowRight') {
        setColIdx(c => Math.min(cur.items.length - 1, c + 1));
        return;
      }
      if (k === 'ArrowUp') {
        if (rowIdx > 0) { setRowIdx(r => r - 1); setColIdx(0); return; }
        setArea(A.HERO);
        setHeroBtn(0);
        return;
      }
      if (k === 'ArrowDown') {
        if (rowIdx < rows.length - 1) { setRowIdx(r => r + 1); setColIdx(0); }
        return;
      }
      if (k === 'Enter') {
        playItem(cur.items[colIdx]);
      }
      if (k === 'Backspace' || k === 'Escape') {
        setArea(A.HERO);
        setHeroBtn(0);
      }
    }
  }, [area, navIdx, heroBtn, rowIdx, colIdx, rows, hero, router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // ── Play helper ───────────────────────────────────────────────────────────

  const playItem = (item) => {
    if (!item) return;
    const isSeries = item.total_seasons != null || item.year_start != null;
    router.push(isSeries ? `/serie/${item.id}` : `/filme/${item.id}`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Carregando…</p>
      </div>
    );
  }

  const heroImg = hero?.backdrop_url || hero?.poster_url;
  const isSeries = hero && (hero.total_seasons != null || hero.year_start != null);

  return (
    <div className={styles.app}>

      {/* ── Sidebar ── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>F</div>
          <span className={styles.logoText}>Flixhome</span>
        </div>

        {NAV.map(({ id, label, Icon }, i) => (
          <div
            key={id}
            className={`${styles.navItem} ${area === A.SIDEBAR && navIdx === i ? styles.navItemFocused : ''}`}
            onClick={() => { setSidebarOpen(false); setArea(A.HERO); }}
          >
            <span className={styles.navIcon}><Icon /></span>
            <span className={styles.navLabel}>{label}</span>
          </div>
        ))}
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>

        {/* Hero */}
        <section
          className={`${styles.hero} ${area === A.ROWS ? styles.heroCollapsed : ''}`}
          style={heroImg ? { backgroundImage: `url(${heroImg})` } : undefined}
        >
          <div className={styles.heroGradient} />
          {hero && (
            <div className={styles.heroContent}>
              <div className={styles.heroMeta}>
                <span className={styles.heroBadge}>N</span>
                <span className={styles.heroCategory}>{isSeries ? 'SÉRIE' : 'FILME'}</span>
              </div>

              <h1 className={styles.heroTitle}>{hero.title}</h1>

              <div className={styles.heroInfo}>
                {(hero.year || hero.year_start) && (
                  <span>{hero.year || hero.year_start}</span>
                )}
                {hero.total_seasons && (
                  <span>{hero.total_seasons} temporada{hero.total_seasons !== 1 ? 's' : ''}</span>
                )}
                {hero.rating > 0 && (
                  <span>★ {Number(hero.rating).toFixed(1)}</span>
                )}
              </div>

              {hero.synopsis && (
                <p className={styles.heroSynopsis}>{hero.synopsis}</p>
              )}

              <div className={styles.heroBtns}>
                <button
                  className={`${styles.btnPlay} ${area === A.HERO && heroBtn === 0 ? styles.btnFocused : ''}`}
                  onClick={() => playItem(hero)}
                >
                  <IconPlay /> Assistir
                </button>
                <button
                  className={`${styles.btnInfo} ${area === A.HERO && heroBtn === 1 ? styles.btnFocused : ''}`}
                  onClick={() => router.push(isSeries ? `/serie/${hero.id}` : `/filme/${hero.id}`)}
                >
                  <IconInfo /> Mais info
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Content rows */}
        <div className={styles.rows} ref={rowsEl}>
          {rows.map((row, ri) => (
            <div
              key={ri}
              data-row={ri}
              className={`${styles.row} ${area === A.ROWS && rowIdx === ri ? styles.rowFocused : ''}`}
            >
              <h2 className={styles.rowTitle}>{row.title}</h2>
              <div className={styles.rowCards}>
                {row.items.map((item, ci) => {
                  const focused = area === A.ROWS && rowIdx === ri && colIdx === ci;
                  return (
                    <div
                      key={item.id}
                      ref={el => { cardRefs.current[`${ri}-${ci}`] = el; }}
                      className={`${styles.card} ${focused ? styles.cardFocused : ''}`}
                      onClick={() => {
                        setArea(A.ROWS); setRowIdx(ri); setColIdx(ci);
                        playItem(item);
                      }}
                    >
                      <div className={styles.cardInner}>
                        {(item.backdrop_url || item.poster_url) ? (
                          <img
                            src={item.backdrop_url || item.poster_url}
                            alt={item.title}
                            className={styles.cardImg}
                            draggable={false}
                          />
                        ) : (
                          <div className={styles.cardPlaceholder}>
                            {item.title?.slice(0, 20)}
                          </div>
                        )}
                        <span className={styles.cardNetflixN}>N</span>
                      </div>
                      {focused && (
                        <div className={styles.cardTooltip}>{item.title}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Navigation hint */}
      <div className={styles.hint}>
        <span>↑↓←→ navegar</span>
        <span>⏎ abrir</span>
        <span>← sidebar</span>
      </div>
    </div>
  );
}
