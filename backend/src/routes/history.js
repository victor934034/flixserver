const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('watch_history')
      .select('*')
      .eq('user_id', req.user.id)
      .order('last_watched', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { content_type, content_id, episode_id, progress, duration } = req.body;
  if (!content_type || !content_id) {
    return res.status(400).json({ error: 'content_type e content_id são obrigatórios' });
  }

  try {
    const completed = duration > 0 ? progress / duration >= 0.9 : false;

    const { data: existing } = await supabase
      .from('watch_history')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('content_id', content_id)
      .eq('episode_id', episode_id || null)
      .single();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('watch_history')
        .update({ progress, duration, completed, last_watched: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('watch_history')
        .insert({ user_id: req.user.id, content_type, content_id, episode_id, progress, duration, completed })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
