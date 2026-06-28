const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const profileId = req.query.profile_id || req.headers['x-profile-id'] || null;

    let query = supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', req.user.id)
      .order('added_at', { ascending: false });

    if (profileId) query = query.eq('profile_id', profileId);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items || items.length === 0) return res.json([]);

    const movieIds = items.filter(i => i.content_type === 'movie').map(i => i.content_id);
    const seriesIds = items.filter(i => i.content_type === 'series').map(i => i.content_id);

    const [moviesRes, seriesRes] = await Promise.all([
      movieIds.length > 0
        ? supabase.from('movies').select('id, title, poster_url, year').in('id', movieIds)
        : { data: [] },
      seriesIds.length > 0
        ? supabase.from('series').select('id, title, poster_url, year_start').in('id', seriesIds)
        : { data: [] },
    ]);

    const moviesMap = Object.fromEntries((moviesRes.data || []).map(m => [m.id, m]));
    const seriesMap = Object.fromEntries((seriesRes.data || []).map(s => [s.id, s]));

    const enriched = items.map(item => {
      const meta = item.content_type === 'movie' ? moviesMap[item.content_id] : seriesMap[item.content_id];
      return { ...item, ...(meta || {}) };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { content_type, content_id, profile_id } = req.body;
  if (!content_type || !content_id) {
    return res.status(400).json({ error: 'content_type e content_id são obrigatórios' });
  }

  try {
    let findQ = supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('content_id', content_id);
    if (profile_id) findQ = findQ.eq('profile_id', profile_id);

    const { data: existing } = await findQ.single();

    if (existing) return res.status(409).json({ error: 'Já está na lista' });

    const { data, error } = await supabase
      .from('watchlist')
      .insert({ user_id: req.user.id, content_type, content_id, profile_id: profile_id || null })
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
