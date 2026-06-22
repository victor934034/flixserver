import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  tvCode: () => api.post('/auth/tv/code'),
  tvCodeStatus: (code) => api.get(`/auth/tv/code/${code}`),
};

// ── Movies ────────────────────────────────────────────────────────────────────
export const moviesAPI = {
  list: (params = {}) => api.get('/movies', { params }),
  search: (q) => api.get('/movies/search', { params: { q } }),
  get: (id) => api.get(`/movies/${id}`),
  newReleases: () => api.get('/movies/section/new'),
  popular: () => api.get('/movies/section/popular'),
};

// ── Series ────────────────────────────────────────────────────────────────────
export const seriesAPI = {
  list: (params = {}) => api.get('/series', { params }),
  search: (q) => api.get('/series/search', { params: { q } }),
  get: (id) => api.get(`/series/${id}`),
  episodes: (id, season) =>
    api.get(`/series/${id}/episodes`, season ? { params: { season } } : {}),
  newReleases: () => api.get('/series/section/new'),
  popular: () => api.get('/series/section/popular'),
};

// ── Cast ──────────────────────────────────────────────────────────────────────
export const castAPI = {
  get: () => api.get('/cast'),
  clear: () => api.delete('/cast'),
};

export default api;
