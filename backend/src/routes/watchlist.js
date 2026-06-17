const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', req.user.id)
      .order('added_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { content_type, content_id } = req.body;
  if (!content_type || !content_id) {
    return res.status(400).json({ error: 'content_type e content_id são obrigatórios' });
  }

  try {
    // Verifica se já existe
    const { data: existing } = await supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('content_id', content_id)
      .single();

    if (existing) return res.status(409).json({ error: 'Já está na lista' });

    const { data, error } = await supabase
      .from('watchlist')
      .insert({ user_id: req.user.id, content_type, content_id })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
