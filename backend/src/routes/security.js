const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { adminMiddleware } = require('../middleware/admin');
const guard = require('../services/guard');

router.use(adminMiddleware);

// GET /api/security/blocklist
router.get('/blocklist', async (req, res) => {
  const { data, error } = await supabase.from('blocked_entries').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// POST /api/security/blocklist { kind: 'ip'|'device', value, scope: 'all'|'trial', reason }
// Para 'device' pode mandar o ID cru em `raw_device_id` (o servidor faz o hash).
router.post('/blocklist', async (req, res) => {
  const { kind, scope = 'all', reason } = req.body || {};
  let { value } = req.body || {};
  if (!['ip', 'device'].includes(kind) || !['all', 'trial'].includes(scope)) return res.status(400).json({ error: 'Dados inválidos' });
  if (kind === 'device' && req.body.raw_device_id) {
    value = guard.deviceHash({ headers: { 'x-device-id': req.body.raw_device_id } });
  }
  value = String(value || '').trim();
  if (!value) return res.status(400).json({ error: 'Valor obrigatório' });
  if (kind === 'ip' && !/^[0-9a-fA-F:.]+(\/\d{1,2})?$/.test(value)) return res.status(400).json({ error: 'IP inválido' });
  // trava de segurança: não deixa o admin bloquear o próprio IP
  if (kind === 'ip' && scope === 'all' && value === guard.clientIp(req)) return res.status(400).json({ error: 'Você não pode bloquear o seu próprio IP' });

  const { data, error } = await supabase.from('blocked_entries')
    .upsert({ kind, value, scope, reason: reason || null }, { onConflict: 'kind,value' }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  guard.invalidateBlocklist();
  res.json(data);
});

// DELETE /api/security/blocklist/:id
router.delete('/blocklist/:id', async (req, res) => {
  const { error } = await supabase.from('blocked_entries').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  guard.invalidateBlocklist();
  res.json({ ok: true });
});

// GET /api/security/trials — testes concedidos (para investigar abuso)
router.get('/trials', async (req, res) => {
  const { data, error } = await supabase.from('trial_claims')
    .select('id, ip, platform, device_hash, created_at, users(name, email)')
    .order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// DELETE /api/security/trials/:id — libera o aparelho/IP para um novo teste (suporte)
router.delete('/trials/:id', async (req, res) => {
  const { data: claim } = await supabase.from('trial_claims').select('user_id').eq('id', req.params.id).single();
  const { error } = await supabase.from('trial_claims').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  if (claim?.user_id) await supabase.from('users').update({ trial_used_at: null }).eq('id', claim.user_id);
  res.json({ ok: true });
});

module.exports = router;
