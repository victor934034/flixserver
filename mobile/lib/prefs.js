import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Preferências locais do app (por aparelho, não por conta).
const KEY = 'flixhome_prefs_v1';
const DEFAULTS = {
  autoDownloadNext: false,   // baixa o próximo episódio sozinho (só no Wi-Fi)
  autoDeleteWatched: false,  // apaga o download depois de assistir até o fim
};

let cache = null;
const listeners = new Set();

async function load() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse((await AsyncStorage.getItem(KEY)) || '{}') };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export async function getPref(key) {
  return (await load())[key];
}

export async function setPref(key, value) {
  const current = await load();
  cache = { ...current, [key]: value };
  AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => {});
  listeners.forEach(fn => fn(cache));
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(cache || DEFAULTS);
  useEffect(() => {
    let alive = true;
    load().then(c => { if (alive) setPrefs(c); });
    listeners.add(setPrefs);
    return () => { alive = false; listeners.delete(setPrefs); };
  }, []);
  return prefs;
}
