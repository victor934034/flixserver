import axios from 'axios';

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = 'Bearer ' + token;
  } catch {}
  return config;
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
};

// ── Series ────────────────────────────────────────────────────────────────────
export const seriesAPI = {
  list:        (params)  => api.get('/api/series', { params }),
  search:      (q)       => api.get('/api/series/search', { params: { q } }),
  get:         (id)      => api.get('/api/series/' + id),
  popular:     ()        => api.get('/api/series/section/popular'),
  newReleases: ()        => api.get('/api/series/section/new'),
  episodes:    (id, s)   => api.get('/api/series/' + id + '/episodes', s ? { params: { season: s } } : {}),
};

// ── Watchlist ─────────────────────────────────────────────────────────────────
export const watchlistAPI = {
  get:    ()                  => api.get('/api/watchlist'),
  add:    (type, id)          => api.post('/api/watchlist', { content_type: type, content_id: id }),
  remove: (itemId)            => api.delete('/api/watchlist/' + itemId),
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

// ── IPTV ──────────────────────────────────────────────────────────────────────
export const iptvAPI = {
  status:     ()      => api.get('/api/iptv/status'),
  categories: ()      => api.get('/api/iptv/categories'),
  streams:    (catId) => api.get('/api/iptv/streams', { params: { category_id: catId } }),
  streamUrl:  (id)    => api.get('/api/iptv/stream-url/' + id),
};

export default api;
