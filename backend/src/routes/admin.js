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
    const { data, error } = await supabase
      .from('episodes')
      .upsert(req.body, { onConflict: 'series_id,season_number,episode_number', ignoreDuplicates: false })
      .select()
      .single();
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

// Quantidade de tokens de push registrados
router.get('/push-tokens/count', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('push_token')
      .not('push_token', 'is', null);
    if (error) return res.status(500).json({ error: error.message });
    const valid = (data || []).filter(u => u.push_token?.startsWith('ExponentPushToken'));
    res.json({ total: (data || []).length, valid: valid.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Notificação push manual para todos os usuários
router.post('/notify', async (req, res) => {
  const { title, body, data = {} } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title e body são obrigatórios' });
  try {
    const count = await sendPushToAll(supabase, title, body, data);
    res.json({ ok: true, sent: count });
  } catch {
    res.json({ ok: true, sent: 0 });
  }
});

// ── Limpeza de arquivos HLS (.ts + .m3u8) do Backblaze ───────────────────────

const hlsCleanJobs = new Map();

// Escaneia o bucket e retorna a contagem + tamanho total dos arquivos HLS
router.get('/hls-cleanup/scan', async (req, res) => {
  try {
    const { listHlsFiles } = require('../services/backblaze');
    const files = await listHlsFiles();
    const totalBytes = files.reduce((s, f) => s + (f.contentLength || 0), 0);
    const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
    const totalGB = (totalBytes / 1024 / 1024 / 1024).toFixed(2);
    res.json({
      count: files.length,
      totalBytes,
      totalMB: Number(totalMB),
      totalGB: Number(totalGB),
      display: totalBytes >= 1024 * 1024 * 1024 ? `${totalGB} GB` : `${totalMB} MB`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Inicia a deleção em background e retorna um jobId para polling
router.post('/hls-cleanup/delete', async (req, res) => {
  try {
    const { listHlsFiles, deleteFile } = require('../services/backblaze');
    const files = await listHlsFiles();
    if (files.length === 0) return res.json({ ok: true, jobId: null, total: 0, message: 'Nenhum arquivo HLS encontrado.' });

    const jobId = `hls_clean_${Date.now()}`;
    hlsCleanJobs.set(jobId, { total: files.length, done: 0, errors: 0, running: true, lastFile: '', lastError: '' });
    res.json({ ok: true, jobId, total: files.length });

    // Deleta em background com concorrência de 10
    (async () => {
      const job = hlsCleanJobs.get(jobId);
      const CONCURRENCY = 10;
      for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        await Promise.allSettled(batch.map(async f => {
          try {
            await deleteFile(f.fileId, f.fileName);
            job.done++;
            job.lastFile = f.fileName;
          } catch (e) {
            job.errors++;
            job.lastError = `${f.fileName}: ${e.message?.slice(0, 80)}`;
            console.error('[hls-cleanup] erro ao deletar', f.fileName, e.message);
          }
        }));
      }
      job.running = false;
      console.log(`[hls-cleanup] concluído: ${job.done} deletados, ${job.errors} erros`);
    })();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Progresso do job de limpeza HLS
router.get('/hls-cleanup/status', (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId obrigatório' });
  const job = hlsCleanJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado.' });
  res.json(job);
});

// ── Reorganização de arquivos de séries em pastas no Backblaze ───────────────

// Detecta se um arquivo é episódio de série e retorna o novo path organizado
// Retorna null se for filme ou já estiver organizado
function detectSeriesNewPath(fileName) {
  if (fileName.startsWith('series/')) return null; // já organizado
  const slash = fileName.lastIndexOf('/');
  const base = slash >= 0 ? fileName.slice(slash + 1) : fileName;
  const match = base.match(/^(.+?)[.\s_-]+(?:[SsTt](\d{1,2})[Ee]|(\d{1,2})x)\d{1,2}/i);
  if (!match) return null;
  const raw = match[1];
  const season = parseInt(match[2] || match[3], 10);
  if (isNaN(season)) return null;
  const name = raw.replace(/[._]/g, ' ')
    .replace(/\b(1080p|720p|4k|2160p|bluray|webrip|bdrip|hdrip|hdtv|x264|x265|hevc|aac|br)\b/gi, '')
    .trim();
  if (!name) return null;
  const folderName = name.replace(/\s+/g, '.').replace(/[^a-zA-Z0-9.\-_]/g, '').replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
  if (!folderName) return null;
  const { sanitizeFilename } = require('../services/backblaze');
  const seasonFolder = `Temporada${String(season).padStart(2, '0')}`;
  return `series/${folderName}/Temporada${String(season).padStart(2, '0')}/${sanitizeFilename(base)}`;
}

function buildCandidates(b2Files, CDN) {
  const candidates = [];
  for (const f of b2Files) {
    const newPath = detectSeriesNewPath(f.fileName);
    if (!newPath) continue;
    candidates.push({
      fileId: f.fileId,
      oldFileName: f.fileName,
      newFileName: newPath,
      oldCdnEncoded: `${CDN}/${encodeURIComponent(f.fileName)}`,
      oldCdnRaw: `${CDN}/${f.fileName}`,
      newCdnUrl: `${CDN}/${encodeURIComponent(newPath)}`,
      size: f.contentLength,
    });
  }
  return candidates;
}

const reorganizeJobs = new Map();

// Prévia: mostra quais arquivos seriam movidos
router.get('/reorganize/scan', async (req, res) => {
  try {
    const { listFiles } = require('../services/backblaze');
    const b2Files = await listFiles('', 100000);
    const candidates = buildCandidates(b2Files, process.env.CDN_BASE_URL);
    res.json({
      total: candidates.length,
      preview: candidates.slice(0, 50).map(c => ({ old: c.oldFileName, new: c.newFileName, size: c.size })),
      hasMore: candidates.length > 50,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Inicia reorganização em background: copia para novo path → atualiza banco → deleta original
router.post('/reorganize/start', async (req, res) => {
  try {
    const { listFiles, copyFile, deleteFile } = require('../services/backblaze');
    const CDN = process.env.CDN_BASE_URL;

    const b2Files = await listFiles('', 100000);
    const candidates = buildCandidates(b2Files, CDN);

    if (candidates.length === 0) {
      return res.json({ ok: true, jobId: null, total: 0, message: 'Nenhum arquivo para reorganizar.' });
    }

    const jobId = `reorg_${Date.now()}`;
    reorganizeJobs.set(jobId, { total: candidates.length, done: 0, errors: 0, running: true, lastFile: '', lastError: '' });
    res.json({ ok: true, jobId, total: candidates.length });

    (async () => {
      const job = reorganizeJobs.get(jobId);
      const MOVIE_FIELDS = ['file_dubbing', 'file_subtitled', 'file_cinema', 'file_4k'];
      const EP_FIELDS = ['file_dubbing', 'file_subtitled', 'file_cinema'];

      for (const c of candidates) {
        try {
          job.lastFile = c.oldFileName;

          // 1. Copia server-side no B2 (sem usar banda)
          await copyFile(c.fileId, c.newFileName);

          // 2. Atualiza banco — testa URL com e sem encodeURIComponent
          for (const oldUrl of [c.oldCdnEncoded, c.oldCdnRaw]) {
            for (const field of MOVIE_FIELDS) {
              await supabase.from('movies').update({ [field]: c.newCdnUrl }).eq(field, oldUrl);
            }
            for (const field of EP_FIELDS) {
              await supabase.from('episodes').update({ [field]: c.newCdnUrl }).eq(field, oldUrl);
            }
          }

          // 3. Deleta original (só depois do banco atualizado)
          await deleteFile(c.fileId, c.oldFileName);

          job.done++;
          console.log(`[reorg] ${job.done}/${job.total}: ${c.oldFileName} → ${c.newFileName}`);
        } catch (e) {
          job.errors++;
          job.lastError = `${c.oldFileName}: ${e.message?.slice(0, 100)}`;
          console.error('[reorg] erro:', c.oldFileName, e.message);
        }
      }
      job.running = false;
      console.log(`[reorg] concluído: ${job.done} ok, ${job.errors} erros`);
    })();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/reorganize/status', (req, res) => {
  const { jobId } = req.query;
  const job = reorganizeJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado.' });
  res.json(job);
});

// ── Detecção e remoção de arquivos duplicados no Backblaze ───────────────────

const dupDeleteJobs = new Map();

// Agrupa por SHA1 real ou por tamanho (≥ 50 MB) como fallback
// Cruza com o banco para marcar qual arquivo manter
router.get('/duplicates/scan', async (req, res) => {
  try {
    const { listFiles } = require('../services/backblaze');
    const CDN = process.env.CDN_BASE_URL;
    const MIN_SIZE_FOR_SIZE_GROUP = 50 * 1024 * 1024; // 50 MB (só agrupa por tamanho acima disto)

    const b2Files = await listFiles('', 100000);

    const [moviesRes, episodesRes] = await Promise.all([
      supabase.from('movies').select('file_dubbing, file_subtitled, file_cinema, file_4k'),
      supabase.from('episodes').select('file_dubbing, file_subtitled, file_cinema'),
    ]);
    const dbUrls = new Set();
    for (const m of moviesRes.data || []) {
      [m.file_dubbing, m.file_subtitled, m.file_cinema, m.file_4k].filter(Boolean).forEach(u => dbUrls.add(u));
    }
    for (const e of episodesRes.data || []) {
      [e.file_dubbing, e.file_subtitled, e.file_cinema].filter(Boolean).forEach(u => dbUrls.add(u));
    }

    const byKey = new Map();
    for (const f of b2Files) {
      const sha1 = f.contentSha1;
      const isRealSha1 = sha1 && sha1.length === 40 && sha1 !== 'none';
      // SHA1 real: inclui qualquer tamanho (identidade garantida)
      // Sem SHA1: só agrupa arquivos ≥ 50 MB (evita falsos positivos)
      if (!isRealSha1 && f.contentLength < MIN_SIZE_FOR_SIZE_GROUP) continue;
      const key = isRealSha1 ? `sha1:${sha1}` : `size:${f.contentLength}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(f);
    }

    const groups = [];
    for (const [key, files] of byKey) {
      if (files.length < 2) continue;

      const withInfo = files.map(f => {
        const cdnEncoded = `${CDN}/${encodeURIComponent(f.fileName)}`;
        const cdnRaw = `${CDN}/${f.fileName}`;
        const inDb = dbUrls.has(cdnEncoded) || dbUrls.has(cdnRaw);
        return { fileId: f.fileId, fileName: f.fileName, size: f.contentLength, uploadedAt: f.uploadTimestamp, inDb };
      });

      // Prioridade para manter:
      // 1) MAIOR TAMANHO — nunca deletar arquivo com conteúdo em favor de um vazio
      // 2) Está no banco de dados
      // 3) Mais recente
      const maxSize = Math.max(...withInfo.map(f => f.size));
      const topCandidates = withInfo.map((f, i) => ({ ...f, origIdx: i })).filter(f => f.size === maxSize);
      let keepOrigIdx;
      const inDbTop = topCandidates.find(f => f.inDb);
      if (inDbTop) {
        keepOrigIdx = inDbTop.origIdx;
      } else {
        keepOrigIdx = topCandidates.reduce((bestIdx, f) =>
          (f.uploadedAt || 0) > (withInfo[bestIdx].uploadedAt || 0) ? f.origIdx : bestIdx,
          topCandidates[0].origIdx
        );
      }

      const wastedSize = withInfo.reduce((s, f, i) => i !== keepOrigIdx ? s + f.size : s, 0);
      groups.push({
        byHash: key.startsWith('sha1:'),
        count: files.length,
        wastedSize,
        files: withInfo.map((f, i) => ({ ...f, keep: i === keepOrigIdx })),
      });
    }

    const totalWasted = groups.reduce((s, g) => s + g.wastedSize, 0);
    res.json({
      totalGroups: groups.length,
      totalDuplicates: groups.reduce((s, g) => s + g.count - 1, 0),
      totalWastedBytes: totalWasted,
      display: totalWasted >= 1073741824
        ? `${(totalWasted / 1073741824).toFixed(2)} GB`
        : `${(totalWasted / 1048576).toFixed(0)} MB`,
      groups,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Deleta os arquivos marcados como duplicata (recebe lista {fileId, fileName})
router.post('/duplicates/delete', async (req, res) => {
  const { files } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files é obrigatório' });
  }
  try {
    const { deleteFile } = require('../services/backblaze');
    const jobId = `dup_${Date.now()}`;
    dupDeleteJobs.set(jobId, { total: files.length, done: 0, errors: 0, running: true, lastFile: '', lastError: '' });
    res.json({ ok: true, jobId, total: files.length });

    (async () => {
      const job = dupDeleteJobs.get(jobId);
      const CONCURRENCY = 5;
      for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        await Promise.allSettled(batch.map(async f => {
          try {
            await deleteFile(f.fileId, f.fileName);
            job.done++;
            job.lastFile = f.fileName.split('/').pop();
          } catch (e) {
            job.errors++;
            job.lastError = `${f.fileName.split('/').pop()}: ${e.message?.slice(0, 80)}`;
            console.error('[dup-delete] erro:', f.fileName, e.message);
          }
        }));
      }
      job.running = false;
      console.log(`[dup-delete] concluído: ${job.done} deletados, ${job.errors} erros`);
    })();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/duplicates/status', (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId obrigatório' });
  const job = dupDeleteJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado.' });
  res.json(job);
});

// ── VERSÕES ANTIGAS NO BACKBLAZE ─────────────────────────────────────────────
const oldVerJobs = new Map();

// Prévia: lista todas as versões antigas que seriam deletadas
router.get('/old-versions/scan', async (req, res) => {
  try {
    const { listOldVersions } = require('../services/backblaze');
    const { toDelete, totalWasted } = await listOldVersions();

    // Agrupa por fileName para exibir no frontend
    const byFile = new Map();
    for (const f of toDelete) {
      if (!byFile.has(f.fileName)) byFile.set(f.fileName, []);
      byFile.get(f.fileName).push(f);
    }

    const groups = Array.from(byFile.entries()).map(([fileName, files]) => ({
      fileName,
      oldVersions: files.length,
      wastedBytes: files.reduce((s, f) => s + (f.size || 0), 0),
      files,
    })).sort((a, b) => b.wastedBytes - a.wastedBytes);

    res.json({ groups, totalFiles: toDelete.length, totalWasted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deleta todas as versões antigas em background
router.post('/old-versions/delete', async (req, res) => {
  const { files } = req.body;
  if (!Array.isArray(files) || files.length === 0)
    return res.status(400).json({ error: 'Lista de arquivos obrigatória.' });

  const jobId = `oldver_${Date.now()}`;
  oldVerJobs.set(jobId, { total: files.length, done: 0, errors: 0, running: true });
  res.json({ ok: true, jobId, total: files.length });

  (async () => {
    const { deleteFile } = require('../services/backblaze');
    const job = oldVerJobs.get(jobId);
    for (const f of files) {
      try {
        await deleteFile(f.fileId, f.fileName);
        job.done++;
      } catch (e) {
        job.errors++;
        console.error('[old-versions] delete error:', f.fileName, e.message);
      }
    }
    job.running = false;
  })();
});

router.get('/old-versions/status', (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId obrigatório' });
  const job = oldVerJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado.' });
  res.json(job);
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
    // Busca pedido para pegar user_id e plan_id
    const { data: order, error: orderErr } = await supabase
      .from('iptv_orders')
      .select('user_id, plan_id')
      .eq('id', req.params.id)
      .single();
    if (orderErr) throw orderErr;

    // Marca como ativado
    const { data, error } = await supabase
      .from('iptv_orders')
      .update({ status: 'activated' })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    // Salva data de expiração IPTV no usuário e manda push
    if (order?.plan_id && order?.user_id) {
      const { data: plan } = await supabase
        .from('iptv_plans')
        .select('duration_months, name')
        .eq('id', order.plan_id)
        .single();

      if (plan?.duration_months) {
        const iptvExpiresAt = new Date();
        iptvExpiresAt.setMonth(iptvExpiresAt.getMonth() + Number(plan.duration_months));

        await supabase
          .from('users')
          .update({ iptv_expires_at: iptvExpiresAt.toISOString() })
          .eq('id', order.user_id);

        const { data: user } = await supabase
          .from('users').select('push_token').eq('id', order.user_id).single();

        if (user?.push_token) {
          const { sendPush } = require('../services/notifications');
          const label = plan.duration_months === 1 ? '1 mês' : `${plan.duration_months} meses`;
          sendPush(
            [user.push_token],
            '📺 IPTV Ativado!',
            `Sua assinatura IPTV de ${label} está ativa. Bom entretenimento!`,
            { screen: 'iptv' }
          ).catch(() => {});
        }
        console.log(`[iptv] pedido ${req.params.id} ativado — expira ${iptvExpiresAt.toLocaleDateString('pt-BR')}`);
      }
    }

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

// ---- SEED PLANS ----
router.post('/seed-plans', async (req, res) => {
  const STREAMING_PLANS = [
    { id: 'monthly_2',   name: 'Mensal · 2 Telas',     price: 9.90,   promo_price: 2.90, duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',        highlight: false, max_streams: 2 },
    { id: 'monthly_3',   name: 'Mensal · 3 Telas',     price: 14.90,  promo_price: 4.90, duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',        highlight: false, max_streams: 3 },
    { id: 'monthly_5',   name: 'Mensal · 5 Telas',     price: 19.90,  promo_price: 6.90, duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',        highlight: false, max_streams: 5 },
    { id: 'quarterly_2', name: 'Trimestral · 2 Telas', price: 19.90,  promo_price: null, duration_days: 90,  active: true,  badge: null,           description: 'Equivale a R$ 6,63/mês',  highlight: false, max_streams: 2 },
    { id: 'quarterly_3', name: 'Trimestral · 3 Telas', price: 29.90,  promo_price: null, duration_days: 90,  active: true,  badge: 'MAIS POPULAR', description: 'Equivale a R$ 9,97/mês',  highlight: true,  max_streams: 3 },
    { id: 'quarterly_5', name: 'Trimestral · 5 Telas', price: 44.90,  promo_price: null, duration_days: 90,  active: true,  badge: null,           description: 'Equivale a R$ 14,97/mês', highlight: false, max_streams: 5 },
    { id: 'yearly_2',    name: 'Anual · 2 Telas',      price: 49.90,  promo_price: null, duration_days: 365, active: true,  badge: null,           description: 'Equivale a R$ 4,16/mês',  highlight: false, max_streams: 2 },
    { id: 'yearly_3',    name: 'Anual · 3 Telas',      price: 79.90,  promo_price: null, duration_days: 365, active: true,  badge: null,           description: 'Equivale a R$ 6,66/mês',  highlight: false, max_streams: 3 },
    { id: 'yearly_5',    name: 'Anual · 5 Telas',      price: 119.90, promo_price: null, duration_days: 365, active: true,  badge: 'MELHOR CUSTO', description: 'Equivale a R$ 9,99/mês',  highlight: true,  max_streams: 5 },
  ];

  const IPTV_PRICES = [
    { name: '1 MÊS S/ADULTO',    price: 24.90,  duration_months: 1,  order_index: 0 },
    { name: '1 MÊS C/ADULTO',    price: 27.90,  duration_months: 1,  order_index: 1 },
    { name: '3 MESES S/ADULTO',  price: 54.90,  duration_months: 3,  order_index: 2 },
    { name: '3 MESES C/ADULTO',  price: 57.90,  duration_months: 3,  order_index: 3 },
    { name: '6 MESES S/ADULTO',  price: 109.90, duration_months: 6,  order_index: 4 },
    { name: '6 MESES C/ADULTO',  price: 114.90, duration_months: 6,  order_index: 5 },
    { name: '12 MESES S/ADULTO', price: 159.90, duration_months: 12, order_index: 6 },
    { name: '12 MESES C/ADULTO', price: 164.90, duration_months: 12, order_index: 7 },
  ];

  try {
    // 1. Save streaming plans to system_settings
    const { error: settingsErr } = await supabase
      .from('system_settings')
      .upsert({ key: 'plans_config', value: JSON.stringify(STREAMING_PLANS) }, { onConflict: 'key' });
    if (settingsErr) throw new Error('streaming plans: ' + settingsErr.message);

    // 2. Upsert IPTV plans (insert if missing, update price if exists)
    const { data: existingIptv, error: fetchErr } = await supabase
      .from('iptv_plans')
      .select('id, name');

    let iptvResult = 'skipped (table missing)';
    if (!fetchErr) {
      const byName = {};
      for (const row of existingIptv || []) byName[row.name.toLowerCase()] = row.id;

      let inserted = 0, updated = 0;
      for (const p of IPTV_PRICES) {
        const existId = byName[p.name.toLowerCase()];
        if (existId) {
          const { error } = await supabase.from('iptv_plans')
            .update({ price: p.price, duration_months: p.duration_months })
            .eq('id', existId);
          if (!error) updated++;
        } else {
          const { error } = await supabase.from('iptv_plans')
            .insert({ name: p.name, price: p.price, duration_months: p.duration_months, is_active: true, order_index: p.order_index });
          if (!error) inserted++;
        }
      }
      iptvResult = `${inserted} inserted, ${updated} updated`;
    }

    res.json({
      ok: true,
      streaming_plans: STREAMING_PLANS.length,
      iptv_plans: iptvResult,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
