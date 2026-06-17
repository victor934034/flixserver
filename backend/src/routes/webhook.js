const router = require('express').Router();

// POST /api/webhook/b2?secret=SEU_SECRET
// Backblaze B2 chama este endpoint automaticamente quando um arquivo é enviado ao bucket.
// Configure em: Backblaze Console → Buckets → Flixhome → Event Notifications
// URL: https://movies0-movie.mgf7wb.easypanel.host/api/webhook/b2?secret=SEU_B2_WEBHOOK_SECRET
router.post('/b2', async (req, res) => {
  const secret = req.query.secret || req.headers['x-bz-event-secret'];
  if (process.env.B2_WEBHOOK_SECRET && secret !== process.env.B2_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // B2 envia uma lista de events
  const events = req.body?.events || [req.body];

  const videoExt = /\.(mp4|mkv|avi|mov|m4v|webm|ts)$/i;
  const filesToProcess = events
    .filter(e => e?.eventType?.startsWith('b2:ObjectCreated') && videoExt.test(e.objectName || ''))
    .map(e => ({
      url: `${process.env.CDN_BASE_URL}/${e.objectName}`,
      version: detectVersion(e.objectName),
    }));

  if (filesToProcess.length === 0) {
    return res.json({ processed: 0, message: 'Nenhum arquivo de vídeo no evento' });
  }

  // Processa em background sem bloquear a resposta
  res.json({ processed: filesToProcess.length, message: 'Processando em background...' });

  try {
    const { processFiles } = require('../../tmdb-bot');
    const report = await processFiles(filesToProcess);
    console.log(`[B2 Webhook] Relatório:`, JSON.stringify(report, null, 2));
  } catch (err) {
    console.error('[B2 Webhook] Erro ao processar:', err.message);
  }
});

function detectVersion(filename = '') {
  const lower = filename.toLowerCase();
  if (lower.includes('legendado') || lower.includes('sub') || lower.includes('leg')) return 'subtitled';
  if (lower.includes('cinema') || lower.includes('original')) return 'cinema';
  if (lower.includes('4k') || lower.includes('2160p')) return '4k';
  return 'dubbing';
}

module.exports = router;
