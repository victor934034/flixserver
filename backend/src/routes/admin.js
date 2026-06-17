const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { adminMiddleware } = require('../middleware/admin');

router.use(adminMiddleware);

// ---- STATS ----
router.get('/stats', async (req, res) => {
  try {
    const [movies, series, episodes, users] = await Promise.all([
      supabase.from('movies').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('series').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('episodes').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('users').select('id', { count: 'exact', head: true }),
    ]);

    const missingVideo = await supabase
      .from('movies')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('file_dubbing', null)
      .is('file_subtitled', null);

    res.json({
      movies: movies.count,
      series: series.count,
      episodes: episodes.count,
      users: users.count,
      movies_missing_video: missingVideo.count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- MOVIES CRUD ----
router.get('/movies', async (req, res) => {
  try {
    const { page = 1, limit = 30, q } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('movies')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (q) query = query.ilike('title', `%${q}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/movies', async (req, res) => {
  try {
    const { data, error } = await supabase.from('movies').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/movies/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('movies')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/movies/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('movies').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- SERIES CRUD ----
router.get('/series', async (req, res) => {
  try {
    const { page = 1, limit = 30, q } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('series')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (q) query = query.ilike('title', `%${q}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/series', async (req, res) => {
  try {
    const { data, error } = await supabase.from('series').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/series/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('series')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/series/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('series').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- EPISODES CRUD ----
router.get('/series/:id/episodes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('series_id', req.params.id)
      .order('season_number')
      .order('episode_number');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/episodes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('episodes').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/episodes/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('episodes')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/episodes/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('episodes').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- USUÁRIOS ----
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, plan, is_admin, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  const allowed = ['plan', 'plan_expires_at', 'is_admin', 'name'];
  const update = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  try {
    const { data, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- CATEGORIAS ----
router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories').select('*').order('order_index');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
