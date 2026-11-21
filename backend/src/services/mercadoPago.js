const axios = require('axios');
const crypto = require('crypto');

const API = 'https://api.mercadopago.com';

function client() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN não configurado no servidor');
  return axios.create({
    baseURL: API,
    timeout: 20000,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

async function createPreference(body) {
  const { data } = await client().post('/checkout/preferences', body);
  return data;
}

async function getPayment(id) {
  const { data } = await client().get(`/v1/payments/${encodeURIComponent(id)}`);
  return data;
}

async function findPayment(externalReference) {
  const { data } = await client().get('/v1/payments/search', {
    params: { external_reference: externalReference, sort: 'date_created', criteria: 'desc' },
  });
  return data?.results?.[0] || null;
}

function normalizeStatus(status) {
  return ({
    approved: 'RECEIVED',
    pending: 'PENDING',
    in_process: 'PENDING',
    authorized: 'PENDING',
    in_mediation: 'PENDING',
    rejected: 'CANCELLED',
    cancelled: 'CANCELLED',
    refunded: 'REFUNDED',
    charged_back: 'CHARGEBACK',
  })[String(status || '').toLowerCase()] || String(status || 'PENDING').toUpperCase();
}

function errorMessage(e) {
  return e.response?.data?.message || e.response?.data?.cause?.[0]?.description || e.message;
}

// Validação recomendada pelo Mercado Pago. Enquanto o segredo não estiver
// configurado, a notificação ainda é conferida consultando a API autenticada.
function validWebhookSignature(req, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const signature = String(req.headers['x-signature'] || '');
  const requestId = String(req.headers['x-request-id'] || '');
  const parts = Object.fromEntries(signature.split(',').map(p => p.trim().split('=')));
  if (!parts.ts || !parts.v1 || !requestId || !dataId) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(parts.v1), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { createPreference, getPayment, findPayment, normalizeStatus, errorMessage, validWebhookSignature };
