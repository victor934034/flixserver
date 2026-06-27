import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { moviesAPI, seriesAPI, watchlistAPI, likesAPI } from '../api/index.js';
import { KEY, useKeyDown } from '../hooks/useNav.js';

const VERSION_META = {
  dubbing:   { label: 'Dublado',   color: '#E50914' },
  subtitled: { label: 'Legendado', color: '#1a73e8' },
  cinema:    { label: 'Original',  color: '#555' },
  '4k':      { label: '4K',        color: '#f59e0b' },
};

// focusSection: 'back' | 'actions' | 'seasons' | 'episodes' | 'like'
// focusIdx within each section

function Btn({ focused, danger, accent, children, onClick, style = {} }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '12px 24px', borderRadius: 30, cursor: 'none',
        background: focused
          ? (danger ? '#c0392b' : accent ? '#fff' : 'rgba(255,255,255,0.22)')
          : (accent ? '#E50914' : danger ? 'rgba(229,9,20,0.15)' : 'rgba(255,255,255,0.10)'),
        border: '2px solid ' + (focused ? '#fff' : 'transparent'),
        transform: focused ? 'scale(1.05)' : 'scale(1)',
        transition: 'all 0.15s ease',
        color: focused && accent ? '#000' : '#fff',
        fontWeight: 700, fontSize: 15,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function EpisodeItem({ ep, focused, onClick }) {
  const url = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
  if (!url) return null;
  const label = 'EP ' + String(ep.episode_number).padStart(2, '0');
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16,
        padding: '14px 20px', borderRadius: 12, marginBottom: 8,
        background: focused ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)',
        border: '2px solid ' + (focused ? '#fff' : 'transparent'),
        cursor: 'none', transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ width: 140, height: 78, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#1a1a1a' }}>
        {ep.thumbnail_url && <img src={ep.thumbnail_url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#E50914', fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 15, color: focused ? '#fff' : '#ccc', fontWeight: 700, marginBottom: 4 }}>{ep.title || label}</div>
        {ep.synopsis && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {ep.synopsis}
          </div>
        )}
      </div>
      {ep.duration && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{ep.duration} min</div>}
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
        {value}
      </div>
    </div>
  );
}

function SubtitleBadge({ label }) {
  return (
    <span style={{
      padding: '6px 18px', borderRadius: 20,
      background: 'rgba(255,255,255,0.06)',
      border: '1.5px solid rgba(255,255,255,0.2)',
      fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
    }}>
      {label}
    </span>
  );
}

export default function DetailScreen() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const type = params.get('type') || 'movie';
  const id   = params.get('id');
  const isSeries = type === 'series';

  const [detail,    setDetail]    = useState(null);
  const [episodes,  setEpisodes]  = useState([]);
  const [seasons,   setSeasons]   = useState([]);
  const [season,    setSeason]    = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Watchlist
  const [wlItem,    setWlItem]    = useState(null);
  const [wlLoading, setWlLoading] = useState(false);

  // Likes
  const [likeData,  setLikeData]  = useState({ likes: 0, dislikes: 0, userVote: null });

  // Focus
  // sections: 'back'(0) | 'actions'(1) | 'seasons'(2) | 'episodes'(3)
  // Within 'actions': back btn(0), play/version btns, watchlist, like, dislike
  const [section,   setSection]   = useState('actions');
  const [secIdx,    setSecIdx]    = useState(0);

  const epScrollRef = useRef(null);
  const epRefs      = useRef([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const req = isSeries ? seriesAPI.get(id) : moviesAPI.get(id);
    req.then(r => {
      setDetail(r.data);
      if (isSeries) {
        const n = r.data.total_seasons || 1;
        setSeasons(Array.from({ length: n }, (_, i) => i + 1));
      }
    }).catch(() => setError('Erro ao carregar')).finally(() => setLoading(false));

    // Load watchlist
    watchlistAPI.get().then(r => {
      const item = (r.data || []).find(i => i.content_id === id);
      setWlItem(item || null);
    }).catch(() => {});

    // Load likes
    likesAPI.get(isSeries ? 'series' : 'movie', id).then(r => setLikeData(r.data)).catch(() => {});
  }, [id, isSeries]);

  useEffect(() => {
    if (!id || !isSeries) return;
    seriesAPI.episodes(id, season).then(r => setEpisodes(r.data || [])).catch(() => setEpisodes([]));
  }, [id, isSeries, season]);

  // Scroll focused episode into view
  useEffect(() => {
    if (section !== 'episodes') return;
    const el = epRefs.current[secIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [secIdx, section]);

  const versions = isSeries ? [] : ['dubbing','subtitled','cinema','4k'].filter(k => detail && detail['file_' + k]);
  const currentEps = episodes.filter(e => e.season_number === season);

  // Actions row items: [play/versions..., watchlist, like, dislike]
  function buildActions() {
    const acts = [];
    if (isSeries) {
      acts.push({ id: 'play', label: '▶ ' + (currentEps[0] ? 'T' + currentEps[0].season_number + ' EP01' : 'Assistir') });
    } else {
      versions.forEach(vk => acts.push({ id: 'play_' + vk, label: '▶ ' + (VERSION_META[vk] ? VERSION_META[vk].label : vk) }));
    }
    acts.push({ id: 'watchlist', label: wlItem ? '♥ Minha lista' : '♡ Minha lista' });
    acts.push({ id: 'like',    label: '👍 ' + (likeData.likes > 0 ? likeData.likes : 'Gostei') });
    acts.push({ id: 'dislike', label: '👎 ' + (likeData.dislikes > 0 ? likeData.dislikes : 'Não gostei') });
    return acts;
  }

  const actions = detail ? buildActions() : [];

  function playMovie(vk) {
    if (!detail) return;
    const url = detail['file_' + vk] || detail.file_dubbing || detail.file_subtitled || detail.file_cinema;
    if (!url) return;
    navigate('/player', { state: {
      url, title: detail.title || detail.name || '',
      tracks: { dubbing: detail.file_dubbing || null, subtitled: detail.file_subtitled || null, cinema: detail.file_cinema || null },
      subtitles: { pt: detail.subtitle_pt || null, en: detail.subtitle_en || null, es: detail.subtitle_es || null },
    }});
  }

  function playEpisode(ep) {
    const url = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
    if (!url) return;
    const epLabel = 'T' + ep.season_number + 'E' + String(ep.episode_number).padStart(2, '0');
    navigate('/player', { state: {
      url,
      title: (detail ? (detail.title || detail.name || '') : '') + ' · ' + epLabel + (ep.title ? ' · ' + ep.title : ''),
      tracks: { dubbing: ep.file_dubbing || null, subtitled: ep.file_subtitled || null, cinema: ep.file_cinema || null },
      subtitles: { pt: ep.subtitle_pt || null, en: ep.subtitle_en || null, es: ep.subtitle_es || null },
      skipIntroTo: 90000,
      seriesContext: {
        seriesTitle: detail ? (detail.title || detail.name || '') : '',
        backdropUrl: detail ? (detail.backdrop_url || null) : null,
        episodes: currentEps,
        currentEpId: ep.id,
      },
    }});
  }

  async function activateAction(act) {
    if (!act) return;
    if (act.id.startsWith('play_')) { playMovie(act.id.replace('play_', '')); return; }
    if (act.id === 'play') { if (currentEps[0]) playEpisode(currentEps[0]); return; }
    if (act.id === 'watchlist') {
      setWlLoading(true);
      try {
        if (wlItem) {
          await watchlistAPI.remove(wlItem.id);
          setWlItem(null);
        } else {
          const r = await watchlistAPI.add(isSeries ? 'series' : 'movie', id);
          setWlItem(r.data);
        }
      } catch {} finally { setWlLoading(false); }
      return;
    }
    if (act.id === 'like' || act.id === 'dislike') {
      const vote = act.id;
      try {
        await likesAPI.vote(isSeries ? 'series' : 'movie', id, vote);
        const r = await likesAPI.get(isSeries ? 'series' : 'movie', id);
        setLikeData(r.data);
      } catch {}
    }
  }

  // Keep mutable snapshot to avoid stale closures in key handler
  const st = useRef({});
  st.current = { section, secIdx, seasons, currentEps, actions, isSeries, season };

  useKeyDown(e => {
    const { section, secIdx, seasons, currentEps, actions, isSeries, season } = st.current;
    const k = e.keyCode;
    if (k === KEY.BACK || k === KEY.BACKSPACE) { e.preventDefault(); navigate(-1); return; }

    if (section === 'actions') {
      if (k === KEY.LEFT)  { e.preventDefault(); setSecIdx(i => Math.max(0, i - 1)); }
      if (k === KEY.RIGHT) { e.preventDefault(); setSecIdx(i => Math.min(actions.length - 1, i + 1)); }
      if (k === KEY.DOWN)  {
        e.preventDefault();
        if (isSeries && seasons.length > 1) { setSection('seasons'); setSecIdx(season - 1); }
        else if (isSeries && currentEps.length > 0) { setSection('episodes'); setSecIdx(0); }
      }
      if (k === KEY.ENTER) { e.preventDefault(); activateAction(actions[secIdx]); }
      return;
    }

    if (section === 'seasons') {
      if (k === KEY.LEFT)  { e.preventDefault(); setSecIdx(i => Math.max(0, i - 1)); }
      if (k === KEY.RIGHT) { e.preventDefault(); setSecIdx(i => Math.min(seasons.length - 1, i + 1)); }
      if (k === KEY.UP)    { e.preventDefault(); setSection('actions'); setSecIdx(0); }
      if (k === KEY.DOWN)  { e.preventDefault(); if (currentEps.length > 0) { setSection('episodes'); setSecIdx(0); } }
      if (k === KEY.ENTER) { e.preventDefault(); setSeason(seasons[secIdx]); }
      return;
    }

    if (section === 'episodes') {
      if (k === KEY.UP) {
        e.preventDefault();
        if (secIdx > 0) setSecIdx(i => i - 1);
        else if (seasons.length > 1) { setSection('seasons'); setSecIdx(season - 1); }
        else { setSection('actions'); setSecIdx(0); }
      }
      if (k === KEY.DOWN)  { e.preventDefault(); setSecIdx(i => Math.min(currentEps.length - 1, i + 1)); }
      if (k === KEY.ENTER) { e.preventDefault(); if (currentEps[secIdx]) playEpisode(currentEps[secIdx]); }
    }
  });

  if (loading) return (
    <div style={{ width: '100%', height: '100%', background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#E50914', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (error || !detail) return (
    <div style={{ width: '100%', height: '100%', background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, color: '#fff' }}>
      <div style={{ fontSize: 20 }}>{error || 'Conteúdo não encontrado'}</div>
      <button onClick={() => navigate(-1)} style={{ padding: '12px 28px', background: '#E50914', border: 'none', borderRadius: 30, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Voltar</button>
    </div>
  );

  const backdrop = detail.backdrop_url || detail.poster_url;
  const title    = detail.title || detail.name || '';
  const year     = detail.year || detail.year_start;

  return (
    <div style={{ width: '100%', height: '100%', background: '#0d0d0d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Back */}
      <div style={{ position: 'absolute', top: 24, left: 36, zIndex: 10 }}>
        <div
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,0,0,0.6)', borderRadius: 30,
            padding: '8px 20px', border: '2px solid rgba(255,255,255,0.12)', cursor: 'none',
          }}
        >
          <span style={{ color: '#fff', fontSize: 14 }}>← Voltar</span>
        </div>
      </div>

      {/* Top — backdrop + info */}
      <div style={{ position: 'relative', height: isSeries ? 400 : 440, flexShrink: 0 }}>
        {backdrop && (
          <>
            <img src={backdrop} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 55%, transparent 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0d0d0d 0%, transparent 45%)' }} />
          </>
        )}
        <div style={{ position: 'absolute', bottom: 36, left: 60, maxWidth: 620 }}>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 10, textShadow: '0 2px 16px rgba(0,0,0,0.8)' }}>
            {title}
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {year     && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{year}</span>}
            {detail.rating > 0 && <span style={{ fontSize: 13, color: '#f5c518', fontWeight: 700 }}>★ {Number(detail.rating).toFixed(1)}</span>}
            {detail.age_rating && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 4, padding: '1px 5px' }}>{detail.age_rating}</span>}
            {isSeries && detail.total_seasons && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{detail.total_seasons} temporada{detail.total_seasons > 1 ? 's' : ''}</span>}
          </div>
          {detail.synopsis && (
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 20 }}>
              {detail.synopsis}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {actions.map((act, i) => {
              const isFoc = section === 'actions' && secIdx === i;
              const isWl  = act.id === 'watchlist';
              const isLike = act.id === 'like';
              const isDislike = act.id === 'dislike';
              const isPlay = act.id === 'play' || act.id.startsWith('play_');
              return (
                <Btn
                  key={act.id}
                  focused={isFoc}
                  accent={isPlay}
                  danger={isDislike && likeData.userVote === 'dislike'}
                  onClick={() => activateAction(act)}
                  style={
                    isLike && likeData.userVote === 'like' ? { background: isFoc ? '#2ecc71' : 'rgba(46,204,113,0.2)', border: '2px solid ' + (isFoc ? '#fff' : '#2ecc71') } :
                    isDislike && likeData.userVote === 'dislike' ? { background: isFoc ? '#E50914' : 'rgba(229,9,20,0.2)', border: '2px solid ' + (isFoc ? '#fff' : '#E50914') } :
                    isWl && wlItem ? { background: isFoc ? '#fff' : 'rgba(229,9,20,0.2)', border: '2px solid ' + (isFoc ? '#fff' : '#E50914'), color: isFoc ? '#000' : '#E50914' } : {}
                  }
                >
                  {act.label}
                </Btn>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom — episodes (series) */}
      {isSeries && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 60px 40px', scrollbarWidth: 'none' }} ref={epScrollRef}>
          {seasons.length > 1 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {seasons.map((s, si) => {
                const isFoc = section === 'seasons' && secIdx === si;
                return (
                  <div
                    key={s}
                    onClick={() => setSeason(s)}
                    style={{
                      padding: '8px 22px', borderRadius: 20, cursor: 'none',
                      background: s === season ? '#E50914' : 'rgba(255,255,255,0.08)',
                      border: '2px solid ' + (isFoc ? '#fff' : 'transparent'),
                      fontSize: 14, fontWeight: 700, color: '#fff',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    Temporada {s}
                  </div>
                );
              })}
            </div>
          )}
          {currentEps.length === 0 && (
            <div style={{ color: '#555', fontSize: 15, marginTop: 20 }}>Nenhum episódio encontrado.</div>
          )}
          {currentEps.map((ep, ei) => (
            <div key={ep.id} ref={el => { epRefs.current[ei] = el; }}>
              <EpisodeItem
                ep={ep}
                focused={section === 'episodes' && secIdx === ei}
                onClick={() => playEpisode(ep)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Bottom — movie info panel */}
      {!isSeries && detail && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 60px 48px', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Genres */}
          {detail.genres && detail.genres.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {detail.genres.map(g => (
                <span key={g} style={{
                  padding: '6px 16px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
                }}>
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Details grid */}
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            {detail.year && <InfoCell label="Ano" value={detail.year} />}
            {detail.duration && <InfoCell label="Duração" value={detail.duration + ' min'} />}
            {detail.director && <InfoCell label="Direção" value={detail.director} />}
            {detail.country && <InfoCell label="País" value={detail.country} />}
            {detail.language && <InfoCell label="Idioma" value={detail.language} />}
            {detail.studio && <InfoCell label="Estúdio" value={detail.studio} />}
          </div>

          {/* Available versions */}
          {versions.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
                Disponível em
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {versions.map(vk => {
                  const vm = VERSION_META[vk];
                  return (
                    <span key={vk} style={{
                      padding: '6px 18px', borderRadius: 20,
                      background: (vm ? vm.color : '#444') + '22',
                      border: '1.5px solid ' + (vm ? vm.color : '#444'),
                      fontSize: 13, fontWeight: 700,
                      color: vm ? vm.color : '#fff',
                    }}>
                      {vm ? vm.label : vk}
                    </span>
                  );
                })}
                {detail.subtitle_pt && <SubtitleBadge label="Legenda PT" />}
                {detail.subtitle_en && <SubtitleBadge label="Legenda EN" />}
                {detail.subtitle_es && <SubtitleBadge label="Legenda ES" />}
              </div>
            </div>
          )}

          {/* Synopsis full */}
          {detail.synopsis && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 10 }}>
                Sinopse
              </div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, maxWidth: 860 }}>
                {detail.synopsis}
              </div>
            </div>
          )}

          {/* Cast */}
          {detail.cast && detail.cast.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
                Elenco
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                {(Array.isArray(detail.cast) ? detail.cast.join(', ') : detail.cast)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
