'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { getToken } from '../../lib/auth';
import { useProfile, AVATARS, getAvatar } from '../../contexts/ProfileContext';
import styles from './page.module.css';

const isUrl = (s) => typeof s === 'string' && s.startsWith('http');

function AvatarCircle({ avatarId, size = 84 }) {
  if (isUrl(avatarId)) {
    return <img src={avatarId} alt="" style={{ width: size, height: size, borderRadius: size * 0.22, objectFit: 'cover' }} />;
  }
  const av = getAvatar(avatarId);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size * 0.22, background: av.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.44,
      }}
    >
      {av.emoji}
    </div>
  );
}

const BLANK = { name: '', avatar: 'avatar_1', is_kids: false };

export default function PerfisPage() {
  const router = useRouter();
  const { selectProfile, loadSavedProfile } = useProfile();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = fechado, {} = criando, {...} = editando
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [presetAvatars, setPresetAvatars] = useState([]);
  const [avatarTab, setAvatarTab] = useState('fotos');

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    fetchProfiles().then(data => {
      const saved = loadSavedProfile(data);
      if (saved) router.replace('/');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function fetchProfiles() {
    setLoading(true);
    return api.get('/profiles')
      .then(r => { setProfiles(r.data || []); return r.data || []; })
      .catch(() => [])
      .finally(() => setLoading(false));
  }

  function fetchPresets(kids) {
    api.get('/preset-avatars' + (kids ? '?kids=true' : ''))
      .then(r => setPresetAvatars(r.data || []))
      .catch(() => setPresetAvatars([]));
  }

  function openCreate() {
    setForm(BLANK);
    setAvatarTab('fotos');
    setError('');
    setEditing({});
    fetchPresets(false);
  }

  function openEdit(profile) {
    setForm({ name: profile.name, avatar: profile.avatar, is_kids: profile.is_kids });
    setAvatarTab(isUrl(profile.avatar) ? 'fotos' : 'emoji');
    setError('');
    setEditing(profile);
    fetchPresets(profile.is_kids);
  }

  function toggleKids() {
    const next = !form.is_kids;
    setForm(f => ({ ...f, is_kids: next }));
    fetchPresets(next);
    if (next) setAvatarTab('fotos');
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Preencha o nome do perfil'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing?.id) {
        await api.put(`/profiles/${editing.id}`, form);
      } else {
        await api.post('/profiles', form);
      }
      setEditing(null);
      fetchProfiles();
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing?.id) return;
    if (!confirm(`Excluir o perfil "${editing.name}"?`)) return;
    try {
      await api.delete(`/profiles/${editing.id}`);
      setEditing(null);
      fetchProfiles();
    } catch (e) {
      setError(e.response?.data?.error || 'Erro ao excluir');
    }
  }

  function handleSelect(profile) {
    selectProfile(profile);
    router.replace('/');
  }

  if (loading) {
    return <div className={styles.loaderPage}><div className={styles.spinner} /></div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.logo}>FLIXHOME</h1>
        <h2 className={styles.title}>Quem está assistindo?</h2>
        <p className={styles.hint}>Clique com o botão direito (ou segure) um perfil para editar</p>
      </div>

      <div className={styles.grid}>
        {profiles.map(p => (
          <button
            key={p.id}
            className={styles.card}
            onClick={() => handleSelect(p)}
            onContextMenu={e => { e.preventDefault(); openEdit(p); }}
          >
            <div className={styles.avatarWrap}>
              <AvatarCircle avatarId={p.avatar} size={96} />
              {p.is_kids && <span className={styles.kidsOverlay}>👶</span>}
            </div>
            <span className={styles.cardName}>{p.name}</span>
            {p.is_kids && <span className={styles.kidsTag}>Infantil</span>}
            <button
              type="button"
              className={styles.editBtn}
              onClick={e => { e.stopPropagation(); openEdit(p); }}
              title="Editar perfil"
            >
              ✎
            </button>
          </button>
        ))}

        {profiles.length < 5 && (
          <button className={styles.card} onClick={openCreate}>
            <div className={styles.addAvatar}>+</div>
            <span className={styles.cardName}>Adicionar</span>
          </button>
        )}
      </div>

      {editing && (
        <div className={styles.modalOverlay} onClick={() => setEditing(null)}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{editing.id ? 'Editar perfil' : 'Novo perfil'}</h3>
            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.previewWrap}>
              <AvatarCircle avatarId={form.avatar} size={100} />
            </div>

            <input
              className={styles.nameInput}
              placeholder="Nome do perfil"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              maxLength={20}
            />

            <label className={styles.kidsToggle}>
              <span className={`${styles.toggleTrack} ${form.is_kids ? styles.toggleTrackOn : ''}`} onClick={toggleKids}>
                <span className={`${styles.toggleThumb} ${form.is_kids ? styles.toggleThumbOn : ''}`} />
              </span>
              <span className={styles.kidsLabel} style={form.is_kids ? { color: '#4caf50' } : undefined}>
                Perfil infantil {form.is_kids ? '👶' : ''}
              </span>
            </label>

            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${avatarTab === 'fotos' ? styles.tabActive : ''}`}
                onClick={() => setAvatarTab('fotos')}
              >
                Fotos
              </button>
              {!form.is_kids && (
                <button
                  className={`${styles.tab} ${avatarTab === 'emoji' ? styles.tabActive : ''}`}
                  onClick={() => setAvatarTab('emoji')}
                >
                  Emojis
                </button>
              )}
            </div>

            <div className={styles.avatarRow}>
              {avatarTab === 'fotos' ? (
                presetAvatars.length === 0 ? (
                  <p className={styles.emptyAvatars}>
                    {form.is_kids ? 'Nenhuma foto infantil disponível' : 'Nenhuma foto disponível ainda'}
                  </p>
                ) : presetAvatars.map(av => (
                  <button
                    key={av.id}
                    className={`${styles.avatarOpt} ${form.avatar === av.url ? styles.avatarOptSelected : ''}`}
                    onClick={() => setForm(f => ({ ...f, avatar: av.url }))}
                  >
                    <img src={av.url} alt={av.label || ''} className={styles.avatarOptImg} />
                  </button>
                ))
              ) : (
                AVATARS.map(av => (
                  <button
                    key={av.id}
                    className={`${styles.avatarOpt} ${form.avatar === av.id ? styles.avatarOptSelected : ''}`}
                    onClick={() => setForm(f => ({ ...f, avatar: av.id }))}
                  >
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                      {av.emoji}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className={styles.actions}>
              {editing.id && (
                <button className={styles.btnDelete} onClick={handleDelete} title="Excluir perfil">🗑</button>
              )}
              <button className={styles.btnCancel} onClick={() => setEditing(null)}>Cancelar</button>
              <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
