const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('user_id', req.user.id).order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  // Nunca devolve o PIN em si pro cliente — só se existe ou não, a
  // verificação de fato acontece no servidor via /verify-pin.
  const safe = (data || []).map(({ pin, ...p }) => ({ ...p, has_pin: !!pin }));
  res.json(safe);
});

// Confere o PIN de um perfil sem nunca expor o valor real ao cliente
router.post('/:id/verify-pin', async (req, res) => {
  const { pin } = req.body;
  const { data, error } = await supabase
    .from('profiles').select('pin').eq('id', req.params.id).eq('user_id', req.user.id).single();
  if (error || !data) return res.status(404).json({ error: 'Perfil não encontrado' });
  if (!data.pin) return res.json({ ok: true }); // sem PIN configurado, libera
  res.json({ ok: String(pin || '') === String(data.pin) });
});

router.post('/', async (req, res) => {
  const { name, avatar = 'avatar_1', is_kids = false, pin } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

  const { count } = await supabase
    .from('profiles').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
  if (count >= 5) return res.status(400).json({ error: 'Limite de 5 perfis por conta' });

  const { data, error } = await supabase
    .from('profiles')
    .insert({ user_id: req.user.id, name: name.trim(), avatar, is_kids, pin: pin ? String(pin).trim() : null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  const { pin: _pin, ...safe } = data;
  res.status(201).json({ ...safe, has_pin: !!_pin });
});

router.put('/:id', async (req, res) => {
  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name.trim();
  if (req.body.avatar !== undefined) updates.avatar = req.body.avatar;
  if (req.body.is_kids !== undefined) updates.is_kids = req.body.is_kids;
  // String vazia/null limpa o PIN (desativa a proteção do perfil)
  if (req.body.pin !== undefined) updates.pin = req.body.pin ? String(req.body.pin).trim() : null;

  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Perfil não encontrado' });
  const { pin: _pin, ...safe } = data;
  res.json({ ...safe, has_pin: !!_pin });
});

router.delete('/:id', async (req, res) => {
  const { count } = await supabase
    .from('profiles').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
  if (count <= 1) return res.status(400).json({ error: 'Não é possível excluir o único perfil' });

  const { error } = await supabase
    .from('profiles').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
