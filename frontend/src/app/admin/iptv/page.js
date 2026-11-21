'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';

const TABS = ['Pedidos', 'Credenciais', 'Planos'];

export default function AdminIptv() {
  const [tab, setTab] = useState('Pedidos');

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <h1 style={s.h1}>Gerenciar IPTV</h1>

      <div style={s.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }}
            onClick={() => setTab(t)}
          >{t}</button>
        ))}
      </div>

      {tab === 'Planos'      && <PlansTab />}
      {tab === 'Pedidos'     && <OrdersTab />}
      {tab === 'Credenciais' && <CredsTab />}
    </div>
  );
}

/* ───────────────────────────── PLANOS ───────────────────────────── */
function PlansTab() {
  const [plans,  setPlans]  = useState([]);
  const [loading, setLoading] = useState(true);
  const EMPTY = { name: '', description: '', price: '', duration_months: 1, order_index: 0, is_adult: false, max_streams: 1, sigma_package_id: '', sigma_server_id: '' };
  const [form,   setForm]   = useState(EMPTY);
  const [sigma, setSigma] = useState(null);
  const [pk, setPk] = useState({ packages: [], servers: [] });
  const [editing, setEditing] = useState(null);
  const [saving,  setSaving]  = useState('');
  const [msg,     setMsg]     = useState('');

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/admin/iptv/plans'); setPlans(data || []); } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get('/admin/sigma/status').then(r => {
      setSigma(r.data);
      if (r.data.ok) api.get('/admin/sigma/packages').then(x => setPk(x.data)).catch(() => {});
    }).catch(() => {});
  }, []);

  function openEdit(p) {
    setEditing(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setForm({ name: p.name, description: p.description || '', price: p.price, duration_months: p.duration_months, order_index: p.order_index || 0, is_adult: !!p.is_adult, max_streams: p.max_streams || 1, sigma_package_id: p.sigma_package_id || '', sigma_server_id: p.sigma_server_id || '' });
    setMsg('');
  }
  function resetForm() { setEditing(null); setForm(EMPTY); setMsg(''); }

  async function save() {
    if (!form.name || !form.price) return setMsg('Nome e preço são obrigatórios.');
    setSaving('save');
    try {
      if (editing) {
        await api.put(`/admin/iptv/plans/${editing}`, form);
      } else {
        await api.post('/admin/iptv/plans', form);
      }
      setMsg(editing ? 'Plano atualizado!' : 'Plano criado!');
      resetForm();
      load();
    } catch (e) { setMsg('Erro: ' + (e.response?.data?.error || e.message)); }
    setSaving('');
  }

  async function toggleActive(p) {
    await api.put(`/admin/iptv/plans/${p.id}`, { is_active: !p.is_active });
    setPlans(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x));
  }

  async function del(id) {
    if (!confirm('Excluir este plano?')) return;
    await api.delete(`/admin/iptv/plans/${id}`);
    setPlans(prev => prev.filter(x => x.id !== id));
  }

  return (
    <div>
      <div style={{ ...s.card, borderLeft: '3px solid ' + (sigma?.ok ? '#4caf50' : '#555') }}>
        <h2 style={s.h2}>Painel IPTV (ONE X)</h2>
        {!sigma ? <p style={{ color: '#666', fontSize: 13 }}>Verificando…</p>
          : !sigma.configured ? <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>API <b>não conectada</b>. Quando o token estiver liberado, defina <code>SIGMA_API_TOKEN</code> no servidor — enquanto isso os pedidos chegam aqui e você cria o usuário no painel manualmente.</p>
          : sigma.ok ? <p style={{ color: '#4caf50', fontSize: 13, margin: 0 }}>Conectado como <b>{sigma.username}</b> · créditos: <b>{sigma.credits}</b> · ativação automática: <b>{sigma.auto ? 'LIGADA' : 'desligada (SIGMA_AUTO)'}</b></p>
          : <p style={{ color: '#f44336', fontSize: 13, margin: 0 }}>Falha ao conectar: {sigma.message}</p>}
      </div>

      <div style={s.card}>
        <h2 style={s.h2}>{editing ? 'Editar plano' : 'Novo plano IPTV'}</h2>
        <div style={s.row}>
          <div style={{ flex: 2 }}>
            <label style={s.label}>Nome *</label>
            <input style={s.input} placeholder="Ex: 1 Mês s/ Adulto" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Preço (R$) *</label>
            <input style={s.input} type="number" step="0.01" placeholder="29.90" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Duração (meses) *</label>
            <input style={s.input} type="number" min="1" value={form.duration_months} onChange={e => setForm(p => ({ ...p, duration_months: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Ordem</label>
            <input style={s.input} type="number" min="0" value={form.order_index} onChange={e => setForm(p => ({ ...p, order_index: e.target.value }))} />
          </div>
        </div>
        <div style={s.row}>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Telas (conexões)</label>
            <input style={s.input} type="number" min="1" value={form.max_streams} onChange={e => setForm(p => ({ ...p, max_streams: e.target.value }))} />
          </div>
          <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', marginTop: 30, fontSize: 14 }}>
            <input type="checkbox" checked={form.is_adult} onChange={e => setForm(p => ({ ...p, is_adult: e.target.checked }))} /> Inclui conteúdo adulto (18+)
          </label>
        </div>
        <label style={s.label}>Pacote no painel (para ativação automática)</label>
        {pk.packages.length > 0 ? (
          <select style={s.input} value={form.sigma_package_id ? form.sigma_package_id : ''} onChange={e => {
            const sel = pk.packages.find(x => String(x.id) === e.target.value);
            setForm(p => ({ ...p, sigma_package_id: e.target.value, sigma_server_id: sel ? sel.server_id : '', max_streams: sel ? sel.connections : p.max_streams }));
          }}>
            <option value="">— sem vínculo (ativação manual) —</option>
            {pk.packages.map(x => <option key={x.id} value={x.id}>{x.name} · {x.connections} conexão(ões) · {x.credits} crédito(s)</option>)}
          </select>
        ) : (
          <input style={s.input} placeholder="Disponível quando a API do painel estiver conectada" disabled value={form.sigma_package_id} />
        )}
        <label style={s.label}>Descrição</label>
        <input style={s.input} placeholder="Ex: Acesso completo, sem conteúdo adulto" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        {msg && <p style={{ color: msg.startsWith('Erro') ? '#f44336' : '#4caf50', marginTop: 8, fontSize: 13 }}>{msg}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button style={s.btnPrimary} onClick={save} disabled={saving === 'save'}>{saving === 'save' ? 'Salvando...' : editing ? 'Atualizar' : 'Criar plano'}</button>
          {editing && <button style={s.btnSecondary} onClick={resetForm}>Cancelar</button>}
        </div>
      </div>

      {loading ? <p style={{ color: '#555' }}>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plans.map(p => (
            <div key={p.id} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                  <span style={p.is_active ? s.badgeGreen : s.badgeRed}>{p.is_active ? 'ATIVO' : 'INATIVO'}</span>
                </div>
                <span style={{ color: '#c91c2c', fontWeight: 700, marginRight: 14 }}>R$ {Number(p.price).toFixed(2).replace('.', ',')}</span>
                <span style={{ color: '#555', fontSize: 13 }}>{p.duration_months} {p.duration_months === 1 ? 'mês' : 'meses'} · {p.max_streams || 1} tela(s){p.is_adult ? ' · 18+' : ''}</span>
                <span style={{ marginLeft: 10, fontSize: 11, color: p.sigma_package_id ? '#4caf50' : '#777' }}>{p.sigma_package_id ? '● ligado ao painel' : '○ ativação manual'}</span>
                {p.description && <span style={{ color: '#444', fontSize: 12, marginLeft: 10 }}>— {p.description}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...s.btnSmall, backgroundColor: '#1a1a2e', color: '#7986cb' }} onClick={() => openEdit(p)}>Editar</button>
                <button style={{ ...s.btnSmall, backgroundColor: p.is_active ? '#2a1515' : '#1b3a1b', color: p.is_active ? '#f44336' : '#4caf50' }} onClick={() => toggleActive(p)}>{p.is_active ? 'Desativar' : 'Ativar'}</button>
                <button style={{ ...s.btnSmall, backgroundColor: '#2a1515', color: '#f44336' }} onClick={() => del(p.id)}>Excluir</button>
              </div>
            </div>
          ))}
          {plans.length === 0 && <p style={{ color: '#555' }}>Nenhum plano cadastrado.</p>}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── PEDIDOS ───────────────────────────── */
function OrdersTab() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/admin/iptv/orders'); setOrders(data || []); } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const setF = (id, k, v) => setForms(f => ({ ...f, [id]: { ...f[id], [k]: v } }));

  async function activateWith(o) {
    const f = forms[o.id] || {};
    if (!f.u || !f.p) return setErr('Informe o usuário e a senha criados no painel.');
    setBusy(o.id); setErr('');
    try { await api.post(`/admin/iptv/orders/${o.id}/activate-with-credentials`, { xc_username: f.u, xc_password: f.p }); await load(); }
    catch (e) { setErr(e.response?.data?.error || 'Erro ao ativar'); }
    setBusy('');
  }
  async function viaApi(o) {
    setBusy(o.id + 'api'); setErr('');
    try { await api.post(`/admin/iptv/orders/${o.id}/provision`); await load(); }
    catch (e) { setErr(e.response?.data?.error || 'Erro ao criar no painel'); }
    setBusy('');
  }
  async function justMark(id) {
    if (!confirm('Marcar como ativado sem vincular usuário/senha?')) return;
    await api.patch(`/admin/iptv/orders/${id}/activate`);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'activated' } : o));
  }

  const pending   = orders.filter(o => o.status === 'pending');
  const activated = orders.filter(o => o.status === 'activated');

  return (
    <div>
      <h2 style={{ ...s.h2, marginBottom: 16 }}>Pedidos pendentes <span style={{ color: '#c91c2c' }}>({pending.length})</span></h2>
      {err && <p style={{ color: '#f44336', fontSize: 13 }}>{err}</p>}
      {loading && orders.length === 0 ? <p style={{ color: '#555' }}>Carregando...</p> : (
        <>
          {pending.length === 0 && <p style={{ color: '#555', marginBottom: 24 }}>Nenhum pedido pendente.</p>}
          {pending.map(o => (
            <div key={o.id} style={{ ...s.card, borderLeft: '3px solid #c91c2c' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ color: '#fff', fontWeight: 700 }}>{o.user_name}</span>
                <span style={{ color: '#888', fontSize: 13 }}>{o.user_email}</span>
                <span style={{ color: '#444', fontSize: 12, marginLeft: 'auto' }}>{new Date(o.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ color: '#c91c2c', fontWeight: 700, marginRight: 12 }}>{o.plan_name}</span>
                <span style={{ color: '#4caf50', fontWeight: 700 }}>R$ {Number(o.amount).toFixed(2).replace('.', ',')}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ ...s.label, marginTop: 0 }}>Usuário criado no painel</label>
                  <input style={s.input} value={forms[o.id]?.u || ''} onChange={e => setF(o.id, 'u', e.target.value)} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ ...s.label, marginTop: 0 }}>Senha</label>
                  <input style={s.input} value={forms[o.id]?.p || ''} onChange={e => setF(o.id, 'p', e.target.value)} />
                </div>
                <button style={{ ...s.btnSmall, backgroundColor: '#1b3a1b', color: '#4caf50', padding: '11px 18px' }} disabled={busy === o.id} onClick={() => activateWith(o)}>{busy === o.id ? 'Ativando…' : 'Ativar e vincular'}</button>
                <button style={{ ...s.btnSmall, backgroundColor: '#1a1a2e', color: '#7986cb', padding: '11px 18px' }} disabled={busy === o.id + 'api'} onClick={() => viaApi(o)} title="Cria o usuário no painel pela API (precisa do token e do plano ligado a um pacote)">{busy === o.id + 'api' ? 'Criando…' : 'Criar no painel (API)'}</button>
                <button style={{ ...s.btnSmall, backgroundColor: '#1a1a1a', color: '#888', padding: '11px 14px' }} onClick={() => justMark(o.id)}>Só marcar</button>
              </div>
            </div>
          ))}

          {activated.length > 0 && (
            <>
              <h3 style={{ color: '#555', fontSize: 14, margin: '24px 0 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ativados ({activated.length})</h3>
              {activated.slice(0, 40).map(o => (
                <div key={o.id} style={{ ...s.card, opacity: 0.6, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: '#fff', fontWeight: 600, marginRight: 10 }}>{o.user_name}</span>
                    <span style={{ color: '#555', fontSize: 13, marginRight: 10 }}>{o.user_email}</span>
                    <span style={{ color: '#888', fontSize: 13 }}>{o.plan_name}</span>
                  </div>
                  <span style={s.badgeGreen}>ATIVADO</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────────────────────── CREDENCIAIS ───────────────────────────── */
function CredsTab() {
  const [creds, setCreds]   = useState([]);
  const [pick, setPick]   = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState({ user_id: '', xc_username: '', xc_password: '', notes: '' });
  const [saving, setSaving] = useState('');
  const [msg, setMsg]       = useState('');
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const c = await api.get('/admin/iptv');
      setCreds(c.data || []);
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return undefined; }
    const t = setTimeout(() => api.get('/admin/users-search', { params: { q } }).then(r => setFound(r.data || [])).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  function openEdit(cred) {
    setPick(cred.user ? { id: cred.user_id, name: cred.user.name, email: cred.user.email } : { id: cred.user_id, name: '', email: '' });
    setEditing(cred.user_id);
    setForm({ user_id: cred.user_id, xc_username: cred.xc_username, xc_password: cred.xc_password, notes: cred.notes || '' });
    setMsg('');
  }
  function resetForm() { setEditing(null); setPick(null); setQ(''); setFound([]); setForm({ user_id: '', xc_username: '', xc_password: '', notes: '' }); setMsg(''); }

  async function save() {
    if (!form.user_id || !form.xc_username || !form.xc_password) return setMsg('Preencha todos os campos obrigatórios.');
    setSaving('save');
    try {
      await api.post('/admin/iptv', form);
      setMsg('Salvo!');
      resetForm();
      load();
    } catch (e) { setMsg('Erro: ' + (e.response?.data?.error || e.message)); }
    setSaving('');
  }

  async function toggle(userId) {
    const { data } = await api.patch(`/admin/iptv/${userId}/toggle`);
    setCreds(prev => prev.map(c => c.user_id === userId ? { ...c, active: data.active } : c));
  }

  async function remove(userId, name) {
    if (!confirm(`Remover IPTV de ${name}?`)) return;
    await api.delete(`/admin/iptv/${userId}`);
    setCreds(prev => prev.filter(c => c.user_id !== userId));
  }


  return (
    <div>
      <div style={s.card}>
        <h2 style={s.h2}>{editing ? 'Editar credenciais' : 'Vincular acesso IPTV ao usuário'}</h2>
        <label style={s.label}>Pessoa (busque por nome ou e-mail) *</label>
        {pick ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ flex: 1 }}><b style={{ color: '#fff' }}>{pick.name || 'Usuário'}</b> <span style={{ color: '#888', fontSize: 13 }}>{pick.email}</span></div>
            {!editing && <button style={s.btnSmall} onClick={() => { setPick(null); setForm(p => ({ ...p, user_id: '' })); }}>Trocar</button>}
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <input style={s.input} placeholder="Digite pelo menos 2 letras…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
            {found.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 10, left: 0, right: 0, top: '100%', marginTop: 4, background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,.6)' }}>
                {found.map(u => {
                  const has = creds.some(c => c.user_id === u.id);
                  return (
                    <button key={u.id} onClick={() => { setPick(u); setForm(p => ({ ...p, user_id: u.id })); setQ(''); setFound([]); }}
                      style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 12, textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 0, borderBottom: '1px solid #1f1f1f', color: '#ddd', cursor: 'pointer' }}>
                      <span><b>{u.name || 'Sem nome'}</b> <span style={{ color: '#777', fontSize: 13 }}>{u.email}</span></span>
                      {has && <span style={s.badgeGreen}>JÁ TEM IPTV</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div style={s.row}>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Usuário XC *</label>
            <input style={s.input} value={form.xc_username} onChange={e => setForm(p => ({ ...p, xc_username: e.target.value }))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Senha XC *</label>
            <input style={s.input} value={form.xc_password} onChange={e => setForm(p => ({ ...p, xc_password: e.target.value }))} />
          </div>
        </div>
        <label style={s.label}>Observações</label>
        <input style={s.input} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        {msg && <p style={{ color: msg.startsWith('Erro') ? '#f44336' : '#4caf50', marginTop: 8, fontSize: 13 }}>{msg}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button style={s.btnPrimary} onClick={save} disabled={saving === 'save'}>{saving === 'save' ? 'Salvando...' : editing ? 'Atualizar' : 'Vincular'}</button>
          {editing && <button style={s.btnSecondary} onClick={resetForm}>Cancelar</button>}
        </div>
      </div>

      {loading ? <p style={{ color: '#555' }}>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {creds.map(cred => {
            const u = cred.user || {};
            return (
              <div key={cred.id} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{u.name}</span>
                    <span style={{ color: '#555', fontSize: 13 }}>{u.email}</span>
                    <span style={cred.active ? s.badgeGreen : s.badgeRed}>{cred.active ? 'ATIVO' : 'INATIVO'}</span>
                  </div>
                  <span style={{ color: '#444', fontSize: 12 }}>👤 {cred.xc_username}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...s.btnSmall, backgroundColor: cred.active ? '#2a1515' : '#1b3a1b', color: cred.active ? '#f44336' : '#4caf50' }} onClick={() => toggle(cred.user_id)}>{cred.active ? 'Desativar' : 'Ativar'}</button>
                  <button style={{ ...s.btnSmall, backgroundColor: '#1a1a2e', color: '#7986cb' }} onClick={() => openEdit(cred)}>Editar</button>
                  <button style={{ ...s.btnSmall, backgroundColor: '#2a1515', color: '#f44336' }} onClick={() => remove(cred.user_id, u.name)}>Remover</button>
                </div>
              </div>
            );
          })}
          {creds.length === 0 && <p style={{ color: '#555' }}>Nenhuma credencial vinculada.</p>}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── ESTILOS ───────────────────────────── */
const s = {
  h1: { color: '#fff', fontSize: 24, fontWeight: 800, marginBottom: 20 },
  h2: { color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 14 },
  tabs: { display: 'flex', gap: 4, marginBottom: 24 },
  tabBtn: { padding: '9px 20px', borderRadius: 8, border: '1px solid #2a2a2a', backgroundColor: '#111', color: '#666', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  tabActive: { backgroundColor: '#c91c2c', borderColor: '#c91c2c', color: '#fff' },
  card: { backgroundColor: '#111', borderRadius: 10, padding: 20, border: '1px solid #1e1e1e', marginBottom: 12 },
  row: { display: 'flex', gap: 12 },
  label: { display: 'block', color: '#888', fontSize: 11, marginBottom: 5, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', fontSize: 14, boxSizing: 'border-box' },
  btnPrimary: { backgroundColor: '#c91c2c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  btnSecondary: { backgroundColor: '#1a1a1a', color: '#888', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  btnSmall: { border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  badgeGreen: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, backgroundColor: '#1b3a1b', color: '#4caf50' },
  badgeRed:   { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, backgroundColor: '#3a1b1b', color: '#f44336' },
};
