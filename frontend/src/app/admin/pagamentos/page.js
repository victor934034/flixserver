'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import s from './page.module.css';
import t from '../configuracoes/bt.module.css';

const PAID = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
const brl = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const KIND = { plan: 'Plano', iptv: 'IPTV', donate: 'Apoio' };
const METHOD = { PIX: 'PIX', CREDIT_CARD: 'Cartão', BOLETO: 'Boleto', CHECKOUT_PRO: 'Mercado Pago', ACCOUNT_MONEY: 'Saldo MP', BANK_TRANSFER: 'PIX', TICKET: 'Boleto' };
const fmtDate = d => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');

function group(status) {
  if (PAID.includes(status)) return 'paid';
  if (status === 'PENDING') return 'pend';
  if (status === 'OVERDUE') return 'over';
  if (String(status).includes('REFUND') || String(status).includes('CHARGEBACK')) return 'ref';
  if (/CANCEL|REJECT|FAIL|REFUS/i.test(String(status))) return 'fail';
  return 'pend';
}
const GROUP_LABEL = { paid: 'Pago', pend: 'Pendente', over: 'Vencido', ref: 'Estornado', fail: 'Cancelado' };

export default function PagamentosPage() {
  const [tab, setTab] = useState('pay');
  const [sum, setSum] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fKind, setFKind] = useState('');
  const [fDays, setFDays] = useState('30');
  const [sel, setSel] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/payments/admin/summary').then(r => setSum(r.data)).catch(() => {}),
      api.get('/payments/admin/list', { params: { limit: 300 } }).then(r => setPayments(r.data.payments || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function resyncAll() {
    setSyncing(true); setMsg('');
    try {
      const { data } = await api.post('/payments/admin/resync-pending');
      setMsg(`${data.checked} conferidos, ${data.changed} atualizados`);
      load();
    } catch (e) { setMsg(e.response?.data?.error || 'Erro ao sincronizar'); }
    setSyncing(false);
  }

  const rows = useMemo(() => {
    const since = fDays ? Date.now() - Number(fDays) * 86400000 : 0;
    return payments.filter(p =>
      (!q || (p.users?.email || '').toLowerCase().includes(q.toLowerCase()) || (p.users?.name || '').toLowerCase().includes(q.toLowerCase())) &&
      (!fStatus || group(p.status) === fStatus) &&
      (!fKind || p.kind === fKind) &&
      new Date(p.created_at).getTime() >= since);
  }, [payments, q, fStatus, fKind, fDays]);

  const selected = payments.find(p => p.id === sel) || rows[0];

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.h1}>Assinaturas e pagamentos</h1>
        <PaymentProviderSwitch onChanged={load} />
        {msg && <span className={s.msg}>{msg}</span>}
        <button className={s.btnGhost} onClick={resyncAll} disabled={syncing}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
          {syncing ? 'Sincronizando…' : 'Ressincronizar pagamentos'}
        </button>
      </div>

      <div className={s.kpis}>
        <div className={s.kpi}><span>Receita do mês</span><b>{sum ? brl(sum.revenue_month) : '—'}</b></div>
        <div className={s.kpi}><span>Pagantes ativos</span><b style={{ color: '#4ADE80' }}>{sum?.active_paying ?? '—'}</b></div>
        <div className={s.kpi}><span>Em teste grátis</span><b>{sum?.in_trial ?? '—'}</b></div>
        <div className={s.kpi}><span>Pendentes</span><b style={{ color: '#FBBF24' }}>{sum?.pending ?? '—'}</b></div>
        <div className={s.kpi}><span>Vencendo em 7 dias</span><b style={{ color: '#F87171' }}>{sum?.expiring_7d ?? '—'}</b></div>
      </div>

      <div className={s.tabs} role="tablist">
        <button role="tab" aria-selected={tab === 'pay'} className={`${s.tab} ${tab === 'pay' ? s.tabOn : ''}`} onClick={() => setTab('pay')}>Pagamentos</button>
        <button role="tab" aria-selected={tab === 'iptv'} className={`${s.tab} ${tab === 'iptv' ? s.tabOn : ''}`} onClick={() => setTab('iptv')}>IPTV {sum?.iptv_pending > 0 && <span className={s.count}>{sum.iptv_pending}</span>}</button>
        <button role="tab" aria-selected={tab === 'plans'} className={`${s.tab} ${tab === 'plans' ? s.tabOn : ''}`} onClick={() => setTab('plans')}>Planos</button>
        <button role="tab" aria-selected={tab === 'trial'} className={`${s.tab} ${tab === 'trial' ? s.tabOn : ''}`} onClick={() => setTab('trial')}>Teste grátis</button>
      </div>

      {tab === 'pay' && (
        <>
          <div className={s.filters}>
            <input className={s.search} type="search" placeholder="Buscar por e-mail" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar por e-mail" />
            <select className={s.select} value={fStatus} onChange={e => setFStatus(e.target.value)} aria-label="Status">
              <option value="">Status: todos</option><option value="pend">Pendente</option><option value="paid">Pago</option><option value="over">Vencido</option><option value="ref">Estornado</option><option value="fail">Cancelado</option>
            </select>
            <select className={s.select} value={fKind} onChange={e => setFKind(e.target.value)} aria-label="Tipo">
              <option value="">Tipo: todos</option><option value="plan">Plano</option><option value="iptv">IPTV</option><option value="donate">Apoio</option>
            </select>
            <select className={s.select} value={fDays} onChange={e => setFDays(e.target.value)} aria-label="Período">
              <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="">Todo o período</option>
            </select>
          </div>

          <div className={s.cols}>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>Usuário</th><th>Plano</th><th>Valor</th><th>Forma</th><th>Status</th><th>Data</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} className={s.empty}>Carregando…</td></tr>
                    : rows.length === 0 ? <tr><td colSpan={6} className={s.empty}>Nenhum pagamento encontrado.</td></tr>
                    : rows.map(p => {
                      const g = group(p.status);
                      return (
                        <tr key={p.id} className={`${s.row} ${selected?.id === p.id ? s.sel : ''}`} onClick={() => setSel(p.id)}>
                          <td className={s.strong}>{p.users?.email || p.users?.name || '—'}</td>
                          <td>{p.kind === 'donate' ? 'Apoio' : p.plan_name || KIND[p.kind]}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(p.amount)}</td>
                          <td>{METHOD[p.method] || p.method}</td>
                          <td><span className={`${s.badge} ${s['b_' + g]}`}>{GROUP_LABEL[g]}</span></td>
                          <td style={{ color: '#A3A3A3' }}>{fmtDate(p.created_at)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <aside className={s.aside}>
              {selected ? <Detail p={selected} /> : null}
              <IptvPending onDone={load} limit={1} />
            </aside>
          </div>
        </>
      )}

      {tab === 'iptv' && <IptvPending onDone={load} full />}
      {tab === 'plans' && <><SubscriptionSwitch /><PlansEditor /></>}
      {tab === 'trial' && <TrialCard />}
    </div>
  );
}

function Detail({ p }) {
  const g = group(p.status);
  const paid = g === 'paid';
  const items = [
    { t: 'Cobrança criada', d: p.created_at, c: '#888' },
    ...(p.method === 'PIX' ? [{ t: 'QR PIX gerado', d: p.created_at, c: '#888' }] : []),
    ...(paid ? [{ t: 'Pagamento confirmado (webhook)', d: p.updated_at, c: '#22C55E' }] : []),
    ...(p.fulfilled_at && p.kind === 'plan' && p.users?.plan_expires_at ? [{ t: `Plano ativado até ${new Date(p.users.plan_expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`, d: p.fulfilled_at, c: '#22C55E' }] : []),
    ...(g === 'ref' ? [{ t: 'Estornado — acesso revogado', d: p.updated_at, c: '#CBD5E1' }] : []),
    ...(g === 'fail' ? [{ t: 'Pagamento não concluído', d: p.updated_at, c: '#F87171' }] : []),
    ...(g === 'over' ? [{ t: 'Cobrança vencida', d: p.updated_at, c: '#F87171' }] : []),
  ];
  return (
    <div className={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h2 style={{ wordBreak: 'break-all' }}>{p.users?.email || p.users?.name}</h2>
        <span className={`${s.badge} ${s['b_' + g]}`}>{GROUP_LABEL[g]}</span>
      </div>
      <div className={s.sub}>{p.plan_name || KIND[p.kind]} · {METHOD[p.method] || p.method} · {brl(p.amount)} · {p.provider === 'mercado_pago' ? 'Mercado Pago' : 'Asaas'} · {String(p.provider_payment_id || p.asaas_payment_id || p.id).slice(0, 12)}…</div>
      <ol className={s.timeline}>
        {items.map((t, i) => <li key={i}><span className={s.dot} style={{ background: t.c }} /><span><b>{t.t}</b><small>{fmtDate(t.d)}</small></span></li>)}
      </ol>
      {p.invoice_url && <a className={s.sub} href={p.invoice_url} target="_blank" rel="noreferrer" style={{ color: '#E50914' }}>Abrir cobrança</a>}
    </div>
  );
}

function PaymentProviderSwitch({ onChanged }) {
  const [provider, setProvider] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/payments/admin/provider').then(r => setProvider(r.data.provider)).catch(() => setMsg('Erro ao carregar gateway')); }, []);

  async function toggle() {
    const next = provider === 'mercado_pago' ? 'asaas' : 'mercado_pago';
    setBusy(true); setMsg('');
    try {
      await api.put('/payments/admin/provider', { provider: next });
      setProvider(next);
      setMsg('Alterado com sucesso');
      onChanged?.();
    } catch (e) { setMsg(e.response?.data?.error || 'Erro ao alterar gateway'); }
    finally { setBusy(false); setTimeout(() => setMsg(''), 3000); }
  }

  if (!provider) return msg ? <span className={s.msg}>{msg}</span> : null;
  const mp = provider === 'mercado_pago';
  return (
    <div className={s.gatewayBox}>
      <span><small>Gateway ativo</small><b>{mp ? 'Mercado Pago' : 'Asaas'}</b></span>
      <button type="button" onClick={toggle} disabled={busy} aria-label={`Trocar para ${mp ? 'Asaas' : 'Mercado Pago'}`}>
        {busy ? 'Alterando…' : `Usar ${mp ? 'Asaas' : 'Mercado Pago'}`}
      </button>
      {msg && <em>{msg}</em>}
    </div>
  );
}

function IptvPending({ onDone, limit, full }) {
  const [orders, setOrders] = useState([]);
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(() => api.get('/admin/iptv/orders').then(r => setOrders(r.data || [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const pending = orders.filter(o => o.status === 'pending');
  const list = limit ? pending.slice(0, limit) : pending;

  async function activate(o) {
    const f = forms[o.id] || {};
    setBusy(o.id); setErr('');
    try {
      await api.post(`/admin/iptv/orders/${o.id}/activate-with-credentials`, { xc_username: f.u, xc_password: f.p });
      await load(); onDone?.();
    } catch (e) { setErr(e.response?.data?.error || 'Erro ao ativar'); }
    setBusy('');
  }
  const ago = d => { const m = Math.max(1, Math.round((Date.now() - new Date(d)) / 60000)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

  if (!list.length) return full ? <div className={s.card}><div className={s.empty}>Nenhum pedido IPTV aguardando ativação.</div></div> : null;
  return (
    <div className={s.cols} style={full ? { flexDirection: 'column' } : { flexDirection: 'column', gap: 16 }}>
      {list.map(o => (
        <div key={o.id} className={s.card} style={full ? { maxWidth: 520 } : undefined}>
          <h2>IPTV · aguardando ativação</h2>
          <div className={s.sub}>{o.user_email} · {o.plan_name} · pago há {ago(o.created_at)}</div>
          <label className={s.field}>Usuário do servidor<input type="text" placeholder="usuario" value={forms[o.id]?.u || ''} onChange={e => setForms({ ...forms, [o.id]: { ...forms[o.id], u: e.target.value } })} /></label>
          <label className={s.field}>Senha do servidor<input type="password" placeholder="••••••" value={forms[o.id]?.p || ''} onChange={e => setForms({ ...forms, [o.id]: { ...forms[o.id], p: e.target.value } })} /></label>
          {err && <span style={{ color: '#F87171', fontSize: 13 }}>{err}</span>}
          <button className={s.btnOk} disabled={busy === o.id || !forms[o.id]?.u || !forms[o.id]?.p} onClick={() => activate(o)}>{busy === o.id ? 'Ativando…' : 'Ativar'}</button>
        </div>
      ))}
    </div>
  );
}

function PlansEditor() {
  const [plans, setPlans] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/payments/plans/all').then(r => setPlans(r.data || [])).catch(() => setPlans([])); }, []);
  const set = (i, k, v) => setPlans(pl => pl.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));
  async function save() {
    setMsg('');
    try { await api.put('/payments/plans', { plans }); setMsg('Planos salvos!'); } catch (e) { setMsg('Erro: ' + (e.response?.data?.error || e.message)); }
  }
  if (!plans) return <div className={s.empty}>Carregando…</div>;
  return (
    <div className={s.card}>
      <div className={s.tableWrap} style={{ flex: 'none' }}>
        <table className={`${s.table} ${s.plans}`}>
          <thead><tr><th>Nome</th><th>Preço</th><th>Promoção</th><th>Dias</th><th>Telas</th><th>Selo</th><th>Descrição</th><th>Destaque</th><th>Ativo</th></tr></thead>
          <tbody>
            {plans.map((p, i) => (
              <tr key={p.id}>
                <td><input type="text" value={p.name} onChange={e => set(i, 'name', e.target.value)} /></td>
                <td><input type="number" step="0.01" value={p.price} onChange={e => set(i, 'price', Number(e.target.value))} /></td>
                <td><input type="number" step="0.01" value={p.promo_price ?? ''} onChange={e => set(i, 'promo_price', e.target.value === '' ? null : Number(e.target.value))} /></td>
                <td><input type="number" value={p.duration_days} onChange={e => set(i, 'duration_days', Number(e.target.value))} /></td>
                <td><input type="number" value={p.max_streams ?? ''} onChange={e => set(i, 'max_streams', Number(e.target.value))} /></td>
                <td><input type="text" value={p.badge || ''} onChange={e => set(i, 'badge', e.target.value || null)} /></td>
                <td><input type="text" value={p.description || ''} onChange={e => set(i, 'description', e.target.value)} /></td>
                <td><input type="checkbox" checked={!!p.highlight} onChange={e => set(i, 'highlight', e.target.checked)} style={{ width: 18, height: 18, accentColor: '#E50914' }} /></td>
                <td><input type="checkbox" checked={!!p.active} onChange={e => set(i, 'active', e.target.checked)} style={{ width: 18, height: 18, accentColor: '#E50914' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><button className={s.btnRed} onClick={save}>Salvar planos</button>{msg && <span className={s.msg}>{msg}</span>}</div>
    </div>
  );
}

// ── Sistema de assinatura on/off (antes ficava em Configurações) ──
function SubscriptionSwitch() {
  const [on, setOn] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get('/settings').then(r => setOn(r.data.subscription_enabled === 'true')).catch(() => setOn(false)); }, []);
  async function toggle(v) {
    setOn(v);
    try { await api.put('/settings/subscription_enabled', { value: String(v) }); setMsg('Salvo'); } catch { setMsg('Erro ao salvar'); setOn(!v); }
    setTimeout(() => setMsg(''), 1800);
  }
  if (on === null) return null;
  return (
    <div className={s.card}>
      <div className={t.row} style={{ borderTop: 0, padding: 0 }}>
        <div>
          <b>Sistema de assinatura: <span style={{ color: on ? '#4ADE80' : '#F87171' }}>{on ? 'ATIVADO' : 'DESATIVADO'}</span></b>
          <small>{on ? 'Usuários sem plano ativo vão para a tela de planos.' : 'Todos têm acesso livre, independente de assinatura.'}</small>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {msg && <span className={t.ok}>{msg}</span>}
          <button type="button" role="switch" aria-checked={on} aria-label="Sistema de assinatura" className={`${t.sw} ${on ? t.swOn : ''}`} onClick={() => toggle(!on)}><i /></button>
        </span>
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`${s.sw} ${on ? s.swOn : ''}`} onClick={() => onChange(!on)}><i /></button>
  );
}

function TrialCard() {
  const [cfg, setCfg] = useState(null);
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/settings').then(r => setCfg(r.data)).catch(() => setCfg({}));
    api.get('/payments/admin/trial-stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const save = useCallback(async (key, value) => {
    setCfg(c => ({ ...c, [key]: String(value) }));
    try { await api.put(`/settings/${key}`, { value: String(value) }); setMsg('Salvo'); } catch { setMsg('Erro ao salvar'); }
    setTimeout(() => setMsg(''), 1800);
  }, []);

  if (!cfg) return null;
  const on = k => cfg[k] === 'true';
  return (
    <section className={s.card}>
      <div className={s.cardHead}><h2>Teste grátis</h2>{msg && <span className={s.ok}>{msg}</span>}</div>
      <div className={s.row}><div><b>Teste grátis ativo</b><small>Novos usuários podem iniciar o teste</small></div><Toggle on={on('trial_enabled')} onChange={v => save('trial_enabled', v)} label="Teste grátis ativo" /></div>
      <div className={s.row}><div><b>Duração</b><small>Dias de acesso no teste</small></div>
        <span className={s.stepper}>
          <button aria-label="Menos" onClick={() => save('trial_days', Math.max(1, (parseInt(cfg.trial_days) || 7) - 1))}>−</button>
          <b>{parseInt(cfg.trial_days) || 7} dias</b>
          <button aria-label="Mais" onClick={() => save('trial_days', Math.min(60, (parseInt(cfg.trial_days) || 7) + 1))}>+</button>
        </span></div>
      <div className={s.row}><div><b>Ativar automaticamente no cadastro</b><small>Sem precisar tocar no botão</small></div><Toggle on={on('trial_auto_signup')} onChange={v => save('trial_auto_signup', v)} label="Ativar no cadastro" /></div>
      <div className={s.row}><div><b>Bloquear VPN e proxy</b><small>Impede teste por VPN, Tor e datacenter</small></div><Toggle on={cfg.trial_block_vpn !== 'false'} onChange={v => save('trial_block_vpn', v)} label="Bloquear VPN" /></div>
      <div className={s.row}><div><b>Máximo por IP (web/PC)</b><small>No celular é um por aparelho</small></div>
        <span className={s.stepper}>
          <button aria-label="Menos" onClick={() => save('trial_max_per_ip', Math.max(1, (parseInt(cfg.trial_max_per_ip) || 1) - 1))}>−</button>
          <b>{parseInt(cfg.trial_max_per_ip) || 1}</b>
          <button aria-label="Mais" onClick={() => save('trial_max_per_ip', Math.min(20, (parseInt(cfg.trial_max_per_ip) || 1) + 1))}>+</button>
        </span></div>
      <div className={s.stats}>
        <div><span>Testes ativos</span><b>{stats?.active ?? '—'}</b></div>
        <div><span>Convertidos</span><b style={{ color: '#4ADE80' }}>{stats?.converted ?? '—'}</b></div>
        <div><span>Taxa de conversão</span><b>{stats ? `${stats.rate}%` : '—'}</b></div>
      </div>
    </section>
  );
}

