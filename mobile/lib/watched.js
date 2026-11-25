import { useEffect, useSyncExternalStore } from 'react';
import api from './api';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';

// Títulos marcados como "já assistido", compartilhados entre cartões e telas
// (uma busca só por perfil, não uma por cartão).
const EMPTY = { owner: null, enabled: false, keys: new Set() };
let state = EMPTY;
const listeners = new Set();
const publish = next => { state = next; listeners.forEach(fn => fn()); };
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const snapshot = () => state;

async function load(owner, profileId) {
  publish({ ...EMPTY, owner });
  try {
    const { data } = await api.get('/watched', { params: { profile_id: profileId || undefined } });
    if (state.owner !== owner) return;
    publish({ owner, enabled: !!data.enabled, keys: new Set((data.items || []).map(i => `${i.content_type}:${i.content_id}`)) });
  } catch {
    if (state.owner === owner) publish(EMPTY); // falhou (sem internet): tenta de novo depois
  }
}

export function useWatched() {
  const { user } = useAuth();
  const profileId = useProfile()?.activeProfile?.id || null;
  const current = useSyncExternalStore(subscribe, snapshot);
  const owner = user?.id ? `${user.id}:${profileId}` : null;

  useEffect(() => {
    if (owner && state.owner !== owner) load(owner, profileId);
  }, [owner]);

  const has = (type, id) => current.keys.has(`${type}:${id}`);

  const toggle = async (type, id) => {
    const watched = !has(type, id);
    await api.put('/watched', { content_type: type, content_id: id, watched, profile_id: profileId });
    const keys = new Set(state.keys);
    if (watched) keys.add(`${type}:${id}`); else keys.delete(`${type}:${id}`);
    publish({ ...state, keys });
  };

  return { enabled: current.enabled, has, toggle };
}
