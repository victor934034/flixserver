const router = require('express').Router();
const { supabase } = require('../services/supabase');

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Episódio não encontrado' });

    supabase
      .from('episodes')
      .update({ views: (data.views || 0) + 1 })
      .eq('id', req.params.id)
      .then(() => {});

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
