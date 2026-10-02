const router = require('express').Router();
const { supabase } = require('../services/supabase');

// GET /api/help — lista artigos de ajuda ativos, pro app/site exibir
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('help_articles')
      .select('id, question, answer, order_index')
      .eq('is_active', true)
      .order('order_index');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
