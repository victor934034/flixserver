import axios from 'axios';
import { ageFilter } from '../lib/ageGate.js';

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '';
export { BASE_URL };

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// ID do aparelho (anti-abuso do teste grátis). Samsung: DUID real; LG/outros: UUID persistido.
function tvDeviceId() {
  try {
    if (typeof webapis !== 'undefined' && webapis.productinfo && webapis.productinfo.getDuid) {
      const d = webapis.productinfo.getDuid();
      if (d) return 'tizen:' + d;
    }
  } catch {}
  let id = localStorage.getItem('device_install_id');
  if (!id) { id = 'tv-' + String(Math.random()).slice(2) + Date.now(); localStorage.setItem('device_install_id', id); }
  return id;
}

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = 'Bearer ' + token;
    config.headers['X-Platform'] = 'tv';
    config.headers['X-Device-Id'] = tvDeviceId();
  } catch {}
  return config;
});

// Classificação até 14 anos (LG Content Store): filtra toda resposta da API
api.interceptors.response.use((res) => {
  try { res.data = ageFilter(String((res.config && res.config.url) || ''), res.data); } catch (e) {}
  return res;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:       (email, password) => api.post('/api/auth/login', { email, password }),
  me:          ()                => api.get('/api/auth/me'),
  tvCode:      ()                => api.post('/api/auth/tv/code'),
  tvCodeStatus:(code)            => api.get('/api/auth/tv/code/' + code),
};

// ── Movies ────────────────────────────────────────────────────────────────────
export const moviesAPI = {
  list:        (params)  => api.get('/api/movies', { params }),
  search:      (q)       => api.get('/api/movies/search', { params: { q } }),
  get:         (id)      => api.get('/api/movies/' + id),
  popular:     ()        => api.get('/api/movies/section/popular'),
  newReleases: ()        => api.get('/api/movies/section/new'),
  released:    ()        => api.get('/api/movies/section/released'),
};

// ── Series ────────────────────────────────────────────────────────────────────
export const seriesAPI = {
  list:        (params)  => api.get('/api/series', { params }),
  search:      (q)       => api.get('/api/series/search', { params: { q } }),
  get:         (id)      => api.get('/api/series/' + id),
  popular:     ()        => api.get('/api/series/section/popular'),
  newReleases: ()        => api.get('/api/series/section/new'),
  released:    ()        => api.get('/api/series/section/released'),
  episodes:    (id, s)   => api.get('/api/series/' + id + '/episodes', s ? { params: { season: s } } : {}),
};

// ── Watchlist ─────────────────────────────────────────────────────────────────
export const watchlistAPI = {
  get:    (profileId)         => api.get('/api/watchlist', profileId ? { params: { profile_id: profileId } } : {}),
  add:    (type, id, profileId) => api.post('/api/watchlist', { content_type: type, content_id: id, profile_id: profileId || null }),
  remove: (itemId)            => api.delete('/api/watchlist/' + itemId),
};

// ── History ───────────────────────────────────────────────────────────────────
export const historyAPI = {
  get:  (profileId) => api.get('/api/history', profileId ? { params: { profile_id: profileId } } : {}),
  save: (data)      => api.post('/api/history', data),
};

// ── Likes ─────────────────────────────────────────────────────────────────────
export const likesAPI = {
  get:  (type, id)       => api.get('/api/likes/' + type + '/' + id),
  vote: (type, id, vote) => api.post('/api/likes/' + type + '/' + id, { vote }),
};

// ── Cast ──────────────────────────────────────────────────────────────────────
export const castAPI = {
  get:   () => api.get('/api/cast'),
  clear: () => api.delete('/api/cast'),
};

// ── Genres ────────────────────────────────────────────────────────────────────
export const genresAPI = {
  list: () => api.get('/api/genres'),
};

// ── Recommendations ───────────────────────────────────────────────────────────
export const recommendationsAPI = {
  get: (profileId) => api.get('/api/recommendations', profileId ? { params: { profile_id: profileId } } : {}),
};

// ── IPTV ──────────────────────────────────────────────────────────────────────
export const iptvAPI = {
  status:     ()      => api.get('/api/iptv/status'),
  categories: ()      => api.get('/api/iptv/categories'),
  streams:    (catId) => api.get('/api/iptv/streams', { params: { category_id: catId } }),
  streamUrl:  (id)    => api.get('/api/iptv/stream-url/' + id),
};

export default api;
