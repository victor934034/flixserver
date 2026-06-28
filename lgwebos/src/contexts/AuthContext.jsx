import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/index.js';
import api from '../api/index.js';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user,                setUser]                = useState(null);
  const [loading,             setLoading]             = useState(true);
  const [activeProfile,       setActiveProfileState]  = useState(null);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);

  useEffect(() => {
    const token   = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try { setUser(JSON.parse(userStr)); } catch {}

      // Refresh user from API to get up-to-date plan/subscription fields
      authAPI.me()
        .then(r => {
          if (r.data) {
            setUser(r.data);
            localStorage.setItem('user', JSON.stringify(r.data));
          }
        })
        .catch(() => {
          // If token is invalid, clear everything
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('profile');
          setUser(null);
          setActiveProfileState(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    const fetchSettings = () => {
      api.get('/api/settings').then(r => {
        setSubscriptionEnabled(r.data && r.data.subscription_enabled === 'true');
      }).catch(() => {});
    };
    fetchSettings();
    const iv = setInterval(fetchSettings, 30000);
    return () => clearInterval(iv);
  }, []);

  const hasValidSubscription = () => {
    if (!subscriptionEnabled) return true;
    if (!user) return false;
    // Accept any of these fields indicating active subscription
    if (user.is_admin) return true;
    if (user.plan && user.plan_expires_at) {
      return new Date(user.plan_expires_at).getTime() > Date.now();
    }
    // Some backends return subscription_active or active_until
    if (user.subscription_active) return true;
    if (user.active_until) {
      return new Date(user.active_until).getTime() > Date.now();
    }
    return false;
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
    if (profile) localStorage.setItem('profile', JSON.stringify(profile));
    else localStorage.removeItem('profile');
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
