const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('user_id', req.user.id).order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/', async (req, res) => {
  const { name, avatar = 'avatar_1', is_kids = false } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

  const { count } = await supabase
    .from('profiles').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
  if (count >= 5) return res.status(400).json({ error: 'Limite de 5 perfis por conta' });

  const { data, error } = await supabase
    .from('profiles').insert({ user_id: req.user.id, name: name.trim(), avatar, is_kids }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', async (req, res) => {
  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name.trim();
  if (req.body.avatar !== undefined) updates.avatar = req.body.avatar;
  if (req.body.is_kids !== undefined) updates.is_kids = req.body.is_kids;

  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Perfil não encontrado' });
  res.json(data);
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
