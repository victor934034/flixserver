const router = require('express').Router();
const multer = require('multer');
const { uploadFile } = require('../services/backblaze');
const { adminMiddleware } = require('../middleware/admin');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 * 1024 }, // 50 GB
});

router.use(adminMiddleware);

// Upload de vídeo (multipart)
router.post('/video', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  try {
    const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
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

function convertSrtToVtt(srt) {
  return 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim();
}

module.exports = router;
