// Pós-pagamento IPTV: avisa o admin e (se SIGMA_AUTO=true e o plano estiver ligado a um pacote do painel)
// cria/renova o usuário no painel automaticamente.
const { supabase } = require('./supabase');
const sigma = require('./sigma');
const { sendPush } = require('./notifications');
const { notifyAdminIptvOrder, sendTelegram } = require('./whatsapp');

async function pushAdmins(title, body, data) {
  try {
    const { data: admins } = await supabase.from('users').select('push_token').eq('is_admin', true).not('push_token', 'is', null);
    const tokens = (admins || []).map(a => a.push_token).filter(Boolean);
    if (tokens.length) await sendPush(tokens, title, body, data);
  } catch (e) { console.error('[iptv] push admins:', e.message); }
}

async function activateOrder(order, plan) {
  await supabase.from('iptv_orders').update({ status: 'activated' }).eq('id', order.id);
  if (plan?.duration_months) {
    const exp = new Date();
    exp.setMonth(exp.getMonth() + Number(plan.duration_months));
    await supabase.from('users').update({ iptv_expires_at: exp.toISOString() }).eq('id', order.user_id);
  }
  const { data: u } = await supabase.from('users').select('push_token, notification_prefs').eq('id', order.user_id).single();
  if (u?.push_token && u.notification_prefs?.billing !== false) {
    sendPush([u.push_token], '📺 IPTV ativado!', 'Seu acesso IPTV já está liberado. Bom entretenimento!', { screen: 'iptv' }).catch(() => {});
  }
}

async function provisionOrder(order) {
  const { data: plan } = await supabase.from('iptv_plans').select('*').eq('id', order.plan_id).maybeSingle();
  if (!plan?.sigma_package_id || !plan?.sigma_server_id) throw new Error('Plano sem pacote do painel vinculado');

  const { data: cred } = await supabase.from('iptv_credentials').select('xc_username').eq('user_id', order.user_id).maybeSingle();
  let customer = null;
  if (cred?.xc_username) customer = await sigma.findCustomer(cred.xc_username);

  if (customer) {
    customer = await sigma.renewCustomer(customer.id, { package_id: plan.sigma_package_id });
  } else {
    customer = await sigma.createCustomer({
      server_id: plan.sigma_server_id, package_id: plan.sigma_package_id,
      connections: Number(plan.max_streams) || 1,
      name: order.user_name || undefined, email: order.user_email || undefined,
      note: `FlixHome · ${order.plan_name} · pedido ${order.id}`,
    });
  }
  if (!customer?.username || !customer?.password) throw new Error('Painel não devolveu usuário/senha');

  await supabase.from('iptv_credentials').upsert(
    { user_id: order.user_id, xc_username: customer.username, xc_password: customer.password, active: true, notes: 'criado pela API do painel', updated_at: new Date().toISOString() },
    { onConflict: 'user_id' });
  await activateOrder(order, plan);
  return customer;
}

// chamado quando o pagamento IPTV é confirmado
async function onIptvPaid(orderRow, info) {
  await notifyAdminIptvOrder(info);
  await pushAdmins('🆕 Novo pedido IPTV', `${info.userName} · ${info.planName}`, { screen: 'admin-iptv' });

  if (!sigma.autoEnabled()) return { auto: false };
  try {
    const c = await provisionOrder(orderRow);
    await sendTelegram(`✅ *IPTV ativado automaticamente*\n\n👤 ${info.userName}\n📦 ${info.planName}\n🔑 Usuário: ${c.username}`);
    return { auto: true };
  } catch (e) {
    console.error('[iptv] auto-ativação falhou:', e.message);
    await sendTelegram(`⚠️ *Falha na ativação automática do IPTV*\n\n👤 ${info.userName}\n📦 ${info.planName}\n❌ ${e.message}\n\nAtive manualmente em /admin/pagamentos → IPTV.`);
    return { auto: false, error: e.message };
  }
}

module.exports = { onIptvPaid, provisionOrder, activateOrder };
