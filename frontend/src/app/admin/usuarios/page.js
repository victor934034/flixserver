'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import styles from './page.module.css';

const PLANS = ['free', 'basic', 'premium'];
const PLAN_COLORS = { free: '#888', basic: '#4a90e2', premium: '#e5b300' };

export default function AdminUsuarios() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editPlan, setEditPlan] = useState('');
  const [editAdmin, setEditAdmin] = useState(false);

  function load() {
    setLoading(true);
    api.get('/admin/users')
      .then(r => setUsers(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function startEdit(u) {
    setEditing(u.id);
    setEditPlan(u.plan || 'free');
    setEditAdmin(!!u.is_admin);
  }

  async function saveEdit(id) {
    await api.put(`/admin/users/${id}`, { plan: editPlan, is_admin: editAdmin });
    setEditing(null);
    load();
  }

  return (
    <div>
      <h1 className={styles.heading}>Usuários <span>({users.length})</span></h1>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Plano</th>
              <th>Admin</th>
              <th>Cadastro</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className={styles.name}>{u.name || '—'}</td>
                <td className={styles.email}>{u.email}</td>
                <td>
                  {editing === u.id ? (
                    <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className={styles.select}>
                      {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <span className={styles.planBadge} style={{ background: PLAN_COLORS[u.plan] || '#555' }}>
                      {u.plan || 'free'}
                    </span>
                  )}
                </td>
                <td>
                  {editing === u.id ? (
                    <input type="checkbox" checked={editAdmin} onChange={e => setEditAdmin(e.target.checked)} />
                  ) : (
                    <span className={u.is_admin ? styles.yes : styles.no}>{u.is_admin ? 'Sim' : 'Não'}</span>
                  )}
                </td>
                <td className={styles.date}>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                <td>
                  {editing === u.id ? (
                    <div className={styles.actions}>
                      <button className={styles.btnSave} onClick={() => saveEdit(u.id)}>Salvar</button>
                      <button className={styles.btnCancel} onClick={() => setEditing(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <button className={styles.btnEdit} onClick={() => startEdit(u)}>Editar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className={styles.loading}>Carregando...</p>}
        {!loading && users.length === 0 && <p className={styles.loading}>Nenhum usuário cadastrado.</p>}
      </div>
    </div>
  );
}
