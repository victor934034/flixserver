const axios = require('axios');

// Envia mensagem de texto via Z-API
// Variáveis de ambiente necessárias no EasePanel:
//   ZAPI_INSTANCE_ID  — ID da instância Z-API
//   ZAPI_TOKEN        — Token da instância Z-API
//   ZAPI_CLIENT_TOKEN — Client-Token de segurança Z-API
//   ADMIN_WHATSAPP    — Número do admin, ex: 5511999999999

async function sendWhatsApp(phone, message) {
  const instanceId   = process.env.ZAPI_INSTANCE_ID;
  const token        = process.env.ZAPI_TOKEN;
  const clientToken  = process.env.ZAPI_CLIENT_TOKEN;

  if (!instanceId || !token) {
    console.log('[WhatsApp] Z-API não configurado. Mensagem que seria enviada:');
    console.log(`Para: ${phone}\n${message}`);
    return;
  }

  try {
    await axios.post(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      { phone, message },
      { headers: { 'Client-Token': clientToken || '' } }
    );
    console.log(`[WhatsApp] Mensagem enviada para ${phone}`);
  } catch (err) {
    console.error('[WhatsApp] Erro ao enviar:', err.response?.data || err.message);
  }
}

async function notifyAdminIptvOrder({ userName, userEmail, planName, amount, paymentId }) {
  const adminPhone = process.env.ADMIN_WHATSAPP;
  if (!adminPhone) {
    console.log('[WhatsApp] ADMIN_WHATSAPP não configurado.');
    return;
  }

  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const price = Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const message =
    `🆕 *NOVO PEDIDO IPTV*\n\n` +
    `👤 Nome: ${userName}\n` +
    `📧 Email: ${userEmail}\n` +
    `📦 Plano: ${planName}\n` +
    `💰 Valor: ${price}\n` +
    `📅 Data: ${date}\n` +
    `🔖 Pagamento ID: ${paymentId}\n\n` +
    `➡️ Acesse o painel admin, crie o acesso no MEGGAULTRA e vincule ao usuário.`;

  await sendWhatsApp(adminPhone, message);
}

module.exports = { sendWhatsApp, notifyAdminIptvOrder };
