import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { KEY, useKeyDown } from '../hooks/useNav.js';
import api from '../api/index.js';

const ACCENT = '#c91c2c';

const AVATAR_MAP = {
  avatar_1:  { emoji: '😎', color: '#E50914' },
  avatar_2:  { emoji: '🎬', color: '#1565C0' },
  avatar_3:  { emoji: '🎭', color: '#6A0DAD' },
  avatar_4:  { emoji: '🦁', color: '#E65100' },
  avatar_5:  { emoji: '🐉', color: '#1B5E20' },
  avatar_6:  { emoji: '🚀', color: '#0D47A1' },
  avatar_7:  { emoji: '🎮', color: '#880E4F' },
  avatar_8:  { emoji: '🌙', color: '#37474F' },
  avatar_9:  { emoji: '⚡', color: '#F9A825' },
  avatar_10: { emoji: '🐱', color: '#00695C' },
  avatar_11: { emoji: '🎵', color: '#4A148C' },
  avatar_12: { emoji: '🌊', color: '#006064' },
  avatar_13: { emoji: '🔥', color: '#BF360C' },
  avatar_14: { emoji: '🌸', color: '#AD1457' },
  avatar_15: { emoji: '🤖', color: '#263238' },
};

const AVATAR_KEYS = Object.keys(AVATAR_MAP);

function avatarStyle(avatar) {
  if (avatar && avatar.startsWith('http')) return { isUrl: true, url: avatar };
  if (avatar && AVATAR_MAP[avatar]) return { isUrl: false, ...AVATAR_MAP[avatar] };
  return { isUrl: false, emoji: '😊', color: '#E50914' };
}

// ── Delete confirm ───────────────────────────────────────────────────────────
function ConfirmDeleteModal({ profile, onConfirm, onCancel }) {
  const [focused, setFocused] = useState('cancel'); // 'cancel' | 'delete'

  useKeyDown(e => {
    const k = e.keyCode;
    if (k === KEY.BACK) { e.preventDefault(); onCancel(); return; }
    if (k === KEY.LEFT || k === KEY.RIGHT) { e.preventDefault(); setFocused(f => f === 'cancel' ? 'delete' : 'cancel'); }
    if (k === KEY.ENTER) { e.preventDefault(); if (focused === 'delete') onConfirm(); else onCancel(); }
  }, [focused]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1a1a1a', borderRadius: 20, padding: '40px 48px', width: 460, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 80px rgba(0,0,0,0.8)' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Excluir perfil</div>
        <div style={{ fontSize: 15, color: '#999', marginBottom: 32 }}>Excluir "{profile.name}"? Essa ação não pode ser desfeita.</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 10,
              background: 'transparent', border: '2px solid ' + (focused === 'cancel' ? '#fff' : 'rgba(255,255,255,0.2)'),
              color: focused === 'cancel' ? '#fff' : '#888', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
              background: focused === 'delete' ? ACCENT : 'rgba(229,9,20,0.2)',
              color: focused === 'delete' ? '#fff' : '#ff6b6b', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create / edit profile modal ──────────────────────────────────────────────
function ProfileModal({ editing, onDone, onCancel, onDelete }) {
  const [name,      setName]      = useState(editing ? editing.name : '');
  const [avatarIdx, setAvatarIdx] = useState(editing ? Math.max(0, AVATAR_KEYS.indexOf(editing.avatar)) : 0);
  const [isKids,    setIsKids]    = useState(editing ? !!editing.is_kids : false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // 'name' | 'avatar' | 'kids' | 'save' | 'cancel' | 'delete'
  const [field,     setField]     = useState('name');
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current && inputRef.current.focus(), 100);
  }, []);

  useKeyDown(e => {
    if (confirmingDelete) return;
    const k = e.keyCode;
    if (k === KEY.BACK) { e.preventDefault(); onCancel(); return; }

    if (field === 'name') {
      if (k === KEY.DOWN) { e.preventDefault(); setField('avatar'); inputRef.current && inputRef.current.blur(); }
      return;
    }
    if (field === 'avatar') {
      if (k === KEY.LEFT)  { e.preventDefault(); setAvatarIdx(i => (i - 1 + AVATAR_KEYS.length) % AVATAR_KEYS.length); }
      if (k === KEY.RIGHT) { e.preventDefault(); setAvatarIdx(i => (i + 1) % AVATAR_KEYS.length); }
      if (k === KEY.UP)    { e.preventDefault(); setField('name'); setTimeout(() => inputRef.current && inputRef.current.focus(), 50); }
      if (k === KEY.DOWN)  { e.preventDefault(); setField('kids'); }
      return;
    }
    if (field === 'kids') {
      if (k === KEY.UP)    { e.preventDefault(); setField('avatar'); }
      if (k === KEY.DOWN)  { e.preventDefault(); setField(editing ? 'delete' : 'save'); }
      if (k === KEY.ENTER) { e.preventDefault(); setIsKids(v => !v); }
      return;
    }
    if (field === 'delete') {
      if (k === KEY.UP)    { e.preventDefault(); setField('kids'); }
      if (k === KEY.RIGHT) { e.preventDefault(); setField('save'); }
      if (k === KEY.ENTER) { e.preventDefault(); setConfirmingDelete(true); }
      return;
    }
    if (field === 'save') {
      if (k === KEY.UP)    { e.preventDefault(); setField(editing ? 'delete' : 'kids'); }
      if (k === KEY.LEFT && editing) { e.preventDefault(); setField('delete'); }
      if (k === KEY.RIGHT) { e.preventDefault(); setField('cancel'); }
      if (k === KEY.ENTER) { e.preventDefault(); handleSave(); }
      return;
    }
    if (field === 'cancel') {
      if (k === KEY.UP)   { e.preventDefault(); setField(editing ? 'delete' : 'kids'); }
      if (k === KEY.LEFT) { e.preventDefault(); setField('save'); }
      if (k === KEY.ENTER){ e.preventDefault(); onCancel(); }
    }
  }, [field, avatarIdx, name, isKids, confirmingDelete]);

  async function handleSave() {
    if (!name.trim()) { setError('Digite um nome'); return; }
    setSaving(true); setError('');
    try {
      const av = AVATAR_KEYS[avatarIdx];
      if (editing) {
        const { data } = await api.put('/api/profiles/' + editing.id, { name: name.trim(), avatar: av, is_kids: isKids });
        onDone(data);
      } else {
        const { data } = await api.post('/api/profiles', { name: name.trim(), avatar: av, is_kids: isKids });
        onDone(data);
      }
    } catch(e) {
      setError(e.response?.data?.error || 'Erro ao salvar perfil');
    } finally { setSaving(false); }
  }

  const curAv = avatarStyle(AVATAR_KEYS[avatarIdx]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a1a', borderRadius: 20,
        padding: '52px 64px', width: 640,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
      }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 40 }}>
          {editing ? 'Editar Perfil' : 'Criar Perfil'}
        </div>

        {/* Name field */}
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Nome</div>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome do perfil"
            maxLength={20}
            onFocus={() => setField('name')}
            style={{
              width: '100%', padding: '16px 20px',
              background: '#111', border: '2px solid ' + (field === 'name' ? '#fff' : 'rgba(255,255,255,0.15)'),
              borderRadius: 10, color: '#fff', fontSize: 18,
              outline: 'none', fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
          />
        </div>

        {/* Avatar picker */}
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Avatar</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 90, height: 90, borderRadius: 18,
              background: curAv.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40, flexShrink: 0,
              border: field === 'avatar' ? '3px solid #fff' : '3px solid transparent',
              transition: 'border-color 0.15s',
            }}>
              {curAv.emoji}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                Avatar {avatarIdx + 1} / {AVATAR_KEYS.length}
              </div>
              {field === 'avatar' && (
                <div style={{ color: '#666', fontSize: 13 }}>← → para trocar</div>
              )}
            </div>
          </div>
        </div>

        {/* Kids toggle */}
        <div
          onClick={() => setIsKids(v => !v)}
          style={{
            marginBottom: 30, padding: '14px 18px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
            border: '2px solid ' + (field === 'kids' ? '#fff' : isKids ? '#4caf50' : 'rgba(255,255,255,0.15)'),
            background: isKids ? 'rgba(76,175,80,0.15)' : 'transparent',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <span style={{ color: isKids ? '#8bd894' : '#ccc', fontSize: 14, fontWeight: 600 }}>
            {isKids ? '👶 Perfil infantil (ativado)' : 'Marcar como perfil infantil'}
          </span>
        </div>

        {error && (
          <div style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 20 }}>{error}</div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {editing && (
            <button
              onClick={() => setConfirmingDelete(true)}
              style={{
                padding: '16px 20px', borderRadius: 10,
                background: 'transparent', border: '2px solid ' + (field === 'delete' ? '#fff' : 'rgba(229,9,20,0.4)'),
                color: '#ff6b6b', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Excluir
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onCancel}
            style={{
              padding: '16px 28px', borderRadius: 10,
              background: 'transparent',
              border: '2px solid ' + (field === 'cancel' ? '#fff' : 'rgba(255,255,255,0.2)'),
              color: field === 'cancel' ? '#fff' : '#666',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '16px 32px', borderRadius: 10, border: 'none',
              background: field === 'save' ? '#fff' : ACCENT,
              color: field === 'save' ? '#0a0a0a' : '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDeleteModal
          profile={editing}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => onDelete(editing)}
        />
      )}
    </div>
  );
}

export default function ProfileSelectScreen() {
  const { setActiveProfile, logout, user } = useAuth();
  const navigate  = useNavigate();
  const [profiles,   setProfiles]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [focused,    setFocused]    = useState(0);
  const [editMode,   setEditMode]   = useState(false);
  const [editing,    setEditing]    = useState(null); // null = fechado, {} = criando, {...} = editando

  function loadProfiles() {
    setLoading(true);
    api.get('/api/profiles')
      .then(r => setProfiles(r.data || []))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadProfiles(); }, []);

  // total focusable: profiles + "add" button + "editar perfis" toggle
  const totalItems = profiles.length + (profiles.length < 5 ? 1 : 0) + 1;
  const editToggleIdx = totalItems - 1;

  useKeyDown(e => {
    if (loading || editing) return;
    if (e.keyCode === KEY.LEFT) {
      e.preventDefault();
      setFocused(f => Math.max(0, f - 1));
    } else if (e.keyCode === KEY.RIGHT) {
      e.preventDefault();
      setFocused(f => Math.min(totalItems - 1, f + 1));
    } else if (e.keyCode === KEY.ENTER) {
      e.preventDefault();
      if (focused === editToggleIdx) { setEditMode(m => !m); return; }
      if (focused < profiles.length) {
        if (profiles[focused]) select(profiles[focused]);
      } else {
        setEditing({});
      }
    } else if (e.keyCode === KEY.BACK) {
      e.preventDefault();
      if (editMode) { setEditMode(false); return; }
      logout();
      navigate('/login', { replace: true });
    }
  }, [loading, profiles, focused, totalItems, editing, editMode, editToggleIdx]);

  function select(p) {
    if (editMode) { setEditing(p); return; }
    setActiveProfile(p);
    navigate('/');
  }

  function handleDone(profile) {
    setEditing(null);
    loadProfiles();
    if (!editMode) select(profile);
  }

  async function handleDelete(profile) {
    try {
      await api.delete('/api/profiles/' + profile.id);
      setEditing(null);
      loadProfiles();
    } catch {}
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#141414',
    }}>
      {editing !== null && (
        <ProfileModal
          editing={editing.id ? editing : null}
          onDone={handleDone}
          onCancel={() => setEditing(null)}
          onDelete={handleDelete}
        />
      )}

      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Quem está assistindo?</div>
      <div style={{ fontSize: 15, color: '#666', marginBottom: 56 }}>
        {editMode ? 'Selecione um perfil para editar' : (user && user.email)}
      </div>

      {loading ? (
        <div style={{ color: '#888', fontSize: 18 }}>Carregando perfis…</div>
      ) : (
        <div style={{ display: 'flex', gap: 56, justifyContent: 'center', alignItems: 'flex-start' }}>
          {profiles.map((p, i) => {
            const av  = avatarStyle(p.avatar);
            const isFoc = focused === i;
            return (
              <div
                key={p.id}
                onClick={() => { setFocused(i); select(p); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: 'pointer', gap: 16, position: 'relative',
                  transform: isFoc ? 'scale(1.14)' : 'scale(1)',
                  transition: 'transform 0.2s',
                }}
              >
                <div style={{ position: 'relative' }}>
                  {av.isUrl ? (
                    <img src={av.url} alt={p.name} style={{
                      width: 130, height: 130, borderRadius: 26, objectFit: 'cover',
                      border: isFoc ? '4px solid #fff' : '4px solid transparent',
                      transition: 'border-color 0.15s',
                    }} />
                  ) : (
                    <div style={{
                      width: 130, height: 130, borderRadius: 26,
                      background: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 56, border: isFoc ? '4px solid #fff' : '4px solid transparent',
                      transition: 'border-color 0.15s',
                    }}>
                      {av.emoji}
                    </div>
                  )}
                  {p.is_kids && (
                    <div style={{ position: 'absolute', bottom: -6, right: -6, background: '#111', borderRadius: 14, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #141414' }}>
                      <span style={{ fontSize: 15 }}>👶</span>
                    </div>
                  )}
                  {editMode && (
                    <div style={{ position: 'absolute', top: -6, right: -6, background: ACCENT, borderRadius: 14, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 13, color: '#fff' }}>✎</span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: isFoc ? '#fff' : '#aaa', transition: 'color 0.15s' }}>
                  {p.name}
                </div>
              </div>
            );
          })}

          {/* Add Profile button */}
          {profiles.length < 5 && (
            <div
              onClick={() => setEditing({})}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: 'pointer', gap: 16,
                transform: focused === profiles.length ? 'scale(1.14)' : 'scale(1)',
                transition: 'transform 0.2s',
              }}
            >
              <div style={{
                width: 130, height: 130, borderRadius: 26,
                background: 'transparent',
                border: focused === profiles.length ? '4px solid #fff' : '4px dashed rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.15s',
              }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill={focused === profiles.length ? '#fff' : 'rgba(255,255,255,0.25)'}>
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: focused === profiles.length ? '#fff' : '#555', transition: 'color 0.15s' }}>
                Adicionar
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit profiles toggle */}
      <div
        onClick={() => setEditMode(m => !m)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 48,
          padding: '12px 20px', borderRadius: 24, cursor: 'pointer',
          border: '2px solid ' + (focused === editToggleIdx ? '#fff' : editMode ? ACCENT : '#333'),
          background: editMode ? ACCENT : 'transparent',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
          {editMode ? 'Concluir edição' : 'Editar perfis'}
        </span>
      </div>

      <div style={{ position: 'absolute', bottom: 20, color: '#333', fontSize: 12 }}>
        ← → navegar • ENTER selecionar • Voltar = {editMode ? 'sair da edição' : 'sair da conta'}
      </div>
    </div>
  );
}
