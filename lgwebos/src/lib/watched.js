// Títulos marcados como "já assistido", compartilhados entre cartões e telas
// (uma busca só por perfil, não uma por cartão).
import { useEffect, useState } from 'react';
import api from '../api/index.js';
import { useAuth } from '../contexts/AuthContext.jsx';

let state = { owner: null, enabled: false, keys: {} };
const listeners = new Set();
const publish = (next) => { state = next; listeners.forEach(fn => fn(next)); };

function load(owner, profileId) {
  publish({ owner, enabled: false, keys: {} });
  api.get('/api/watched', { params: { profile_id: profileId } })
    .then(r => {
      if (state.owner !== owner) return;
      const keys = {};
      (r.data.items || []).forEach(i => { keys[i.content_type + ':' + i.content_id] = true; });
      publish({ owner, enabled: !!r.data.enabled, keys });
    })
    .catch(() => { if (state.owner === owner) publish({ owner: null, enabled: false, keys: {} }); });
}

export function useWatched() {
  const { user, activeProfile } = useAuth();
  const [current, setCurrent] = useState(state);
  const profileId = activeProfile && activeProfile.id;
  const owner = user && profileId ? user.id + ':' + profileId : null;

  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state);
    return () => { listeners.delete(setCurrent); };
  }, []);

  useEffect(() => {
    if (owner && state.owner !== owner) load(owner, profileId);
  }, [owner]);

  const has = (type, id) => !!current.keys[type + ':' + id];

  async function toggle(type, id) {
    const watched = !has(type, id);
    await api.put('/api/watched', { content_type: type, content_id: id, watched, profile_id: profileId });
    const keys = Object.assign({}, state.keys);
    if (watched) keys[type + ':' + id] = true; else delete keys[type + ':' + id];
    publish(Object.assign({}, state, { keys }));
    return watched;
  }

  return { enabled: current.enabled, has, toggle };
}
