// Títulos marcados como "já assistido", compartilhados entre cartões e telas
// (uma busca só por perfil, não uma por cartão).
import { useEffect, useState } from 'react';
import api from './api';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';

let state = { owner: null, enabled: false, keys: new Set() };
const listeners = new Set();
const publish = (next) => { state = next; listeners.forEach(fn => fn(next)); };

async function load(owner, profileId) {
  publish({ owner, enabled: false, keys: new Set() });
  try {
    const { data } = await api.get('/watched', { params: { profile_id: profileId } });
    if (state.owner !== owner) return;
    publish({ owner, enabled: !!data.enabled, keys: new Set((data.items || []).map(i => `${i.content_type}:${i.content_id}`)) });
  } catch {
    if (state.owner === owner) publish({ owner: null, enabled: false, keys: new Set() });
  }
}

export function useWatched() {
  const { user } = useAuth();
  const profileId = useProfile()?.activeProfile?.id;
  const [current, setCurrent] = useState(state);
  const owner = user?.id && profileId ? `${user.id}:${profileId}` : null;

  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state);
    return () => { listeners.delete(setCurrent); };
  }, []);

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
    return watched;
  };

  return { enabled: current.enabled, has, toggle };
}
