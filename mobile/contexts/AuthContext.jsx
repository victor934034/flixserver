import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem('token');
        const u = await AsyncStorage.getItem('user');
        if (t && u) {
          setToken(t);
          setUser(JSON.parse(u));
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email: email.trim().toLowerCase(), password });
    const { token: t, user: u } = res.data;
    await AsyncStorage.setItem('token', t);
    await AsyncStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const register = async (email, password, name) => {
    const res = await api.post('/auth/register', { email: email.trim().toLowerCase(), password, name });
    const { token: t, user: u } = res.data;
    await AsyncStorage.setItem('token', t);
    await AsyncStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const sendOTP = async (email) => {
    await api.post('/auth/send-otp', { email: email.trim().toLowerCase() });
  };

  const verifyOTP = async (email, code) => {
    const res = await api.post('/auth/verify-otp', {
      email: email.trim().toLowerCase(),
      code: String(code).trim(),
    });
    const { token: t, user: u } = res.data;
    await AsyncStorage.setItem('token', t);
    await AsyncStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const registerWithOTP = async (email, code, password, name) => {
    const res = await api.post('/auth/register-with-otp', {
      email: email.trim().toLowerCase(),
      code: String(code).trim(),
      password,
      name,
    });
    const { token: t, user: u } = res.data;
    await AsyncStorage.setItem('token', t);
    await AsyncStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      if (data?.id) {
        await AsyncStorage.setItem('user', JSON.stringify(data));
        setUser(data);
      }
    } catch {}
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, sendOTP, verifyOTP, registerWithOTP, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
