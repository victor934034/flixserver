// "Assistir juntos" na TV: sincronia + chat (Socket.IO). Sem voz.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const API_BASE = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');

export function useTogether(code) {
  const [status, setStatus] = useState(code ? 'connecting' : 'off');
  const [error, setError] = useState('');
  const [room, setRoom] = useState(null);
  const [you, setYou] = useState(null);
  const [members, setMembers] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [initialState, setInitialState] = useState(null);

  const sockRef = useRef(null);
  const offsetRef = useRef(0);
  const handlers = useRef(new Set());

  const toast = useCallback((text) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    let sock;
    (async () => {
      const token = await AsyncStorage.getItem('token');
      if (!alive) return;
      sock = io(API_BASE, { path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'], reconnectionDelay: 500, reconnectionDelayMax: 3000 });
      sockRef.current = sock;

      const syncClock = async () => {
        let best = null;
        for (let i = 0; i < 4; i++) {
          const t0 = Date.now();
          const st = await new Promise(res => sock.timeout(2000).emit('time:ping', null, (err, v) => res(err ? null : v)));
          const t1 = Date.now();
          if (st == null) continue;
          const rtt = t1 - t0;
          if (!best || rtt < best.rtt) best = { rtt, offset: st + rtt / 2 - t1 };
        }
        if (best) offsetRef.current = best.offset;
      };

      sock.on('connect', async () => {
        await syncClock();
        sock.emit('room:join', { code }, (res) => {
          if (!res?.ok) { setStatus('error'); setError(res?.error || 'Não foi possível entrar.'); return; }
          setRoom(res.room); setYou(res.you); setMembers(res.members);
          setInitialState(res.state && res.state.t && (res.state.time > 0 || res.state.playing) ? res.state : null);
          setStatus('ready');
          if (res.you?.host && res.room && !res.room.started) sock.emit('room:start');
        });
      });
      sock.on('disconnect', () => setStatus(s => (s === 'ended' ? s : 'reconnecting')));
      sock.on('connect_error', e => { if (e.message === 'unauthorized') { setStatus('error'); setError('Faça login para entrar.'); } });
      sock.on('room:members', setMembers);
      sock.on('toast', t => toast(t.text));
      sock.on('room:ended', () => setStatus('ended'));
      sock.on('room:kicked', () => { setStatus('error'); setError('Você entrou nesta sala em outro aparelho.'); });
      sock.on('state', ev => {
        if (ev.type !== 'tick') {
          const label = { play: 'deu play', pause: 'pausou', seek: 'pulou o vídeo', version: 'trocou o áudio', subtitle: 'trocou a legenda' }[ev.type];
          if (label) toast(`${ev.name} ${label}`);
        }
        handlers.current.forEach(h => h(ev));
      });
    })();
    return () => { alive = false; sock?.removeAllListeners(); sock?.disconnect(); sockRef.current = null; };
  }, [code, toast]);

  const api2 = useMemo(() => ({
    serverNow: () => Date.now() + offsetRef.current,
    emit: (ev) => sockRef.current?.emit('state', ev),
    subscribe: (h) => { handlers.current.add(h); return () => handlers.current.delete(h); },
  }), []);

  return {
    active: !!code, status, error, room, you, members, toasts, initialState,
    isHost: !!you?.host,
    ...api2,
    endRoom: () => sockRef.current?.emit('room:end'),
  };
}

// ── Navegação ────────────────────────────────────────────────────────────────
const tracksOf = c => ({ dubbing: c.file_dubbing || null, subtitled: c.file_subtitled || null, cinema: c.file_cinema || null });
const subsOf = c => ({ pt: c.subtitle_pt || null, en: c.subtitle_en || null, es: c.subtitle_es || null });

// Anfitrião (filme ou episódio já com params de Player prontos): cria a sala e abre o player nela
export async function startTogether(navigation, playerParams) {
  const meta = playerParams.contentMeta || {};
  const { data: room } = await api.post('/together/rooms', {
    content_type: meta.content_type === 'movie' ? 'movie' : 'episode',
    content_id: String(meta.content_id),
    title: playerParams.title,
    poster_url: playerParams.poster || null,
  });
  navigation.navigate('Player', { ...playerParams, room: room.code });
  return room;
}

// Convidado: busca o conteúdo da sala e abre o player
export async function joinTogether(navigation, code) {
  const { data: info } = await api.get(`/together/rooms/${code}`);
  const isMovie = info.content_type === 'movie';
  const { data: c } = await api.get(isMovie ? `/movies/${info.content_id}` : `/episodes/${info.content_id}`);
  const tracks = tracksOf(c);
  const url = tracks.dubbing || tracks.subtitled || tracks.cinema;
  if (!url) throw new Error('Vídeo indisponível');
  navigation.navigate('Player', {
    url, title: info.title, poster: info.poster_url, tracks, subtitles: subsOf(c), room: info.code,
    contentMeta: isMovie
      ? { content_type: 'movie', content_id: c.id }
      : { content_type: 'episode', content_id: c.id, episode_id: c.id, series_id: c.series_id },
  });
}
