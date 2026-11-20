const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');
const asaas = require('../services/asaas');

async function getPlansConfig() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'plans_config')
      .single();
    if (error) {
      console.error('[payments] getPlansConfig Supabase error:', error.code, error.message);
      return [];
    }
    if (!data) return [];
    return JSON.parse(data.value);
  } catch (e) {
    console.error('[payments] getPlansConfig exception:', e.message);
    return [];
  }
}

// GET /api/payments/plans — planos ativos (público)
router.get('/plans', async (req, res) => {
  try {
    const plans = await getPlansConfig();
    res.json(plans.filter(p => p.active));
  } catch (e) {
    console.error('[payments] GET /plans error:', e.message);
    res.status(500).json({ error: 'Erro ao carregar planos: ' + e.message });
  }
});

// GET /api/payments/plans/all — todos os planos (admin)
router.get('/plans/all', adminMiddleware, async (req, res) => {
  try {
    res.json(await getPlansConfig());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/payments/plans — salva planos (admin)
router.put('/plans', adminMiddleware, async (req, res) => {
  const { plans } = req.body;
  if (!Array.isArray(plans)) return res.status(400).json({ error: 'plans deve ser um array' });
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'plans_config', value: JSON.stringify(plans), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/payments/qr?text=<link> - QR code PNG do link de pagamento (TVs mostram na tela
// pra pagar pelo celular). Só gera QR de links do próprio site (evita virar gerador aberto).
router.get('/qr', async (req, res) => {
  const text = String(req.query.text || '');
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!base || !text.startsWith(base + '/') || text.length > 400) return res.status(400).json({ error: 'Link inválido' });
  try {
    const png = await require('qrcode').toBuffer(text, { width: 360, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
    res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=3600').send(png);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ───────────────────────── helpers ─────────────────────────

const frontBase = () => process.env.FRONTEND_URL || 'https://flixhome.com.br';

async function getSetting(key, fallback = null) {
  const { data } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
  return data?.value ?? fallback;
}

function validCpfCnpj(v) {
  const d = asaas.onlyDigits(v);
  return d.length === 11 || d.length === 14;
}

async function ensureCustomer(userId, { name, email, cpfCnpj, phone }) {
  const { data: u } = await supabase.from('users').select('asaas_customer_id').eq('id', userId).single();
  if (u?.asaas_customer_id) return u.asaas_customer_id;
  const c = await asaas.createCustomer({ name, email, cpfCnpj, phone });
  await supabase.from('users').update({ asaas_customer_id: c.id }).eq('id', userId);
  return c.id;
}

// Resolve o que está sendo comprado (preço sempre vem do servidor, nunca do cliente).
async function resolveItem(kind, body) {
  if (kind === 'plan') {
    const plans = await getPlansConfig();
    const plan = plans.find(p => p.id === body.plan_id && p.active);
    if (!plan) throw Object.assign(new Error('Plano não encontrado ou inativo'), { status: 400 });
    const price = plan.promo_price != null ? plan.promo_price : plan.price;
    return { plan_id: plan.id, plan_name: plan.name, amount: Number(price), duration_days: Number(plan.duration_days) || 30, desc: `FlixHome – ${plan.name}` };
  }
  if (kind === 'iptv') {
    const { data: plan } = await supabase.from('iptv_plans').select('*').eq('id', body.plan_id).eq('is_active', true).maybeSingle();
    if (!plan) throw Object.assign(new Error('Plano IPTV não encontrado ou inativo'), { status: 400 });
    return { plan_id: plan.id, plan_name: plan.name, amount: Number(plan.price), duration_days: null, desc: `FlixHome IPTV – ${plan.name}` };
  }
  if (kind === 'donate') {
    const amount = Number(body.amount);
    if (!amount || amount < 5) throw Object.assign(new Error('Valor mínimo de apoio: R$ 5,00'), { status: 400 });
    return { plan_id: null, plan_name: 'Apoio ao FlixHome', amount, duration_days: null, desc: 'Apoio ao FlixHome' };
  }
  throw Object.assign(new Error('Tipo de compra inválido'), { status: 400 });
}

// Aplica o benefício de um pagamento confirmado. Idempotente: só roda se
// fulfilled_at ainda for nulo (o webhook pode chegar repetido ou junto do polling).
async function fulfill(row) {
  const { data: claimed } = await supabase
    .from('payments')
    .update({ fulfilled_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('fulfilled_at', null)
    .select('id');
  if (!claimed || claimed.length === 0) return false;

  if (row.kind === 'plan') {
    const { data: cur } = await supabase.from('users').select('plan_expires_at').eq('id', row.user_id).single();
    const base = cur?.plan_expires_at && new Date(cur.plan_expires_at) > new Date() ? new Date(cur.plan_expires_at) : new Date();
    const expiresAt = new Date(base.getTime() + (row.duration_days || 30) * 86400000).toISOString();
    await supabase.from('users').update({ plan: row.plan_id, plan_expires_at: expiresAt }).eq('id', row.user_id);
    console.log(`[asaas] plano ativado user=${row.user_id} plano=${row.plan_id} expira=${expiresAt}`);
  } else if (row.kind === 'iptv') {
    const { data: u } = await supabase.from('users').select('name, email').eq('id', row.user_id).single();
    await supabase.from('iptv_orders').insert({
      user_id: row.user_id, user_name: u?.name || 'Usuário', user_email: u?.email || '',
      plan_id: row.plan_id, plan_name: row.plan_name, amount: row.amount,
      asaas_payment_id: row.asaas_payment_id, status: 'pending',
    });
    try {
      const { notifyAdminIptvOrder } = require('../services/whatsapp');
      await notifyAdminIptvOrder({ userName: u?.name || 'Usuário', userEmail: u?.email || '', planName: row.plan_name, amount: row.amount, paymentId: row.asaas_payment_id });
    } catch (e) { console.error('[asaas] notify iptv:', e.message); }
  } else {
    console.log(`[asaas] apoio recebido user=${row.user_id} valor=${row.amount}`);
  }
  return true;
}

// Sincroniza o status de um pagamento com o Asaas e aplica se pago.
async function syncPayment(row) {
  const remote = await asaas.getPayment(row.asaas_payment_id);
  const status = remote.status;
  if (status !== row.status) {
    await supabase.from('payments').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id);
    row.status = status;
  }
  if (asaas.isPaid(status)) await fulfill(row);
  return status;
}

// ───────────────────────── checkout próprio ─────────────────────────

// POST /api/payments/checkout
// body: { kind: 'plan'|'iptv'|'donate', plan_id?, amount?, method: 'PIX'|'CREDIT_CARD'|'BOLETO',
//         cpf, phone?, card?: { holderName, number, expiryMonth, expiryYear, ccv }, holder?: { postalCode, addressNumber } }
router.post('/checkout', authMiddleware, async (req, res) => {
  const userId = req.user.id || req.user.userId;
  const { kind, method, cpf, phone, card, holder } = req.body || {};
  if (!['PIX', 'CREDIT_CARD', 'BOLETO'].includes(method)) return res.status(400).json({ error: 'Forma de pagamento inválida' });
  if (!validCpfCnpj(cpf)) return res.status(400).json({ error: 'Informe um CPF ou CNPJ válido' });

  try {
    const item = await resolveItem(kind, req.body);
    const { data: user } = await supabase.from('users').select('name, email').eq('id', userId).single();
    const email = user?.email || req.user.email || '';
    const name = user?.name || email.split('@')[0] || 'Cliente FlixHome';

    const customer = await ensureCustomer(userId, { name, email, cpfCnpj: cpf, phone });

    const due = new Date(Date.now() + (method === 'BOLETO' ? 3 : 1) * 86400000).toISOString().slice(0, 10);
    const body = {
      customer,
      billingType: method,
      value: item.amount,
      dueDate: due,
      description: item.desc,
      externalReference: `${kind}|${userId}|${item.plan_id || ''}`,
    };

    if (method === 'CREDIT_CARD') {
      if (!card?.number || !card?.ccv || !card?.expiryMonth || !card?.expiryYear || !card?.holderName) {
        return res.status(400).json({ error: 'Dados do cartão incompletos' });
      }
      body.creditCard = {
        holderName: card.holderName,
        number: asaas.onlyDigits(card.number),
        expiryMonth: String(card.expiryMonth).padStart(2, '0'),
        expiryYear: String(card.expiryYear).length === 2 ? `20${card.expiryYear}` : String(card.expiryYear),
        ccv: asaas.onlyDigits(card.ccv),
      };
      body.creditCardHolderInfo = {
        name: card.holderName,
        email,
        cpfCnpj: asaas.onlyDigits(cpf),
        postalCode: asaas.onlyDigits(holder?.postalCode),
        addressNumber: String(holder?.addressNumber || 'S/N'),
        mobilePhone: /^\d{2}9\d{8}$/.test(asaas.onlyDigits(phone)) ? asaas.onlyDigits(phone) : undefined,
      };
      body.remoteIp = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    }

    const pay = await asaas.createPayment(body);

    const { data: row, error: insErr } = await supabase.from('payments').insert({
      user_id: userId, kind, plan_id: item.plan_id, plan_name: item.plan_name,
      duration_days: item.duration_days, amount: item.amount, method,
      asaas_payment_id: pay.id, status: pay.status, invoice_url: pay.invoiceUrl || null,
    }).select().single();
    if (insErr) throw insErr;

    const out = { payment_id: pay.id, status: pay.status, method, amount: item.amount, invoice_url: pay.invoiceUrl || null };

    if (method === 'PIX') {
      const qr = await asaas.getPixQrCode(pay.id);
      out.pix = { qr_image: qr.encodedImage, payload: qr.payload, expires_at: qr.expirationDate };
    } else if (method === 'BOLETO') {
      out.boleto = { url: pay.bankSlipUrl || pay.invoiceUrl, due_date: pay.dueDate };
      try { out.boleto.line = (await asaas.getBoletoLine(pay.id)).identificationField; } catch {}
    }

    if (asaas.isPaid(pay.status)) await fulfill(row); // cartão aprovado na hora
    res.json(out);
  } catch (e) {
    console.error('[asaas] checkout error:', e.response?.data || e.message);
    res.status(e.status || 500).json({ error: e.status ? e.message : asaas.asaasError(e) });
  }
});

// GET /api/payments/status/:id — o app/web faz polling aqui enquanto espera o PIX
router.get('/status/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { data: row } = await supabase.from('payments').select('*').eq('asaas_payment_id', req.params.id).eq('user_id', userId).maybeSingle();
    if (!row) return res.status(404).json({ error: 'Pagamento não encontrado' });
    const status = row.fulfilled_at ? row.status : await syncPayment(row);
    res.json({ status, paid: asaas.isPaid(status), kind: row.kind });
  } catch (e) {
    res.status(500).json({ error: asaas.asaasError(e) });
  }
});

// POST /api/payments/webhook/asaas — configure no painel do Asaas com o
// "Token de autenticação" igual a ASAAS_WEBHOOK_TOKEN.
router.post('/webhook/asaas', async (req, res) => {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    console.error('[asaas] ASAAS_WEBHOOK_TOKEN não configurado — webhook recusado');
    return res.sendStatus(503);
  }
  const got = String(req.headers['asaas-access-token'] || '');
  const a = Buffer.from(got), b = Buffer.from(expected);
  if (a.length !== b.length || !require('crypto').timingSafeEqual(a, b)) return res.sendStatus(401);
  res.sendStatus(200);

  try {
    const ev = req.body?.event;
    const id = req.body?.payment?.id;
    if (!id) return;
    const { data: row } = await supabase.from('payments').select('*').eq('asaas_payment_id', id).maybeSingle();
    if (!row) return;
    const status = req.body.payment.status;
    await supabase.from('payments').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id);
    row.status = status;
    if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(ev) || asaas.isPaid(status)) await fulfill(row);

    // Estorno / chargeback: tira o acesso que esse pagamento concedeu.
    if (['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED'].includes(ev) && row.fulfilled_at && row.kind === 'plan') {
      const { data: u } = await supabase.from('users').select('plan').eq('id', row.user_id).single();
      if (u?.plan === row.plan_id) {
        await supabase.from('users').update({ plan: null, plan_expires_at: new Date().toISOString() }).eq('id', row.user_id);
        console.log(`[asaas] acesso revogado (${ev}) user=${row.user_id}`);
      }
    }
  } catch (e) {
    console.error('[asaas] webhook error:', e.message);
  }
});

// ───────── compatibilidade com apps antigos (esperavam init_point do Mercado Pago) ─────────
// Em vez de quebrar, mandam o usuário pra página de pagamento própria no site.
router.post('/subscribe', authMiddleware, (req, res) => {
  const { plan_id } = req.body;
  if (!plan_id) return res.status(400).json({ error: 'plan_id obrigatório' });
  res.json({ init_point: `${frontBase()}/pagamento?kind=plan&plan_id=${encodeURIComponent(plan_id)}` });
});
router.post('/donate', authMiddleware, (req, res) => {
  const amount = Number(req.body?.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });
  res.json({ init_point: `${frontBase()}/pagamento?kind=donate&amount=${amount}` });
});

// ───────────────────────── teste grátis ─────────────────────────

async function trialConfig() {
  const [enabled, days] = await Promise.all([getSetting('trial_enabled', 'false'), getSetting('trial_days', '7')]);
  return { enabled: enabled === 'true', days: Math.max(1, parseInt(days) || 7) };
}

// Concede o teste grátis com anti-abuso. Retorna { ok: true, days } ou { ok: false, code, message }.
//  - Celular/TV: 1 teste por APARELHO (IP não vale: operadoras compartilham IP entre clientes).
//  - PC/web: 1 teste por IP.
//  - VPN/proxy/datacenter/Tor: bloqueado (configurável em trial_block_vpn).
async function grantTrial(userId, req) {
  const guard = require('../services/guard');
  const cfg = await trialConfig();
  if (!cfg.enabled) return { ok: false, code: 'disabled', message: 'Teste grátis indisponível.' };

  const { data: u } = await supabase.from('users').select('trial_used_at, plan_expires_at').eq('id', userId).single();
  if (!u) return { ok: false, code: 'no_user', message: 'Usuário não encontrado.' };
  if (u.trial_used_at) return { ok: false, code: 'used', message: 'Você já usou o teste grátis.' };
  if (u.plan_expires_at && new Date(u.plan_expires_at) > new Date()) return { ok: false, code: 'has_plan', message: 'Você já tem um plano ativo.' };

  const ip = guard.clientIp(req);
  const platform = guard.platformOf(req);
  const dev = guard.deviceHash(req);
  const native = platform !== 'web';

  if (await guard.isBlocked(req, 'trial')) return { ok: false, code: 'blocked', message: 'Teste grátis indisponível para este dispositivo/rede.' };
  if (native && !dev) return { ok: false, code: 'no_device', message: 'Atualize o app para ativar o teste grátis.' };

  if ((await getSetting('trial_block_vpn', 'true')) === 'true' && await guard.isVpn(ip)) {
    return { ok: false, code: 'vpn', message: 'Desative a VPN/proxy para ativar o teste grátis.' };
  }

  if (dev) {
    const { count } = await supabase.from('trial_claims').select('id', { count: 'exact', head: true }).eq('device_hash', dev);
    if (count > 0) return { ok: false, code: 'device_used', message: 'Este aparelho já usou o teste grátis.' };
  }
  if (!native && ip) {
    const maxIp = Math.max(1, parseInt(await getSetting('trial_max_per_ip', '1')) || 1);
    const { count } = await supabase.from('trial_claims').select('id', { count: 'exact', head: true }).eq('ip', ip);
    if (count >= maxIp) return { ok: false, code: 'ip_used', message: 'Esta rede já usou o teste grátis.' };
  }

  const expires = new Date(Date.now() + cfg.days * 86400000).toISOString();
  // Marca de forma condicional: duas chamadas simultâneas não concedem em dobro.
  const { data: marked } = await supabase.from('users')
    .update({ plan: 'trial', plan_expires_at: expires, trial_used_at: new Date().toISOString() })
    .eq('id', userId).is('trial_used_at', null).select('id');
  if (!marked || marked.length === 0) return { ok: false, code: 'used', message: 'Você já usou o teste grátis.' };
  await supabase.from('trial_claims').insert({ user_id: userId, device_hash: dev, ip, platform });
  return { ok: true, days: cfg.days };
}

// GET /api/payments/trial — a tela de planos usa pra decidir se mostra o botão
router.get('/trial', authMiddleware, async (req, res) => {
  const cfg = await trialConfig();
  const { data: u } = await supabase.from('users').select('trial_used_at, plan_expires_at').eq('id', req.user.id).single();
  const hasActive = u?.plan_expires_at && new Date(u.plan_expires_at) > new Date();
  res.json({ enabled: cfg.enabled, days: cfg.days, available: cfg.enabled && !u?.trial_used_at && !hasActive });
});

// POST /api/payments/trial/start
router.post('/trial/start', authMiddleware, async (req, res) => {
  try {
    const r = await grantTrial(req.user.id, req);
    if (!r.ok) return res.status(400).json({ error: r.message, code: r.code });
    res.json({ ok: true, days: r.days });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ───────────────────────── admin: orquestrador de cobranças ─────────────────────────

// GET /api/payments/admin/list?status=&kind=&limit=
router.get('/admin/list', adminMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 300);
    let q = supabase.from('payments').select('*, users(name, email, plan, plan_expires_at)').order('created_at', { ascending: false }).limit(limit);
    if (req.query.status) q = q.eq('status', req.query.status);
    if (req.query.kind) q = q.eq('kind', req.query.kind);
    const { data, error } = await q;
    if (error) throw error;
    const paid = (data || []).filter(p => asaas.isPaid(p.status));
    res.json({
      payments: data || [],
      totals: { count: data?.length || 0, paid_count: paid.length, paid_amount: paid.reduce((a, p) => a + Number(p.amount), 0) },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/payments/admin/summary - KPIs da tela de pagamentos
router.get('/admin/summary', adminMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString();
    const [paid, pend, active, trial, expiring, iptv] = await Promise.all([
      supabase.from('payments').select('amount').in('status', ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']).gte('created_at', monthStart),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('users').select('id', { count: 'exact', head: true }).gt('plan_expires_at', now.toISOString()).neq('plan', 'trial'),
      supabase.from('users').select('id', { count: 'exact', head: true }).gt('plan_expires_at', now.toISOString()).eq('plan', 'trial'),
      supabase.from('users').select('id', { count: 'exact', head: true }).gt('plan_expires_at', now.toISOString()).lt('plan_expires_at', in7).neq('plan', 'trial'),
      supabase.from('iptv_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    res.json({
      revenue_month: (paid.data || []).reduce((a, p) => a + Number(p.amount), 0),
      active_paying: active.count || 0, in_trial: trial.count || 0,
      pending: pend.count || 0, expiring_7d: expiring.count || 0, iptv_pending: iptv.count || 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/payments/admin/resync-pending - confere no Asaas todos os pendentes (até 50)
router.post('/admin/resync-pending', adminMiddleware, async (req, res) => {
  try {
    const { data: rows } = await supabase.from('payments').select('*').eq('status', 'PENDING').order('created_at', { ascending: false }).limit(50);
    let changed = 0;
    for (const row of rows || []) {
      try { const before = row.status; const st = await syncPayment(row); if (st !== before) changed++; } catch {}
    }
    res.json({ checked: (rows || []).length, changed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/payments/admin/trial-stats - testes ativos / convertidos / taxa
router.get('/admin/trial-stats', adminMiddleware, async (req, res) => {
  try {
    const nowIso = new Date().toISOString();
    const [active, claims] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('plan', 'trial').gt('plan_expires_at', nowIso),
      supabase.from('trial_claims').select('user_id'),
    ]);
    const ids = [...new Set((claims.data || []).map(c => c.user_id).filter(Boolean))];
    let converted = 0;
    if (ids.length) {
      const { data: paidRows } = await supabase.from('payments').select('user_id').in('user_id', ids).in('status', ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']);
      converted = new Set((paidRows || []).map(p => p.user_id)).size;
    }
    res.json({ active: active.count || 0, total: ids.length, converted, rate: ids.length ? Math.round((converted / ids.length) * 1000) / 10 : 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/payments/admin/:id/resync — força consulta ao Asaas (webhook perdido)
router.post('/admin/:id/resync', adminMiddleware, async (req, res) => {
  try {
    const { data: row } = await supabase.from('payments').select('*').eq('id', req.params.id).single();
    if (!row) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ status: await syncPayment(row) });
  } catch (e) {
    res.status(500).json({ error: asaas.asaasError(e) });
  }
});

module.exports = router;
module.exports.grantTrial = grantTrial;
