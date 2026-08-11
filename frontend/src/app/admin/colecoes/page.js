'use client';
import { useEffect, useRef, useState } from 'react';
import api from '../../../lib/api';
import styles from './page.module.css';

const BLANK = { name: '', slug: '', description: '', cover_url: '', is_active: true, order_index: 0 };

function describeError(err) {
  const d = err.response?.data;
  if (!d) return err.message;
  return [d.error, d.details, d.hint].filter(Boolean).join(' — ');
}

export default function AdminColecoes() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [managing, setManaging] = useState(null); // coleção com itens sendo gerenciada
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef(null);

  function load() {
    setLoading(true);
    api.get('/admin/collections')
      .then(r => setCollections(r.data || []))
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

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/avatar', formData);
      setForm(f => ({ ...f, cover_url: res.data.cdnUrl }));
    } catch (err) {
      alert('Erro no upload: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  }

  function slugify(val) {
    return val.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function save() {
    if (!form.name.trim() || !form.slug.trim()) { setError('Nome e slug são obrigatórios'); return; }
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/admin/collections/${form.id}`, form);
      } else {
        await api.post('/admin/collections', form);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCollection(id, name) {
    if (!confirm(`Excluir a coleção "${name}"? Isso remove todos os itens dela.`)) return;
    await api.delete(`/admin/collections/${id}`);
    load();
  }

  return (
    <div>
      <div className={styles.topBar}>
        <h1 className={styles.heading}>Cronologias / Coleções <span>({collections.length})</span></h1>
        <button className={styles.btnNew} onClick={openNew}>+ Nova Coleção</button>
      </div>
      <p className={styles.hint}>
        Use para agrupar filmes e séries numa ordem específica — ex: "Universo Marvel em Ordem Cronológica".
      </p>

      {form && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>{form.id ? 'Editar Coleção' : 'Nova Coleção'}</h2>
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
                placeholder="Ex: Universo Marvel"
              />
            </label>
            <label className={styles.field}>
              <span>Slug</span>
              <input name="slug" value={form.slug} onChange={handleInput} className={styles.input} placeholder="universo-marvel" />
            </label>
            <label className={styles.field}>
              <span>Ordem</span>
              <input name="order_index" type="number" value={form.order_index} onChange={handleInput} className={styles.input} style={{ width: 80 }} />
            </label>
            <label className={styles.field} style={{ flex: 1, minWidth: 280 }}>
              <span>Capa</span>
              <div className={styles.coverRow}>
                {form.cover_url && (
                  <img src={form.cover_url} alt="" className={styles.coverPreview} />
                )}
                <input
                  name="cover_url"
                  value={form.cover_url || ''}
                  onChange={handleInput}
                  className={styles.input}
                  style={{ flex: 1 }}
                  placeholder="https://... ou envie uma imagem"
                />
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleCoverUpload}
                />
                <button
                  type="button"
                  className={styles.btnCancel}
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                >
                  {uploadingCover ? 'Enviando...' : 'Enviar imagem'}
                </button>
              </div>
            </label>
            <label className={styles.field} style={{ flex: 1, minWidth: 240 }}>
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

      {managing && (
        <CollectionItems collection={managing} onClose={() => setManaging(null)} />
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ordem</th>
              <th>Nome</th>
              <th>Slug</th>
              <th>Ativa</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {collections.map(c => (
              <tr key={c.id}>
                <td>{c.order_index}</td>
                <td className={styles.catName}>{c.name}</td>
                <td className={styles.slug}>{c.slug}</td>
                <td><span className={c.is_active ? styles.yes : styles.no}>{c.is_active ? 'Sim' : 'Não'}</span></td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.btnItems} onClick={() => setManaging(c)}>Itens</button>
                    <button className={styles.btnEdit} onClick={() => openEdit(c)}>Editar</button>
                    <button className={styles.btnDelete} onClick={() => deleteCollection(c.id, c.name)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className={styles.loading}>Carregando...</p>}
        {!loading && collections.length === 0 && !form && <p className={styles.loading}>Nenhuma coleção cadastrada.</p>}
      </div>
    </div>
  );
}

function CollectionItems({ collection, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('movie');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  function load() {
    setLoading(true);
    api.get(`/admin/collections/${collection.id}/items`)
      .then(r => setItems((r.data || []).sort((a, b) => a.position - b.position)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [collection.id]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      api.get(`/admin/${type === 'movie' ? 'movies' : 'series'}?q=${encodeURIComponent(query.trim())}&limit=8`)
        .then(r => setResults(r.data?.data || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, type]);

  async function addItem(content) {
    const nextPosition = items.length > 0 ? Math.max(...items.map(i => i.position)) + 1 : 1;
    try {
      await api.post(`/admin/collections/${collection.id}/items`, {
        content_type: type,
        content_id: content.id,
        position: nextPosition,
      });
      setQuery('');
      setResults([]);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao adicionar item');
    }
  }

  async function removeItem(itemId) {
    try {
      await api.delete(`/admin/collections/${collection.id}/items/${itemId}`);
      load();
    } catch (err) {
      alert(describeError(err) || 'Erro ao remover item');
    }
  }

  async function moveItem(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    // Posições podem ser iguais (itens antigos criados com position=0) — garante
    // que a troca sempre gere valores diferentes, senão a ordenação não muda.
    const posA = b.position;
    const posB = a.position !== b.position ? a.position : a.position + 1;
    try {
      await Promise.all([
        api.put(`/admin/collections/${collection.id}/items/${a.id}`, { position: posA }),
        api.put(`/admin/collections/${collection.id}/items/${b.id}`, { position: posB }),
      ]);
      load();
    } catch (err) {
      alert(describeError(err) || 'Erro ao reordenar item');
    }
  }

  return (
    <div className={styles.itemsPanel}>
      <div className={styles.itemsPanelHeader}>
        <h2 className={styles.formTitle}>Itens de "{collection.name}"</h2>
        <button className={styles.btnCancel} onClick={onClose}>Fechar</button>
      </div>

      <div className={styles.searchRow}>
        <select className={styles.select} value={type} onChange={e => { setType(e.target.value); setQuery(''); setResults([]); }}>
          <option value="movie">Filme</option>
          <option value="series">Série</option>
        </select>
        <input
          className={styles.input}
          style={{ flex: 1 }}
          placeholder="Buscar por título para adicionar..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {searching && <p className={styles.loading}>Buscando...</p>}
      {results.length > 0 && (
        <div className={styles.results}>
          {results.map(r => (
            <button key={r.id} className={styles.resultItem} onClick={() => addItem(r)}>
              {r.title} {r.year || r.year_start ? `(${r.year || r.year_start})` : ''}
            </button>
          ))}
        </div>
      )}

      <div className={styles.tableWrap} style={{ marginTop: '1rem' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Título</th>
              <th>Tipo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id}>
                <td>{idx + 1}</td>
                <td className={styles.catName}>{item.title}</td>
                <td>{item.content_type === 'movie' ? 'Filme' : 'Série'}</td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.btnEdit} disabled={idx === 0} onClick={() => moveItem(idx, -1)}>↑</button>
                    <button className={styles.btnEdit} disabled={idx === items.length - 1} onClick={() => moveItem(idx, 1)}>↓</button>
                    <button className={styles.btnDelete} onClick={() => removeItem(item.id)}>Remover</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className={styles.loading}>Carregando...</p>}
        {!loading && items.length === 0 && <p className={styles.loading}>Nenhum item adicionado ainda.</p>}
      </div>
    </div>
  );
}
