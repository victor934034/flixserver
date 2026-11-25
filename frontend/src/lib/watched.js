'use client';
import { useEffect, useSyncExternalStore } from 'react';
import api from './api';
import { getToken } from './auth';
import { useProfile } from '../contexts/ProfileContext';

// Títulos marcados como "já assistido", compartilhados entre cartões e telas
// (uma busca só por perfil, não uma por cartão).
const EMPTY = { owner: null, enabled: false, keys: new Set() };
let state = EMPTY;
const listeners = new Set();
const publish = next => { state = next; listeners.forEach(fn => fn()); };
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };

async function load(owner, profileId) {
  publish({ ...EMPTY, owner });
  try {
    const { data } = await api.get('/watched', { params: { profile_id: profileId || undefined } });
    if (state.owner !== owner) return;
    publish({ owner, enabled: !!data.enabled, keys: new Set((data.items || []).map(i => `${i.content_type}:${i.content_id}`)) });
  } catch {}
}

export function useWatched() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id || null;
  const current = useSyncExternalStore(subscribe, () => state, () => EMPTY);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const owner = `${token.slice(-12)}:${profileId}`;
    if (state.owner !== owner) load(owner, profileId);
  }, [profileId]);

  const has = (type, id) => current.keys.has(`${type}:${id}`);

  async function toggle(type, id) {
    const watched = !has(type, id);
    await api.put('/watched', { content_type: type, content_id: id, watched, profile_id: profileId });
    const keys = new Set(state.keys);
    if (watched) keys.add(`${type}:${id}`); else keys.delete(`${type}:${id}`);
    publish({ ...state, keys });
  }

  return { enabled: current.enabled, has, toggle };
}
