const router = require('express').Router();
const { optionalAuth } = require('../middleware/auth');

// In-memory cast store: userId → item, plus a global fallback
const castByUser = new Map();
let globalCast = null;

// POST /api/cast — salva o item a transmitir (mobile ou web → TV)
router.post('/', optionalAuth, (req, res) => {
  const { url, title = '', position = 0, subtitleUrl = null, version = null } = req.body;
  if (!url) return res.status(400).json({ error: 'url é obrigatório' });
  const item = { url, title, position, subtitleUrl, version, sentAt: Date.now() };
  globalCast = item;
  if (req.user) castByUser.set(req.user.id, item);
  res.json({ ok: true });
});

// GET /api/cast — LG TV polling: retorna item atual (expira em 2 min)
router.get('/', optionalAuth, (req, res) => {
  const item = (req.user && castByUser.get(req.user.id)) || globalCast;
  if (!item || Date.now() - item.sentAt > 120_000) {
    return res.json({ hasContent: false });
  }
  res.json({ hasContent: true, ...item });
});

// DELETE /api/cast — TV confirma recebimento, limpa estado
router.delete('/', optionalAuth, (req, res) => {
  if (req.user) castByUser.delete(req.user.id);
  globalCast = null;
  res.json({ ok: true });
});

module.exports = router;
