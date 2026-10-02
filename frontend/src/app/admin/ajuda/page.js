'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import styles from './page.module.css';

const BLANK = { question: '', answer: '', order_index: 0, is_active: true };

export default function AdminAjuda() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.get('/admin/help')
      .then(r => setArticles(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm({ ...BLANK, order_index: articles.length }); setError(''); }
  function openEdit(a) { setForm({ ...a }); setError(''); }
  function closeForm() { setForm(null); setError(''); }

  function handleInput(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function save() {
    if (!form.question.trim() || !form.answer.trim()) {
      setError('Pergunta e resposta são obrigatórias');
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/admin/help/${form.id}`, form);
      } else {
        await api.post('/admin/help', form);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function deleteArticle(id, question) {
    if (!confirm(`Excluir "${question}"?`)) return;
    await api.delete(`/admin/help/${id}`);
    load();
  }

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.heading}>Ajuda / FAQ <span>({articles.length})</span></h1>
        <button className={styles.btnNew} onClick={openNew}>+ Nova Pergunta</button>
      </div>
      <p className={styles.hint}>
        Perguntas e respostas exibidas na tela de Ajuda do app e do site.
      </p>

      {form && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>{form.id ? 'Editar Pergunta' : 'Nova Pergunta'}</h2>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.fields}>
            <label className={styles.field} style={{ flex: 1, minWidth: 280 }}>
              <span>Pergunta</span>
              <input
                name="question"
                value={form.question}
                onChange={handleInput}
                className={styles.input}
                placeholder="Ex: Como funciona o download offline?"
              />
            </label>
            <label className={styles.field}>
              <span>Ordem</span>
              <input name="order_index" type="number" value={form.order_index} onChange={handleInput} className={styles.input} style={{ width: 80 }} />
            </label>
            <label className={styles.checkField}>
              <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleInput} />
              <span>Ativa</span>
            </label>
            <label className={styles.field} style={{ flex: '1 1 100%' }}>
              <span>Resposta</span>
              <textarea
                name="answer"
                value={form.answer}
                onChange={handleInput}
                className={styles.input}
                rows={5}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Resposta completa, pode ter várias linhas."
              />
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
              <th>Pergunta</th>
              <th>Ativa</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {articles.map(a => (
              <tr key={a.id}>
                <td>{a.order_index}</td>
                <td className={styles.catName}>{a.question}</td>
                <td><span className={a.is_active ? styles.yes : styles.no}>{a.is_active ? 'Sim' : 'Não'}</span></td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.btnEdit} onClick={() => openEdit(a)}>Editar</button>
                    <button className={styles.btnDelete} onClick={() => deleteArticle(a.id, a.question)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className={styles.loading}>Carregando...</p>}
        {!loading && articles.length === 0 && !form && <p className={styles.loading}>Nenhuma pergunta cadastrada.</p>}
      </div>
    </div>
  );
}
