const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAnon } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

// In-memory TV device code store (code → { status, token, user, expiresAt })
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

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
  }

  try {
    const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (authError) {
      console.error('[register] Supabase authError:', JSON.stringify(authError));
      const isRetryable = authError.name === 'AuthRetryableFetchError' || authError.status >= 500;
      if (isRetryable) {
        return res.status(503).json({ error: 'Serviço de autenticação temporariamente indisponível. Verifique se o projeto Supabase está ativo e as variáveis de ambiente estão corretas.' });
      }
      const msg = authError.message || authError.msg || authError.error_description
        || authError.error || (typeof authError === 'string' ? authError : null)
        || 'Erro ao criar conta';
      return res.status(400).json({ error: msg });
    }

    if (!authData?.user) {
      return res.status(400).json({ error: 'Não foi possível criar a conta. Verifique se o email já está cadastrado.' });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({ id: authData.user.id, email, name })
      .select()
      .single();

    if (userError) {
      console.error('[register] Supabase userError:', JSON.stringify(userError));
      const msg = userError.message || userError.code || 'Erro ao salvar usuário';
      return res.status(400).json({ error: msg });
    }

    res.status(201).json({ user: userData, token: signToken(userData) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const isRetryable = authError.name === 'AuthRetryableFetchError' || authError.status >= 500;
      if (isRetryable) return res.status(503).json({ error: 'Serviço de autenticação temporariamente indisponível.' });
      return res.status(401).json({ error: authError.message || 'Credenciais inválidas' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError || !user) return res.status(404).json({ error: 'Usuário não encontrado' });

    res.json({ user, token: signToken(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// ── TV Device Code Login ──────────────────────────────────────────────────────

// TV requests a new code
router.post('/tv/code', (req, res) => {
  const code = generateTvCode();
  tvCodes.set(code, { status: 'pending', token: null, user: null, expiresAt: Date.now() + 600000 });
  setTimeout(() => tvCodes.delete(code), 600000);
  res.json({ code });
});

// TV polls for authorization status
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

// Mobile or web confirms the code
// Accepts: Bearer token (logged-in user) OR email+password in body
router.post('/tv/code/:code/confirm', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const entry = tvCodes.get(code);
  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(404).json({ error: 'Código inválido ou expirado' });
  }

  let user = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    // Logged-in user via token
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      const { data } = await supabase.from('users').select('*').eq('id', decoded.id).single();
      user = data;
    } catch {
      return res.status(401).json({ error: 'Token inválido' });
    }
  } else {
    // Email + password (web form)
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });
    const { data: authData, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: 'Credenciais inválidas' });
    const { data } = await supabase.from('users').select('*').eq('id', authData.user.id).single();
    user = data;
  }

  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  entry.status = 'authorized';
  entry.token = signToken(user);
  entry.user = { id: user.id, email: user.email, name: user.name };

  res.json({ success: true });
});

module.exports = router;
