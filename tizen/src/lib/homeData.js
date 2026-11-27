// Dados do app carregados UMA vez na tela de abertura (splash), para a navegação nunca esperar rede.
import api, { moviesAPI, seriesAPI, recommendationsAPI } from '../api/index.js';
import { mergeReleased, mapRecentEpisodes } from './released.js';

const list = (p) => p.then(r => r.data || []).catch(() => []);

// Parte pública do Início (igual para todo mundo)
export async function fetchHomeBase() {
  const [pm, ps, nm, ns, relM, relS, eps] = await Promise.all([
    list(moviesAPI.popular()), list(seriesAPI.popular()),
    list(moviesAPI.newReleases()), list(seriesAPI.newReleases()),
    list(moviesAPI.released()), list(seriesAPI.released()),
    api.get('/api/episodes/section/recent?limit=20').then(r => mapRecentEpisodes(r.data)).catch(() => []),
  ]);
  const seen = new Set();
  const dedup = arr => arr.filter(it => { if (seen.has(it.id)) return false; seen.add(it.id); return true; }).slice(0, 20);
  return { pm: dedup(pm), ps: dedup(ps), nm: dedup(nm), ns: dedup(ns), rel: mergeReleased(relM, relS), eps };
}

// Parte do perfil: continuar assistindo e recomendações
export async function fetchHomeProfile(profileId, hasUser) {
  const [hist, recs, top10] = await Promise.all([
    hasUser ? list(api.get('/api/history' + (profileId ? '?profile_id=' + profileId : ''))) : Promise.resolve([]),
    list(recommendationsAPI.get(profileId)),
    hasUser ? list(api.get('/api/recommendations/top10')) : Promise.resolve([]),
  ]);
  return { history: hist.filter(h => h.progress > 0 && !h.completed && h.title).slice(0, 12), recs, top10 };
}

export function assembleHome(base, prof) {
  const p = prof || { history: [], recs: [] };
  const sections = [
    { key: 'history', title: 'Continue Assistindo', data: p.history },
    // com menos de 3 a lista não diz nada
    { key: 'top10',   title: 'Top 10 da semana',    data: p.top10 && p.top10.length >= 3 ? p.top10 : [] },
    { key: 'rel',     title: 'Recém lançados',      data: base.rel },
    { key: 'recs',    title: 'Recomendados pra você', data: p.recs },
    { key: 'pm',      title: 'Filmes em Alta',      data: base.pm },
    { key: 'ps',      title: 'Séries em Alta',      data: base.ps },
    { key: 'nm',      title: 'Filmes Novos',        data: base.nm },
    { key: 'ns',      title: 'Séries Novas',        data: base.ns },
    { key: 'eps',     title: 'Episódios adicionados recentemente', data: base.eps },
  ].filter(s => s.data && s.data.length > 0);
  return { featured: base.pm[0] || base.ps[0] || null, sections };
}

// Catálogo completo (Filmes ou Séries): os filtros rodam no aparelho
export async function fetchCatalog(kind) {
  const src = kind === 'movies' ? moviesAPI : seriesAPI;
  const r = await src.list({ limit: 1000, sort: 'created_at', order: 'desc' }).catch(() => null);
  const all = (r && r.data && r.data.data) || [];
  const set = new Set();
  all.forEach(it => (it.genres || []).forEach(g => g && set.add(g)));
  return {
    featured: all[0] || null,
    genres: [...set].sort(),
    sections: all.length ? [{ key: 'all', title: kind === 'movies' ? 'Filmes' : 'Séries', data: all }] : [],
  };
}

const YEAR = new Date().getFullYear();
const yearOf = it => Number(it.year != null ? it.year : it.year_start) || 0;
function matchDate(it, key) {
  if (!key) return true;
  if (key === '30d' || key === '180d') {
    if (!it.release_date) return false;
    const from = new Date(Date.now() - (key === '30d' ? 30 : 180) * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return it.release_date >= from && it.release_date <= today;
  }
  const y = yearOf(it);
  if (key === 'year') return y === YEAR;
  const start = Number(key.slice(0, 4));
  return y >= start && y <= start + 9;
}

export function filterCatalog(items, f) {
  let out = items.filter(it =>
    (!f.genre || (it.genres || []).indexOf(f.genre) >= 0) &&
    matchDate(it, f.date) &&
    (!f.rating || Number(it.rating) >= f.rating));
  const by = (fn) => out.slice().sort(fn);
  if (f.sort === 'az')      out = by((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'pt'));
  else if (f.sort === 'release') out = by((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || '')));
  else if (f.sort === 'oldest')  out = by((a, b) => String(a.release_date || '9999').localeCompare(String(b.release_date || '9999')));
  else if (f.sort === 'rating')  out = by((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  return out; // 'recent' = ordem do servidor (mais recentes adicionados)
}

// Baixa as imagens do topo de cada fileira antes de entrar (sem travar mais que o limite)
const keep = [];
export function preloadImages(urls, timeoutMs = 7000) {
  const list_ = [...new Set(urls.filter(Boolean))];
  if (!list_.length) return Promise.resolve();
  return new Promise(resolve => {
    let left = list_.length;
    const t = setTimeout(resolve, timeoutMs);
    const done = () => { left -= 1; if (left <= 0) { clearTimeout(t); resolve(); } };
    // decode(): a imagem já fica pronta pra pintar (sem piscar/atrasar o banner)
    list_.forEach(u => {
      const im = new Image();
      im.onerror = done;
      im.onload = () => { if (im.decode) im.decode().then(done, done); else done(); };
      im.src = u; keep.push(im);
    });
  });
}
export const posterOf = it => it && (it.poster_url || it.backdrop_url || it.thumbnail_url);
