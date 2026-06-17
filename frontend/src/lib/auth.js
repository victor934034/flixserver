import api from './api';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('flixhome_token');
}

export function setToken(token) {
  localStorage.setItem('flixhome_token', token);
}

export function clearToken() {
  localStorage.removeItem('flixhome_token');
}

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  setToken(data.token);
  return data;
}

export async function register(email, password, name) {
  const { data } = await api.post('/auth/register', { email, password, name });
  setToken(data.token);
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export function logout() {
  clearToken();
  window.location.href = '/login';
}
