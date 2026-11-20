// "Assistir juntos": salas em memória + Socket.IO (sincronia, chat e sinalização de voz WebRTC).
//
// Sincronia sem atraso: o servidor só repassa eventos (play/pause/seek/versão/legenda) com
// o horário do servidor; cada cliente mede seu desvio de relógio (time:ping) e compensa a
// latência ao aplicar. O anfitrião manda um "tick" a cada ~4s pra corrigir deriva.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { supabase } = require('./supabase');

const rooms = new Map();      // code -> room
const invites = new Map();    // userId -> [{ code, from, title, poster_url, at }]
const MAX_MEMBERS = 8;
const ROOM_TTL_MS = 6 * 3600 * 1000;

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    let c = '';
    const buf = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) c += CHARS[buf[i] % CHARS.length];
    if (!rooms.has(c)) return c;
  }
}

function createRoom({ host, content_type, content_id, title, poster_url, control = 'all' }) {
  const code = newCode();
  const room = {
    code, hostId: host.id, hostName: host.name,
    content_type, content_id, title: String(title || '').slice(0, 200), poster_url: poster_url || null,
    control: control === 'host' ? 'host' : 'all',
    members: new Map(),       // socket.id -> { userId, name, avatar, voice }
    state: { playing: false, time: 0, version: null, subtitle: 'none', t: Date.now() },
    messages: [],
    createdAt: Date.now(), touchedAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

const publicRoom = r => ({
  code: r.code, content_type: r.content_type, content_id: r.content_id, title: r.title,
  poster_url: r.poster_url, host_name: r.hostName, control: r.control, members: r.members.size,
});
const memberList = r => [...r.members.entries()].map(([id, m]) => ({ id, userId: m.userId, name: m.name, avatar: m.avatar, voice: !!m.voice, host: m.userId === r.hostId }));

// limpeza de salas paradas
setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) if (r.members.size === 0 && now - r.touchedAt > 15 * 60 * 1000 || now - r.createdAt > ROOM_TTL_MS) rooms.delete(code);
  for (const [uid, list] of invites) {
    const fresh = list.filter(i => now - i.at < 3600 * 1000);
    if (fresh.length) invites.set(uid, fresh); else invites.delete(uid);
  }
}, 5 * 60 * 1000).unref();

function attach(httpServer) {
  const origins = [process.env.FRONTEND_URL, ...(process.env.CORS_ORIGINS || '').split(',')]
    .map(o => (o || '').trim().replace(/\/$/, '')).filter(Boolean);
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: origins.length ? origins : true, credentials: true },
    maxHttpBufferSize: 1e5,
    pingInterval: 10000, pingTimeout: 8000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const p = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const { data: u } = await supabase.from('users').select('id, name, avatar_url').eq('id', p.id).single();
      if (!u) return next(new Error('unauthorized'));
      socket.user = { id: u.id, name: u.name || 'Alguém', avatar: u.avatar_url || null };
      next();
    } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', socket => {
    let room = null;
    let lastChat = 0;

    socket.on('time:ping', (_, ack) => typeof ack === 'function' && ack(Date.now()));

    socket.on('room:join', ({ code } = {}, ack) => {
      const r = rooms.get(String(code || '').toUpperCase());
      if (!r) return ack?.({ ok: false, error: 'Sala não encontrada ou encerrada.' });
      if (r.members.size >= MAX_MEMBERS && ![...r.members.values()].some(m => m.userId === socket.user.id)) {
        return ack?.({ ok: false, error: 'Sala cheia.' });
      }
      // mesma conta em outra aba: expulsa a antiga
      for (const [sid, m] of r.members) if (m.userId === socket.user.id && sid !== socket.id) { io.to(sid).emit('room:kicked'); r.members.delete(sid); }
      room = r;
      r.touchedAt = Date.now();
      r.members.set(socket.id, { userId: socket.user.id, name: socket.user.name, avatar: socket.user.avatar, voice: false });
      socket.join(r.code);
      socket.to(r.code).emit('room:members', memberList(r));
      socket.to(r.code).emit('toast', { text: `${socket.user.name} entrou` });
      ack?.({
        ok: true, room: publicRoom(r), you: { id: socket.id, userId: socket.user.id, host: socket.user.id === r.hostId },
        members: memberList(r), state: r.state, messages: r.messages.slice(-50), serverTime: Date.now(),
      });
    });

    // play / pause / seek / tick / version / subtitle
    socket.on('state', (ev = {}) => {
      if (!room) return;
      const isHost = socket.user.id === room.hostId;
      if (room.control === 'host' && !isHost) return;
      if (ev.type === 'tick' && !isHost) return; // só o anfitrião manda tick de correção
      const type = ['play', 'pause', 'seek', 'tick', 'version', 'subtitle'].includes(ev.type) ? ev.type : null;
      if (!type) return;
      const t = Date.now();
      const next = {
        type, t, from: socket.id, name: socket.user.name,
        playing: !!ev.playing, time: Math.max(0, Number(ev.time) || 0),
        version: ev.version != null ? String(ev.version).slice(0, 30) : undefined,
        subtitle: ev.subtitle != null ? String(ev.subtitle).slice(0, 30) : undefined,
      };
      room.state = {
        ...room.state, playing: next.playing, time: next.time, t,
        ...(next.version !== undefined ? { version: next.version } : {}),
        ...(next.subtitle !== undefined ? { subtitle: next.subtitle } : {}),
      };
      room.touchedAt = t;
      socket.to(room.code).emit('state', next);
    });

    socket.on('chat', ({ text } = {}) => {
      if (!room) return;
      const now = Date.now();
      if (now - lastChat < 300) return;
      lastChat = now;
      const clean = String(text || '').trim().slice(0, 500);
      if (!clean) return;
      const msg = { id: crypto.randomBytes(4).toString('hex'), from: socket.id, userId: socket.user.id, name: socket.user.name, text: clean, t: now };
      room.messages.push(msg);
      if (room.messages.length > 200) room.messages.shift();
      io.to(room.code).emit('chat', msg);
    });

    // ── Voz (WebRTC em malha; o servidor só repassa a sinalização) ──
    socket.on('voice:join', () => {
      if (!room) return;
      const m = room.members.get(socket.id); if (!m) return;
      m.voice = true;
      const others = [...room.members.entries()].filter(([id, x]) => id !== socket.id && x.voice).map(([id]) => id);
      socket.emit('voice:peers', others);                  // quem já está na voz: o novo faz as ofertas
      io.to(room.code).emit('room:members', memberList(room));
    });
    socket.on('voice:leave', () => {
      if (!room) return;
      const m = room.members.get(socket.id); if (m) m.voice = false;
      socket.to(room.code).emit('voice:left', socket.id);
      io.to(room.code).emit('room:members', memberList(room));
    });
    socket.on('rtc:signal', ({ to, data } = {}) => {
      if (!room || !room.members.has(to) || !room.members.has(socket.id)) return;
      io.to(to).emit('rtc:signal', { from: socket.id, data });
    });

    socket.on('room:end', () => {
      if (!room || socket.user.id !== room.hostId) return;
      io.to(room.code).emit('room:ended');
      rooms.delete(room.code);
      room = null;
    });

    socket.on('disconnect', () => {
      if (!room) return;
      room.members.delete(socket.id);
      room.touchedAt = Date.now();
      io.to(room.code).emit('voice:left', socket.id);
      if (room.members.size) {
        if (socket.user.id === room.hostId) {          // anfitrião saiu: passa o comando pro mais antigo
          const [, first] = [...room.members.entries()][0];
          room.hostId = first.userId; room.hostName = first.name;
        }
        io.to(room.code).emit('room:members', memberList(room));
        io.to(room.code).emit('toast', { text: `${socket.user.name} saiu` });
      }
    });
  });

  return io;
}

module.exports = { attach, rooms, invites, createRoom, publicRoom };
