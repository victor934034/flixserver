import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { KEY, useKeyDown } from '../hooks/useNav.js';
import api from '../api/index.js';

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

function avatarStyle(avatar) {
  if (avatar && avatar.startsWith('http')) return { isUrl: true, url: avatar };
  if (avatar && AVATAR_MAP[avatar]) return { isUrl: false, ...AVATAR_MAP[avatar] };
  return { isUrl: false, emoji: '😊', color: '#E50914' };
}

export default function ProfileSelectScreen() {
  const { setActiveProfile, logout, user } = useAuth();
  const navigate  = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [focused,  setFocused]  = useState(0);

  useEffect(() => {
    api.get('/api/profiles')
      .then(r => setProfiles(r.data || []))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, []);

  useKeyDown(e => {
    if (loading) return;
    if (e.keyCode === KEY.LEFT) {
      e.preventDefault();
      setFocused(f => Math.max(0, f - 1));
    } else if (e.keyCode === KEY.RIGHT) {
      e.preventDefault();
      setFocused(f => Math.min(profiles.length - 1, f + 1));
    } else if (e.keyCode === KEY.ENTER) {
      e.preventDefault();
      if (profiles[focused]) select(profiles[focused]);
    } else if (e.keyCode === KEY.BACK) {
      e.preventDefault();
      logout();
      navigate('/login', { replace: true });
    }
  }, [loading, profiles, focused]);

  function select(p) {
    setActiveProfile(p);
    navigate('/');
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#141414',
    }}>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Quem está assistindo?</div>
      <div style={{ fontSize: 15, color: '#666', marginBottom: 72 }}>
        {user && user.email}
      </div>

      {loading ? (
        <div style={{ color: '#888', fontSize: 18 }}>Carregando perfis…</div>
      ) : profiles.length === 0 ? (
        <div style={{ color: '#888', fontSize: 18 }}>Nenhum perfil encontrado.</div>
      ) : (
        <div style={{ display: 'flex', gap: 56, justifyContent: 'center' }}>
          {profiles.map((p, i) => {
            const av  = avatarStyle(p.avatar);
            const isFoc = focused === i;
            return (
              <div
                key={p.id}
                onClick={() => { setFocused(i); select(p); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: 'none', gap: 16,
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
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 40, color: '#444', fontSize: 13 }}>
        Pressione Voltar para sair da conta
      </div>
    </div>
  );
}
