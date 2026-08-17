'use client';
import { createContext, useContext, useState, useCallback } from 'react';

const ProfileContext = createContext(null);

export const AVATARS = [
  { id: 'avatar_1',  emoji: '😎', color: '#E50914' },
  { id: 'avatar_2',  emoji: '🎬', color: '#1565C0' },
  { id: 'avatar_3',  emoji: '🎭', color: '#6A0DAD' },
  { id: 'avatar_4',  emoji: '🦁', color: '#E65100' },
  { id: 'avatar_5',  emoji: '🐉', color: '#1B5E20' },
  { id: 'avatar_6',  emoji: '🚀', color: '#0D47A1' },
  { id: 'avatar_7',  emoji: '🎮', color: '#880E4F' },
  { id: 'avatar_8',  emoji: '🌙', color: '#37474F' },
  { id: 'avatar_9',  emoji: '⚡', color: '#F9A825' },
  { id: 'avatar_10', emoji: '🐱', color: '#00695C' },
  { id: 'avatar_11', emoji: '🎵', color: '#4A148C' },
  { id: 'avatar_12', emoji: '🌊', color: '#006064' },
  { id: 'avatar_13', emoji: '🔥', color: '#BF360C' },
  { id: 'avatar_14', emoji: '🌸', color: '#AD1457' },
  { id: 'avatar_15', emoji: '🤖', color: '#263238' },
];

export function getAvatar(id) {
  return AVATARS.find(a => a.id === id) || AVATARS[0];
}

const STORAGE_KEY = 'flixhome_active_profile';

export function useProfile() {
  return useContext(ProfileContext);
}

export function ProfileProvider({ children }) {
  const [activeProfile, setActiveProfileState] = useState(null);

  const selectProfile = useCallback((profile) => {
    setActiveProfileState(profile);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    }
  }, []);

  const loadSavedProfile = useCallback((profiles) => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        const still = profiles.find(pr => pr.id === p.id);
        if (still) { setActiveProfileState(still); return still; }
      }
    } catch {}
    return null;
  }, []);

  const clearProfile = useCallback(() => {
    setActiveProfileState(null);
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ProfileContext.Provider value={{ activeProfile, selectProfile, loadSavedProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
