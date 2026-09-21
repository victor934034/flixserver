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

// category: 'new_content' (novo filme/série/episódio) ou 'billing' (assinatura/IPTV) —
// respeita users.notification_prefs, que por padrão vem tudo habilitado.
async function sendPushToAll(supabase, title, body, data = {}, category = 'new_content') {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('push_token, notification_prefs')
      .not('push_token', 'is', null);
    const tokens = (users || [])
      .filter(u => u.notification_prefs?.[category] !== false) // default true se ausente
      .map(u => u.push_token)
      .filter(t => t && t.startsWith('ExponentPushToken'));
    console.log(`[push] sendPushToAll (${category}): ${tokens.length} token(s) encontrado(s)`);
    if (tokens.length) await sendPush(tokens, title, body, data);
    return tokens.length;
  } catch (e) {
    console.error('[push] sendPushToAll erro:', e.message);
    return 0;
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
      const { data: usersRaw } = await supabase
        .from('users')
        .select('push_token, notification_prefs')
        .not('push_token', 'is', null)
        .not('plan_expires_at', 'is', null)
        .gte('plan_expires_at', winStart.toISOString())
        .lte('plan_expires_at', winEnd.toISOString());
      const users = (usersRaw || []).filter(u => u.notification_prefs?.billing !== false);

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
      const { data: usersRaw } = await supabase
        .from('users')
        .select('push_token, notification_prefs')
        .not('push_token', 'is', null)
        .not('iptv_expires_at', 'is', null)
        .gte('iptv_expires_at', winStart.toISOString())
        .lte('iptv_expires_at', winEnd.toISOString());
      const users = (usersRaw || []).filter(u => u.notification_prefs?.billing !== false);

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


// ── Episódio novo de série que está na "Minha Lista" ─────────────────────────
// Sem migração: guarda o "ultimo check" e um cooldown por série em
// system_settings. Primeira execução só marca a linha de base (não avisa
// nada do que já existia). Espera 10 min após o episódio ser salvo e limita
// 1 aviso por série a cada 6h, senão um upload em lote (35 eps em horas)
// mandaria uma notificação por rodada.
const EP_LAST_KEY = 'episode_notify_last_check';
const EP_CD_KEY = 'episode_notify_series_cooldown';
const EP_SETTLE_MS = 10 * 60 * 1000;
const EP_COOLDOWN_MS = 6 * 60 * 60 * 1000;

async function readSetting(supabase, key) {
  const { data } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
async function writeSetting(supabase, key, value) {
  await supabase.from('system_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

async function sendNewEpisodeAlerts(supabase) {
  const now = Date.now();
  const cutoffIso = new Date(now - EP_SETTLE_MS).toISOString();
  const lastIso = await readSetting(supabase, EP_LAST_KEY);
  if (!lastIso) { await writeSetting(supabase, EP_LAST_KEY, cutoffIso); return 0; }

  const { data: eps, error } = await supabase
    .from('episodes')
    .select('id, series_id, season_number, episode_number, title, file_dubbing, file_subtitled, file_cinema, file_color, file_bw, created_at')
    .gt('created_at', lastIso)
    .lte('created_at', cutoffIso)
    .limit(500);
  if (error) throw error;
  await writeSetting(supabase, EP_LAST_KEY, cutoffIso);

  const playable = (eps || []).filter(e => e.file_dubbing || e.file_subtitled || e.file_cinema || e.file_color || e.file_bw);
  if (!playable.length) return 0;

  const bySeries = new Map();
  for (const e of playable) {
    if (!bySeries.has(e.series_id)) bySeries.set(e.series_id, []);
    bySeries.get(e.series_id).push(e);
  }

  let cooldown = {};
  try { cooldown = JSON.parse((await readSetting(supabase, EP_CD_KEY)) || '{}'); } catch {}
  const seriesIds = [...bySeries.keys()].filter(id => now - (cooldown[id] || 0) > EP_COOLDOWN_MS);
  if (!seriesIds.length) return 0;

  const { data: seriesRows } = await supabase.from('series').select('id, title').in('id', seriesIds);
  const titleOf = Object.fromEntries((seriesRows || []).map(r => [r.id, r.title]));

  const { data: lists } = await supabase
    .from('watchlist').select('user_id, content_id').eq('content_type', 'series').in('content_id', seriesIds);
  const userIds = [...new Set((lists || []).map(l => l.user_id))];
  if (!userIds.length) return 0;
  const { data: users } = await supabase
    .from('users').select('id, push_token, notification_prefs').in('id', userIds).not('push_token', 'is', null);
  const userById = Object.fromEntries((users || []).map(u => [u.id, u]));

  let sent = 0;
  for (const sid of seriesIds) {
    const list = bySeries.get(sid);
    const tokens = (lists || [])
      .filter(l => l.content_id === sid)
      .map(l => userById[l.user_id])
      .filter(u => u && u.notification_prefs?.new_content !== false)
      .map(u => u.push_token);
    if (!tokens.length) continue;
    const first = [...list].sort((a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number)[0];
    const label = list.length === 1
      ? `T${first.season_number}E${String(first.episode_number).padStart(2, '0')}${first.title ? ' · ' + first.title : ''}`
      : `${list.length} episódios novos`;
    await sendPush([...new Set(tokens)], `Novo em ${titleOf[sid] || 'sua lista'}`, label, { screen: 'serie', id: sid });
    cooldown[sid] = now;
    sent += tokens.length;
  }
  await writeSetting(supabase, EP_CD_KEY, JSON.stringify(cooldown));
  console.log(`[push] episódios novos: ${sent} aviso(s)`);
  return sent;
}

module.exports = { sendPush, sendPushToAll, sendExpiryWarnings, sendNewEpisodeAlerts };
