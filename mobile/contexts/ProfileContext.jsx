import { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export function useProfile() {
  return useContext(ProfileContext);
}

export function ProfileProvider({ children }) {
  const [activeProfile, setActiveProfile] = useState(null);

  const selectProfile = useCallback(async (profile) => {
    setActiveProfile(profile);
    await AsyncStorage.setItem('active_profile', JSON.stringify(profile));
  }, []);

  const loadSavedProfile = useCallback(async (profiles) => {
    try {
      const saved = await AsyncStorage.getItem('active_profile');
      if (saved) {
        const p = JSON.parse(saved);
        const still = profiles.find(pr => pr.id === p.id);
        if (still) { setActiveProfile(still); return still; }
      }
    } catch {}
    return null;
  }, []);

  const clearProfile = useCallback(async () => {
    setActiveProfile(null);
    await AsyncStorage.removeItem('active_profile');
  }, []);

  return (
    <ProfileContext.Provider value={{ activeProfile, selectProfile, loadSavedProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
