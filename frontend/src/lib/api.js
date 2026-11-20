import axios from 'axios';

// No servidor (SSR) chama o backend diretamente via localhost.
// No browser chama via /api que o Next.js redireciona para o backend.
const baseURL = typeof window === 'undefined'
  ? 'http://localhost:3001/api'
  : '/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    config.headers['X-Platform'] = 'web';
    const did = (() => { try { let i = localStorage.getItem('device_install_id'); if (!i) { i = 'web-' + (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem('device_install_id', i); } return i; } catch { return ''; } })();
    if (did) config.headers['X-Device-Id'] = did;
    const token = localStorage.getItem('flixhome_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('flixhome_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
