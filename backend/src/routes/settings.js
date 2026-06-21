const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { adminMiddleware } = require('../middleware/admin');

// GET /api/settings — público
router.get('/', async (req, res) => {
  const { data } = await supabase.from('system_settings').select('key, value');
  const settings = {};
  (data || []).forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

// PUT /api/settings/:key — admin
router.put('/:key', adminMiddleware, async (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value é obrigatório' });
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key: req.params.key, value: String(value), updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, key: req.params.key, value: String(value) });
});

module.exports = router;
