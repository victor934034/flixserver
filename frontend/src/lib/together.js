'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from './auth';
import api from './api';

let ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

// Hook da sala "Assistir juntos": sincronia, chat e voz (WebRTC em malha).
export function useTogether(code) {
  const [status, setStatus] = useState('connecting'); // connecting | ready | reconnecting | error | ended
  const [error, setError] = useState('');
  const [room, setRoom] = useState(null);
  const [you, setYou] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [initialState, setInitialState] = useState(null);
  const [resyncing, setResyncing] = useState(false);
  const [started, setStarted] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState({});   // socketId -> true
  const [micError, setMicError] = useState('');

  const sockRef = useRef(null);
  const offsetRef = useRef(0);              // serverTime - clientTime
  const handlersRef = useRef(new Set());
  const youRef = useRef(null);
  const pcsRef = useRef(new Map());          // socketId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const audioElsRef = useRef(new Map());
  const analysersRef = useRef(new Map());    // id -> { analyser, data }

  const toast = useCallback((text) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  // ── medição de relógio (3 amostras, usa a de menor RTT) ──
  const syncClock = useCallback(async (sock) => {
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
  }, []);

  useEffect(() => {
    if (!code) return;
    const token = getToken();
    if (!token) { setStatus('error'); setError('login'); return; }
    const sock = io('/', { path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'], reconnectionDelay: 500, reconnectionDelayMax: 3000 });
    sockRef.current = sock;

    const join = async () => {
      await syncClock(sock);
      sock.emit('room:join', { code }, (res) => {
        if (!res?.ok) { setStatus('error'); setError(res?.error || 'Não foi possível entrar.'); return; }
        setRoom(res.room); setStarted(!!res.room?.started); setYou(res.you); youRef.current = res.you;
        setMembers(res.members); setMessages(res.messages || []);
        setInitialState(res.state && res.state.t && (res.state.time > 0 || res.state.playing) ? res.state : null);
        setStatus('ready'); setResyncing(false);
      });
    };
    sock.on('connect', () => { if (sockRef.current === sock) join(); });
    sock.on('disconnect', () => { setStatus(s => (s === 'ended' ? s : 'reconnecting')); });
    sock.on('connect_error', (e) => { if (e.message === 'unauthorized') { setStatus('error'); setError('login'); } });

    sock.on('room:members', setMembers);
    sock.on('toast', (t) => toast(t.text));
    sock.on('chat', (m) => setMessages(list => [...list.slice(-199), m]));
    sock.on('room:started', () => setStarted(true));
    sock.on('room:ended', () => { setStatus('ended'); });
    sock.on('room:kicked', () => { setStatus('error'); setError('Você entrou nesta sala em outra aba.'); });
    sock.on('state', (ev) => {
      if (ev.type !== 'tick') {
        const label = { play: 'deu play', pause: 'pausou', seek: 'pulou o vídeo', version: 'trocou o áudio', subtitle: 'trocou a legenda' }[ev.type];
        if (label) toast(`${ev.name} ${label}`);
      }
      handlersRef.current.forEach(h => h(ev));
    });

    // ── Voz ──
    sock.on('voice:peers', (ids) => { ids.forEach(id => makePeer(id, true)); });
    sock.on('voice:left', (id) => closePeer(id));
    sock.on('rtc:signal', async ({ from, data }) => {
      let pc = pcsRef.current.get(from);
      if (!pc) { if (!localStreamRef.current) return; pc = makePeer(from, false); }
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp);
          if (data.sdp.type === 'offer') {
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            sock.emit('rtc:signal', { to: from, data: { sdp: pc.localDescription } });
          }
        } else if (data.candidate) {
          await pc.addIceCandidate(data.candidate).catch(() => {});
        }
      } catch {}
    });

    return () => {
      leaveVoiceInternal();
      sock.removeAllListeners();
      sock.disconnect();
      sockRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ── API de sincronia pro player ──
  const sync = useMemo(() => ({
    isHost: !!you?.host,
    initialState,
    serverNow: () => Date.now() + offsetRef.current,
    emit: (ev) => sockRef.current?.emit('state', ev),
    subscribe: (h) => { handlersRef.current.add(h); return () => handlersRef.current.delete(h); },
  }), [you?.host, initialState]);

  const sendChat = useCallback((text) => sockRef.current?.emit('chat', { text }), []);
  const endRoom = useCallback(() => sockRef.current?.emit('room:end'), []);

  // ── WebRTC ──
  function makePeer(id, initiator) {
    if (pcsRef.current.has(id)) return pcsRef.current.get(id);
    const pc = new RTCPeerConnection(ICE);
    pcsRef.current.set(id, pc);
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    pc.onicecandidate = (e) => { if (e.candidate) sockRef.current?.emit('rtc:signal', { to: id, data: { candidate: e.candidate } }); };
    pc.ontrack = (e) => {
      let el = audioElsRef.current.get(id);
      if (!el) { el = new Audio(); el.autoplay = true; audioElsRef.current.set(id, el); }
      el.srcObject = e.streams[0];
      el.play().catch(() => {});
      watchLevel(id, e.streams[0]);
    };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) closePeer(id); };
    if (initiator) {
      pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => {
        sockRef.current?.emit('rtc:signal', { to: id, data: { sdp: pc.localDescription } });
      }).catch(() => {});
    }
    return pc;
  }
  function closePeer(id) {
    pcsRef.current.get(id)?.close();
    pcsRef.current.delete(id);
    const el = audioElsRef.current.get(id);
    if (el) { el.srcObject = null; audioElsRef.current.delete(id); }
    analysersRef.current.delete(id);
    setSpeaking(s => { const n = { ...s }; delete n[id]; return n; });
  }

  // detecção de quem está falando (anel verde no avatar)
  const levelTimer = useRef(null);
  function watchLevel(id, stream) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = analysersRef.current.ctx || (analysersRef.current.ctx = new Ctx());
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      src.connect(analyser);
      analysersRef.current.set(id, { analyser, data: new Uint8Array(analyser.frequencyBinCount) });
      if (!levelTimer.current) {
        levelTimer.current = setInterval(() => {
          const next = {};
          analysersRef.current.forEach((a, key) => {
            if (key === 'ctx') return;
            a.analyser.getByteFrequencyData(a.data);
            const avg = a.data.reduce((x, y) => x + y, 0) / a.data.length;
            if (avg > 18) next[key] = true;
          });
          setSpeaking(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        }, 150);
      }
    } catch {}
  }

  async function joinVoice() {
    setMicError('');
    try {
      const ice = await api.get('/together/ice').then(r => r.data).catch(() => null);
      if (ice && ice.iceServers) ICE = { iceServers: ice.iceServers };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      localStreamRef.current = stream;
      setVoiceOn(true); setMuted(false);
      if (youRef.current) watchLevel(youRef.current.id, stream);
      sockRef.current?.emit('voice:join');
    } catch {
      setMicError('Permita o microfone no navegador para usar a voz.');
    }
  }
  function leaveVoiceInternal() {
    sockRef.current?.emit('voice:leave');
    pcsRef.current.forEach((_, id) => closePeer(id));
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (levelTimer.current) { clearInterval(levelTimer.current); levelTimer.current = null; }
    setVoiceOn(false); setSpeaking({});
  }
  function toggleMute() {
    const s = localStreamRef.current; if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach(t => { t.enabled = !next; });
    setMuted(next);
  }

  return {
    status, error, room, you, members, messages, toasts, resyncing, sync, started,
    startRoom: () => sockRef.current?.emit('room:start'),
    updateAvatar: (url) => sockRef.current?.emit('member:update', { avatar: url }),
    sendChat, endRoom, toast,
    voice: { on: voiceOn, muted, speaking, micError, join: joinVoice, leave: leaveVoiceInternal, toggleMute },
  };
}
