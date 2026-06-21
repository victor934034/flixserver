import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/index.js';
import api from '../api/index.js';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeProfile, setActiveProfileState] = useState(null);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      const profileStr = localStorage.getItem('profile');
      if (token && userStr) {
        setUser(JSON.parse(userStr));
      }
      if (profileStr) {
        setActiveProfileState(JSON.parse(profileStr));
      }
    } catch {
      // ignore parse errors
    } finally {
      setLoading(false);
    }

    // Check if subscription system is enabled
    api.get('/settings').then(r => {
      setSubscriptionEnabled(r.data?.subscription_enabled === 'true');
    }).catch(() => {});
  }, []);

  const hasValidSubscription = () => {
    if (!subscriptionEnabled) return true;
    if (!user?.plan || !user?.plan_expires_at) return false;
    return new Date(user.plan_expires_at).getTime() > Date.now();
  };

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    const { token, user: u } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    setActiveProfileState(null);
    localStorage.removeItem('profile');
  };

  const loginWithToken = (token, u) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    setActiveProfileState(null);
    localStorage.removeItem('profile');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('profile');
    setUser(null);
    setActiveProfileState(null);
  };

  const setActiveProfile = (profile) => {
    setActiveProfileState(profile);
    if (profile) {
      localStorage.setItem('profile', JSON.stringify(profile));
    } else {
      localStorage.removeItem('profile');
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, loginWithToken, logout,
      activeProfile, setActiveProfile,
      subscriptionEnabled, hasValidSubscription,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
