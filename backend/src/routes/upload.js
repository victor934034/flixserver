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

// Upload de legenda
router.post('/subtitle', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  try {
    let buffer = req.file.buffer;
    let filename = req.file.originalname;

    // Converte .srt para .vtt automaticamente
    if (filename.endsWith('.srt')) {
      const srtContent = buffer.toString('utf-8');
      const vttContent = convertSrtToVtt(srtContent);
      buffer = Buffer.from(vttContent, 'utf-8');
      filename = filename.replace('.srt', '.vtt');
    }

    const result = await uploadFile(buffer, filename, 'text/vtt');
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
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// Finish large file upload
router.post('/finish-large', async (req, res) => {
  const { fileId, partSha1Array, filename } = req.body;
  if (!fileId || !filename) return res.status(400).json({ error: 'fileId e filename são obrigatórios' });
  try {
    const { finishLargeFile } = require('../services/backblaze');
    await finishLargeFile(fileId, partSha1Array || []);
    res.json({ cdnUrl: `${process.env.CDN_BASE_URL}/${filename}` });
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
