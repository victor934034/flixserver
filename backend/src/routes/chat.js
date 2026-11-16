// Chat ao vivo de suporte: cada usuário tem uma conversa com o admin.
//
// Tempo real via "long polling": o cliente pergunta "tem mensagem nova depois
// de X?" com ?wait=1 e o servidor segura a requisição até chegar mensagem nova
// (responde na hora) ou dar 25s (responde vazio e o cliente pergunta de novo).
// Funciona igual no site e no app, sem biblioteca extra.
const router = require('express').Router();
const { EventEmitter } = require('events');
const crypto = require('crypto');
const multer = require('multer');
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');
const { sendPush } = require('../services/notifications');
const { scanFile } = require('../services/virusScan');
const { uploadFile } = require('../services/backblaze');

const MAX_LEN = 4000;
const WAIT_MS = 20_000; // abaixo do timeout de 30s do proxy do Next
const FIELDS = 'id, user_id, sender, body, attachment_url, attachment_type, attachment_name, attachment_size, is_read, created_at';

const bus = new EventEmitter();
bus.setMaxListeners(0);

const MAX_SIZE = { image: 15, video: 100, file: 25 }; // MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SIZE.video * 1024 * 1024 } });

const cleanBody = (b) => (typeof b === 'string' ? b.trim().slice(0, MAX_LEN) : '');

function kindOf(mime, name) {
  if (/^image\//.test(mime || '')) return 'image';
  if (/^video\//.test(mime || '')) return 'video';
  if (/\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name || '')) return 'image';
  if (/\.(mp4|mov|m4v|webm|mkv|3gp|avi)$/i.test(name || '')) return 'video';
  return 'file';
}

// Espera mensagens novas da conversa (long polling)
async function fetchSince(userId, after) {
  let q = supabase.from('support_messages').select(FIELDS)
    .eq('user_id', userId).order('created_at', { ascending: true }).limit(500);
  if (after) q = q.gt('created_at', after);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// res 'close' antes de responder = cliente desistiu (fechou a tela, trocou de rede)
function gone(req) {
  return req.res?.destroyed || req.socket?.destroyed;
}

function waitFor(event, req) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      bus.off(event, finish);
      resolve();
    };
    const timer = setTimeout(finish, WAIT_MS);
    bus.on(event, finish);
    req.res.on('close', finish);
  });
}

async function longPoll(req, userId, after, event) {
  let msgs = await fetchSince(userId, after);
  if (msgs.length || !after || req.query.wait !== '1') return msgs;
  await waitFor(event, req);
  if (gone(req)) return [];
  msgs = await fetchSince(userId, after);
  return msgs;
}

async function insertMessage(row) {
  const { data, error } = await supabase.from('support_messages').insert(row).select(FIELDS).single();
  if (error) throw error;
  bus.emit(`user:${row.user_id}`);
  bus.emit('admin');
  return data;
}

async function notifyAfterInsert(msg) {
  try {
    if (msg.sender === 'admin') {
      const { data: user } = await supabase.from('users').select('push_token').eq('id', msg.user_id).single();
      if (user?.push_token) {
        const text = msg.body || (msg.attachment_type === 'image' ? '📷 Foto' : msg.attachment_type === 'video' ? '🎬 Vídeo' : '📎 Arquivo');
        await sendPush(user.push_token, '💬 Suporte Flixhome', text.slice(0, 120), { screen: 'chat' });
      }
    } else {
      const [{ data: admins }, { data: me }] = await Promise.all([
        supabase.from('users').select('push_token').eq('is_admin', true).not('push_token', 'is', null),
        supabase.from('users').select('name, email').eq('id', msg.user_id).single(),
      ]);
      const tokens = (admins || []).map(a => a.push_token);
      if (tokens.length) {
        const text = msg.body || '📎 Anexo';
        await sendPush(tokens, `💬 ${me?.name || me?.email || 'Usuário'}`, text.slice(0, 120), { screen: 'admin-chat', userId: msg.user_id });
      }
    }
  } catch (e) {
    console.warn('[chat] push:', e.message);
  }
}

// Recebe o anexo, verifica vírus e sobe pro storage
async function handleAttachment(req, ownerId) {
  if (!req.file) return null;
  const { buffer, originalname, mimetype, size } = req.file;
  const kind = kindOf(mimetype, originalname);
  if (size > MAX_SIZE[kind] * 1024 * 1024) {
    const err = new Error(`Arquivo muito grande (máx. ${MAX_SIZE[kind]} MB para ${kind === 'image' ? 'fotos' : kind === 'video' ? 'vídeos' : 'arquivos'})`);
    err.status = 413;
    throw err;
  }
  const scan = await scanFile(buffer, originalname);
  if (!scan.ok) {
    const err = new Error(scan.reason);
    err.status = 422;
    throw err;
  }
  const safeName = (originalname || 'arquivo').replace(/[^\w.\-]+/g, '_').slice(-80);
  const key = `chat/${ownerId}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}_${safeName}`;
  const up = await uploadFile(buffer, key, mimetype || 'application/octet-stream');
  return {
    attachment_url: up.cdnUrl,
    attachment_type: kind,
    attachment_name: originalname || safeName,
    attachment_size: size,
  };
}

function multerSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `Arquivo muito grande (máx. ${MAX_SIZE.video} MB)` : err.message;
      return res.status(413).json({ error: msg });
    }
    next();
  });
}

// ── Admin ────────────────────────────────────────────────────────────────

router.get('/admin/conversations', adminMiddleware, async (req, res) => {
  try {
    if (req.query.wait === '1' && req.query.since) {
      // Segura até ter qualquer mensagem nova (ou 25s)
      const { count } = await supabase.from('support_messages')
        .select('id', { count: 'exact', head: true }).gt('created_at', req.query.since);
      if (!count) await waitFor('admin', req);
      if (gone(req)) return;
    }
    const { data: msgs, error } = await supabase
      .from('support_messages')
      .select('user_id, sender, body, attachment_type, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;

    const convs = new Map();
    for (const m of msgs || []) {
      let c = convs.get(m.user_id);
      if (!c) {
        c = {
          user_id: m.user_id,
          last_message: m.body || (m.attachment_type ? `📎 ${m.attachment_type === 'image' ? 'Foto' : m.attachment_type === 'video' ? 'Vídeo' : 'Arquivo'}` : ''),
          last_sender: m.sender, last_at: m.created_at, unread: 0,
        };
        convs.set(m.user_id, c);
      }
      if (m.sender === 'user' && !m.is_read) c.unread++;
    }
    const ids = [...convs.keys()];
    if (ids.length) {
      const { data: users } = await supabase.from('users').select('id, name, email').in('id', ids);
      for (const u of users || []) Object.assign(convs.get(u.id), { name: u.name, email: u.email });
    }
    res.json({ now: new Date().toISOString(), conversations: [...convs.values()] });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

router.get('/admin/unread', adminMiddleware, async (req, res) => {
  const { count } = await supabase
    .from('support_messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender', 'user').eq('is_read', false);
  res.json({ unread: count || 0 });
});

// Busca usuários pra iniciar conversa
router.get('/admin/users', adminMiddleware, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  const { data } = await supabase.from('users').select('id, name, email')
    .or(`name.ilike.%${q.replace(/[%,()]/g, '')}%,email.ilike.%${q.replace(/[%,()]/g, '')}%`).limit(10);
  res.json(data || []);
});

router.get('/admin/conversations/:userId/messages', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const msgs = await longPoll(req, userId, req.query.after, `user:${userId}`);
    if (gone(req)) return;
    if (msgs.some(m => m.sender === 'user' && !m.is_read)) {
      await supabase.from('support_messages').update({ is_read: true })
        .eq('user_id', userId).eq('sender', 'user').eq('is_read', false);
    }
    let user = null;
    if (!req.query.after) {
      ({ data: user } = await supabase.from('users').select('id, name, email').eq('id', userId).single());
    }
    res.json({ user, messages: msgs });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

router.post('/admin/conversations/:userId/messages', adminMiddleware, multerSingle, async (req, res) => {
  try {
    const { userId } = req.params;
    const body = cleanBody(req.body?.body);
    const att = await handleAttachment(req, userId);
    if (!body && !att) return res.status(400).json({ error: 'Mensagem vazia' });
    const msg = await insertMessage({ user_id: userId, sender: 'admin', body, ...(att || {}) });
    res.status(201).json(msg);
    notifyAfterInsert(msg);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Usuário ──────────────────────────────────────────────────────────────

router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const msgs = await longPoll(req, req.user.id, req.query.after, `user:${req.user.id}`);
    if (gone(req)) return;
    if (msgs.some(m => m.sender === 'admin' && !m.is_read)) {
      await supabase.from('support_messages').update({ is_read: true })
        .eq('user_id', req.user.id).eq('sender', 'admin').eq('is_read', false);
    }
    res.json(msgs);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

router.get('/unread', authMiddleware, async (req, res) => {
  const { count } = await supabase
    .from('support_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id).eq('sender', 'admin').eq('is_read', false);
  res.json({ unread: count || 0 });
});

router.post('/messages', authMiddleware, multerSingle, async (req, res) => {
  try {
    const body = cleanBody(req.body?.body);
    const att = await handleAttachment(req, req.user.id);
    if (!body && !att) return res.status(400).json({ error: 'Mensagem vazia' });
    const msg = await insertMessage({ user_id: req.user.id, sender: 'user', body, ...(att || {}) });
    res.status(201).json(msg);
    notifyAfterInsert(msg);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
