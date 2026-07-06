const axios = require('axios');

async function sendPush(tokens, title, body, data = {}) {
  const valid = (Array.isArray(tokens) ? tokens : [tokens])
    .filter(t => t && typeof t === 'string' && t.startsWith('ExponentPushToken'));
  if (!valid.length) return;

  const messages = valid.map(to => ({ to, sound: 'default', title, body, data }));
  // Expo aceita até 100 por requisição
  for (let i = 0; i < messages.length; i += 100) {
    try {
      await axios.post('https://exp.host/--/api/v2/push/send', messages.slice(i, i + 100), {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 10_000,
      });
    } catch (e) {
      console.error('[push] erro ao enviar chunk:', e.message?.slice(0, 100));
    }
  }
}

async function sendPushToAll(supabase, title, body, data = {}) {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('push_token')
      .not('push_token', 'is', null);
    const tokens = (users || []).map(u => u.push_token).filter(Boolean);
    await sendPush(tokens, title, body, data);
  } catch (e) {
    console.error('[push] sendPushToAll erro:', e.message);
  }
}

// Avisa usuários cuja assinatura (app ou IPTV) expira em ~3 dias ou ~1 dia.
// Deve ser chamado a cada 12h — a janela de ±12h garante que cada usuário
// receba no máximo 1 aviso por marco (3 dias antes, 1 dia antes).
async function sendExpiryWarnings(supabase) {
  const now = new Date();
  const HALF_DAY = 12 * 60 * 60 * 1000;
  const WARN_AT_DAYS = [3, 1];

  for (const days of WARN_AT_DAYS) {
    const winStart = new Date(now.getTime() + days * 24 * 60 * 60 * 1000 - HALF_DAY);
    const winEnd   = new Date(now.getTime() + days * 24 * 60 * 60 * 1000 + HALF_DAY);
    const label    = days === 1 ? 'hoje' : `em ${days} dias`;

    // ── Assinatura do app ─────────────────────────────────────────────────────
    try {
      const { data: users } = await supabase
        .from('users')
        .select('push_token')
        .not('push_token', 'is', null)
        .not('plan_expires_at', 'is', null)
        .gte('plan_expires_at', winStart.toISOString())
        .lte('plan_expires_at', winEnd.toISOString());

      for (const u of users || []) {
        await sendPush(
          [u.push_token],
          '⚠️ Assinatura FlixHome',
          `Sua assinatura expira ${label}. Renove para continuar assistindo!`,
          { screen: 'subscription' }
        );
      }
      if (users?.length) console.log(`[push] app expiry (${days}d): ${users.length} avisos`);
    } catch (e) {
      console.error('[push] app expiry check erro:', e.message);
    }

    // ── Assinatura IPTV ───────────────────────────────────────────────────────
    try {
      const { data: users } = await supabase
        .from('users')
        .select('push_token')
        .not('push_token', 'is', null)
        .not('iptv_expires_at', 'is', null)
        .gte('iptv_expires_at', winStart.toISOString())
        .lte('iptv_expires_at', winEnd.toISOString());

      for (const u of users || []) {
        await sendPush(
          [u.push_token],
          '📺 IPTV FlixHome',
          `Sua assinatura IPTV expira ${label}. Renove para continuar assistindo!`,
          { screen: 'iptv' }
        );
      }
      if (users?.length) console.log(`[push] iptv expiry (${days}d): ${users.length} avisos`);
    } catch (e) {
      // iptv_expires_at pode não existir ainda na tabela — não logar como erro crítico
      if (!e.message?.includes('column')) {
        console.error('[push] iptv expiry check erro:', e.message);
      }
    }
  }
}

module.exports = { sendPush, sendPushToAll, sendExpiryWarnings };
