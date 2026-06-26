'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';

export default function AdminIptv() {
  const [creds, setCreds]   = useState([]);
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState({ user_id: '', server_url: '', xc_username: '', xc_password: '', notes: '' });
  const [saving, setSaving] = useState('');
  const [msg, setMsg]       = useState('');
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([
        api.get('/admin/iptv'),
        api.get('/admin/users'),
      ]);
      setCreds(c.data || []);
      setUsers(u.data || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openEdit(cred) {
    setEditing(cred.user_id);
    setForm({
      user_id: cred.user_id,
      server_url: cred.server_url,
      xc_username: cred.xc_username,
      xc_password: cred.xc_password,
      notes: cred.notes || '',
    });
    setMsg('');
  }

  function resetForm() {
    setEditing(null);
    setForm({ user_id: '', server_url: '', xc_username: '', xc_password: '', notes: '' });
    setMsg('');
  }

  async function save() {
    if (!form.user_id || !form.server_url || !form.xc_username || !form.xc_password) {
      return setMsg('Preencha todos os campos obrigatórios.');
    }
    setSaving('save');
    try {
      await api.post('/admin/iptv', form);
      setMsg('Salvo com sucesso!');
      resetForm();
      load();
    } catch (e) {
      setMsg('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving('');
    }
  }

  async function toggle(userId) {
    setSaving('toggle_' + userId);
    try {
      const { data } = await api.patch(`/admin/iptv/${userId}/toggle`);
      setCreds(prev => prev.map(c => c.user_id === userId ? { ...c, active: data.active } : c));
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving('');
    }
  }

  async function remove(userId, userName) {
    if (!confirm(`Remover IPTV de ${userName}?`)) return;
    setSaving('del_' + userId);
    try {
      await api.delete(`/admin/iptv/${userId}`);
      setCreds(prev => prev.filter(c => c.user_id !== userId));
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving('');
    }
  }

  const linkedIds = new Set(creds.map(c => c.user_id));
  const availUsers = users.filter(u => !linkedIds.has(u.id) || u.id === editing);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, marginBottom: 24 }}>
        Gerenciar IPTV
        <span style={{ color: '#555', fontWeight: 400, fontSize: 15, marginLeft: 10 }}>
          ({creds.length} assinaturas)
        </span>
      </h1>

      {/* Form */}
      <div style={s.card}>
        <h2 style={s.cardTitle}>{editing ? 'Editar credenciais' : 'Vincular credenciais IPTV'}</h2>

        <label style={s.label}>Usuário *</label>
        <select
          style={s.input}
          value={form.user_id}
          onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))}
          disabled={!!editing}
        >
          <option value="">— Selecione um usuário —</option>
          {availUsers.map(u => (
            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
          ))}
        </select>

        <label style={s.label}>URL do servidor XC *</label>
        <input
          style={s.input}
          placeholder="http://servidor:porta"
          value={form.server_url}
          onChange={e => setForm(p => ({ ...p, server_url: e.target.value }))}
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Usuário XC *</label>
            <input
              style={s.input}
              placeholder="username"
              value={form.xc_username}
              onChange={e => setForm(p => ({ ...p, xc_username: e.target.value }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Senha XC *</label>
            <input
              style={s.input}
              placeholder="password"
              value={form.xc_password}
              onChange={e => setForm(p => ({ ...p, xc_password: e.target.value }))}
            />
          </div>
        </div>

        <label style={s.label}>Observações</label>
        <input
          style={s.input}
          placeholder="Ex: plano mensal, contrato #123..."
          value={form.notes}
          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
        />

        {msg && (
          <p style={{ color: msg.startsWith('Erro') ? '#f44336' : '#4caf50', marginTop: 8, fontSize: 13 }}>
            {msg}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button style={s.btnPrimary} onClick={save} disabled={saving === 'save'}>
            {saving === 'save' ? 'Salvando...' : editing ? 'Atualizar' : 'Vincular'}
          </button>
          {editing && (
            <button style={s.btnSecondary} onClick={resetForm}>Cancelar</button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : creds.length === 0 ? (
        <p style={{ color: '#555' }}>Nenhuma credencial IPTV vinculada ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {creds.map(cred => {
            const u = cred.user || {};
            return (
              <div key={cred.id} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{u.name}</span>
                    <span style={{ color: '#555', fontSize: 13 }}>{u.email}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      backgroundColor: cred.active ? '#1b3a1b' : '#3a1b1b',
                      color: cred.active ? '#4caf50' : '#f44336',
                    }}>
                      {cred.active ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </div>
                  <div style={{ color: '#555', fontSize: 12 }}>
                    <span style={{ marginRight: 16 }}>🖥 {cred.server_url}</span>
                    <span style={{ marginRight: 16 }}>👤 {cred.xc_username}</span>
                    {cred.notes && <span>📝 {cred.notes}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ ...s.btnSmall, backgroundColor: cred.active ? '#3a1b1b' : '#1b3a1b', color: cred.active ? '#f44336' : '#4caf50' }}
                    onClick={() => toggle(cred.user_id)}
                    disabled={saving === 'toggle_' + cred.user_id}
                  >
                    {saving === 'toggle_' + cred.user_id ? '...' : cred.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    style={{ ...s.btnSmall, backgroundColor: '#1a1a2e', color: '#7986cb' }}
                    onClick={() => openEdit(cred)}
                  >
                    Editar
                  </button>
                  <button
                    style={{ ...s.btnSmall, backgroundColor: '#2a1515', color: '#f44336' }}
                    onClick={() => remove(cred.user_id, u.name)}
                    disabled={saving === 'del_' + cred.user_id}
                  >
                    {saving === 'del_' + cred.user_id ? '...' : 'Remover'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  card: {
    backgroundColor: '#111', borderRadius: 10, padding: 20,
    border: '1px solid #1e1e1e', marginBottom: 16,
  },
  cardTitle: { color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 16 },
  label: { display: 'block', color: '#888', fontSize: 12, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    width: '100%', backgroundColor: '#1a1a1a', color: '#fff',
    border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px',
    fontSize: 14, boxSizing: 'border-box',
  },
  btnPrimary: {
    backgroundColor: '#c91c2c', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: '#1a1a1a', color: '#888', border: '1px solid #2a2a2a',
    borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
  },
  btnSmall: {
    border: 'none', borderRadius: 6, padding: '6px 14px',
    fontWeight: 700, cursor: 'pointer', fontSize: 12,
  },
};
