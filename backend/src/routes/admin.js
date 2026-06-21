const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { adminMiddleware } = require('../middleware/admin');
const { sendPushToAll } = require('../services/notifications');

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

// ---- SCAN BUCKET ----
router.get('/scan-bucket', async (req, res) => {
  try {
    const { listFiles } = require('../services/backblaze');
    const CDN = process.env.CDN_BASE_URL;

    // Lista todos os vídeos no bucket
    const b2Files = await listFiles();

    // Coleta todas as URLs já cadastradas no banco
    const [moviesRes, episodesRes] = await Promise.all([
      supabase.from('movies').select('file_dubbing, file_subtitled, file_cinema, file_4k').not('id', 'is', null),
      supabase.from('episodes').select('file_dubbing, file_subtitled, file_cinema').not('id', 'is', null),
    ]);

    if (moviesRes.error) console.warn('[scan-bucket] movies query error:', moviesRes.error.message);
    if (episodesRes.error) console.warn('[scan-bucket] episodes query error:', episodesRes.error.message);

    const registeredUrls = new Set();
    for (const m of moviesRes.data || []) {
      [m.file_dubbing, m.file_subtitled, m.file_cinema, m.file_4k]
        .filter(Boolean).forEach(u => registeredUrls.add(u));
    }
    for (const e of episodesRes.data || []) {
      [e.file_dubbing, e.file_subtitled, e.file_cinema]
        .filter(Boolean).forEach(u => registeredUrls.add(u));
    }

    // Filtra os arquivos que NÃO estão cadastrados
    const { extractInfo } = require('../../tmdb-bot');
    const newFiles = b2Files
      .filter(f => !registeredUrls.has(`${CDN}/${f.fileName}`))
      .map(f => {
        const info = extractInfo(f.fileName);
        return {
          fileName: f.fileName,
          cdnUrl: `${CDN}/${f.fileName}`,
          size: f.contentLength,
          detectedName: info.name,
          detectedType: info.type,
          detectedSeason: info.season,
          detectedEpisode: info.episode,
          version: detectVersionFromName(f.fileName),
        };
      });

    res.json({
      totalInBucket: b2Files.length,
      alreadyRegistered: b2Files.length - newFiles.length,
      newFiles,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Importa arquivos selecionados do bucket
router.post('/scan-bucket/import', async (req, res) => {
  const { files } = req.body; // [{ cdnUrl, version }]
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files é obrigatório' });
  }
  try {
    const { processFiles } = require('../../tmdb-bot');
    const report = await processFiles(files.map(f => ({ url: f.cdnUrl, version: f.version || 'dubbing' })));
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function detectVersionFromName(filename = '') {
  const lower = filename.toLowerCase();
  if (lower.includes('legendado') || lower.includes('sub') || lower.includes('leg')) return 'subtitled';
  if (lower.includes('cinema') || lower.includes('original')) return 'cinema';
  if (lower.includes('4k') || lower.includes('2160p')) return '4k';
  return 'dubbing';
}

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
    // Notifica todos os usuários sobre o novo filme
    if (data.is_active && data.title) {
      sendPushToAll(supabase, '🎬 Novo filme disponível!', data.title, { type: 'movie', id: data.id }).catch(() => {});
    }
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
    if (data.is_active && data.title) {
      sendPushToAll(supabase, '📺 Nova série disponível!', data.title, { type: 'series', id: data.id }).catch(() => {});
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/series/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('series').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json(data);
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
    // Notifica sobre novo episódio
    if (data.title && data.series_id) {
      const { data: serie } = await supabase.from('series').select('title').eq('id', data.series_id).single();
      const serieTitle = serie?.title || 'Série';
      const epLabel = data.season_number ? `T${data.season_number}E${data.episode_number} — ${data.title}` : data.title;
      sendPushToAll(supabase, `📺 Novo episódio: ${serieTitle}`, epLabel, { type: 'episode', seriesId: data.series_id }).catch(() => {});
    }
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
      .select('id, email, name, plan, plan_expires_at, is_admin, created_at, push_token')
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

// Notificação push manual para todos os usuários
router.post('/notify', async (req, res) => {
  const { title, body, data = {} } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title e body são obrigatórios' });
  sendPushToAll(supabase, title, body, data).catch(() => {});
  res.json({ ok: true });
});

// Gerenciamento de assinaturas de usuários (para o painel admin)
router.get('/users/subscriptions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, plan, plan_expires_at, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/subscription', async (req, res) => {
  const { plan, plan_expires_at, add_days, clear } = req.body;
  try {
    let update = {};

    if (clear) {
      update = { plan: null, plan_expires_at: null };
    } else if (add_days) {
      // Adiciona dias à assinatura atual (ou começa do hoje)
      const { data: current } = await supabase.from('users').select('plan_expires_at, plan').eq('id', req.params.id).single();
      const base = current?.plan_expires_at && new Date(current.plan_expires_at) > new Date()
        ? new Date(current.plan_expires_at)
        : new Date();
      base.setDate(base.getDate() + Number(add_days));
      update = { plan: plan || current?.plan || 'monthly_2', plan_expires_at: base.toISOString() };
    } else {
      if (plan !== undefined) update.plan = plan;
      if (plan_expires_at !== undefined) update.plan_expires_at = plan_expires_at;
    }

    const { data, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', req.params.id)
      .select('id, name, email, plan, plan_expires_at')
      .single();
    if (error) throw error;

    if (update.plan && data) {
      const { data: u } = await supabase.from('users').select('push_token').eq('id', req.params.id).single();
      if (u?.push_token) {
        const { sendPush } = require('../services/notifications');
        sendPush([u.push_token], '🎉 Assinatura ativada!', 'Sua assinatura FlixHome está ativa. Bom filme!', { screen: 'home' }).catch(() => {});
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
