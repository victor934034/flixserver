const router = require('express').Router();
const multer = require('multer');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { uploadFile } = require('../services/backblaze');
const { adminMiddleware } = require('../middleware/admin');

const execFileAsync = promisify(execFile);

// ─── FFmpeg helpers ──────────────────────────────────────────────────────────

async function probeAudio(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_streams', '-select_streams', 'a',
      filePath,
    ]);
    const stream = JSON.parse(stdout).streams?.[0];
    if (!stream) return null;
    return {
      codec:    stream.codec_name,
      profile:  stream.profile || '',
      channels: stream.channels || 0,
    };
  } catch {
    return null; // ffprobe não disponível
  }
}

function needsRemux(info) {
  if (!info) return false;
  const p = info.profile.toLowerCase();
  const heAac = p.includes('he') || p === 'lc+sbr' || p === 'lc+sbr+ps';
  return heAac || info.channels > 2;
}

async function remuxToWebAac(inputPath) {
  const outputPath = inputPath.replace(/(\.[^.]+)$/, '_fixed$1');
  try {
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'copy',
      '-c:a', 'aac', '-profile:a', 'aac_low', '-ac', '2', '-b:a', '192k',
      '-y', outputPath,
    ], { maxBuffer: 1024 * 1024 });
    return outputPath;
  } catch (e) {
    console.error('[ffmpeg] remux falhou:', e.message);
    return null;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 * 1024 }, // 50 GB
});

router.use(adminMiddleware);

// Upload de vídeo (multipart) — com detecção e remux automático de AAC incompatível
router.post('/video', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const ext = path.extname(req.file.originalname) || '.tmp';
  const tmpInput = path.join(os.tmpdir(), `fh_in_${Date.now()}${ext}`);
  let tmpOutput = null;

  try {
    fs.writeFileSync(tmpInput, req.file.buffer);

    let buffer   = req.file.buffer;
    let filename = req.file.originalname;

    const audioInfo = await probeAudio(tmpInput);
    if (audioInfo) {
      console.log(`[upload/video] audio: codec=${audioInfo.codec} profile="${audioInfo.profile}" ch=${audioInfo.channels}`);
    }

    if (needsRemux(audioInfo)) {
      console.log('[upload/video] HE-AAC ou surround detectado → remuxando para AAC-LC estéreo…');
      tmpOutput = await remuxToWebAac(tmpInput);
      if (tmpOutput) {
        buffer   = fs.readFileSync(tmpOutput);
        console.log(`[upload/video] remux OK: ${buffer.length} bytes`);
      }
    }

    const result = await uploadFile(buffer, filename, req.file.mimetype);
    res.json({ ...result, remuxed: !!tmpOutput, audioInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.unlinkSync(tmpInput); } catch {}
    try { if (tmpOutput) fs.unlinkSync(tmpOutput); } catch {}
  }
});

// Upload de legenda — aceita .srt ou .vtt, converte .srt e salva no DB se movieId informado
router.post('/subtitle', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const { movieId, movieType, language } = req.body; // language: pt | en | es

  try {
    let buffer = req.file.buffer;
    let filename = req.file.originalname;

    if (filename.endsWith('.srt')) {
      const vttContent = convertSrtToVtt(buffer.toString('utf-8'));
      buffer = Buffer.from(vttContent, 'utf-8');
      filename = filename.replace(/\.srt$/, '.vtt');
    }

    const result = await uploadFile(buffer, `subtitles/${filename}`, 'text/vtt');

    if (movieId && language) {
      const { supabase } = require('../services/supabase');
      const col = `subtitle_${language}`;
      // 'series' type maps to episodes table; 'movie' maps to movies table
      const table = movieType === 'series' ? 'episodes' : 'movies';
      const { error: dbErr } = await supabase.from(table).update({ [col]: result.cdnUrl }).eq('id', movieId);
      if (dbErr) console.error('[subtitle] db update error:', dbErr.message);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retorna URL pré-assinada para upload direto do frontend
router.get('/presign', async (req, res) => {
  try {
    if (!process.env.BACKBLAZE_KEY_ID || !process.env.BACKBLAZE_APP_KEY) {
      return res.status(500).json({ error: 'Credenciais do Backblaze não configuradas no servidor.' });
    }
    const { getUploadUrl } = require('../services/backblaze');
    const uploadData = await getUploadUrl();
    res.json({
      uploadUrl: uploadData.uploadUrl,
      authorizationToken: uploadData.authorizationToken,
      cdnBase: process.env.CDN_BASE_URL,
    });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    const status = err.response?.status;
    if (status === 401) {
      return res.status(500).json({ error: `Backblaze: credenciais inválidas (401). Gere uma nova App Key no console do B2 e atualize as variáveis de ambiente no EasePanel.` });
    }
    res.status(500).json({ error: `Backblaze: ${msg}` });
  }
});

// Start B2 large file upload (for files > 5GB)
router.post('/start-large', async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename é obrigatório' });
  try {
    const { startLargeFile } = require('../services/backblaze');
    const data = await startLargeFile(filename, contentType);
    res.json({ fileId: data.fileId });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Get upload URL for a single part
router.post('/part-url', async (req, res) => {
  const { fileId } = req.body;
  if (!fileId) return res.status(400).json({ error: 'fileId é obrigatório' });
  try {
    const { getUploadPartUrl } = require('../services/backblaze');
    const data = await getUploadPartUrl(fileId);
    res.json({ uploadUrl: data.uploadUrl, authorizationToken: data.authorizationToken });
  } catch (err) {
    const b2Code = err.response?.data?.code;
    const b2Msg = err.response?.data?.message || err.message;
    const httpStatus = err.response?.status || 500;
    console.error(`[B2 part-url] status=${httpStatus} code=${b2Code} msg=${b2Msg}`);
    res.status(httpStatus === 503 ? 503 : 500).json({ error: b2Msg, code: b2Code });
  }
});

// List already-uploaded parts of a large file (used for resume)
router.post('/list-parts', async (req, res) => {
  const { fileId } = req.body;
  if (!fileId) return res.status(400).json({ error: 'fileId é obrigatório' });
  try {
    const { listParts } = require('../services/backblaze');
    const parts = await listParts(fileId);
    res.json({ parts: parts.sort((a, b) => a.partNumber - b.partNumber) });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Finish large file upload
router.post('/finish-large', async (req, res) => {
  const { fileId, filename, partSha1Array } = req.body;
  if (!fileId || !filename) return res.status(400).json({ error: 'fileId e filename são obrigatórios' });
  try {
    const { listParts, finishLargeFile } = require('../services/backblaze');

    let sha1Array = partSha1Array;

    // Se o frontend não enviou SHA1s reais (legado ou vazio), busca do B2
    if (!Array.isArray(sha1Array) || sha1Array.length === 0 || sha1Array.every(s => s === 'do_not_verify')) {
      const parts = await listParts(fileId);
      sha1Array = parts
        .sort((a, b) => a.partNumber - b.partNumber)
        .map(p => p.contentSha1);
    }

    await finishLargeFile(fileId, sha1Array);
    const cdnUrl = `${process.env.CDN_BASE_URL}/${filename}`;

    // Notificação de email (fire-and-forget: falha não quebra o upload)
    if (req.user?.email) {
      const { sendUploadComplete } = require('../services/email');
      sendUploadComplete(req.user.email, filename, cdnUrl)
        .catch(e => console.warn('[email] upload-complete:', e.message));
    }

    res.json({ cdnUrl });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Corrigir áudio AAC de arquivo já enviado ao B2 (download → ffprobe → remux → re-upload)
router.post('/fix-audio', async (req, res) => {
  const { cdnUrl, movieId, movieType, field } = req.body;
  if (!cdnUrl) return res.status(400).json({ error: 'cdnUrl é obrigatório' });

  const ext = path.extname(new URL(cdnUrl).pathname) || '.mp4';
  const tmpInput  = path.join(os.tmpdir(), `fh_fix_in_${Date.now()}${ext}`);
  const tmpOutput = path.join(os.tmpdir(), `fh_fix_out_${Date.now()}${ext}`);

  try {
    // Baixa arquivo do B2/CDN
    console.log('[fix-audio] baixando:', cdnUrl);
    const https = cdnUrl.startsWith('https') ? require('https') : require('http');
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmpInput);
      https.get(cdnUrl, (res) => {
        res.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    });

    const audioInfo = await probeAudio(tmpInput);
    console.log('[fix-audio] audio info:', audioInfo);

    if (!needsRemux(audioInfo)) {
      return res.json({ skipped: true, reason: 'Áudio já compatível com navegadores', audioInfo });
    }

    // Remux
    await execFileAsync('ffmpeg', [
      '-i', tmpInput,
      '-c:v', 'copy',
      '-c:a', 'aac', '-profile:a', 'aac_low', '-ac', '2', '-b:a', '192k',
      '-y', tmpOutput,
    ], { maxBuffer: 1024 * 1024 });

    const filename = path.basename(new URL(cdnUrl).pathname);
    const buffer   = fs.readFileSync(tmpOutput);
    const result   = await uploadFile(buffer, filename, 'video/mp4');

    // Atualiza DB se informado
    if (movieId && field) {
      const { supabase } = require('../services/supabase');
      const table = movieType === 'series' ? 'episodes' : 'movies';
      await supabase.from(table).update({ [field]: result.cdnUrl }).eq('id', movieId);
    }

    res.json({ ok: true, cdnUrl: result.cdnUrl, audioInfo });
  } catch (err) {
    console.error('[fix-audio]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.unlinkSync(tmpInput); } catch {}
    try { fs.unlinkSync(tmpOutput); } catch {}
  }
});

// Buscar e importar legendas do OpenSubtitles automaticamente pelo TMDB ID
router.post('/fetch-subtitles', async (req, res) => {
  const { tmdbId, movieId, movieType, seasonNumber, episodeNumber } = req.body;
  if (!tmdbId || !movieId) return res.status(400).json({ error: 'tmdbId e movieId são obrigatórios' });

  const { searchSubtitles, getDownloadLink, downloadContent } = require('../services/opensubtitles');
  const { uploadFile } = require('../services/backblaze');
  const { supabase } = require('../services/supabase');

  const langMap = { pt: 'pt-BR', en: 'en', es: 'es' };
  const results = {};
  const errors = {};

  for (const [dbLang, apiLang] of Object.entries(langMap)) {
    try {
      const hits = await searchSubtitles({
        tmdbId, type: movieType || 'movie', lang: apiLang, seasonNumber, episodeNumber,
      });
      if (!hits.length) { errors[dbLang] = 'Não encontrado'; continue; }

      const sorted = hits.sort((a, b) => (b.attributes?.download_count || 0) - (a.attributes?.download_count || 0));
      const file = sorted[0]?.attributes?.files?.[0];
      if (!file?.file_id) { errors[dbLang] = 'Arquivo indisponível'; continue; }

      const link = await getDownloadLink(file.file_id);
      const srtBuffer = await downloadContent(link);
      const vttBuffer = Buffer.from(convertSrtToVtt(srtBuffer.toString('utf-8')), 'utf-8');

      const filename = `subtitles/${movieId}_${dbLang}.vtt`;
      const uploaded = await uploadFile(vttBuffer, filename, 'text/vtt');

      const table = movieType === 'episode' ? 'episodes' : 'movies';
      const { error: dbErr } = await supabase.from(table).update({ [`subtitle_${dbLang}`]: uploaded.cdnUrl }).eq('id', movieId);
      if (dbErr) throw new Error(`DB: ${dbErr.message}`);

      results[dbLang] = uploaded.cdnUrl;
    } catch (e) {
      console.warn(`[opensubtitles] ${dbLang}:`, e.message);
      errors[dbLang] = e.message;
    }
  }

  res.json({ results, errors });
});

function convertSrtToVtt(srt) {
  return 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim();
}

module.exports = router;
