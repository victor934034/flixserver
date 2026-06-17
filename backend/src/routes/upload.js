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

// Retorna URL pré-assinada para upload direto do frontend (evita passar pelo servidor)
router.get('/presign', async (req, res) => {
  try {
    const { getUploadUrl } = require('../services/backblaze');
    const uploadData = await getUploadUrl();
    res.json({
      uploadUrl: uploadData.uploadUrl,
      authorizationToken: uploadData.authorizationToken,
      cdnBase: process.env.CDN_BASE_URL,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function convertSrtToVtt(srt) {
  return 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim();
}

module.exports = router;
