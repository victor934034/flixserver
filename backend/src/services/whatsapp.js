const axios = require('axios');

// Notificações via Telegram Bot (gratuito, sem limite)
// Variáveis de ambiente necessárias no EasePanel:
//   TELEGRAM_BOT_TOKEN — token do bot (@BotFather)
//   TELEGRAM_CHAT_ID   — seu chat ID pessoal com o bot

async function sendTelegram(message) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('[Telegram] Não configurado. Mensagem que seria enviada:');
    console.log(message);
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id:    chatId,
      text:       message,
      parse_mode: 'Markdown',
    });
    console.log('[Telegram] Notificação enviada ao admin.');
  } catch (err) {
    console.error('[Telegram] Erro ao enviar:', err.response?.data || err.message);
  }
}

async function notifyAdminIptvOrder({ userName, userEmail, planName, amount, paymentId }) {
  const price = Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const date  = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const message =
    `🆕 *NOVO PEDIDO IPTV*\n\n` +
    `👤 Nome: ${userName}\n` +
    `📧 Email: ${userEmail}\n` +
    `📦 Plano: ${planName}\n` +
    `💰 Valor: ${price}\n` +
    `📅 Data: ${date}\n` +
    `🔖 ID: ${paymentId}\n\n` +
    `➡️ Crie o acesso no MEGGAULTRA e vincule em /admin/iptv`;

  await sendTelegram(message);
}

module.exports = { sendTelegram, notifyAdminIptvOrder };
