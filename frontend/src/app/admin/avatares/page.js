'use client';
import { useEffect, useState, useRef } from 'react';
import api from '../../../lib/api';

export default function AdminAvatares() {
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [isKids, setIsKids] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewOk, setPreviewOk] = useState(false);
  const fileInputRef = useRef(null);

  function load() {
    setLoading(true);
    api.get('/admin/preset-avatars')
      .then(r => setAvatars(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/avatar', formData);
      setUrl(res.data.cdnUrl);
      setPreviewOk(false);
    } catch (err) {
      alert('Erro no upload: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    try {
      await api.post('/admin/preset-avatars', { url: url.trim(), label: label.trim() || null, is_kids: isKids });
      setUrl(''); setLabel(''); setIsKids(false); setPreviewOk(false);
      load();
    } catch (err) {
      alert('Erro: ' + (err.response?.data?.error || err.message));
    } finally { setSaving(false); }
  }

  async function toggleActive(av) {
    try {
      await api.put(`/admin/preset-avatars/${av.id}`, { is_active: !av.is_active });
      setAvatars(prev => prev.map(a => a.id === av.id ? { ...a, is_active: !av.is_active } : a));
    } catch {}
  }

  async function toggleKids(av) {
    try {
      await api.put(`/admin/preset-avatars/${av.id}`, { is_kids: !av.is_kids });
      setAvatars(prev => prev.map(a => a.id === av.id ? { ...a, is_kids: !av.is_kids } : a));
    } catch {}
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este avatar?')) return;
    try {
      await api.delete(`/admin/preset-avatars/${id}`);
      setAvatars(prev => prev.filter(a => a.id !== id));
    } catch { alert('Erro ao excluir'); }
  }

  const general = avatars.filter(a => !a.is_kids);
  const kids = avatars.filter(a => a.is_kids);

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Avatares de Perfil</h1>
      <p style={{ color: '#555', fontSize: 14, marginBottom: 32 }}>
        Adicione fotos pré-configuradas que aparecem como opções circulares ao criar perfis no app.<br />
        Marque como <strong style={{ color: '#4caf50' }}>Infantil</strong> para aparecerem apenas em perfis infantis.
      </p>

      {/* ── Add form ── */}
      <form onSubmit={handleAdd} style={{ background: '#111', borderRadius: 16, padding: 24, marginBottom: 40, border: '1px solid #1e1e1e' }}>
        <h2 style={{ color: '#ccc', fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Adicionar avatar</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 3, minWidth: 240 }}>
            <label style={{ color: '#666', fontSize: 12, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Imagem</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={url}
                onChange={e => { setUrl(e.target.value); setPreviewOk(false); }}
                placeholder="Cole a URL ou clique em Anexar"
                style={{ flex: 1, padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ padding: '10px 16px', background: uploading ? '#1a1a1a' : '#1a2a3a', border: '1px solid #2a3a4a', borderRadius: 8, color: uploading ? '#444' : '#6ab0f5', fontSize: 13, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {uploading ? 'Enviando...' : '📎 Anexar'}
              </button>
            </div>
          </div>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label style={{ color: '#666', fontSize: 12, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nome / Label</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="ex: Guerreiro"
              style={{ width: '100%', padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          {/* Preview */}
          <div style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', border: previewOk ? '2px solid #E50914' : '2px dashed #333', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
            {url.trim() ? (
              <img
                src={url}
                alt="preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onLoad={() => setPreviewOk(true)}
                onError={() => setPreviewOk(false)}
              />
            ) : (
              <span style={{ color: '#333', fontSize: 28 }}>?</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div
              onClick={() => setIsKids(v => !v)}
              style={{ width: 44, height: 24, borderRadius: 12, background: isKids ? '#4caf50' : '#2a2a2a', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, border: '1px solid #333' }}
            >
              <div style={{ position: 'absolute', top: 3, left: isKids ? 22 : 3, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <span style={{ color: isKids ? '#4caf50' : '#666', fontSize: 14, fontWeight: isKids ? 600 : 400 }}>Apenas perfis infantis</span>
          </label>

          <button
            type="submit"
            disabled={saving || uploading || !url.trim()}
            style={{ marginLeft: 'auto', padding: '10px 28px', background: saving || uploading || !url.trim() ? '#2a2a2a' : '#E50914', color: saving || uploading || !url.trim() ? '#555' : '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: url.trim() && !uploading ? 'pointer' : 'not-allowed' }}
          >
            {saving ? 'Adicionando...' : '+ Adicionar'}
          </button>
        </div>
      </form>

      {loading ? (
        <p style={{ color: '#555' }}>Carregando...</p>
      ) : (
        <>
          {/* ── Grid geral ── */}
          <Section title="Avatares Gerais" avatars={general} onToggleActive={toggleActive} onToggleKids={toggleKids} onDelete={handleDelete} />
          {/* ── Grid infantil ── */}
          <Section title="Avatares Infantis" avatars={kids} accent="#4caf50" onToggleActive={toggleActive} onToggleKids={toggleKids} onDelete={handleDelete} />
        </>
      )}

      {/* SQL hint */}
      <div style={{ marginTop: 40, padding: 20, background: '#0d0d0d', borderRadius: 12, border: '1px solid #1a1a1a' }}>
        <p style={{ color: '#555', fontSize: 12, margin: '0 0 8px' }}>SQL necessário no Supabase (executar uma vez):</p>
        <pre style={{ color: '#4caf50', fontSize: 12, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{`CREATE TABLE IF NOT EXISTS public.preset_avatars (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  label text,
  is_kids boolean DEFAULT false,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);`}</pre>
      </div>
    </div>
  );
}

function Section({ title, avatars, accent = '#E50914', onToggleActive, onToggleKids, onDelete }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ color: '#777', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
        {title} <span style={{ color: '#333', fontWeight: 400 }}>({avatars.length})</span>
      </h2>
      {avatars.length === 0 ? (
        <p style={{ color: '#333', fontSize: 14 }}>Nenhum avatar nesta categoria.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {avatars.map(av => (
            <div key={av.id} style={{
              background: '#111', borderRadius: 14, padding: '16px 14px',
              border: `1px solid ${av.is_active ? '#222' : '#1a1a1a'}`,
              opacity: av.is_active ? 1 : 0.45,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              width: 130,
            }}>
              <div style={{ width: 80, height: 80, borderRadius: 40, overflow: 'hidden', border: `2px solid ${accent}33` }}>
                <img src={av.url} alt={av.label || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              {av.label && <span style={{ color: '#aaa', fontSize: 12, textAlign: 'center', fontWeight: 500 }}>{av.label}</span>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                <button onClick={() => onToggleActive(av)} style={{ padding: '4px 0', borderRadius: 6, border: `1px solid ${av.is_active ? '#2a4a2a' : '#2a2a2a'}`, background: 'none', color: av.is_active ? '#4caf50' : '#444', fontSize: 11, cursor: 'pointer', width: '100%' }}>
                  {av.is_active ? '✓ Ativo' : 'Oculto'}
                </button>
                <button onClick={() => onToggleKids(av)} style={{ padding: '4px 0', borderRadius: 6, border: `1px solid ${av.is_kids ? '#2a4a2a' : '#2a2a2a'}`, background: 'none', color: av.is_kids ? '#4caf50' : '#444', fontSize: 11, cursor: 'pointer', width: '100%' }}>
                  {av.is_kids ? '👶 Infantil' : 'Geral'}
                </button>
                <button onClick={() => onDelete(av.id)} style={{ padding: '4px 0', borderRadius: 6, border: '1px solid #3a1a1a', background: 'none', color: '#f44336', fontSize: 11, cursor: 'pointer', width: '100%' }}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
