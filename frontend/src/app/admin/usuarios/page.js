'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import styles from './page.module.css';

const ALL_PLANS = [
  { id: 'monthly_2',    label: 'Mensal · 2 telas',      days: 30  },
  { id: 'monthly_3',    label: 'Mensal · 3 telas',      days: 30  },
  { id: 'monthly_5',    label: 'Mensal · 5 telas',      days: 30  },
  { id: 'quarterly_2',  label: 'Trimestral · 2 telas',  days: 90  },
  { id: 'quarterly_3',  label: 'Trimestral · 3 telas',  days: 90  },
  { id: 'quarterly_5',  label: 'Trimestral · 5 telas',  days: 90  },
  { id: 'yearly_2',     label: 'Anual · 2 telas',       days: 365 },
  { id: 'yearly_3',     label: 'Anual · 3 telas',       days: 365 },
  { id: 'yearly_5',     label: 'Anual · 5 telas',       days: 365 },
];

function daysRemaining(expiresAt) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function planLabel(planId) {
  return ALL_PLANS.find(p => p.id === planId)?.label || planId || '—';
}

function planColor(planId, daysLeft) {
  if (!planId || daysLeft === null) return '#444';
  if (daysLeft <= 0) return '#f44336';
  if (daysLeft <= 7) return '#ff9800';
  if (planId.startsWith('yearly')) return '#9c27b0';
  if (planId.startsWith('quarterly')) return '#2196f3';
  return '#4caf50';
}

export default function AdminUsuarios() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [managing, setManaging] = useState(null); // user id being managed
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState('');
  const [msg, setMsg]         = useState({});
  const [editRole, setEditRole] = useState(null); // for is_admin toggle

  function load() {
    setLoading(true);
    api.get('/admin/users')
      .then(r => setUsers(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openManage(u) {
    setManaging(u.id);
    setForm({
      plan: u.plan || 'monthly_2',
      expires: u.plan_expires_at ? u.plan_expires_at.substring(0, 10) : '',
      add_days: '',
    });
    setMsg(prev => ({ ...prev, [u.id]: '' }));
  }

  async function setPlan(userId) {
    const planInfo = ALL_PLANS.find(p => p.id === form.plan);
    const expiresAt = form.expires
      ? new Date(form.expires + 'T23:59:59').toISOString()
      : new Date(Date.now() + (planInfo?.days || 30) * 86400000).toISOString();

    setSaving(userId + '_set');
    try {
      await api.put(`/admin/users/${userId}/subscription`, { plan: form.plan, plan_expires_at: expiresAt });
      setMsg(prev => ({ ...prev, [userId]: 'Plano definido!' }));
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: form.plan, plan_expires_at: expiresAt } : u));
    } catch (e) {
      setMsg(prev => ({ ...prev, [userId]: 'Erro: ' + (e.response?.data?.error || e.message) }));
    } finally {
      setSaving('');
    }
  }

  async function addDays(userId, days) {
    setSaving(userId + '_add' + days);
    try {
      await api.put(`/admin/users/${userId}/subscription`, {
        plan: form.plan || users.find(u => u.id === userId)?.plan || 'monthly_2',
        add_days: days,
      });
      // Reload user data
      const { data } = await api.get('/admin/users');
      setUsers(data || []);
      const updated = (data || []).find(u => u.id === userId);
      if (updated) {
        setForm(prev => ({
          ...prev,
          expires: updated.plan_expires_at ? updated.plan_expires_at.substring(0, 10) : '',
        }));
      }
      setMsg(prev => ({ ...prev, [userId]: `+${days} dias adicionados!` }));
    } catch (e) {
      setMsg(prev => ({ ...prev, [userId]: 'Erro: ' + (e.response?.data?.error || e.message) }));
    } finally {
      setSaving('');
    }
  }

  async function clearSub(userId) {
    if (!confirm('Remover assinatura deste usuário?')) return;
    setSaving(userId + '_clear');
    try {
      await api.put(`/admin/users/${userId}/subscription`, { clear: true });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: null, plan_expires_at: null } : u));
      setMsg(prev => ({ ...prev, [userId]: 'Assinatura removida.' }));
      setManaging(null);
    } catch (e) {
      setMsg(prev => ({ ...prev, [userId]: 'Erro: ' + (e.response?.data?.error || e.message) }));
    } finally {
      setSaving('');
    }
  }

  async function toggleAdmin(u) {
    setEditRole(u.id);
    try {
      await api.put(`/admin/users/${u.id}`, { is_admin: !u.is_admin });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_admin: !u.is_admin } : x));
    } catch {}
    setEditRole(null);
  }

  return (
    <div>
      <h1 className={styles.heading}>Usuários <span>({users.length})</span></h1>

      {loading ? (
        <p className={styles.loading}>Carregando...</p>
      ) : users.length === 0 ? (
        <p className={styles.loading}>Nenhum usuário cadastrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {users.map(u => {
            const daysLeft  = daysRemaining(u.plan_expires_at);
            const color     = planColor(u.plan, daysLeft);
            const expired   = daysLeft !== null && daysLeft <= 0;
            const isOpen    = managing === u.id;

            return (
              <div key={u.id} style={{
                background: '#1a1a1a', borderRadius: 12,
                border: '1px solid #2a2a2a', overflow: 'hidden',
              }}>
                {/* ── Row ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: 16, alignItems: 'center', padding: '14px 20px' }}>
                  {/* Nome + email */}
                  <div>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>{u.name || '—'}</div>
                    <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{u.email}</div>
                    <div style={{ color: '#444', fontSize: 11, marginTop: 2 }}>
                      Desde {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  {/* Plano + dias */}
                  <div>
                    {u.plan ? (
                      <>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 10,
                          background: color + '22', color, fontSize: 12, fontWeight: 700, marginBottom: 4,
                        }}>
                          {planLabel(u.plan)}
                        </span>
                        <div style={{ fontSize: 12, color: expired ? '#f44336' : daysLeft <= 7 ? '#ff9800' : '#666' }}>
                          {expired
                            ? `⚠️ Expirado há ${Math.abs(daysLeft)} dias`
                            : daysLeft !== null
                              ? `✓ ${daysLeft} dias restantes`
                              : ''}
                          {u.plan_expires_at && (
                            <span style={{ color: '#444', marginLeft: 6 }}>
                              (até {new Date(u.plan_expires_at).toLocaleDateString('pt-BR')})
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span style={{ color: '#444', fontSize: 13 }}>Sem assinatura</span>
                    )}
                  </div>

                  {/* Admin badge */}
                  <button
                    onClick={() => toggleAdmin(u)}
                    disabled={editRole === u.id}
                    title="Clique para alternar admin"
                    style={{
                      padding: '3px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
                      background: u.is_admin ? '#1b5e2044' : '#2a2a2a',
                      color: u.is_admin ? '#4caf50' : '#555',
                      fontWeight: 700,
                    }}>
                    {u.is_admin ? 'ADMIN' : 'USER'}
                  </button>

                  {/* Gerenciar btn */}
                  <button
                    onClick={() => isOpen ? setManaging(null) : openManage(u)}
                    style={{
                      padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: isOpen ? '#333' : '#E50914', color: '#fff', fontSize: 13, fontWeight: 600,
                    }}>
                    {isOpen ? 'Fechar' : 'Gerenciar'}
                  </button>
                </div>

                {/* ── Painel de gerenciamento ── */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #2a2a2a', padding: '20px 20px 20px', background: '#111' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
                      <label style={{ color: '#888', fontSize: 13 }}>
                        Plano
                        <select
                          value={form.plan}
                          onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                          className={styles.select}
                          style={{ display: 'block', marginTop: 6, width: '100%', padding: '8px 10px' }}
                        >
                          {ALL_PLANS.map(p => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      </label>

                      <label style={{ color: '#888', fontSize: 13 }}>
                        Válido até
                        <input
                          type="date"
                          value={form.expires}
                          onChange={e => setForm(f => ({ ...f, expires: e.target.value }))}
                          style={{
                            display: 'block', marginTop: 6, width: '100%', padding: '8px 10px',
                            background: '#1a1a1a', border: '1px solid #333', borderRadius: 6,
                            color: '#fff', fontSize: 14,
                          }}
                        />
                      </label>

                      <button
                        onClick={() => setPlan(u.id)}
                        disabled={!!saving}
                        style={{
                          padding: '9px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: '#4caf50', color: '#fff', fontWeight: 700, fontSize: 14,
                          opacity: saving ? 0.6 : 1,
                        }}>
                        {saving === u.id + '_set' ? '...' : 'Definir'}
                      </button>
                    </div>

                    {/* Botões rápidos de dias */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ color: '#666', fontSize: 13 }}>Adicionar dias:</span>
                      {[7, 30, 60, 90, 180, 365].map(d => (
                        <button
                          key={d}
                          onClick={() => addDays(u.id, d)}
                          disabled={!!saving}
                          style={{
                            padding: '5px 14px', borderRadius: 6, border: '1px solid #333',
                            background: 'none', color: '#aaa', fontSize: 13, cursor: 'pointer',
                            opacity: saving === `${u.id}_add${d}` ? 0.5 : 1,
                          }}>
                          {saving === `${u.id}_add${d}` ? '...' : `+${d}d`}
                        </button>
                      ))}

                      <button
                        onClick={() => clearSub(u.id)}
                        disabled={!!saving}
                        style={{
                          marginLeft: 'auto', padding: '5px 14px', borderRadius: 6,
                          border: '1px solid #f4433655', background: 'none', color: '#f44336',
                          fontSize: 13, cursor: 'pointer',
                        }}>
                        Remover assinatura
                      </button>
                    </div>

                    {msg[u.id] && (
                      <p style={{
                        margin: 0, fontSize: 13,
                        color: msg[u.id].startsWith('Erro') ? '#f44336' : '#4caf50',
                      }}>
                        {msg[u.id]}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
