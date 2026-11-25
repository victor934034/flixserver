const router = require('express').Router();
const { supabase, fetchAll } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { removeFromContinue } = require('../services/continueWatching');

router.use(authMiddleware);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const UUID = /^[0-9a-f-]{36}$/i;
const profileOf = req => {
  const id = req.query.profile_id || req.body?.profile_id || req.headers['x-profile-id'];
  return id && UUID.test(String(id)) ? String(id) : null;
};
const scoped = (query, userId, profileId) => {
  const q = query.eq('user_id', userId);
  return profileId ? q.eq('profile_id', profileId) : q.is('profile_id', null);
};

// GET /api/watched?profile_id=X — { enabled, items: [{ content_type, content_id }] }
router.get('/', async (req, res) => {
  const { data, error } = await fetchAll(() =>
    scoped(supabase.from('watched_marks').select('id, content_type, content_id'), req.user.id, profileOf(req)).order('id'));
  // sem a migração no banco, os apps só escondem o recurso
  if (error) return res.json({ enabled: false, items: [] });
  res.json({ enabled: true, items: (data || []).map(({ content_type, content_id }) => ({ content_type, content_id })) });
});

// PUT /api/watched { content_type: 'movie'|'series', content_id, watched: true|false, profile_id }
router.put('/', async (req, res) => {
  const { content_type: type, content_id: id, watched } = req.body || {};
  if (!['movie', 'series'].includes(type) || !UUID.test(String(id || '')) || typeof watched !== 'boolean') {
    return res.status(400).json({ error: 'Dados inválidos' });
  }
  const profileId = profileOf(req);
  try {
    if (!watched) {
      const { error } = await scoped(supabase.from('watched_marks').delete(), req.user.id, profileId)
        .eq('content_type', type).eq('content_id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('watched_marks')
        .insert({ user_id: req.user.id, profile_id: profileId, content_type: type, content_id: id });
      if (error && error.code !== '23505') throw error; // 23505 = já estava marcado
      // quem já viu não precisa do título no "Continuar assistindo"
      await removeFromContinue(supabase, { userId: req.user.id, profileId, type, id });
    }
    res.json({ ok: true, watched });
  } catch (e) {
    console.error('[watched] erro:', e.message);
    res.status(500).json({ error: 'Não foi possível salvar.' });
  }
});

module.exports = router;
