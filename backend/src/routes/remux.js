const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const { spawn } = require('child_process');

const CDN_BASE = process.env.CDN_BASE_URL || '';

// GET /api/remux?url=...
// Lê o vídeo da CDN e re-encoda só o áudio para AAC (vídeo copiado sem re-encode).
// Usado como fallback quando o browser não suporta o codec de áudio original (AC3/DTS).
router.get('/', authMiddleware, (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url obrigatória' });

  // Valida que a URL pertence ao nosso CDN (evita SSRF)
  const allowed = CDN_BASE && url.startsWith(CDN_BASE);
  if (CDN_BASE && !allowed) return res.status(403).json({ error: 'URL não autorizada' });

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no'); // desativa buffering no nginx

  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-i', url,
    '-c:v', 'copy',          // copia vídeo sem re-encodar
    '-c:a', 'aac',           // converte áudio para AAC (suportado por todos os browsers)
    '-b:a', '192k',
    '-ac', '2',              // estéreo (downmix de 5.1 se necessário)
    '-movflags', 'frag_keyframe+empty_moov', // MP4 fragmentado para streaming
    '-f', 'mp4',
    'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'ignore'] });

  ffmpeg.stdout.pipe(res);

  ffmpeg.on('error', (e) => {
    console.error('[remux] ffmpeg error:', e.message);
    if (!res.headersSent) res.status(500).end();
    else res.end();
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0) console.warn('[remux] ffmpeg exited with code', code);
    res.end();
  });

  req.on('close', () => {
    ffmpeg.kill('SIGKILL');
  });
});

module.exports = router;
