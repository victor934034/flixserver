'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import s from './page.module.css';

const PAID = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
const brl = v => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const KIND = { plan: 'Plano', iptv: 'IPTV', donate: 'Apoio' };
const METHOD = { PIX: 'PIX', CREDIT_CARD: 'Cartão', BOLETO: 'Boleto' };
const fmtDate = d => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');

function group(status) {
  if (PAID.includes(status)) return 'paid';
  if (status === 'PENDING') return 'pend';
  if (status === 'OVERDUE') return 'over';
  if (String(status).includes('REFUND') || String(status).includes('CHARGEBACK')) return 'ref';
  return 'pend';
}
const GROUP_LABEL = { paid: 'Pago', pend: 'Pendente', over: 'Vencido', ref: 'Estornado' };

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
        {msg && <span className={s.msg}>{msg}</span>}
        <button className={s.btnGhost} onClick={resyncAll} disabled={syncing}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
          {syncing ? 'Sincronizando…' : 'Ressincronizar com Asaas'}
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
      </div>

      {tab === 'pay' && (
        <>
          <div className={s.filters}>
            <input className={s.search} type="search" placeholder="Buscar por e-mail" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar por e-mail" />
            <select className={s.select} value={fStatus} onChange={e => setFStatus(e.target.value)} aria-label="Status">
              <option value="">Status: todos</option><option value="pend">Pendente</option><option value="paid">Pago</option><option value="over">Vencido</option><option value="ref">Estornado</option>
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
      {tab === 'plans' && <PlansEditor />}
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
    ...(g === 'over' ? [{ t: 'Cobrança vencida', d: p.updated_at, c: '#F87171' }] : []),
  ];
  return (
    <div className={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h2 style={{ wordBreak: 'break-all' }}>{p.users?.email || p.users?.name}</h2>
        <span className={`${s.badge} ${s['b_' + g]}`}>{GROUP_LABEL[g]}</span>
      </div>
      <div className={s.sub}>{p.plan_name || KIND[p.kind]} · {METHOD[p.method] || p.method} · {brl(p.amount)} · {String(p.asaas_payment_id).slice(0, 12)}…</div>
      <ol className={s.timeline}>
        {items.map((t, i) => <li key={i}><span className={s.dot} style={{ background: t.c }} /><span><b>{t.t}</b><small>{fmtDate(t.d)}</small></span></li>)}
      </ol>
      {p.invoice_url && <a className={s.sub} href={p.invoice_url} target="_blank" rel="noreferrer" style={{ color: '#E50914' }}>Abrir fatura no Asaas</a>}
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
          <thead><tr><th>Nome</th><th>Preço</th><th>Promoção</th><th>Dias</th><th>Telas</th><th>Selo</th><th>Ativo</th></tr></thead>
          <tbody>
            {plans.map((p, i) => (
              <tr key={p.id}>
                <td><input type="text" value={p.name} onChange={e => set(i, 'name', e.target.value)} /></td>
                <td><input type="number" step="0.01" value={p.price} onChange={e => set(i, 'price', Number(e.target.value))} /></td>
                <td><input type="number" step="0.01" value={p.promo_price ?? ''} onChange={e => set(i, 'promo_price', e.target.value === '' ? null : Number(e.target.value))} /></td>
                <td><input type="number" value={p.duration_days} onChange={e => set(i, 'duration_days', Number(e.target.value))} /></td>
                <td><input type="number" value={p.max_streams ?? ''} onChange={e => set(i, 'max_streams', Number(e.target.value))} /></td>
                <td><input type="text" value={p.badge || ''} onChange={e => set(i, 'badge', e.target.value || null)} /></td>
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
