'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import styles from './page.module.css';

const BLANK = { name: '', slug: '', type: 'movie', description: '', is_active: true, order_index: 0 };

export default function AdminCategorias() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.get('/admin/categories')
      .then(r => setCats(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm({ ...BLANK }); setError(''); }
  function openEdit(c) { setForm({ ...c }); setError(''); }
  function closeForm() { setForm(null); setError(''); }

  function handleInput(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function save() {
    if (!form.name.trim() || !form.slug.trim()) { setError('Nome e slug são obrigatórios'); return; }
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/admin/categories/${form.id}`, form);
      } else {
        await api.post('/admin/categories', form);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id, name) {
    if (!confirm(`Excluir categoria "${name}"?`)) return;
    await api.delete(`/admin/categories/${id}`);
    load();
  }

  function slugify(val) {
    return val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.heading}>Categorias <span>({cats.length})</span></h1>
        <button className={styles.btnNew} onClick={openNew}>+ Nova Categoria</button>
      </div>

      {form && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>{form.id ? 'Editar Categoria' : 'Nova Categoria'}</h2>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>Nome</span>
              <input
                name="name"
                value={form.name}
                onChange={e => {
                  handleInput(e);
                  if (!form.id) setForm(f => ({ ...f, slug: slugify(e.target.value) }));
                }}
                className={styles.input}
                placeholder="Ex: Filmes de Ação"
              />
            </label>
            <label className={styles.field}>
              <span>Slug</span>
              <input name="slug" value={form.slug} onChange={handleInput} className={styles.input} placeholder="acao" />
            </label>
            <label className={styles.field}>
              <span>Tipo</span>
              <select name="type" value={form.type} onChange={handleInput} className={styles.select}>
                <option value="movie">Filme</option>
                <option value="series">Série</option>
                <option value="both">Ambos</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Ordem</span>
              <input name="order_index" type="number" value={form.order_index} onChange={handleInput} className={styles.input} style={{ width: 80 }} />
            </label>
            <label className={styles.field}>
              <span>Descrição</span>
              <input name="description" value={form.description || ''} onChange={handleInput} className={styles.input} />
            </label>
            <label className={styles.checkField}>
              <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleInput} />
              <span>Ativa</span>
            </label>
          </div>
          <div className={styles.formActions}>
            <button className={styles.btnSave} onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            <button className={styles.btnCancel} onClick={closeForm}>Cancelar</button>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ordem</th>
              <th>Nome</th>
              <th>Slug</th>
              <th>Tipo</th>
              <th>Ativa</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(c => (
              <tr key={c.id}>
                <td>{c.order_index}</td>
                <td className={styles.catName}>{c.name}</td>
                <td className={styles.slug}>{c.slug}</td>
                <td>{c.type}</td>
                <td><span className={c.is_active ? styles.yes : styles.no}>{c.is_active ? 'Sim' : 'Não'}</span></td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.btnEdit} onClick={() => openEdit(c)}>Editar</button>
                    <button className={styles.btnDelete} onClick={() => deleteCategory(c.id, c.name)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className={styles.loading}>Carregando...</p>}
        {!loading && cats.length === 0 && !form && <p className={styles.loading}>Nenhuma categoria cadastrada.</p>}
      </div>
    </div>
  );
}
