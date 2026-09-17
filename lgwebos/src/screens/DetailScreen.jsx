import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { moviesAPI, seriesAPI, watchlistAPI, likesAPI } from '../api/index.js';
import { KEY, useKeyDown } from '../hooks/useNav.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const ACCENT = '#E50914';

const VERSION_META = {
  dubbing:   { label: 'Dublado',   sub: 'Áudio português', icon: '🔊' },
  subtitled: { label: 'Legendado', sub: 'Áudio original',  icon: '💬' },
  cinema:    { label: 'Cinema',    sub: null,              icon: '🎬' },
  '4k':      { label: '4K HDR',    sub: 'Ultra HD',        icon: '💎' },
  color:     { label: 'Colorido',  sub: 'Versão colorida', icon: '🎨' },
  bw:        { label: 'P&B',       sub: 'Preto e branco',  icon: '⚫' },
};

// ── Back button ─────────────────────────────────────────────────────────────
function BackBtn({ onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute', top: 20, left: 20, zIndex: 30,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(0,0,0,0.6)', borderRadius: 30,
        padding: '9px 14px', border: '2px solid transparent', cursor: 'pointer',
        color: '#fff', fontSize: 15, fontWeight: 700,
      }}
    >
      ← Voltar
    </div>
  );
}

// ── Action button (stacked pill, left panel) ────────────────────────────────
function ActionBtn({ label, sublabel, icon, focused, primary, danger, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 10, padding: '10px 16px',
        border: '2px solid ' + (focused ? '#fff' : 'transparent'),
        background: focused
          ? (danger ? '#c0392b' : primary ? '#fff' : 'rgba(255,255,255,0.15)')
          : (danger ? 'rgba(229,9,20,0.15)' : primary ? '#fff' : 'rgba(60,60,60,0.85)'),
        cursor: 'pointer', marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 16, flexShrink: 0,
        // Fundo do botao primario fica branco tanto focado quanto nao -
        // a cor do circulo/texto tem que seguir so o `primary`, nunca o
        // `focused` isolado, senao (focado + primario) virava texto branco
        // em cima de fundo branco = "some" a escrita.
        background: primary ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: primary ? '#000' : '#fff' }}>{label}</div>
        {!!sublabel && (
          <div style={{ fontSize: 12, color: primary ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)', marginTop: 1 }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Season dropdown ──────────────────────────────────────────────────────────
function SeasonDropdown({ seasons, season, focused, open, focIdx }) {
  if (seasons.length <= 1) return null;
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '10px 18px', borderRadius: 8, cursor: 'pointer',
        border: '2px solid ' + (focused ? '#fff' : 'rgba(255,255,255,0.12)'),
        background: focused ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
        fontSize: 15, fontWeight: 800, color: '#fff',
      }}>
        Temporada {season}
        <span style={{ fontSize: 11, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 52, left: 0, zIndex: 50,
          minWidth: 240, background: 'rgba(12,12,14,0.98)',
          borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)',
          padding: '10px 0', boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, padding: '0 18px 8px' }}>
            Temporadas
          </div>
          {seasons.map((sv, si) => (
            <div
              key={sv}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 18px', margin: '0 6px', borderRadius: 8,
                border: '2px solid ' + (focIdx === si ? 'rgba(255,255,255,0.5)' : 'transparent'),
                background: focIdx === si ? 'rgba(255,255,255,0.10)' : 'transparent',
                fontSize: 15, fontWeight: sv === season ? 800 : 500,
                color: sv === season ? '#fff' : 'rgba(255,255,255,0.65)',
              }}
            >
              Temporada {sv}
              {sv === season && <span style={{ color: ACCENT, fontSize: 16 }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Episode item ─────────────────────────────────────────────────────────────
function EpisodeItem({ ep, focused, onClick, epProgress, innerRef }) {
  const hasFile = !!(ep.file_dubbing || ep.file_subtitled || ep.file_cinema || ep.file_color || ep.file_bw);
  const pct = epProgress > 0 ? Math.min(epProgress * 100, 100) : 0;
  return (
    <div
      ref={innerRef}
      onClick={() => hasFile && onClick()}
      style={{
        borderRadius: 10, marginBottom: 4, overflow: 'hidden', position: 'relative',
        border: '2px solid ' + (focused ? 'rgba(255,255,255,0.18)' : 'transparent'),
        background: focused ? 'rgba(255,255,255,0.07)' : 'transparent',
        opacity: hasFile ? 1 : 0.35,
        cursor: hasFile ? 'pointer' : 'default',
      }}
    >
      {focused && <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, background: ACCENT, borderRadius: 2 }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10 }}>
        <div style={{
          width: 200, height: 113, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
          background: '#161616', position: 'relative',
          border: '2px solid ' + (focused ? 'rgba(255,255,255,0.3)' : 'transparent'),
        }}>
          {ep.thumbnail_url
            ? <img src={ep.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a2a2a', fontSize: 28, fontWeight: 900 }}>{ep.episode_number}</div>
          }
          {pct > 0 && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(0,0,0,0.4)' }}>
              <div style={{ height: '100%', width: pct + '%', background: ACCENT }} />
            </div>
          )}
          {focused && hasFile && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>▶</div>
          )}
          {!focused && (
            <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.78)', padding: '2px 5px', borderRadius: 4, fontSize: 11, color: '#ccc', fontWeight: 600 }}>
              {ep.duration ? ep.duration + 'm' : '—'}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#555', fontSize: 11, fontWeight: 700, marginBottom: 3, letterSpacing: 0.5 }}>
            EP {String(ep.episode_number).padStart(2, '0')}
          </div>
          <div style={{
            color: focused ? '#fff' : '#bbb', fontSize: 14, fontWeight: focused ? 800 : 600, marginBottom: 4,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {ep.title || 'Episódio ' + ep.episode_number}
          </div>
          {!!ep.synopsis && (
            <div style={{
              color: '#555', fontSize: 12, lineHeight: 1.4, overflow: 'hidden',
              display: '-webkit-box', WebkitLineClamp: focused ? 3 : 2, WebkitBoxOrient: 'vertical',
            }}>
              {ep.synopsis}
            </div>
          )}
          {!hasFile && <div style={{ color: '#3a3a3a', fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>Não disponível</div>}
        </div>

        <div style={{
          width: 28, height: 28, borderRadius: 14, background: ACCENT, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
          opacity: focused ? 1 : 0,
        }}>▶</div>
      </div>
    </div>
  );
}

export default function DetailScreen() {
  const [params]          = useSearchParams();
  const navigate          = useNavigate();
  const { activeProfile } = useAuth();
  const type = params.get('type') || 'movie';
  const id   = params.get('id');
  const startAt   = params.get('startAt') ? Number(params.get('startAt')) : null;
  const epId      = params.get('epId') || null;
  const seasonNum = params.get('seasonNum') ? Number(params.get('seasonNum')) : null;
  const isSeries  = type === 'series';

  const [detail,    setDetail]    = useState(null);
  const [episodes,  setEpisodes]  = useState([]);
  const [seasons,   setSeasons]   = useState([]);
  const [season,    setSeason]    = useState(seasonNum || 1);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  // Episodios (serie) chegam de um fetch separado do "detail" - sem essa
  // trava, o botao "Assistir" podia renderizar antes de firstEp existir
  // (rotulo/subtitulo incompletos ate os episodios carregarem).
  const [episodesLoaded, setEpisodesLoaded] = useState(false);

  const [wlItem,    setWlItem]    = useState(null);
  const [likeData,  setLikeData]  = useState({ likes: 0, dislikes: 0, userVote: null });

  const [epProgress, setEpProgress] = useState({});
  const [epSeconds, setEpSeconds] = useState({});
  const [movieSeconds, setMovieSeconds] = useState(0);

  const autoPlayedRef = useRef(false);
  // So trava a tela inteira no spinner na PRIMEIRA carga - trocar de
  // temporada depois reseta episodesLoaded, mas nao deve voltar a tela toda
  // pro spinner, so a lista de episodios atualiza quando estiver pronta.
  const shownOnceRef = useRef(false);

  // section: 'actions' | 'seasons' | 'episodes'
  const [section,   setSection]   = useState('actions');
  const [secIdx,    setSecIdx]    = useState(0);

  const epRefs = useRef([]);

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

    const profileId = activeProfile && activeProfile.id;
    watchlistAPI.get(profileId).then(r => {
      const item = (r.data || []).find(i => i.content_id === id);
      setWlItem(item || null);
    }).catch(() => {});

    likesAPI.get(isSeries ? 'series' : 'movie', id).then(r => setLikeData(r.data)).catch(() => {});
  }, [id, isSeries]);

  useEffect(() => {
    if (!id || !isSeries) return;
    setEpisodesLoaded(false);
    seriesAPI.episodes(id, season)
      .then(r => setEpisodes(r.data || []))
      .catch(() => setEpisodes([]))
      .finally(() => setEpisodesLoaded(true));
  }, [id, isSeries, season]);

  useEffect(() => {
    if (!epId || !isSeries || autoPlayedRef.current) return;
    const ep = episodes.find(e => String(e.id) === String(epId));
    if (!ep) return;
    autoPlayedRef.current = true;
    playEpisode(ep, startAt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodes, epId]);

  useEffect(() => {
    if (!id || !isSeries) return;
    const profileId = activeProfile && activeProfile.id;
    if (!profileId) return;
    api.get('/api/history', { params: { profile_id: profileId, limit: 200 } })
      .then(r => {
        const progressMap = {}, secondsMap = {};
        (r.data || []).forEach(h => {
          if (h.episode_id && h.duration > 0) {
            progressMap[h.episode_id] = h.progress / h.duration;
            secondsMap[h.episode_id] = h.progress;
          }
        });
        setEpProgress(progressMap);
        setEpSeconds(secondsMap);
      }).catch(() => {});
  }, [id, isSeries, activeProfile]);

  useEffect(() => {
    if (!id || isSeries) return;
    const profileId = activeProfile && activeProfile.id;
    if (!profileId) return;
    api.get('/api/history', { params: { profile_id: profileId, limit: 50 } })
      .then(r => {
        const h = (r.data || []).find(item =>
          item.content_id === id && !item.episode_id && !item.completed && item.progress > 5
        );
        if (h) setMovieSeconds(h.progress);
      }).catch(() => {});
  }, [id, isSeries, activeProfile]);

  useEffect(() => {
    if (section !== 'episodes') return;
    const el = epRefs.current[secIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [secIdx, section]);

  const versions = isSeries ? [] : ['dubbing','subtitled','cinema','4k','color','bw'].filter(k => detail && detail['file_' + k]);
  const currentEps = episodes.filter(e => e.season_number === season);
  const firstEp = currentEps[0];

  function buildActions() {
    const acts = [];
    if (isSeries) {
      if (firstEp) {
        acts.push({
          id: 'play', label: 'Assistir', primary: true, icon: '▶',
          sublabel: 'T' + firstEp.season_number + ' · EP ' + String(firstEp.episode_number).padStart(2,'0') + (firstEp.title ? ' — ' + firstEp.title : ''),
        });
      }
    } else {
      versions.forEach((vk, i) => {
        const vm = VERSION_META[vk] || {};
        acts.push({ id: 'play_' + vk, label: vm.label || vk, sublabel: vm.sub, icon: vm.icon || '▶', primary: i === 0 });
      });
    }
    acts.push({ id: 'watchlist', label: wlItem ? 'Na Minha Lista' : 'Minha Lista', icon: wlItem ? '✓' : '+' });
    acts.push({ id: 'like',    label: 'Gostei' + (likeData.likes > 0 ? ' · ' + likeData.likes : ''), icon: '👍', active: likeData.userVote === 'like' });
    acts.push({ id: 'dislike', label: 'Não gostei' + (likeData.dislikes > 0 ? ' · ' + likeData.dislikes : ''), icon: '👎', active: likeData.userVote === 'dislike', danger: likeData.userVote === 'dislike' });
    return acts;
  }

  const actions = detail ? buildActions() : [];

  function playMovie(vk, resumeAt) {
    if (!detail) return;
    const url = detail['file_' + vk] || detail.file_dubbing || detail.file_subtitled || detail.file_cinema || detail.file_color || detail.file_bw;
    if (!url) return;
    navigate('/player', { state: {
      url, title: detail.title || detail.name || '',
      tracks: { dubbing: detail.file_dubbing || null, subtitled: detail.file_subtitled || null, cinema: detail.file_cinema || null, color: detail.file_color || null, bw: detail.file_bw || null },
      subtitles: { pt: detail.subtitle_pt || null, en: detail.subtitle_en || null, es: detail.subtitle_es || null },
      contentMeta: { content_type: 'movie', content_id: detail.id },
      ...(resumeAt > 5 ? { startAt: resumeAt } : {}),
    }});
  }

  function playEpisode(ep, resumeAt) {
    const url = ep.file_dubbing || ep.file_subtitled || ep.file_cinema || ep.file_color || ep.file_bw;
    if (!url) return;
    const epLabel = 'T' + ep.season_number + 'E' + String(ep.episode_number).padStart(2, '0');
    navigate('/player', { state: {
      url,
      title: (detail ? (detail.title || detail.name || '') : '') + ' · ' + epLabel + (ep.title ? ' · ' + ep.title : ''),
      tracks: { dubbing: ep.file_dubbing || null, subtitled: ep.file_subtitled || null, cinema: ep.file_cinema || null, color: ep.file_color || null, bw: ep.file_bw || null },
      subtitles: { pt: ep.subtitle_pt || null, en: ep.subtitle_en || null, es: ep.subtitle_es || null },
      skipIntroTo: 90000,
      seriesContext: {
        seriesTitle: detail ? (detail.title || detail.name || '') : '',
        backdropUrl: detail ? (detail.backdrop_url || null) : null,
        episodes: currentEps,
        currentEpId: ep.id,
      },
      contentMeta: {
        content_type: 'episode',
        content_id: ep.id,
        episode_id: ep.id,
        series_id: detail ? detail.id : null,
      },
      ...(resumeAt > 5 ? { startAt: resumeAt } : {}),
    }});
  }

  async function activateAction(act) {
    if (!act) return;
    if (act.id.startsWith('play_')) { playMovie(act.id.replace('play_', ''), startAt || movieSeconds); return; }
    if (act.id === 'play') { if (firstEp) playEpisode(firstEp, startAt || epSeconds[firstEp.id] || 0); return; }
    if (act.id === 'watchlist') {
      const profileId = activeProfile && activeProfile.id;
      try {
        if (wlItem) {
          await watchlistAPI.remove(wlItem.id);
          setWlItem(null);
        } else {
          const r = await watchlistAPI.add(isSeries ? 'series' : 'movie', id, profileId);
          setWlItem(r.data);
        }
      } catch {}
      return;
    }
    if (act.id === 'like' || act.id === 'dislike') {
      try {
        await likesAPI.vote(isSeries ? 'series' : 'movie', id, act.id);
        const r = await likesAPI.get(isSeries ? 'series' : 'movie', id);
        setLikeData(r.data);
      } catch {}
    }
  }

  const st = useRef({});
  st.current = { section, secIdx, seasons, currentEps, actions, isSeries, season, epSeconds, firstEp };

  useKeyDown(e => {
    const { section, secIdx, seasons, currentEps, actions, isSeries, epSeconds } = st.current;
    const k = e.keyCode;
    if (k === KEY.BACK || k === KEY.BACKSPACE) { e.preventDefault(); navigate(-1); return; }

    if (section === 'actions') {
      if (k === KEY.UP)   { e.preventDefault(); setSecIdx(i => Math.max(0, i - 1)); }
      if (k === KEY.DOWN) { e.preventDefault(); setSecIdx(i => Math.min(actions.length - 1, i + 1)); }
      if (k === KEY.RIGHT && isSeries) {
        e.preventDefault();
        if (seasons.length > 1) { setSection('seasons'); setSecIdx(-2); }
        else if (currentEps.length > 0) { setSection('episodes'); setSecIdx(0); }
      }
      if (k === KEY.ENTER) { e.preventDefault(); activateAction(actions[secIdx]); }
      return;
    }

    if (section === 'seasons') {
      // secIdx: -2 = botão fechado, 0+ = item do dropdown aberto
      if (secIdx === -2) {
        if (k === KEY.LEFT)  { e.preventDefault(); setSection('actions'); setSecIdx(0); }
        if (k === KEY.DOWN)  { e.preventDefault(); if (currentEps.length > 0) { setSection('episodes'); setSecIdx(0); } }
        if (k === KEY.ENTER) { e.preventDefault(); setSecIdx(Math.max(0, seasons.indexOf(st.current.season))); }
      } else {
        if (k === KEY.UP) {
          e.preventDefault();
          if (secIdx <= 0) setSecIdx(-2);
          else setSecIdx(i => i - 1);
        }
        if (k === KEY.DOWN)  { e.preventDefault(); setSecIdx(i => Math.min(seasons.length - 1, i + 1)); }
        if (k === KEY.BACK || k === KEY.BACKSPACE) { e.preventDefault(); setSecIdx(-2); return; }
        if (k === KEY.ENTER) {
          e.preventDefault();
          if (secIdx >= 0) { setSeason(seasons[secIdx]); setSecIdx(-2); }
        }
      }
      return;
    }

    if (section === 'episodes') {
      if (k === KEY.LEFT)  { e.preventDefault(); setSection('actions'); setSecIdx(0); }
      if (k === KEY.UP) {
        e.preventDefault();
        if (secIdx > 0) setSecIdx(i => i - 1);
        else if (seasons.length > 1) { setSection('seasons'); setSecIdx(-2); }
      }
      if (k === KEY.DOWN)  { e.preventDefault(); setSecIdx(i => Math.min(currentEps.length - 1, i + 1)); }
      if (k === KEY.ENTER) { e.preventDefault(); if (currentEps[secIdx]) playEpisode(currentEps[secIdx], epSeconds[currentEps[secIdx].id] || 0); }
    }
  });

  // So mostra o conteudo quando TUDO que os botoes de acao dependem ja
  // chegou - detail (titulo/sinopse) e, pra serie, os episodios (o botao
  // "Assistir" precisa do primeiro episodio pra montar rotulo/subtitulo).
  // Sem essa trava, a tela podia renderizar a barra de acoes antes de
  // firstEp existir, com o botao Assistir aparecendo sem texto ate os
  // episodios chegarem. So vale pra PRIMEIRA carga - trocar de temporada
  // depois nao deve travar a tela toda de novo.
  const dataReady = !loading && (!isSeries || episodesLoaded);
  if (dataReady) shownOnceRef.current = true;
  if (!shownOnceRef.current) return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (error || !detail) return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, color: '#fff' }}>
      <div style={{ fontSize: 20 }}>{error || 'Conteúdo não encontrado'}</div>
      <button onClick={() => navigate(-1)} style={{ padding: '12px 28px', background: ACCENT, border: 'none', borderRadius: 30, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Voltar</button>
    </div>
  );

  const title = detail.title || detail.name || '';
  const seasonOpen = section === 'seasons' && secIdx >= 0;
  const seasonFoc  = section === 'seasons';

  return (
    <div style={{ width: '100%', height: '100%', background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* Full-screen backdrop */}
      {detail.backdrop_url
        ? <img src={detail.backdrop_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ position: 'absolute', inset: 0, background: '#0d0d0d' }} />
      }
      {/* Bottom-to-top dark overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.92) 15%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0) 60%)',
      }} />
      {/* Left panel overlay */}
      <div style={{
        position: 'absolute', inset: 0, width: '52%',
        background: 'linear-gradient(to right, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.7) 55%, transparent 100%)',
      }} />

      <BackBtn onClick={() => navigate(-1)} />

      <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
        {/* Left: info */}
        <div style={{
          width: '44%', paddingTop: 68, paddingLeft: 44, paddingRight: 44, paddingBottom: 28,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden',
        }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {!!detail.age_rating && (
                <span style={{ background: ACCENT, borderRadius: 4, padding: '3px 8px', color: '#fff', fontSize: 12, fontWeight: 900 }}>{detail.age_rating}+</span>
              )}
              {isSeries && !!detail.total_seasons && (
                <span style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '3px 10px', color: '#ccc', fontSize: 12, fontWeight: 600 }}>
                  {detail.total_seasons} temporada{detail.total_seasons > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 10, textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>
              {title}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              {!!(detail.year || detail.year_start) && <span style={{ color: '#888', fontSize: 14 }}>{detail.year || detail.year_start}</span>}
              {!!detail.duration && <span style={{ color: '#888', fontSize: 14 }}>{detail.duration} min</span>}
              {detail.rating > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,0.12)', borderRadius: 6, padding: '2px 8px', color: '#f59e0b', fontSize: 14, fontWeight: 700 }}>
                  ★ {Number(detail.rating).toFixed(1)}
                </span>
              )}
            </div>

            {Array.isArray(detail.genres) && detail.genres.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {detail.genres.slice(0, 4).map(g => (
                  <span key={g} style={{ border: '1px solid rgba(255,255,255,0.13)', borderRadius: 16, padding: '3px 10px', color: '#888', fontSize: 12 }}>{g}</span>
                ))}
              </div>
            )}

            {detail.synopsis && (
              <div style={{
                color: '#aaa', fontSize: 15, lineHeight: 1.6, marginBottom: 16,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical',
              }}>
                {detail.synopsis}
              </div>
            )}
          </div>

          <div>
            {actions.map((act, i) => (
              <ActionBtn
                key={act.id}
                label={act.label}
                sublabel={act.sublabel}
                icon={act.icon}
                primary={act.primary}
                danger={act.danger}
                focused={section === 'actions' && secIdx === i}
                onClick={() => activateAction(act)}
              />
            ))}
          </div>
        </div>

        {/* Right: episodes */}
        {isSeries && (
          <div style={{ flex: 1, paddingTop: 20, paddingLeft: 8, paddingRight: 28, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              onClick={() => { setSection('seasons'); setSecIdx(seasonOpen ? -2 : Math.max(0, seasons.indexOf(season))); }}
              style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}
            >
              <SeasonDropdown seasons={seasons} season={season} focused={seasonFoc && secIdx === -2} open={seasonOpen} focIdx={secIdx} />
              <span style={{ color: '#444', fontSize: 13, fontWeight: 600 }}>{currentEps.length} ep.</span>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 8 }} />
            <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', paddingBottom: 40 }}>
              {currentEps.length === 0 && (
                <div style={{ color: '#555', fontSize: 15, marginTop: 20 }}>Nenhum episódio encontrado.</div>
              )}
              {currentEps.map((ep, ei) => (
                <EpisodeItem
                  key={ep.id}
                  innerRef={el => { epRefs.current[ei] = el; }}
                  ep={ep}
                  focused={section === 'episodes' && secIdx === ei}
                  onClick={() => playEpisode(ep, epSeconds[ep.id] || 0)}
                  epProgress={epProgress[ep.id] || 0}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
