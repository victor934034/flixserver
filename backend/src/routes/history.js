const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const profileId = req.query.profile_id || req.headers['x-profile-id'] || null;

    let query = supabase
      .from('watch_history')
      .select('*')
      .eq('user_id', req.user.id)
      .order('last_watched', { ascending: false })
      .limit(50);

    // Sem isso, quando profileId não vem, a query retorna o histórico de TODOS os
    // perfis da conta misturado (inclusive teria mostrado o de outro perfil).
    query = profileId ? query.eq('profile_id', profileId) : query.is('profile_id', null);

    const { data: items, error } = await query;

    if (error) throw error;
    if (!items || items.length === 0) return res.json([]);

    const movieIds = items.filter(i => i.content_type === 'movie').map(i => i.content_id);
    const episodeIds = items.filter(i => i.content_type === 'episode').map(i => i.content_id);

    const [moviesRes, episodesRes] = await Promise.all([
      movieIds.length > 0
        ? supabase.from('movies').select('id, title, poster_url, year').in('id', movieIds)
        : { data: [] },
      episodeIds.length > 0
        ? supabase.from('episodes').select('id, title, thumbnail_url, season_number, episode_number, series_id').in('id', episodeIds)
        : { data: [] },
    ]);

    const moviesMap = Object.fromEntries((moviesRes.data || []).map(m => [m.id, m]));
    const episodesMap = Object.fromEntries((episodesRes.data || []).map(e => [e.id, e]));

    // Fetch series info for episodes
    const seriesIds = [...new Set(
      (episodesRes.data || []).map(e => e.series_id).filter(Boolean)
    )];
    let seriesMap = {};
    if (seriesIds.length > 0) {
      const { data: seriesData } = await supabase
        .from('series')
        .select('id, title, poster_url')
        .in('id', seriesIds);
      seriesMap = Object.fromEntries((seriesData || []).map(s => [s.id, s]));
    }

    const enriched = items.map(item => {
      if (item.content_type === 'movie') {
        const meta = moviesMap[item.content_id] || {};
        return { ...item, title: meta.title, poster_url: meta.poster_url };
      }
      const ep = episodesMap[item.content_id] || {};
      const serie = seriesMap[ep.series_id] || {};
      return {
        ...item,
        title: serie.title,
        poster_url: serie.poster_url,
        episode_title: ep.title,
        season_number: ep.season_number,
        episode_number: ep.episode_number,
        series_id: ep.series_id || item.series_id,
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/history/:id — tira o título do "Continuar assistindo".
// Apaga só o que está pela metade; o que já foi concluído continua no histórico.
// Em série, vale para todos os episódios dela (senão outro episódio pela metade voltaria).
router.delete('/:id', async (req, res) => {
  try {
    const { data: row } = await supabase.from('watch_history')
      .select('id, content_type, content_id, series_id, profile_id')
      .eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!row) return res.status(404).json({ error: 'Item não encontrado' });

    let contentIds = [row.content_id];
    if (row.content_type === 'episode') {
      const { data: ep } = await supabase.from('episodes').select('series_id').eq('id', row.content_id).single();
      const seriesId = ep?.series_id || row.series_id;
      if (seriesId) {
        const { data: eps } = await supabase.from('episodes').select('id').eq('series_id', seriesId);
        if (eps?.length) contentIds = eps.map(e => e.id);
      }
    }

    // Em lotes: séries longas estourariam o tamanho da URL do banco
    for (let i = 0; i < contentIds.length; i += 100) {
      let q = supabase.from('watch_history').delete()
        .eq('user_id', req.user.id)
        .in('content_id', contentIds.slice(i, i + 100))
        .or('completed.is.null,completed.eq.false');
      q = row.profile_id ? q.eq('profile_id', row.profile_id) : q.is('profile_id', null);
      const { error } = await q;
      if (error) throw error;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[history] DELETE error:', err.message);
    res.status(500).json({ error: 'Não foi possível remover.' });
  }
});

router.post('/', async (req, res) => {
  const { content_type, content_id, episode_id, series_id, progress, duration, profile_id } = req.body;
  if (!content_type || !content_id) {
    return res.status(400).json({ error: 'content_type e content_id são obrigatórios' });
  }

  try {
    const completed = duration > 0 ? progress / duration >= 0.9 : false;

    let findQ = supabase
      .from('watch_history')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('content_id', content_id);
    // .eq(col, null) NÃO funciona no PostgREST (nunca casa com linhas NULL) —
    // precisa ser .is(). Sem isso, filme (episode_id sempre null) nunca achava
    // o registro existente e toda atualização virava tentativa de inserir de novo.
    findQ = episode_id ? findQ.eq('episode_id', episode_id) : findQ.is('episode_id', null);
    // Sem isso (quando profile_id não vem), a busca ignorava profile_id por completo
    // e podia achar/atualizar a linha de OUTRO perfil da mesma conta.
    findQ = profile_id ? findQ.eq('profile_id', profile_id) : findQ.is('profile_id', null);

    const { data: existing } = await findQ.single();

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
        .insert({ user_id: req.user.id, content_type, content_id, episode_id, series_id, progress, duration, completed, profile_id: profile_id || null })
        .select()
        .single();
      if (error && error.code === '23505') {
        // Corrida rara: outra requisição inseriu entre o find e o insert acima —
        // ao invés de falhar, atualiza a linha que acabou de aparecer.
        let retryQ = supabase.from('watch_history').select('id')
          .eq('user_id', req.user.id).eq('content_id', content_id);
        retryQ = episode_id ? retryQ.eq('episode_id', episode_id) : retryQ.is('episode_id', null);
        retryQ = profile_id ? retryQ.eq('profile_id', profile_id) : retryQ.is('profile_id', null);
        const { data: justInserted } = await retryQ.single();
        if (justInserted) {
          const { data: updated, error: updErr } = await supabase
            .from('watch_history')
            .update({ progress, duration, completed, last_watched: new Date().toISOString() })
            .eq('id', justInserted.id)
            .select()
            .single();
          if (updErr) throw updErr;
          result = updated;
        } else {
          throw error;
        }
      } else if (error) {
        throw error;
      } else {
        result = data;
      }
    }

    res.json(result);
  } catch (err) {
    console.error('[history] POST error:', { body: req.body, message: err.message, code: err.code, details: err.details, hint: err.hint });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
