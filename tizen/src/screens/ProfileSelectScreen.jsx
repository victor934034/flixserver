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

// ── Create Profile Modal ──────────────────────────────────────────────────────
function CreateProfileModal({ onCreated, onCancel }) {
  const [name,      setName]      = useState('');
  const [avatarIdx, setAvatarIdx] = useState(0);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [field,     setField]     = useState('name'); // 'name'|'avatar'|'save'|'cancel'
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current && inputRef.current.focus(), 100);
  }, []);

  useKeyDown(e => {
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
      if (k === KEY.DOWN)  { e.preventDefault(); setField('save'); }
      if (k === KEY.ENTER) { e.preventDefault(); setField('save'); }
      return;
    }
    if (field === 'save') {
      if (k === KEY.UP)    { e.preventDefault(); setField('avatar'); }
      if (k === KEY.RIGHT) { e.preventDefault(); setField('cancel'); }
      if (k === KEY.ENTER) { e.preventDefault(); handleSave(); }
      return;
    }
    if (field === 'cancel') {
      if (k === KEY.UP)   { e.preventDefault(); setField('avatar'); }
      if (k === KEY.LEFT) { e.preventDefault(); setField('save'); }
      if (k === KEY.ENTER){ e.preventDefault(); onCancel(); }
    }
  }, [field, avatarIdx, name]);

  async function handleSave() {
    if (!name.trim()) { setError('Digite um nome'); return; }
    setSaving(true); setError('');
    try {
      const av = AVATAR_KEYS[avatarIdx];
      const { data } = await api.post('/api/profiles', { name: name.trim(), avatar: av });
      onCreated(data);
    } catch(e) {
      setError(e.response?.data?.error || 'Erro ao criar perfil');
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
          Criar Perfil
        </div>

        {/* Name field */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Nome</div>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome do perfil"
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
        <div style={{ marginBottom: 40 }}>
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

        {error && (
          <div style={{ color: '#ff6b6b', fontSize: 14, marginBottom: 20 }}>{error}</div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: '16px 0', borderRadius: 10, border: 'none',
              background: field === 'save' ? '#fff' : ACCENT,
              color: field === 'save' ? '#0a0a0a' : '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              outline: field === 'save' ? '3px solid rgba(255,255,255,0.5)' : 'none',
              outlineOffset: '2px',
              transition: 'all 0.15s',
            }}
          >
            {saving ? 'Salvando…' : 'Criar Perfil'}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '16px 28px', borderRadius: 10,
              background: 'transparent',
              border: '2px solid ' + (field === 'cancel' ? '#fff' : 'rgba(255,255,255,0.2)'),
              color: field === 'cancel' ? '#fff' : '#666',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
              outline: field === 'cancel' ? '3px solid rgba(255,255,255,0.5)' : 'none',
              outlineOffset: '2px',
              transition: 'all 0.15s',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfileSelectScreen() {
  const { setActiveProfile, logout, user } = useAuth();
  const navigate  = useNavigate();
  const [profiles,   setProfiles]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [focused,    setFocused]    = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  function loadProfiles() {
    setLoading(true);
    api.get('/api/profiles')
      .then(r => setProfiles(r.data || []))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadProfiles(); }, []);

  // total focusable: profiles + "add" button
  const totalItems = profiles.length + 1;

  useKeyDown(e => {
    if (loading || showCreate) return;
    if (e.keyCode === KEY.LEFT) {
      e.preventDefault();
      setFocused(f => Math.max(0, f - 1));
    } else if (e.keyCode === KEY.RIGHT) {
      e.preventDefault();
      setFocused(f => Math.min(totalItems - 1, f + 1));
    } else if (e.keyCode === KEY.ENTER) {
      e.preventDefault();
      if (focused < profiles.length) {
        if (profiles[focused]) select(profiles[focused]);
      } else {
        setShowCreate(true);
      }
    } else if (e.keyCode === KEY.BACK) {
      e.preventDefault();
      logout();
      navigate('/login', { replace: true });
    }
  }, [loading, profiles, focused, totalItems, showCreate]);

  function select(p) {
    setActiveProfile(p);
    navigate('/');
  }

  function handleCreated(profile) {
    setShowCreate(false);
    setProfiles(prev => [...prev, profile]);
    setFocused(profiles.length);
    select(profile);
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#141414',
    }}>
      {showCreate && (
        <CreateProfileModal
          onCreated={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Quem está assistindo?</div>
      <div style={{ fontSize: 15, color: '#666', marginBottom: 72 }}>
        {user && user.email}
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
                  cursor: 'pointer', gap: 16,
                  transform: isFoc ? 'scale(1.14)' : 'scale(1)',
                  transition: 'transform 0.2s',
                }}
              >
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
                <div style={{ fontSize: 18, fontWeight: 600, color: isFoc ? '#fff' : '#aaa', transition: 'color 0.15s' }}>
                  {p.name}
                </div>
                {p.is_kids && (
                  <div style={{ fontSize: 11, color: '#46d369', fontWeight: 700, letterSpacing: 1 }}>INFANTIL</div>
                )}
              </div>
            );
          })}

          {/* Add Profile button */}
          {profiles.length < 5 && (
            <div
              onClick={() => setShowCreate(true)}
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

      <div style={{ position: 'absolute', bottom: 40, color: '#444', fontSize: 13 }}>
        ← → navegar • ENTER selecionar • Voltar = sair da conta
      </div>
    </div>
  );
}
