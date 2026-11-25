const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { referralConfig, ensureCode } = require('../services/referrals');

// Só conta nova pode informar um código (senão dois clientes antigos se
// "indicariam" um ao outro na hora de renovar).
const APPLY_WINDOW_DAYS = 7;

router.use(authMiddleware);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

async function canApply(userId) {
  const [{ data: user }, { data: used }, { count: paid }] = await Promise.all([
    supabase.from('users').select('created_at').eq('id', userId).single(),
    supabase.from('referrals').select('id').eq('referred_id', userId).limit(1),
    supabase.from('payments').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).in('kind', ['plan', 'iptv']).not('fulfilled_at', 'is', null),
  ]);
  if (used?.length) return { ok: false, message: 'Você já usou um código de indicação.' };
  const age = Date.now() - new Date(user?.created_at || 0).getTime();
  if (age > APPLY_WINDOW_DAYS * 86400000) return { ok: false, message: `O código só vale para contas criadas há até ${APPLY_WINDOW_DAYS} dias.` };
  if (paid > 0) return { ok: false, message: 'O código só vale antes da primeira assinatura.' };
  return { ok: true };
}

// GET /api/referrals/me — { enabled:false } enquanto o recurso estiver desligado
router.get('/me', async (req, res) => {
  try {
    const cfg = await referralConfig(supabase);
    if (!cfg.enabled) return res.json({ enabled: false });

    const [code, { data: mine, error }, apply] = await Promise.all([
      ensureCode(supabase, req.user.id),
      supabase.from('referrals').select('rewarded_at, reward_days').eq('referrer_id', req.user.id),
      canApply(req.user.id),
    ]);
    if (error) throw error;
    const rewarded = (mine || []).filter(r => r.rewarded_at);
    const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    res.json({
      enabled: true,
      days: cfg.days,
      code,
      link: base && code ? `${base}/indicar?codigo=${code}` : null,
      invited: (mine || []).length,
      rewarded: rewarded.length,
      days_earned: rewarded.reduce((sum, r) => sum + (r.reward_days || 0), 0),
      can_apply: apply.ok,
    });
  } catch (e) {
    console.error('[indicação] me:', e.message);
    res.json({ enabled: false }); // sem a migração no banco, o app só esconde o recurso
  }
});

// POST /api/referrals/apply { code } — o amigo informa quem indicou
router.post('/apply', async (req, res) => {
  try {
    const cfg = await referralConfig(supabase);
    if (!cfg.enabled) return res.status(400).json({ error: 'Indicação indisponível no momento.' });

    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!/^[A-Z2-9]{7}$/.test(code)) return res.status(400).json({ error: 'Código inválido.' });

    const allowed = await canApply(req.user.id);
    if (!allowed.ok) return res.status(400).json({ error: allowed.message });

    const { data: referrer } = await supabase.from('users').select('id').eq('referral_code', code).maybeSingle();
    if (!referrer) return res.status(404).json({ error: 'Código não encontrado.' });
    if (referrer.id === req.user.id) return res.status(400).json({ error: 'Você não pode usar o seu próprio código.' });

    // Mesmo aparelho nas duas contas = provável autoindicação
    const guard = require('../services/guard');
    const device = guard.deviceHash(req);
    if (device) {
      const { count } = await supabase.from('trial_claims').select('id', { count: 'exact', head: true })
        .eq('user_id', referrer.id).eq('device_hash', device);
      if (count > 0) return res.status(400).json({ error: 'Este código não pode ser usado neste aparelho.' });
    }

    const { error } = await supabase.from('referrals').insert({ referrer_id: referrer.id, referred_id: req.user.id });
    if (error) return res.status(400).json({ error: 'Não foi possível usar este código.' });
    res.json({ ok: true, days: cfg.days });
  } catch (e) {
    console.error('[indicação] apply:', e.message);
    res.status(500).json({ error: 'Não foi possível usar este código agora.' });
  }
});

module.exports = router;
