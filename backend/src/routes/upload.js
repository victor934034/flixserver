const router = require('express').Router();
const multer = require('multer');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { uploadFile, getDirectDownloadInfo } = require('../services/backblaze');
const { adminMiddleware } = require('../middleware/admin');

const execFileAsync = promisify(execFile);

// ─── FFmpeg helpers ──────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PARTIAL_BYTES = 20 * 1024 * 1024; // 20 MB — suficiente para ffprobe ler o container

// Baixa os primeiros N bytes de uma URL via axios com headers de browser completos
async function downloadPartial(url, destPath, maxBytes) {
  const axios = require('axios');
  const resp = await axios.get(url, {
    responseType: 'stream',
    timeout: 60_000,
    headers: {
      'User-Agent': UA,
      'Accept': '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Range': `bytes=0-${maxBytes - 1}`,
    },
  });
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    let total = 0;
    resp.data.on('data', chunk => {
      total += chunk.length;
      if (total >= maxBytes) { resp.data.destroy(); }
    });
    resp.data.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    // ECONNRESET é esperado quando destruímos o stream antes do fim
    resp.data.on('error', err => (err.code === 'ECONNRESET' ? resolve() : reject(err)));
  });
}

// Probe local (sempre funciona, sem depender do cliente HTTP do ffprobe)
async function probeLocalFile(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_streams', '-select_streams', 'a',
      filePath,
    ], { timeout: 20_000 });
    const stream = JSON.parse(stdout).streams?.[0];
    if (!stream) return null;
    return { codec: stream.codec_name, profile: stream.profile || '', channels: stream.channels || 0 };
  } catch (e) {
    console.error('[ffprobe] erro local:', e.message?.slice(0, 200));
    return null;
  }
}

async function probeAudio(input) {
  const isUrl = /^https?:\/\//i.test(input);
  if (!isUrl) return probeLocalFile(input);

  // Para URLs: baixa parcialmente via axios (evita bloqueio de CDN/Cloudflare)
  const tmpProbe = path.join(os.tmpdir(), `fh_probe_${Date.now()}.tmp`);
  try {
    console.log('[probe] baixando parcial:', input);
    await downloadPartial(input, tmpProbe, PARTIAL_BYTES);
    return await probeLocalFile(tmpProbe);
  } catch (e) {
    console.error('[probe] download parcial falhou:', e.message?.slice(0, 200));
    return null;
  } finally {
    try { fs.unlinkSync(tmpProbe); } catch {}
  }
}

function needsRemux(info) {
  if (!info) return false;
  const p = info.profile.toLowerCase();
  const heAac = p.includes('he') || p === 'lc+sbr' || p === 'lc+sbr+ps';
  return heAac || info.channels > 2;
}

async function remuxToWebAac(input, outputPath) {
  const out = outputPath || input.replace(/(\.[^.]+)$/, '_fixed$1');
  const isUrl = /^https?:\/\//i.test(input);
  // ffmpeg aceita múltiplos headers via -headers "H1: v1\r\nH2: v2\r\n"
  const hdrs = `User-Agent: ${UA}\r\nAccept: */*\r\nAccept-Language: pt-BR,pt;q=0.9,en;q=0.8\r\n`;
  const args = [
    ...(isUrl ? ['-headers', hdrs] : []),
    '-i', input,
    '-c:v', 'copy',
    '-c:a', 'aac', '-profile:a', 'aac_low', '-ac', '2', '-b:a', '192k',
    '-y', out,
  ];
  try {
    await execFileAsync('ffmpeg', args, { maxBuffer: 10 * 1024 * 1024, timeout: 7_200_000 });
    return out;
  } catch (e) {
    console.error('[ffmpeg] remux falhou:', e.message?.slice(0, 300));
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
      const fixedPath = tmpInput.replace(/(\.[^.]+)$/, '_fixed$1');
      tmpOutput = await remuxToWebAac(tmpInput, fixedPath);
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
    res.json({ fileId: data.fileId, filename: data.sanitizedFileName });
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

    // Push notification para todos os usuários (fire-and-forget)
    const { sendPushToAll } = require('../services/notifications');
    const { supabase } = require('../services/supabase');
    const title = filename.replace(/\.[^.]+$/, '').replace(/[._]/g, ' ');
    sendPushToAll(supabase, 'Novo conteúdo adicionado!', `"${title}" já está disponível no FlixHome.`, { screen: 'home' })
      .catch(e => console.warn('[push] upload-complete:', e.message));

    res.json({ cdnUrl });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Corrigir áudio AAC de arquivo já no B2
// Usa URL direta do B2 (bypassa CDN Cloudflare que bloqueia ffprobe/ffmpeg)
router.post('/fix-audio', async (req, res) => {
  const { cdnUrl, movieId, movieType, field } = req.body;
  if (!cdnUrl) return res.status(400).json({ error: 'cdnUrl é obrigatório' });

  let tmpOutput = null;

  try {
    // Extrai o nome do arquivo da URL da CDN
    const origName = decodeURIComponent(path.basename(new URL(cdnUrl).pathname));
    const ext = path.extname(origName) || '.mkv';

    // Obtém URL direta do B2 (contorna Cloudflare Workers CDN)
    console.log('[fix-audio] obtendo URL direta do B2 para:', origName);
    const { url: b2Url, token: b2Token } = await getDirectDownloadInfo(origName);
    console.log('[fix-audio] B2 URL:', b2Url);

    // Passo 1: probe usando URL B2 direta com token de autorização
    const b2AuthHdr = `Authorization: ${b2Token}\r\nUser-Agent: ${UA}\r\n`;
    let audioInfo = null;
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-headers', b2AuthHdr,
        '-print_format', 'json',
        '-show_streams', '-select_streams', 'a',
        b2Url,
      ], { timeout: 30_000 });
      const stream = JSON.parse(stdout).streams?.[0];
      if (stream) {
        audioInfo = { codec: stream.codec_name, profile: stream.profile || '', channels: stream.channels || 0 };
      }
    } catch (fpErr) {
      console.error('[fix-audio] ffprobe direto falhou:', fpErr.message?.slice(0, 200));
    }

    console.log('[fix-audio] audio info:', audioInfo);

    if (!audioInfo) {
      return res.status(422).json({ error: 'Não foi possível ler as faixas de áudio mesmo com acesso direto ao B2. Verifique os logs do servidor.' });
    }

    if (!needsRemux(audioInfo)) {
      return res.json({ skipped: true, reason: 'Áudio já compatível (AAC-LC estéreo)', audioInfo });
    }

    // Passo 2: remux com ffmpeg via URL direta B2 + token
    tmpOutput = path.join(os.tmpdir(), `fh_fix_${Date.now()}${ext}`);
    console.log(`[fix-audio] remuxando ${origName} → ${tmpOutput}`);

    const ffArgs = [
      '-headers', b2AuthHdr,
      '-i', b2Url,
      '-c:v', 'copy',
      '-c:a', 'aac', '-profile:a', 'aac_low', '-ac', '2', '-b:a', '192k',
      '-y', tmpOutput,
    ];

    try {
      await execFileAsync('ffmpeg', ffArgs, { maxBuffer: 10 * 1024 * 1024, timeout: 7_200_000 });
    } catch (ffErr) {
      console.error('[fix-audio] ffmpeg falhou:', ffErr.message?.slice(0, 300));
      throw new Error('ffmpeg falhou ao remuxar. Verifique os logs do servidor.');
    }

    const sizeBytes = fs.statSync(tmpOutput).size;
    console.log(`[fix-audio] remux OK: ${(sizeBytes / 1024 / 1024).toFixed(0)} MB`);

    // Passo 3: upload para B2 em partes (sem carregar tudo na memória)
    const { uploadFileFromPath } = require('../services/backblaze');
    const result = await uploadFileFromPath(tmpOutput, origName, 'video/x-matroska');

    // Passo 4: atualiza DB se movieId/field informados
    if (movieId && field) {
      const { supabase } = require('../services/supabase');
      const table = movieType === 'series' ? 'episodes' : 'movies';
      await supabase.from(table).update({ [field]: result.cdnUrl }).eq('id', movieId);
    }

    res.json({ ok: true, cdnUrl: result.cdnUrl, audioInfo });
  } catch (err) {
    console.error('[fix-audio] erro:', err.message);
    res.status(500).json({ error: err.message || 'Erro desconhecido' });
  } finally {
    try { if (tmpOutput) fs.unlinkSync(tmpOutput); } catch {}
  }
});

// Verifica o áudio (sem remuxar) — usa URL direta B2 para contornar CDN Cloudflare
router.post('/check-audio', async (req, res) => {
  const { cdnUrl } = req.body;
  if (!cdnUrl) return res.status(400).json({ error: 'cdnUrl é obrigatório' });

  try {
    const filename = decodeURIComponent(path.basename(new URL(cdnUrl).pathname));
    const { url: b2Url, token: b2Token } = await getDirectDownloadInfo(filename);

    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-headers', `Authorization: ${b2Token}\r\nUser-Agent: ${UA}\r\n`,
      '-print_format', 'json',
      '-show_streams', '-select_streams', 'a',
      b2Url,
    ], { timeout: 30_000 });

    const stream = JSON.parse(stdout).streams?.[0];
    if (!stream) return res.status(422).json({ error: 'Nenhuma faixa de áudio encontrada no arquivo.' });

    const audioInfo = { codec: stream.codec_name, profile: stream.profile || '', channels: stream.channels || 0 };
    res.json({ audioInfo, needsRemux: needsRemux(audioInfo) });
  } catch (err) {
    console.error('[check-audio] erro:', err.message?.slice(0, 300));
    res.status(500).json({ error: err.message?.slice(0, 300) });
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

// Upload de avatar de perfil — imagem JPG/PNG, armazenada em avatars/
router.post('/avatar', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  try {
    const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
    const filename = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const result = await uploadFile(req.file.buffer, filename, req.file.mimetype);
    res.json({ cdnUrl: result.cdnUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
