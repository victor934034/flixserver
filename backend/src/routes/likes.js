const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// GET /likes/:type/:id — retorna contagem e se o usuário atual deu like/dislike
router.get('/:type/:id', optionalAuth, async (req, res) => {
  const { type, id } = req.params;
  if (!['movie', 'series'].includes(type)) return res.status(400).json({ error: 'type inválido' });

  const [{ data: counts }, { data: mine }] = await Promise.all([
    supabase.from('likes')
      .select('is_like')
      .eq('content_type', type)
      .eq('content_id', id),
    req.user
      ? supabase.from('likes')
          .select('is_like')
          .eq('content_type', type)
          .eq('content_id', id)
          .eq('user_id', req.user.id)
          .single()
      : { data: null },
  ]);

  const likes = (counts || []).filter(r => r.is_like).length;
  const dislikes = (counts || []).filter(r => !r.is_like).length;

  res.json({ likes, dislikes, userVote: mine ? (mine.is_like ? 'like' : 'dislike') : null });
});

// POST /likes/:type/:id — like ou dislike (toggle)
router.post('/:type/:id', authMiddleware, async (req, res) => {
  const { type, id } = req.params;
  const { vote } = req.body; // 'like' | 'dislike'
  if (!['movie', 'series'].includes(type)) return res.status(400).json({ error: 'type inválido' });
  if (!['like', 'dislike'].includes(vote)) return res.status(400).json({ error: 'vote deve ser like ou dislike' });

  const is_like = vote === 'like';

  const { data: existing } = await supabase.from('likes')
    .select('id, is_like')
    .eq('content_type', type)
    .eq('content_id', id)
    .eq('user_id', req.user.id)
    .single();

  if (existing) {
    if (existing.is_like === is_like) {
      // Clicou no mesmo voto → remove (toggle off)
      await supabase.from('likes').delete().eq('id', existing.id);
      return res.json({ userVote: null });
    }
    // Troca voto
    await supabase.from('likes').update({ is_like }).eq('id', existing.id);
  } else {
    await supabase.from('likes').insert({
      user_id: req.user.id,
      content_type: type,
      content_id: id,
      is_like,
    });
  }

  res.json({ userVote: vote });
});

module.exports = router;
