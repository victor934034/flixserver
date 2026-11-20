// "Assistir juntos" no app: sincronia + chat (Socket.IO).
// Voz: WebRTC nativo (react-native-webrtc) — só em build nativo, não no Expo Go.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

let webrtc = null;
try { webrtc = require('react-native-webrtc'); } catch { webrtc = null; }
export const voiceSupported = !!webrtc;

const API_BASE = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');

export function useTogether(code) {
  const [status, setStatus] = useState(code ? 'connecting' : 'off');
  const [error, setError] = useState('');
  const [room, setRoom] = useState(null);
  const [you, setYou] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [initialState, setInitialState] = useState(null);
  const [unread, setUnread] = useState(0);
  const [started, setStarted] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micError, setMicError] = useState('');
  const pcs = useRef(new Map());
  const localStream = useRef(null);
  const iceRef = useRef({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  const sockRef = useRef(null);
  const offsetRef = useRef(0);
  const handlers = useRef(new Set());
  const peerMaker = useRef(null);
  const chatOpenRef = useRef(false);

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
          setRoom(res.room); setStarted(!!res.room?.started); setYou(res.you); setMembers(res.members); setMessages(res.messages || []);
          setInitialState(res.state && res.state.t && (res.state.time > 0 || res.state.playing) ? res.state : null);
          setStatus('ready');
        });
      });
      sock.on('disconnect', () => setStatus(s => (s === 'ended' ? s : 'reconnecting')));
      sock.on('connect_error', e => { if (e.message === 'unauthorized') { setStatus('error'); setError('Faça login para entrar.'); } });
      sock.on('room:members', setMembers);
      sock.on('toast', t => toast(t.text));
      sock.on('chat', m => { setMessages(l => [...l.slice(-199), m]); if (!chatOpenRef.current) setUnread(u => u + 1); });
      const closePeer = (id) => { const pc = pcs.current.get(id); if (pc) { try { pc.close(); } catch {} pcs.current.delete(id); } };
      const makePeer = (id, initiator) => {
        if (pcs.current.has(id) || !webrtc) return pcs.current.get(id);
        const pc = new webrtc.RTCPeerConnection(iceRef.current);
        pcs.current.set(id, pc);
        localStream.current?.getTracks().forEach(t => pc.addTrack(t, localStream.current));
        pc.onicecandidate = (e) => { if (e.candidate) sock.emit('rtc:signal', { to: id, data: { candidate: e.candidate } }); };
        pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) closePeer(id); };
        if (initiator) {
          pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => sock.emit('rtc:signal', { to: id, data: { sdp: pc.localDescription } })).catch(() => {});
        }
        return pc;
      };
      peerMaker.current = makePeer;
      sock.on('voice:peers', ids => { ids.forEach(id => makePeer(id, true)); });
      sock.on('voice:left', closePeer);
      sock.on('rtc:signal', async ({ from, data }) => {
        if (!webrtc) return;
        let pc = pcs.current.get(from);
        if (!pc) { if (!localStream.current) return; pc = makePeer(from, false); }
        try {
          if (data.sdp) {
            await pc.setRemoteDescription(new webrtc.RTCSessionDescription(data.sdp));
            if (data.sdp.type === 'offer') {
              const ans = await pc.createAnswer();
              await pc.setLocalDescription(ans);
              sock.emit('rtc:signal', { to: from, data: { sdp: pc.localDescription } });
            }
          } else if (data.candidate) {
            await pc.addIceCandidate(new webrtc.RTCIceCandidate(data.candidate)).catch(() => {});
          }
        } catch {}
      });
      sock.on('room:started', () => setStarted(true));
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
    return () => {
      alive = false;
      pcs.current.forEach(pc => { try { pc.close(); } catch {} });
      pcs.current.clear();
      localStream.current?.getTracks().forEach(t => t.stop());
      localStream.current = null;
      sock?.removeAllListeners(); sock?.disconnect(); sockRef.current = null;
    };
  }, [code, toast]);

  const joinVoice = useCallback(async () => {
    setMicError('');
    if (!webrtc) { setMicError('Voz indisponível nesta versão do app. Atualize o app.'); return; }
    try {
      const { data } = await api.get('/together/ice').catch(() => ({ data: null }));
      if (data?.iceServers) iceRef.current = { iceServers: data.iceServers };
      const stream = await webrtc.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current = stream;
      setVoiceOn(true); setMuted(false);
      sockRef.current?.emit('voice:join');
    } catch {
      setMicError('Permita o microfone para usar a voz.');
    }
  }, []);
  const leaveVoice = useCallback(() => {
    sockRef.current?.emit('voice:leave');
    pcs.current.forEach(pc => { try { pc.close(); } catch {} });
    pcs.current.clear();
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    setVoiceOn(false);
  }, []);
  const toggleMute = useCallback(() => {
    const st = localStream.current; if (!st) return;
    const next = !muted;
    st.getAudioTracks().forEach(t => { t.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const api2 = useMemo(() => ({
    serverNow: () => Date.now() + offsetRef.current,
    emit: (ev) => sockRef.current?.emit('state', ev),
    subscribe: (h) => { handlers.current.add(h); return () => handlers.current.delete(h); },
  }), []);

  return {
    active: !!code, status, error, room, you, members, messages, toasts, initialState, unread,
    isHost: !!you?.host, started,
    startRoom: () => sockRef.current?.emit('room:start'),
    updateAvatar: (url) => sockRef.current?.emit('member:update', { avatar: url }),
    voice: { supported: voiceSupported, on: voiceOn, muted, micError, join: joinVoice, leave: leaveVoice, toggleMute },
    ...api2,
    sendChat: (text) => sockRef.current?.emit('chat', { text }),
    endRoom: () => sockRef.current?.emit('room:end'),
    setChatOpen: (open) => { chatOpenRef.current = open; if (open) setUnread(0); },
  };
}
