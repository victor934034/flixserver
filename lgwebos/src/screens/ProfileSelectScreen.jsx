import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { KEY, useKeyDown } from '../hooks/useNav.js';
import api from '../api/index.js';

const AVATAR_COLORS = ['#E50914','#1db954','#0070f3','#ff9800','#9c27b0'];

function getAvatarStyle(avatar, size = 100) {
  if (!avatar || !avatar.startsWith('http')) {
    const emoji = avatar || '😊';
    const colorIndex = emoji.codePointAt(0) % AVATAR_COLORS.length;
    return { emoji, color: AVATAR_COLORS[colorIndex], isUrl: false };
  }
  return { url: avatar, isUrl: true };
}

export default function ProfileSelectScreen() {
  const { setActiveProfile, logout, user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focused, setFocused] = useState(0);

  useEffect(() => {
    api.get('/profiles')
      .then(r => setProfiles(r.data || []))
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, []);

  useKeyDown(e => {
    if (loading || profiles.length === 0) return;
    if (e.keyCode === KEY.LEFT) {
      e.preventDefault();
      setFocused(f => Math.max(0, f - 1));
    } else if (e.keyCode === KEY.RIGHT) {
      e.preventDefault();
      setFocused(f => Math.min(profiles.length - 1, f + 1));
    } else if (e.keyCode === KEY.ENTER) {
      e.preventDefault();
      handleSelect(profiles[focused]);
    } else if (e.keyCode === KEY.BACK) {
      e.preventDefault();
      logout();
    }
  }, [loading, profiles, focused]);

  function handleSelect(profile) {
    setActiveProfile(profile);
    navigate('/');
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#141414', color: '#fff',
    }}>
      <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Quem está assistindo?</div>
      <div style={{ fontSize: 15, color: '#888', marginBottom: 64 }}>Logado como {user?.email}</div>

      {loading ? (
        <div style={{ color: '#888', fontSize: 18 }}>Carregando perfis...</div>
      ) : profiles.length === 0 ? (
        <div style={{ color: '#888', fontSize: 18 }}>Nenhum perfil encontrado.</div>
      ) : (
        <div style={{ display: 'flex', gap: 48, justifyContent: 'center' }}>
          {profiles.map((profile, idx) => {
            const av = getAvatarStyle(profile.avatar);
            const isFocused = focused === idx;
            return (
              <div
                key={profile.id}
                onClick={() => { setFocused(idx); handleSelect(profile); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: 'pointer', gap: 16,
                  transform: isFocused ? 'scale(1.12)' : 'scale(1)',
                  transition: 'transform 0.2s',
                }}>
                {av.isUrl ? (
                  <img
                    src={av.url}
                    alt={profile.name}
                    style={{
                      width: 120, height: 120, borderRadius: 12, objectFit: 'cover',
                      border: isFocused ? '4px solid #fff' : '4px solid transparent',
                    }}
                  />
                ) : (
                  <div style={{
                    width: 120, height: 120, borderRadius: 12,
                    background: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 52,
                    border: isFocused ? '4px solid #fff' : '4px solid transparent',
                  }}>
                    {av.emoji}
                  </div>
                )}
                <div style={{
                  fontSize: 18, fontWeight: 600,
                  color: isFocused ? '#fff' : '#aaa',
                }}>
                  {profile.name}
                </div>
                {profile.is_kids && (
                  <div style={{ fontSize: 11, color: '#46d369', fontWeight: 700, letterSpacing: 1 }}>INFANTIL</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        onClick={logout}
        style={{
          position: 'absolute', bottom: 32,
          color: '#555', fontSize: 14, cursor: 'pointer',
        }}>
        Sair da conta
      </div>
    </div>
  );
}
