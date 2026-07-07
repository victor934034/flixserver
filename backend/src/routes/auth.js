const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAnon } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

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

// POST /auth/send-otp — Supabase Auth dispara o email via Resend SMTP
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const key = email.trim().toLowerCase();
  const { error } = await supabaseAnon.auth.signInWithOtp({
    email: key,
    options: { shouldCreateUser: true },
  });

  if (error) {
    console.error('[auth] send-otp error:', error.message);
    return res.status(500).json({ error: 'Erro ao enviar código. Tente novamente.' });
  }

  res.json({ ok: true });
});

// POST /auth/verify-otp — valida código via Supabase Auth e retorna JWT próprio
router.post('/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email e código são obrigatórios' });
  }

  const key = email.trim().toLowerCase();

  const { data: authData, error: authError } = await supabaseAnon.auth.verifyOtp({
    email: key,
    token: String(code).trim(),
    type: 'email',
  });

  if (authError || !authData?.user) {
    return res.status(400).json({ error: 'Código inválido ou expirado' });
  }

  try {
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', key)
      .single();

    if (findError && findError.code !== 'PGRST116') throw findError;

    if (user) {
      return res.json({ user, token: signToken(user) });
    }

    // Cria usuário novo usando o ID do Supabase Auth
    const name = key.split('@')[0].replace(/[._-]+/g, ' ').trim();
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({ id: authData.user.id, email: key, name })
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

// POST /auth/register-with-otp — verifica OTP e cria conta com senha
router.post('/register-with-otp', async (req, res) => {
  const { email, code, password, name } = req.body;
  if (!email || !code || !password || !name) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha muito curta' });
  }

  const key = email.trim().toLowerCase();

  // Verifica o OTP via Supabase Auth
  const { data: authData, error: authError } = await supabaseAnon.auth.verifyOtp({
    email: key,
    token: String(code).trim(),
    type: 'email',
  });

  if (authError || !authData?.user) {
    return res.status(400).json({ error: 'Código inválido ou expirado' });
  }

  try {
    // Define a senha no Supabase Auth
    await supabase.auth.admin.updateUserById(authData.user.id, { password });

    // Busca ou cria o usuário na nossa tabela
    const { data: existing } = await supabase
      .from('users').select('*').eq('email', key).single();

    if (existing) {
      return res.json({ user: existing, token: signToken(existing) });
    }

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({ id: authData.user.id, email: key, name: name.trim() })
      .select()
      .single();

    if (createError) {
      console.error('[auth] register-with-otp criar usuário:', createError);
      return res.status(500).json({ error: 'Erro ao criar conta. Contate o suporte.' });
    }

    res.status(201).json({ user: newUser, token: signToken(newUser) });
  } catch (e) {
    console.error('[auth] register-with-otp error:', e.message);
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
  const { error } = await supabase.from('users').update({ push_token: token }).eq('id', req.user.id);
  if (error) {
    console.error('[push-token] erro ao salvar token:', error.message);
    return res.status(500).json({ error: error.message });
  }
  console.log(`[push-token] token salvo para user ${req.user.id}: ${token.slice(0, 30)}...`);
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
