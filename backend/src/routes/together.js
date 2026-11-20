const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { sendPush } = require('../services/notifications');
const { rooms, invites, createRoom, publicRoom } = require('../services/together');

router.use(authMiddleware);
router.use(rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: 'Muitas requisições.' } }));

const APP_URL = () => process.env.FRONTEND_URL || 'https://movies0-movie.mgf7wb.easypanel.host';

// POST /api/together/rooms { content_type: 'movie'|'episode', content_id, title, poster_url, control }
router.post('/rooms', async (req, res) => {
  const { content_type, content_id, title, poster_url, control } = req.body || {};
  if (!['movie', 'episode'].includes(content_type) || !content_id) return res.status(400).json({ error: 'Conteúdo inválido' });
  const { data: u } = await supabase.from('users').select('id, name').eq('id', req.user.id).single();
  const room = createRoom({ host: { id: req.user.id, name: u?.name || 'Anfitrião' }, content_type, content_id, title, poster_url, control });
  res.status(201).json({ ...publicRoom(room), link: `${APP_URL()}/juntos/${room.code}` });
});

// GET /api/together/rooms/:code — dados da sala (tela "Entrar pelo link")
router.get('/rooms/:code', (req, res) => {
  const r = rooms.get(String(req.params.code).toUpperCase());
  if (!r) return res.status(404).json({ error: 'Sala não encontrada ou encerrada.' });
  res.json({ ...publicRoom(r), link: `${APP_URL()}/juntos/${r.code}` });
});

// GET /api/together/ice — servidores STUN/TURN pra voz (TURN opcional via env: TURN_URL, TURN_USERNAME, TURN_CREDENTIAL)
router.get('/ice', (req, res) => {
  const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) {
    iceServers.push({ urls: process.env.TURN_URL.split(',').map(x => x.trim()), username: process.env.TURN_USERNAME || '', credential: process.env.TURN_CREDENTIAL || '' });
  }
  res.json({ iceServers });
});

// GET /api/together/users?q= — busca de amigos (só nome/avatar; nunca expõe e-mail completo)
router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) return res.json([]);
  const safe = q.replace(/[%_,()]/g, ' ');
  const { data } = await supabase.from('users').select('id, name, avatar_url, email')
    .or(`name.ilike.%${safe}%,email.ilike.${safe}%`).neq('id', req.user.id).limit(8);
  res.json((data || []).map(u => ({
    id: u.id, name: u.name, avatar_url: u.avatar_url,
    hint: u.email ? u.email.replace(/^(.).*(@.*)$/, '$1•••$2') : '',
  })));
});

// POST /api/together/rooms/:code/invite { user_id } — convite direto pelo app (push + lista de convites)
router.post('/rooms/:code/invite', async (req, res) => {
  const r = rooms.get(String(req.params.code).toUpperCase());
  if (!r) return res.status(404).json({ error: 'Sala não encontrada.' });
  const { user_id } = req.body || {};
  const { data: target } = await supabase.from('users').select('id, push_token').eq('id', user_id).single();
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
  const { data: me } = await supabase.from('users').select('name').eq('id', req.user.id).single();
  const list = (invites.get(target.id) || []).filter(i => i.code !== r.code);
  list.push({ code: r.code, from: me?.name || 'Um amigo', title: r.title, poster_url: r.poster_url, at: Date.now() });
  invites.set(target.id, list);
  if (target.push_token) {
    sendPush([target.push_token], `${me?.name || 'Um amigo'} chamou você pra assistir junto`, r.title, { screen: 'juntos', code: r.code }).catch(() => {});
  }
  res.json({ ok: true });
});

// GET /api/together/invites — convites pendentes do usuário (apps consultam ao abrir/periodicamente)
router.get('/invites', (req, res) => {
  const now = Date.now();
  const list = (invites.get(req.user.id) || []).filter(i => now - i.at < 3600 * 1000 && rooms.has(i.code));
  res.json(list);
});

// DELETE /api/together/invites/:code — recusar
router.delete('/invites/:code', (req, res) => {
  invites.set(req.user.id, (invites.get(req.user.id) || []).filter(i => i.code !== req.params.code.toUpperCase()));
  res.json({ ok: true });
});

module.exports = router;
