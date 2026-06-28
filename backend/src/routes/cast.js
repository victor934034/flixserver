const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');

// In-memory cast store: userId → item (completely isolated per user)
const castByUser = new Map();

router.use(authMiddleware);

// POST /api/cast — mobile envia o item para a TV do próprio usuário
router.post('/', (req, res) => {
  const { url, title = '', position = 0, subtitleUrl = null, version = null } = req.body;
  if (!url) return res.status(400).json({ error: 'url é obrigatório' });
  castByUser.set(req.user.id, { url, title, position, subtitleUrl, version, sentAt: Date.now() });
  res.json({ ok: true });
});

// GET /api/cast — TV polling: retorna item do próprio usuário (expira em 2 min)
router.get('/', (req, res) => {
  const item = castByUser.get(req.user.id);
  if (!item || Date.now() - item.sentAt > 120_000) {
    return res.json({ hasContent: false });
  }
  res.json({ hasContent: true, ...item });
});

// DELETE /api/cast — TV confirma recebimento, limpa só o item deste usuário
router.delete('/', (req, res) => {
  castByUser.delete(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
