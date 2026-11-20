// "Assistir juntos" na TV (web): sincronia play/pause/seek via Socket.IO. Sem voz/chat.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import api, { BASE_URL } from '../api/index.js';

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
    setToasts(t => t.slice(-2).concat([{ id, text }]));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  useEffect(() => {
    if (!code) return undefined;
    const token = localStorage.getItem('token');
    const sock = io(BASE_URL || '/', { path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'], reconnectionDelay: 500, reconnectionDelayMax: 3000 });
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
        if (!res || !res.ok) { setStatus('error'); setError((res && res.error) || 'Não foi possível entrar.'); return; }
        setRoom(res.room); setYou(res.you); setMembers(res.members);
        setInitialState(res.state && res.state.t && (res.state.time > 0 || res.state.playing) ? res.state : null);
        setStatus('ready');
        if (res.you && res.you.host && res.room && !res.room.started) sock.emit('room:start');
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
        const label = { play: 'deu play', pause: 'pausou', seek: 'pulou o vídeo' }[ev.type];
        if (label) toast(ev.name + ' ' + label);
      }
      handlers.current.forEach(h => h(ev));
    });
    return () => { sock.removeAllListeners(); sock.disconnect(); sockRef.current = null; };
  }, [code, toast]);

  const apiObj = useMemo(() => ({
    serverNow: () => Date.now() + offsetRef.current,
    emit: (ev) => { if (sockRef.current) sockRef.current.emit('state', ev); },
    subscribe: (h) => { handlers.current.add(h); return () => handlers.current.delete(h); },
  }), []);

  return Object.assign({ active: !!code, status, error, room, you, members, toasts, initialState, isHost: !!(you && you.host) }, apiObj);
}

// Anfitrião: cria a sala e abre o player nela
export async function startTogetherWeb(navigate, playerState) {
  const meta = playerState.contentMeta || {};
  const { data: room } = await api.post('/api/together/rooms', {
    content_type: meta.content_type === 'movie' ? 'movie' : 'episode',
    content_id: String(meta.content_id),
    title: playerState.title,
    poster_url: null,
  });
  navigate('/player', { state: Object.assign({}, playerState, { room: room.code }) });
}

// Convidado
export async function joinTogetherWeb(navigate, code) {
  const { data: info } = await api.get('/api/together/rooms/' + code);
  const isMovie = info.content_type === 'movie';
  const { data: c } = await api.get(isMovie ? '/api/movies/' + info.content_id : '/api/episodes/' + info.content_id);
  const tracks = { dubbing: c.file_dubbing || null, subtitled: c.file_subtitled || null, cinema: c.file_cinema || null, color: c.file_color || null, bw: c.file_bw || null };
  const url = tracks.dubbing || tracks.subtitled || tracks.cinema || tracks.color || tracks.bw;
  if (!url) throw new Error('Vídeo indisponível');
  navigate('/player', { state: {
    url, title: info.title, tracks,
    subtitles: { pt: c.subtitle_pt || null, en: c.subtitle_en || null, es: c.subtitle_es || null },
    room: info.code,
    contentMeta: isMovie
      ? { content_type: 'movie', content_id: c.id }
      : { content_type: 'episode', content_id: c.id, episode_id: c.id, series_id: c.series_id },
  }});
}
