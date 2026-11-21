import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Lista de canais que estava na tela quando o usuário abriu o player (troca de canal por swipe/gaveta)
export const iptvQueue = { list: [], index: 0 };
export function setQueue(list, index) { iptvQueue.list = list || []; iptvQueue.index = Math.max(0, index || 0); }

const FAV_KEY = 'iptv_favs_v1';
export async function loadFavs() {
  try { return JSON.parse((await AsyncStorage.getItem(FAV_KEY)) || '[]'); } catch { return []; }
}
export async function saveFavs(list) { try { await AsyncStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch {} }

// URL de reprodução do canal (m3u8 por padrão, ts como alternativa)
export async function streamUrl(streamId, fmt = 'm3u8') {
  const { data } = await api.get(`/iptv/stream-url/${streamId}`, { params: { fmt } });
  return data.url;
}
