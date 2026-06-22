const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAnon } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { sendOTP } = require('../services/email');

// OTP store: email → { code, sentAt, expiresAt, attempts }
const otpStore = new Map();

// TV device code store: code → { status, token, user, expiresAt }
const tvCodes = new Map();

function generateTvCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, is_admin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// POST /auth/register — cadastro com email + senha (via Supabase Auth)
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
  }
  try {
    const { data: authData, error: authError } = await supabaseAnon.auth.signUp({ email, password, options: { data: { name } } });
    if (authError) {
      const isRetryable = authError.name === 'AuthRetryableFetchError' || authError.status >= 500;
      if (isRetryable) return res.status(503).json({ error: 'Serviço temporariamente indisponível' });
      return res.status(400).json({ error: authError.message || 'Erro ao criar conta' });
    }
    if (!authData?.user) return res.status(400).json({ error: 'Não foi possível criar a conta' });

    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({ id: authData.user.id, email, name })
      .select()
      .single();
    if (userError) return res.status(400).json({ error: userError.message });

    res.status(201).json({ user: userData, token: signToken(userData) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login — login com email + senha (via Supabase Auth)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  try {
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (authError) {
      const isRetryable = authError.name === 'AuthRetryableFetchError' || authError.status >= 500;
      if (isRetryable) return res.status(503).json({ error: 'Serviço temporariamente indisponível' });
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    const { data: user, error: userError } = await supabase
      .from('users').select('*').eq('id', authData.user.id).single();
    if (userError || !user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ user, token: signToken(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/send-otp — envia código de 6 dígitos por email (Resend)
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const key = email.trim().toLowerCase();

  // Rate limit: 1 OTP por email a cada 60s
  const existing = otpStore.get(key);
  if (existing && Date.now() - existing.sentAt < 60_000) {
    const wait = Math.ceil((60_000 - (Date.now() - existing.sentAt)) / 1000);
    return res.status(429).json({ error: `Aguarde ${wait}s antes de solicitar um novo código` });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(key, { code, sentAt: Date.now(), expiresAt: Date.now() + 10 * 60_000, attempts: 0 });
  setTimeout(() => otpStore.delete(key), 10 * 60_000);

  try {
    await sendOTP(key, code);
    res.json({ ok: true });
  } catch (e) {
    console.error('[auth] send-otp error:', e.response?.data || e.message);
    otpStore.delete(key);
    res.status(500).json({ error: 'Erro ao enviar email. Tente novamente.' });
  }
});

// POST /auth/verify-otp — valida código e retorna JWT + usuário
router.post('/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email e código são obrigatórios' });
  }

  const key = email.trim().toLowerCase();
  const entry = otpStore.get(key);

  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(400).json({ error: 'Código expirado. Solicite um novo.' });
  }

  entry.attempts = (entry.attempts || 0) + 1;
  if (entry.attempts > 5) {
    otpStore.delete(key);
    return res.status(429).json({ error: 'Muitas tentativas. Solicite um novo código.' });
  }

  if (entry.code !== String(code).trim()) {
    return res.status(400).json({ error: 'Código incorreto' });
  }

  otpStore.delete(key);

  try {
    // Busca usuário existente
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', key)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      throw findError;
    }

    if (user) {
      return res.json({ user, token: signToken(user) });
    }

    // Cria usuário novo automaticamente
    const name = key.split('@')[0].replace(/[._-]+/g, ' ').trim();
    const id = crypto.randomUUID();
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({ id, email: key, name })
      .select()
      .single();

    if (createError) {
      console.error('[auth] verify-otp criar usuário:', createError);
      return res.status(500).json({ error: 'Erro ao criar conta. Contate o suporte.' });
    }

    res.json({ user: newUser, token: signToken(newUser) });
  } catch (e) {
    console.error('[auth] verify-otp error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, avatar_url, plan, plan_expires_at, is_admin, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/push-token
router.post('/push-token', authMiddleware, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token é obrigatório' });
  await supabase.from('users').update({ push_token: token }).eq('id', req.user.id);
  res.json({ ok: true });
});

// ── TV Device Code Login ──────────────────────────────────────────────────────

router.post('/tv/code', (req, res) => {
  const code = generateTvCode();
  tvCodes.set(code, { status: 'pending', token: null, user: null, expiresAt: Date.now() + 600_000 });
  setTimeout(() => tvCodes.delete(code), 600_000);
  res.json({ code });
});

router.get('/tv/code/:code', (req, res) => {
  const entry = tvCodes.get(req.params.code.toUpperCase());
  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(404).json({ error: 'Código inválido ou expirado' });
  }
  if (entry.status === 'authorized') {
    return res.json({ status: 'authorized', token: entry.token, user: entry.user });
  }
  res.json({ status: 'pending' });
});

// Mobile confirma o código da TV via Bearer token (usuário já logado)
router.post('/tv/code/:code/confirm', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const entry = tvCodes.get(code);
  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(404).json({ error: 'Código inválido ou expirado' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autenticação necessária' });
  }

  let user = null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const { data } = await supabase.from('users').select('*').eq('id', decoded.id).single();
    user = data;
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }

  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  entry.status = 'authorized';
  entry.token = signToken(user);
  entry.user = { id: user.id, email: user.email, name: user.name };

  res.json({ success: true });
});

module.exports = router;
