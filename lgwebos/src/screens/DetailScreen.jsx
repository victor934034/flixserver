import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFocusable, FocusContext, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { moviesAPI, seriesAPI } from '../api/index.js';
import FocusItem from '../components/FocusItem.jsx';
import { KEY, useKeyDown } from '../hooks/useNav.js';

const TRACK_META = {
  dubbing:   { label: 'Dublado',   sub: 'Áudio em português' },
  subtitled: { label: 'Legendado', sub: 'Áudio original' },
  cinema:    { label: 'Cinema',    sub: 'Sem legenda' },
};

// ─── Episode item ──────────────────────────────────────────────────────────────
function EpisodeItem({ ep, seriesTitle, backdropUrl, episodes, onPlay }) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onPlay(ep, episodes),
    onFocus: ({ node }) => node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
  });

  const url = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
  if (!url) return null;

  const label = `EP ${String(ep.episode_number).padStart(2, '0')}`;

  return (
    <div
      ref={ref}
      onClick={() => onPlay(ep, episodes)}
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16,
        padding: '14px 20px', borderRadius: 12, marginBottom: 8,
        background: focused ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)',
        border: focused ? '2px solid #fff' : '2px solid transparent',
        cursor: 'none', transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Thumbnail */}
      <div style={{ width: 140, height: 78, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#1a1a1a' }}>
        {ep.thumbnail_url && <img src={ep.thumbnail_url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: '#E50914', fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 15, color: focused ? '#fff' : '#ccc', fontWeight: 700, marginBottom: 4 }}>
          {ep.title || label}
        </div>
        {ep.synopsis && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {ep.synopsis}
          </div>
        )}
      </div>
      {/* Duration */}
      {ep.duration && (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{ep.duration} min</div>
      )}
    </div>
  );
}

// ─── DetailScreen ─────────────────────────────────────────────────────────────
export default function DetailScreen() {
  const [params]    = useSearchParams();
  const navigate    = useNavigate();
  const type        = params.get('type') || 'movie';
  const id          = params.get('id');

  const [detail,   setDetail]   = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [seasons,  setSeasons]  = useState([]);
  const [season,   setSeason]   = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const { ref: actionsRef, focusKey: actionsFocusKey } = useFocusable({ focusKey: 'ACTIONS', trackChildren: true });

  const isSeries = type === 'series';

  // Load detail
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const api = isSeries ? seriesAPI.get(id) : moviesAPI.get(id);
    api.then(r => {
      setDetail(r.data);
      if (isSeries) {
        const n = r.data.total_seasons || 1;
        setSeasons(Array.from({ length: n }, (_, i) => i + 1));
      }
    }).catch(() => setError('Erro ao carregar')).finally(() => setLoading(false));
  }, [id, isSeries]);

  // Load episodes for current season
  useEffect(() => {
    if (!id || !isSeries) return;
    seriesAPI.episodes(id, season).then(r => setEpisodes(r.data || [])).catch(() => setEpisodes([]));
  }, [id, isSeries, season]);

  // Auto-focus actions after load
  useEffect(() => {
    if (!loading && detail) setTimeout(() => setFocus('ACTIONS'), 100);
  }, [loading, detail]);

  // Back button
  useKeyDown(e => {
    if (e.keyCode === KEY.BACK || e.keyCode === KEY.BACKSPACE) {
      e.preventDefault(); navigate(-1);
    }
  }, []);

  function buildPlayerState(url, extraTracks = {}, extraSubs = {}, epList = null, currentEpId = null) {
    return {
      url,
      title: detail?.title || detail?.name || '',
      tracks: {
        dubbing:   detail?.file_dubbing   || extraTracks.dubbing   || null,
        subtitled: detail?.file_subtitled || extraTracks.subtitled || null,
        cinema:    detail?.file_cinema    || extraTracks.cinema    || null,
      },
      subtitles: {
        pt: detail?.subtitle_pt || extraSubs.pt || null,
        en: detail?.subtitle_en || extraSubs.en || null,
        es: detail?.subtitle_es || extraSubs.es || null,
      },
      skipIntroTo: isSeries ? 90_000 : null,
      seriesContext: epList ? {
        seriesTitle: detail?.title || detail?.name || '',
        backdropUrl: detail?.backdrop_url || null,
        episodes: epList,
        currentEpId,
      } : null,
    };
  }

  function playMovie(versionKey) {
    if (!detail) return;
    const url = detail[`file_${versionKey}`] || detail.file_dubbing || detail.file_subtitled || detail.file_cinema;
    if (!url) return;
    navigate('/player', { state: buildPlayerState(url) });
  }

  function playEpisode(ep, epList) {
    const url = ep.file_dubbing || ep.file_subtitled || ep.file_cinema;
    if (!url) return;
    const epLabel = `T${ep.season_number}E${String(ep.episode_number).padStart(2, '0')}`;
    const state = {
      ...buildPlayerState(url, {
        dubbing:   ep.file_dubbing   || null,
        subtitled: ep.file_subtitled || null,
        cinema:    ep.file_cinema    || null,
      }, {
        pt: ep.subtitle_pt || null,
        en: ep.subtitle_en || null,
        es: ep.subtitle_es || null,
      }, epList, ep.id),
      title: `${detail?.title || detail?.name} · ${epLabel}${ep.title ? ` · ${ep.title}` : ''}`,
      poster: ep.thumbnail_url || detail?.backdrop_url,
    };
    navigate('/player', { state });
  }

  if (loading) return (
    <div style={{ width: '100%', height: '100%', background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#E50914', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !detail) return (
    <div style={{ width: '100%', height: '100%', background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, marginBottom: 16 }}>{error || 'Conteúdo não encontrado'}</div>
        <FocusItem onEnterPress={() => navigate(-1)} style={{ display: 'inline-flex', padding: '12px 28px', background: '#E50914', borderRadius: 30, cursor: 'none', border: '2px solid transparent' }} focusedStyle={{ borderColor: '#fff' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Voltar</span>
        </FocusItem>
      </div>
    </div>
  );

  const backdrop = detail.backdrop_url || detail.poster_url;
  const title    = detail.title || detail.name || '';
  const year     = detail.year || detail.year_start;
  const movieVersions = isSeries ? [] : ['dubbing', 'subtitled', 'cinema', '4k'].filter(k => !!detail[`file_${k}`]);
  const currentEps   = episodes.filter(e => e.season_number === season);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0d0d0d', display: 'flex', flexDirection: 'column' }}>
      {/* Back button */}
      <div style={{ position: 'absolute', top: 24, left: 36, zIndex: 10 }}>
        <FocusItem
          onEnterPress={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,0,0,0.55)', borderRadius: 30,
            padding: '8px 20px', border: '2px solid rgba(255,255,255,0.12)', cursor: 'none',
          }}
          focusedStyle={{ borderColor: '#fff', background: 'rgba(255,255,255,0.1)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Voltar</span>
        </FocusItem>
      </div>

      {/* Top section: backdrop + info */}
      <div style={{ position: 'relative', height: 440, flexShrink: 0 }}>
        {backdrop && (
          <>
            <img src={backdrop} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 55%, transparent 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0d0d0d 0%, transparent 50%)' }} />
          </>
        )}
        <div style={{ position: 'absolute', bottom: 40, left: 60, maxWidth: 580 }}>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 10, textShadow: '0 2px 16px rgba(0,0,0,0.8)' }}>
            {title}
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            {year   && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{year}</span>}
            {detail.rating && <span style={{ fontSize: 13, color: '#f5c518', fontWeight: 700 }}>★ {Number(detail.rating).toFixed(1)}</span>}
            {detail.age_rating && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 4, padding: '1px 5px' }}>{detail.age_rating}</span>}
          </div>
          {detail.synopsis && (
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', marginBottom: 22 }}>
              {detail.synopsis}
            </div>
          )}

          {/* Action buttons */}
          <FocusContext.Provider value={actionsFocusKey}>
            <div ref={actionsRef} style={{ display: 'flex', flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              {isSeries ? (
                <FocusItem
                  focusKey="PLAY_SERIES"
                  onEnterPress={() => currentEps.length > 0 && playEpisode(currentEps[0], currentEps)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', background: '#E50914', borderRadius: 30, cursor: 'none', border: '2px solid transparent' }}
                  focusedStyle={{ borderColor: '#fff', transform: 'scale(1.04)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                    {currentEps[0] ? `Assistir T${currentEps[0].season_number} EP 01` : 'Assistir'}
                  </span>
                </FocusItem>
              ) : (
                movieVersions.map(vk => (
                  <FocusItem
                    key={vk}
                    onEnterPress={() => playMovie(vk)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 24px', background: vk === 'dubbing' ? '#E50914' : 'rgba(255,255,255,0.12)', borderRadius: 30, cursor: 'none', border: '2px solid transparent' }}
                    focusedStyle={{ borderColor: '#fff', transform: 'scale(1.04)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{TRACK_META[vk]?.label || vk.toUpperCase()}</span>
                  </FocusItem>
                ))
              )}
            </div>
          </FocusContext.Provider>
        </div>
      </div>

      {/* Bottom: season selector + episode list */}
      {isSeries && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 60px 40px' }}>
          {/* Season selector */}
          {seasons.length > 1 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              {seasons.map(s => (
                <FocusItem
                  key={s}
                  onEnterPress={() => setSeason(s)}
                  style={{
                    padding: '8px 20px', borderRadius: 20, cursor: 'none',
                    background: s === season ? '#E50914' : 'rgba(255,255,255,0.08)',
                    border: '2px solid transparent', fontSize: 14, fontWeight: 700, color: '#fff',
                  }}
                  focusedStyle={{ borderColor: '#fff', transform: 'scale(1.05)' }}
                >
                  Temporada {s}
                </FocusItem>
              ))}
            </div>
          )}

          {/* Episodes */}
          {currentEps.map(ep => (
            <EpisodeItem
              key={ep.id}
              ep={ep}
              seriesTitle={title}
              backdropUrl={detail.backdrop_url}
              episodes={currentEps}
              onPlay={playEpisode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
