const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');
const { sendPush } = require('../services/notifications');

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
