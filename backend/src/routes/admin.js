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
    if (data.is_active && data.title) {
      sendPushToAll(supabase, `🎬 ${data.title}`, 'Novo filme adicionado!', { screen: 'filme', id: data.id }).catch(() => {});
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
      sendPushToAll(supabase, `📺 ${data.title}`, 'Nova série adicionada!', { screen: 'serie', id: data.id }).catch(() => {});
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
    if (data.is_active && data.series_id) {
      const { data: serie } = await supabase.from('series').select('title').eq('id', data.series_id).single();
      const serieTitle = serie?.title || 'Série';
      const epLabel = data.season_number
        ? `T${data.season_number}E${String(data.episode_number).padStart(2, '0')}${data.title ? ` — ${data.title}` : ''} • Novo ep disponível`
        : `${data.title || 'Novo episódio'} • Novo ep disponível`;
      sendPushToAll(supabase, `📺 ${serieTitle}`, epLabel, { screen: 'serie', id: data.series_id }).catch(() => {});
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch de episódios — insere vários e envia UMA notificação por série
router.post('/episodes/batch', async (req, res) => {
  const { episodes } = req.body;
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return res.status(400).json({ error: 'episodes deve ser array não-vazio' });
  }
  try {
    const { data, error } = await supabase.from('episodes').insert(episodes).select();
    if (error) throw error;

    // Agrupa por série e envia uma push por série
    const bySeries = {};
    for (const ep of data || []) {
      if (!ep.series_id) continue;
      if (!bySeries[ep.series_id]) bySeries[ep.series_id] = [];
      bySeries[ep.series_id].push(ep);
    }
    for (const [seriesId, eps] of Object.entries(bySeries)) {
      const { data: serie } = await supabase.from('series').select('title').eq('id', seriesId).single();
      const serieTitle = serie?.title || 'Série';
      let body;
      if (eps.length === 1) {
        const ep = eps[0];
        body = ep.season_number
          ? `T${ep.season_number}E${String(ep.episode_number).padStart(2, '0')}${ep.title ? ` — ${ep.title}` : ''} • Novo ep disponível`
          : `${ep.title || 'Novo episódio'} • Novo ep disponível`;
      } else {
        body = `${eps.length} episódios foram adicionados`;
      }
      sendPushToAll(supabase, `📺 ${serieTitle}`, body, { screen: 'serie', id: seriesId }).catch(() => {});
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
  const allowed = ['plan', 'plan_expires_at', 'is_admin', 'name', 'avatar_url'];
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

// ---- LIKES STATS ----
router.get('/likes/stats', async (req, res) => {
  try {
    const { data: likes, error } = await supabase.from('likes').select('content_type, content_id, is_like');
    if (error) throw error;

    // Agrupa por conteúdo
    const map = {};
    for (const l of likes || []) {
      const key = `${l.content_type}:${l.content_id}`;
      if (!map[key]) map[key] = { content_type: l.content_type, content_id: l.content_id, likes: 0, dislikes: 0 };
      if (l.is_like) map[key].likes++; else map[key].dislikes++;
    }

    const movieIds = Object.values(map).filter(x => x.content_type === 'movie').map(x => x.content_id);
    const seriesIds = Object.values(map).filter(x => x.content_type === 'series').map(x => x.content_id);

    const [moviesRes, seriesRes] = await Promise.all([
      movieIds.length > 0 ? supabase.from('movies').select('id, title, poster_url, genres').in('id', movieIds) : { data: [] },
      seriesIds.length > 0 ? supabase.from('series').select('id, title, poster_url, genres').in('id', seriesIds) : { data: [] },
    ]);

    const contentMap = {};
    for (const m of moviesRes.data || []) contentMap[`movie:${m.id}`] = { ...m, type: 'movie' };
    for (const s of seriesRes.data || []) contentMap[`series:${s.id}`] = { ...s, type: 'series' };

    const items = Object.values(map).map(item => {
      const info = contentMap[`${item.content_type}:${item.content_id}`] || {};
      const total = item.likes + item.dislikes;
      return {
        ...item,
        title: info.title || 'Desconhecido',
        poster_url: info.poster_url || null,
        genres: info.genres || [],
        type: info.type || item.content_type,
        total,
        ratio: total > 0 ? Math.round((item.likes / total) * 100) : 0,
      };
    }).sort((a, b) => b.ratio - a.ratio || b.total - a.total);

    // Estatísticas por gênero
    const genreMap = {};
    for (const item of items) {
      for (const genre of (item.genres || [])) {
        if (!genreMap[genre]) genreMap[genre] = { genre, likes: 0, dislikes: 0 };
        genreMap[genre].likes += item.likes;
        genreMap[genre].dislikes += item.dislikes;
      }
    }
    const byGenre = Object.values(genreMap)
      .map(g => ({ ...g, total: g.likes + g.dislikes, ratio: Math.round((g.likes / (g.likes + g.dislikes)) * 100) }))
      .sort((a, b) => b.total - a.total);

    const totals = { likes: items.reduce((s, i) => s + i.likes, 0), dislikes: items.reduce((s, i) => s + i.dislikes, 0) };

    res.json({ items, byGenre, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- PRESET AVATARS ----
router.get('/preset-avatars', async (req, res) => {
  const { data, error } = await supabase.from('preset_avatars').select('*').order('order_index').order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/preset-avatars', async (req, res) => {
  const { url, label, order_index = 0, is_kids = false } = req.body;
  if (!url) return res.status(400).json({ error: 'url é obrigatório' });
  const { data, error } = await supabase.from('preset_avatars').insert({ url, label: label || null, order_index, is_kids }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/preset-avatars/:id', async (req, res) => {
  const allowed = ['url', 'label', 'is_active', 'order_index', 'is_kids'];
  const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const { data, error } = await supabase.from('preset_avatars').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/preset-avatars/:id', async (req, res) => {
  const { error } = await supabase.from('preset_avatars').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
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

// ---- IPTV TEST NOTIFY ----
router.post('/iptv/test-notify', async (req, res) => {
  try {
    const { notifyAdminIptvOrder } = require('../services/whatsapp');
    await notifyAdminIptvOrder({
      userName:  'João Teste',
      userEmail: 'joao@teste.com',
      planName:  '1 Mês s/ Adulto',
      amount:    29.90,
      paymentId: 'TEST-123456',
    });
    res.json({ ok: true, message: 'Notificação enviada! Verifique seu Telegram.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- IPTV PLANS ----
router.get('/iptv/plans', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('iptv_plans')
      .select('*')
      .order('order_index')
      .order('created_at');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/iptv/plans', async (req, res) => {
  const { name, description, price, duration_months, is_active, order_index } = req.body;
  if (!name || price == null || !duration_months) {
    return res.status(400).json({ error: 'name, price e duration_months são obrigatórios' });
  }
  try {
    const { data, error } = await supabase
      .from('iptv_plans')
      .insert({ name, description: description || null, price: Number(price), duration_months: Number(duration_months), is_active: is_active !== false, order_index: order_index || 0 })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/iptv/plans/:id', async (req, res) => {
  const allowed = ['name', 'description', 'price', 'duration_months', 'is_active', 'order_index'];
  const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase
      .from('iptv_plans')
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

router.delete('/iptv/plans/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('iptv_plans').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- IPTV ORDERS ----
router.get('/iptv/orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('iptv_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/iptv/orders/:id/activate', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('iptv_orders')
      .update({ status: 'activated' })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- IPTV CREDENTIALS ----
router.get('/iptv', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('iptv_credentials')
      .select('*, user:user_id(id, name, email)')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[admin/iptv] query error:', error.message);
      return res.json([]);
    }
    res.json(data || []);
  } catch (err) {
    console.warn('[admin/iptv] error:', err.message);
    res.json([]);
  }
});

router.post('/iptv', async (req, res) => {
  const { user_id, xc_username, xc_password, notes } = req.body;
  if (!user_id || !xc_username || !xc_password) {
    return res.status(400).json({ error: 'user_id, xc_username e xc_password são obrigatórios' });
  }
  try {
    const { data, error } = await supabase
      .from('iptv_credentials')
      .upsert(
        { user_id, xc_username, xc_password, notes: notes || null, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.status(503).json({ error: 'Tabela iptv_credentials não existe no banco. Crie-a no Supabase.' });
      }
      throw error;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/iptv/:userId/toggle', async (req, res) => {
  try {
    const { data: current, error: fetchErr } = await supabase
      .from('iptv_credentials')
      .select('active')
      .eq('user_id', req.params.userId)
      .single();
    if (fetchErr || !current) return res.status(404).json({ error: 'Credencial não encontrada' });

    const { data, error } = await supabase
      .from('iptv_credentials')
      .update({ active: !current.active, updated_at: new Date().toISOString() })
      .eq('user_id', req.params.userId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/iptv/:userId', async (req, res) => {
  try {
    const { error } = await supabase
      .from('iptv_credentials')
      .delete()
      .eq('user_id', req.params.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
