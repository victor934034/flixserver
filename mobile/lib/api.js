import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId, platformName } from './deviceId';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://movies0-movie.mgf7wb.easypanel.host/api';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// Quem cuida do login é avisado quando o acesso deixa de valer
const expiredListeners = new Set();
export function onSessionExpired(fn) {
  expiredListeners.add(fn);
  return () => expiredListeners.delete(fn);
}

// Renova o acesso de quem usa o app, pra não ter que entrar de novo quando vencer
export async function renewSession() {
  try {
    const { data } = await api.post('/auth/refresh');
    // só grava se a pessoa não saiu da conta enquanto a resposta vinha
    if (data?.token && await AsyncStorage.getItem('token')) await AsyncStorage.setItem('token', data.token);
  } catch {}
}

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Device-Id'] = await getDeviceId();
  config.headers['X-Platform'] = platformName();
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      // Só derruba o login se o recusado for o token atual: uma resposta atrasada
      // de um token antigo (ou erro de senha) não pode apagar o acesso novo.
      const sent = error.config?.headers?.Authorization;
      const current = await AsyncStorage.getItem('token');
      if (current && sent === `Bearer ${current}`) {
        await AsyncStorage.multiRemove(['token', 'user']);
        expiredListeners.forEach(fn => fn());
      }
    }
    return Promise.reject(error);
  }
);

export default api;
