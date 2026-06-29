'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';

const TABS = ['Planos', 'Pedidos', 'Credenciais'];

export default function AdminIptv() {
  const [tab, setTab] = useState('Planos');

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
  const [form,   setForm]   = useState({ name: '', description: '', price: '', duration_months: 1, order_index: 0 });
  const [editing, setEditing] = useState(null);
  const [saving,  setSaving]  = useState('');
  const [msg,     setMsg]     = useState('');

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/admin/iptv/plans'); setPlans(data || []); } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openEdit(p) {
    setEditing(p.id);
    setForm({ name: p.name, description: p.description || '', price: p.price, duration_months: p.duration_months, order_index: p.order_index || 0 });
    setMsg('');
  }
  function resetForm() { setEditing(null); setForm({ name: '', description: '', price: '', duration_months: 1, order_index: 0 }); setMsg(''); }

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
                <span style={{ color: '#555', fontSize: 13 }}>{p.duration_months} {p.duration_months === 1 ? 'mês' : 'meses'}</span>
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

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/admin/iptv/orders'); setOrders(data || []); } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function activate(id) {
    await api.patch(`/admin/iptv/orders/${id}/activate`);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'activated' } : o));
  }

  const pending   = orders.filter(o => o.status === 'pending');
  const activated = orders.filter(o => o.status === 'activated');

  return (
    <div>
      <h2 style={{ ...s.h2, marginBottom: 16 }}>Pedidos pendentes <span style={{ color: '#c91c2c' }}>({pending.length})</span></h2>
      {loading ? <p style={{ color: '#555' }}>Carregando...</p> : (
        <>
          {pending.length === 0 && <p style={{ color: '#555', marginBottom: 24 }}>Nenhum pedido pendente.</p>}
          {pending.map(o => (
            <div key={o.id} style={{ ...s.card, borderLeft: '3px solid #c91c2c', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{o.user_name}</span>
                  <span style={{ color: '#555', fontSize: 13 }}>{o.user_email}</span>
                </div>
                <div>
                  <span style={{ color: '#c91c2c', fontWeight: 700, marginRight: 12 }}>{o.plan_name}</span>
                  <span style={{ color: '#4caf50', fontWeight: 700, marginRight: 12 }}>R$ {Number(o.amount).toFixed(2).replace('.', ',')}</span>
                  <span style={{ color: '#444', fontSize: 12 }}>{new Date(o.created_at).toLocaleString('pt-BR')}</span>
                </div>
              </div>
              <button
                style={{ ...s.btnSmall, backgroundColor: '#1b3a1b', color: '#4caf50', padding: '8px 18px' }}
                onClick={() => activate(o.id)}
              >
                Marcar ativado
              </button>
            </div>
          ))}

          {activated.length > 0 && (
            <>
              <h3 style={{ color: '#555', fontSize: 14, margin: '24px 0 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ativados ({activated.length})</h3>
              {activated.map(o => (
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
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const SERVERS = [
    { label: 'Padrão (env IPTV_SERVER_URL)', value: '' },
    { label: 'ph1.fun', value: 'http://ph1.fun' },
    { label: 'MEGGA IPTV — c.mainbr.xyz', value: 'http://c.mainbr.xyz' },
  ];
  const [form, setForm]     = useState({ user_id: '', xc_username: '', xc_password: '', notes: '', server_url: '' });
  const [saving, setSaving] = useState('');
  const [msg, setMsg]       = useState('');
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([api.get('/admin/iptv'), api.get('/admin/users')]);
      setCreds(c.data || []);
      setUsers(u.data || []);
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openEdit(cred) {
    setEditing(cred.user_id);
    setForm({ user_id: cred.user_id, xc_username: cred.xc_username, xc_password: cred.xc_password, notes: cred.notes || '', server_url: cred.server_url || '' });
    setMsg('');
  }
  function resetForm() { setEditing(null); setForm({ user_id: '', xc_username: '', xc_password: '', notes: '', server_url: '' }); setMsg(''); }

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

  const linkedIds = new Set(creds.map(c => c.user_id));
  const availUsers = users.filter(u => !linkedIds.has(u.id) || u.id === editing);

  return (
    <div>
      <div style={s.card}>
        <h2 style={s.h2}>{editing ? 'Editar credenciais' : 'Vincular acesso IPTV ao usuário'}</h2>
        <label style={s.label}>Usuário *</label>
        <select style={s.input} value={form.user_id} onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))} disabled={!!editing}>
          <option value="">— Selecione —</option>
          {availUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
        </select>
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
        <label style={s.label}>Servidor IPTV</label>
        <select style={s.input} value={form.server_url} onChange={e => setForm(p => ({ ...p, server_url: e.target.value }))}>
          {SERVERS.map(sv => <option key={sv.value} value={sv.value}>{sv.label}</option>)}
        </select>
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
                  {cred.server_url && <span style={{ color: '#555', fontSize: 11, marginLeft: 8 }}>🌐 {cred.server_url}</span>}
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
