const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');
const { sendPush } = require('../services/notifications');

// GET /api/suggestions/search-tmdb — busca no TMDB (filme+série juntos) pro
// usuário escolher o que sugerir. A tela de sugestão buscava no catálogo
// PRÓPRIO (/search), o que não fazia sentido: sugestão é justamente pra algo
// que ainda NÃO está no catálogo, então quase nunca aparecia resultado.
router.get('/search-tmdb', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);

  const axios = require('axios');
  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';
  const apiKey = process.env.TMDB_API_KEY;

  try {
    const [movieRes, tvRes] = await Promise.all([
      axios.get(`${TMDB_BASE}/search/movie`, { params: { api_key: apiKey, query: q, language: 'pt-BR' } }),
      axios.get(`${TMDB_BASE}/search/tv`, { params: { api_key: apiKey, query: q, language: 'pt-BR' } }),
    ]);

    const movies = (movieRes.data.results || []).map(r => ({
      id: r.id, type: 'movie',
      title: r.title, original_title: r.original_title,
      displayYear: (r.release_date || '').split('-')[0] || null,
      poster_url: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
    }));
    const series = (tvRes.data.results || []).map(r => ({
      id: r.id, type: 'series',
      title: r.name, original_title: r.original_name,
      displayYear: (r.first_air_date || '').split('-')[0] || null,
      poster_url: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
    }));

    // Intercala por popularidade (ordem que o TMDB já devolve) e limita
    const merged = [];
    const max = Math.max(movies.length, series.length);
    for (let i = 0; i < max; i++) {
      if (movies[i]) merged.push(movies[i]);
      if (series[i]) merged.push(series[i]);
    }
    res.json(merged.slice(0, 12));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/suggestions — envia sugestão (usuário autenticado)
router.post('/', authMiddleware, async (req, res) => {
  const { title, original_title, year, type, poster_url, tmdb_id, message } = req.body;
  if (!title) return res.status(400).json({ error: 'title obrigatório' });

  const userId = req.user.id;

  try {
    // Busca email do usuário para exibir no admin
    const { data: userRow } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single();

    const { data: suggestion, error } = await supabase
      .from('suggestions')
      .insert({
        user_id: userId,
        user_email: userRow?.email || req.user.email,
        user_name: userRow?.name || '',
        title,
        original_title: original_title || null,
        year: year || null,
        type: type || 'movie',
        poster_url: poster_url || null,
        tmdb_id: tmdb_id || null,
        message: message || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Notifica admins via push
    notifyAdmins(userRow?.name || 'Alguém', title).catch(() => {});

    res.json({ ok: true, id: suggestion.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function notifyAdmins(userName, title) {
  const { data: admins } = await supabase
    .from('users')
    .select('push_token')
    .eq('is_admin', true)
    .not('push_token', 'is', null);

  const tokens = (admins || []).map(a => a.push_token).filter(Boolean);
  if (!tokens.length) return;

  await sendPush(tokens, '💡 Nova sugestão', `${userName} sugeriu: ${title}`, { screen: 'suggestions' });
}

// GET /api/suggestions — lista todas as sugestões (admin)
router.get('/', adminMiddleware, async (req, res) => {
  const { status } = req.query;
  try {
    let q = supabase
      .from('suggestions')
      .select('*')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/suggestions/:id — atualiza status (admin)
router.put('/:id', adminMiddleware, async (req, res) => {
  const { status, note } = req.body;
  const allowed = ['pending', 'approved', 'rejected', 'added'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'status inválido' });

  try {
    const { error } = await supabase
      .from('suggestions')
      .update({ status, admin_note: note || null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/suggestions/:id (admin)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.from('suggestions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
