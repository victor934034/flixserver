// Integração com o painel IPTV (Sigma Reseller API) — https://painel.onexx.sbs
// Variáveis de ambiente:
//   SIGMA_API_TOKEN  token da API de revenda (criado na página "Reseller API" do painel)
//   SIGMA_API_URL    opcional; padrão https://painel.onexx.sbs/api/reseller-api/v1
//   SIGMA_AUTO       "true" liga a criação/renovação automática ao receber o pagamento.
//                    Enquanto não for "true", todo pedido IPTV fica pendente para ativação manual.
const axios = require('axios');

const base = () => String(process.env.SIGMA_API_URL || 'https://painel.onexx.sbs/api/reseller-api/v1').replace(/\/$/, '');
const configured = () => !!process.env.SIGMA_API_TOKEN;
const autoEnabled = () => configured() && String(process.env.SIGMA_AUTO || '').toLowerCase() === 'true';

async function call(method, path, { params, data } = {}) {
  if (!configured()) { const e = new Error('SIGMA_API_TOKEN não configurado'); e.status = 503; throw e; }
  try {
    const r = await axios({
      method, url: base() + path, params, data, timeout: 20000,
      headers: { Authorization: `Bearer ${process.env.SIGMA_API_TOKEN}`, Accept: 'application/json' },
    });
    return r.data;
  } catch (err) {
    const d = err.response?.data;
    const msg = d?.message || (d?.errors ? Object.values(d.errors).flat().join(' ') : null) || err.message;
    const e = new Error(`Painel IPTV: ${msg}`);
    e.status = err.response?.status || 502;
    e.code = d?.error;
    throw e;
  }
}

const me = () => call('get', '/me').then(r => r.data);
const listPackages = async () => {
  const out = []; let page = 1;
  for (;;) {
    const r = await call('get', '/packages', { params: { page, per_page: 100 } });
    out.push(...(r.data || []));
    if (!r.meta || page >= r.meta.last_page) break;
    page++;
  }
  return out;
};
const listServers = () => call('get', '/servers', { params: { per_page: 100 } }).then(r => r.data || []);
const findCustomer = (username) => call('get', `/customers/by-username/${encodeURIComponent(username)}`).then(r => r.data).catch(e => (e.status === 404 ? null : Promise.reject(e)));
const createCustomer = (body) => call('post', '/customers', { data: body }).then(r => r.data);
const renewCustomer = (id, body) => call('post', `/customers/${id}/renew`, { data: body || {} }).then(r => r.data);

module.exports = { configured, autoEnabled, me, listPackages, listServers, findCustomer, createCustomer, renewCustomer };
