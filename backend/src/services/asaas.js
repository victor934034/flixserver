// Cliente mínimo da API Asaas v3.
// ASAAS_ENV=production usa api.asaas.com; qualquer outro valor usa o sandbox.
const axios = require('axios');

const isProd = () => process.env.ASAAS_ENV === 'production';
const BASE = () => (isProd() ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3');

function client() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error('ASAAS_API_KEY não configurada no servidor');
  return axios.create({
    baseURL: BASE(),
    timeout: 20000,
    headers: { access_token: key, 'Content-Type': 'application/json', 'User-Agent': 'FlixHome' },
  });
}

// Converte erro do Asaas em mensagem legível pro usuário.
function asaasError(e) {
  const list = e.response?.data?.errors;
  if (Array.isArray(list) && list.length) return list.map(x => x.description).join(' ');
  return e.message;
}

const onlyDigits = v => String(v || '').replace(/\D/g, '');

async function createCustomer({ name, email, cpfCnpj, phone }) {
  const { data } = await client().post('/customers', {
    name,
    email,
    cpfCnpj: onlyDigits(cpfCnpj),
    // só envia se parecer celular BR válido (DDD + 9 dígitos); senão o Asaas recusa o cadastro
    mobilePhone: /^\d{2}9\d{8}$/.test(onlyDigits(phone)) ? onlyDigits(phone) : undefined,
    notificationDisabled: true, // o app já mostra tudo; evita e-mail duplicado do Asaas
  });
  return data;
}

async function createPayment(body) {
  const { data } = await client().post('/payments', body);
  return data;
}

async function getPayment(id) {
  const { data } = await client().get(`/payments/${id}`);
  return data;
}

async function getPixQrCode(id) {
  const { data } = await client().get(`/payments/${id}/pixQrCode`);
  return data; // { encodedImage (base64), payload, expirationDate }
}

async function getBoletoLine(id) {
  const { data } = await client().get(`/payments/${id}/identificationField`);
  return data; // { identificationField, nossoNumero, barCode }
}

const PAID = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);
const isPaid = status => PAID.has(status);

module.exports = {
  createCustomer, createPayment, getPayment, getPixQrCode, getBoletoLine,
  asaasError, isPaid, onlyDigits, isProd,
};
