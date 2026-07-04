const router = require('express').Router();
const multer = require('multer');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { uploadFile, getDirectDownloadInfo, getUploadUrl, sanitizeFilename } = require('../services/backblaze');
const { adminMiddleware } = require('../middleware/admin');

// Rastreamento de jobs batch em memória (reseta ao reiniciar, mas é suficiente)
const batchJobs = new Map();

// ── Geração de HLS (M3U8 + segmentos .ts) ────────────────────────────────────
// Converte qualquer vídeo do B2 em HLS — o player começa a tocar em < 1s
// porque só precisa baixar o primeiro segmento (4s ≈ 500KB) antes de iniciar.

async function generateHLS(origName) {
  const crypto = require('crypto');
  const axios  = require('axios');

  // baseName sem extensão e sem caminho (ex: "My.Movie.mp4" → "My.Movie")
  const cleanBase = path.posix.basename(origName).replace(/\.[^.]+$/, '');
  const tmpDir    = path.join(os.tmpdir(), `hls_${Date.now()}`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const { url: b2Url, token: b2Token } = await getDirectDownloadInfo(origName);
    const b2AuthHdr = `Authorization: ${b2Token}\r\nUser-Agent: ${UA}\r\n`;

    const playlistTmp = path.join(tmpDir, 'pl.m3u8');
    const segPattern  = path.join(tmpDir, 'seg_%04d.ts');

    // Stream copy para HLS (rápido, sem perda de qualidade)
    try {
      await execFileAsync('ffmpeg', [
        '-headers', b2AuthHdr, '-i', b2Url,
        '-c:v', 'copy', '-c:a', 'copy',
        '-hls_time', '4',
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-hls_segment_filename', segPattern,
        playlistTmp,
      ], { maxBuffer: 10 * 1024 * 1024, timeout: 7_200_000 });
    } catch (e1) {
      // Fallback para transcode quando stream copy falha (ex: MKV com codec incompatível)
      console.warn(`[hls] stream copy falhou, transcoding ${origName}: ${e1.message.slice(0, 80)}`);
      fs.readdirSync(tmpDir).filter(f => f !== 'pl.m3u8').forEach(f => {
        try { fs.unlinkSync(path.join(tmpDir, f)); } catch {}
      });
      await execFileAsync('ffmpeg', [
        '-headers', b2AuthHdr, '-i', b2Url,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-hls_time', '4',
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-hls_segment_filename', segPattern,
        playlistTmp,
      ], { maxBuffer: 10 * 1024 * 1024, timeout: 7_200_000 });
    }

    // Ordena e faz upload dos segmentos .ts
    const segments = fs.readdirSync(tmpDir).filter(f => /^seg_\d{4}\.ts$/.test(f)).sort();
    let uploadData  = await getUploadUrl();

    for (let i = 0; i < segments.length; i++) {
      const seg  = segments[i];
      const b2Name = sanitizeFilename(`${cleanBase}.${seg}`); // ex: "My.Movie.seg_0000.ts"
      const buf  = fs.readFileSync(path.join(tmpDir, seg));
      const sha1 = crypto.createHash('sha1').update(buf).digest('hex');

      const doUpload = async (ud) => axios.post(ud.uploadUrl, buf, {
        headers: {
          Authorization:      ud.authorizationToken,
          'X-Bz-File-Name':   encodeURIComponent(b2Name),
          'Content-Type':     'video/mp2t',
          'Content-Length':   buf.length,
          'X-Bz-Content-Sha1': sha1,
        },
        maxContentLength: Infinity, maxBodyLength: Infinity,
      });

      try {
        await doUpload(uploadData);
      } catch {
        uploadData = await getUploadUrl();
        await doUpload(uploadData);
      }

      if ((i + 1) % 20 === 0) console.log(`[hls] ${cleanBase}: ${i + 1}/${segments.length} segs`);
    }

    // Corrige playlist: troca "seg_0000.ts" pelos nomes que usamos no B2
    const rawPlaylist   = fs.readFileSync(playlistTmp, 'utf8');
    const fixedPlaylist = rawPlaylist.replace(/^(seg_\d{4}\.ts)$/gm,
      (_, s) => sanitizeFilename(`${cleanBase}.${s}`)
    );

    // Faz upload da playlist como "My.Movie.m3u8"
    const playlistB2Name = sanitizeFilename(`${cleanBase}.m3u8`);
    const plBuf          = Buffer.from(fixedPlaylist, 'utf8');
    const plSha1         = crypto.createHash('sha1').update(plBuf).digest('hex');

    const doPlUpload = async (ud) => axios.post(ud.uploadUrl, plBuf, {
      headers: {
        Authorization:      ud.authorizationToken,
        'X-Bz-File-Name':   encodeURIComponent(playlistB2Name),
        'Content-Type':     'application/x-mpegURL',
        'Content-Length':   plBuf.length,
        'X-Bz-Content-Sha1': plSha1,
      },
      maxContentLength: Infinity, maxBodyLength: Infinity,
    });

    try { await doPlUpload(uploadData); }
    catch { uploadData = await getUploadUrl(); await doPlUpload(uploadData); }

    const hlsUrl = `${process.env.CDN_BASE_URL}/${encodeURIComponent(playlistB2Name)}`;
    console.log(`[hls] OK: ${origName} → ${segments.length} segs`);
    return hlsUrl;

  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

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

async function applyFaststart(inputPath, outputPath) {
  try {
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y', outputPath,
    ], { maxBuffer: 10 * 1024 * 1024, timeout: 7_200_000 });
    return true;
  } catch (e) {
    console.error('[faststart] ffmpeg falhou:', e.message?.slice(0, 200));
    return false;
  }
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
  let tmpFaststart = null;

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

    // Aplica faststart em MP4 (move moov atom para o início — início de reprodução instantâneo)
    const isMp4 = /\.mp4$/i.test(filename);
    if (isMp4) {
      const src = tmpOutput || tmpInput;
      const faststartPath = path.join(os.tmpdir(), `fh_fs_${Date.now()}.mp4`);
      const ok = await applyFaststart(src, faststartPath);
      if (ok) {
        tmpFaststart = faststartPath;
        buffer = fs.readFileSync(faststartPath);
        console.log('[upload/video] faststart aplicado');
      }
    }

    const result = await uploadFile(buffer, filename, req.file.mimetype);
    res.json({ ...result, remuxed: !!tmpOutput, faststartApplied: isMp4, audioInfo });

    // Gera HLS em background (abre em < 1s em qualquer dispositivo)
    generateHLS(result.fileName).catch(e => console.warn('[hls-auto]', result.fileName, e.message?.slice(0, 80)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.unlinkSync(tmpInput); } catch {}
    try { if (tmpOutput) fs.unlinkSync(tmpOutput); } catch {}
    try { if (tmpFaststart) fs.unlinkSync(tmpFaststart); } catch {}
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

    // Gera HLS em background (abre em < 1s em qualquer dispositivo)
    generateHLS(filename).catch(e => console.warn('[hls-auto]', filename, e.message?.slice(0, 80)));

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

// Corrige faststart de um MP4 já no B2 (baixa, processa, re-envia com mesmo nome)
router.post('/fix-faststart', async (req, res) => {
  const { cdnUrl, movieId, movieType, field } = req.body;
  if (!cdnUrl) return res.status(400).json({ error: 'cdnUrl é obrigatório' });
  if (!/\.mp4$/i.test(cdnUrl)) return res.json({ skipped: true, reason: 'Não é MP4' });

  let tmpOutput = null;
  try {
    const origName = decodeURIComponent(path.basename(new URL(cdnUrl).pathname));
    const { url: b2Url, token: b2Token } = await getDirectDownloadInfo(origName);
    const b2AuthHdr = `Authorization: ${b2Token}\r\nUser-Agent: ${UA}\r\n`;

    tmpOutput = path.join(os.tmpdir(), `fh_fs_${Date.now()}.mp4`);
    console.log(`[fix-faststart] processando ${origName}`);

    try {
      await execFileAsync('ffmpeg', [
        '-headers', b2AuthHdr,
        '-i', b2Url,
        '-c', 'copy',
        '-movflags', '+faststart',
        '-y', tmpOutput,
      ], { maxBuffer: 10 * 1024 * 1024, timeout: 7_200_000 });
    } catch (e) {
      throw new Error('ffmpeg falhou: ' + e.message?.slice(0, 200));
    }

    const { uploadFileFromPath } = require('../services/backblaze');
    const result = await uploadFileFromPath(tmpOutput, origName, 'video/mp4');

    if (movieId && field) {
      const { supabase } = require('../services/supabase');
      const table = movieType === 'series' ? 'episodes' : 'movies';
      await supabase.from(table).update({ [field]: result.cdnUrl }).eq('id', movieId);
    }

    res.json({ ok: true, cdnUrl: result.cdnUrl });
  } catch (err) {
    console.error('[fix-faststart]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { if (tmpOutput) fs.unlinkSync(tmpOutput); } catch {}
  }
});

// Corrige faststart em lote para todos os MP4s do banco (roda em background)
router.post('/batch-fix-faststart', async (_req, res) => {
  const { supabase } = require('../services/supabase');
  const { uploadFileFromPath } = require('../services/backblaze');

  const MOVIE_FIELDS   = ['file_dubbing', 'file_subtitled', 'file_cinema', 'file_4k'];
  const EPISODE_FIELDS = ['file_dubbing', 'file_subtitled', 'file_cinema'];

  const collect = async (table) => {
    const fields = table === 'movies' ? MOVIE_FIELDS : EPISODE_FIELDS;
    const { data, error } = await supabase
      .from(table)
      .select(['id', ...fields].join(', '))
      .limit(5000);
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    const items = [];
    for (const row of data || []) {
      for (const f of fields) {
        if (row[f] && /\.mp4$/i.test(row[f])) {
          items.push({ table, id: row.id, field: f, cdnUrl: row[f] });
        }
      }
    }
    return items;
  };

  let allItems = [];
  try {
    const [eps, movs] = await Promise.all([collect('episodes'), collect('movies')]);
    allItems = [...eps, ...movs];
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao coletar itens: ' + e.message });
  }

  if (allItems.length === 0) {
    return res.json({ ok: true, jobId: null, total: 0, message: 'Nenhum arquivo MP4 encontrado.' });
  }

  const jobId = `fs_${Date.now()}`;
  batchJobs.set(jobId, { total: allItems.length, done: 0, errors: 0, running: true, lastFile: '' });

  res.json({ ok: true, jobId, total: allItems.length, message: `Iniciando correção de ${allItems.length} arquivo(s) MP4.` });

  // Processa em background, um de cada vez para não sobrecarregar o servidor
  (async () => {
    const job = batchJobs.get(jobId);
    for (const item of allItems) {
      let tmpOut = null;
      try {
        // Usa o path completo da URL (não só o basename) para preservar subpastas no B2
        const urlPath = new URL(item.cdnUrl).pathname;
        const origName = decodeURIComponent(urlPath.replace(/^\//, ''));
        job.lastFile = origName.slice(-60);

        const { url: b2Url, token: b2Token } = await getDirectDownloadInfo(origName);
        const b2AuthHdr = `Authorization: ${b2Token}\r\nUser-Agent: ${UA}\r\n`;
        tmpOut = path.join(os.tmpdir(), `fh_bfs_${Date.now()}.mp4`);

        await execFileAsync('ffmpeg', [
          '-headers', b2AuthHdr, '-i', b2Url,
          '-c', 'copy', '-movflags', '+faststart',
          '-y', tmpOut,
        ], { maxBuffer: 10 * 1024 * 1024, timeout: 7_200_000 });

        await uploadFileFromPath(tmpOut, origName, 'video/mp4');
        job.done++;
        console.log(`[batch-faststart] ${job.done}/${job.total} OK: ${origName}`);
      } catch (e) {
        job.errors++;
        console.error(`[batch-faststart] ERRO (${item.table}#${item.id} ${item.field}):`, e.message?.slice(0, 150));
      } finally {
        try { if (tmpOut) fs.unlinkSync(tmpOut); } catch {}
      }
    }
    job.running = false;
    console.log(`[batch-faststart] Concluído: ${job.done} corrigidos, ${job.errors} erros`);
  })();
});

// Polling de progresso do batch
router.get('/batch-status', (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId obrigatório' });
  const job = batchJobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado (servidor reiniciado?)' });
  res.json(job);
});

// Gera HLS para um único vídeo
router.post('/generate-hls', async (req, res) => {
  const { cdnUrl } = req.body;
  if (!cdnUrl) return res.status(400).json({ error: 'cdnUrl obrigatório' });
  try {
    const origName = decodeURIComponent(new URL(cdnUrl).pathname.replace(/^\//, ''));
    const hlsUrl   = await generateHLS(origName);
    res.json({ ok: true, hlsUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gera HLS em batch para todos os vídeos do banco
router.post('/batch-generate-hls', async (_req, res) => {
  const { supabase }    = require('../services/supabase');
  const MOVIE_FIELDS   = ['file_dubbing', 'file_subtitled', 'file_cinema', 'file_4k'];
  const EPISODE_FIELDS = ['file_dubbing', 'file_subtitled', 'file_cinema'];

  const collect = async (table) => {
    const fields = table === 'movies' ? MOVIE_FIELDS : EPISODE_FIELDS;
    const { data, error } = await supabase.from(table).select(['id', ...fields].join(', ')).limit(5000);
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    const items = [], seen = new Set();
    for (const row of data || []) {
      for (const f of fields) {
        const url = row[f];
        if (url && !seen.has(url)) { seen.add(url); items.push({ cdnUrl: url }); }
      }
    }
    return items;
  };

  let allItems = [];
  try {
    const [eps, movs] = await Promise.all([collect('episodes'), collect('movies')]);
    allItems = [...eps, ...movs];
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao coletar: ' + e.message });
  }

  if (allItems.length === 0)
    return res.json({ ok: true, jobId: null, total: 0, message: 'Nenhum vídeo encontrado.' });

  const jobId = `hls_${Date.now()}`;
  batchJobs.set(jobId, { total: allItems.length, done: 0, errors: 0, running: true, lastFile: '' });
  res.json({ ok: true, jobId, total: allItems.length, message: `Gerando HLS para ${allItems.length} vídeo(s).` });

  (async () => {
    const job = batchJobs.get(jobId);
    for (const item of allItems) {
      try {
        const origName = decodeURIComponent(new URL(item.cdnUrl).pathname.replace(/^\//, ''));
        job.lastFile   = origName.slice(-60);
        await generateHLS(origName);
        job.done++;
      } catch (e) {
        job.errors++;
        console.error('[batch-hls] ERRO:', e.message?.slice(0, 150));
      }
    }
    job.running = false;
    console.log(`[batch-hls] Concluído: ${job.done} ok, ${job.errors} erros`);
  })();
});

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
