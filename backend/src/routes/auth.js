const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAnon } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

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

    if (authError) return res.status(400).json({ error: authError.message || authError.code || 'Erro ao criar conta' });

    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({ id: authData.user.id, email, name })
      .select()
      .single();

    if (userError) return res.status(400).json({ error: userError.message || userError.code || 'Erro ao salvar usuário' });

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

    if (authError) return res.status(401).json({ error: authError.message || 'Credenciais inválidas' });

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

module.exports = router;
