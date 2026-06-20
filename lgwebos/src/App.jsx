import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import LoginScreen  from './screens/LoginScreen.jsx';
import HomeScreen   from './screens/HomeScreen.jsx';
import DetailScreen from './screens/DetailScreen.jsx';
import PlayerScreen from './screens/PlayerScreen.jsx';

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ background: '#141414', width: '100%', height: '100%' }} />;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      {/* HashRouter — works on LG WebOS file:// and local-server URLs */}
      <HashRouter>
        <div style={{ width: 1920, height: 1080, background: '#141414', overflow: 'hidden', position: 'relative', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
          <Routes>
            <Route path="/login"  element={<LoginScreen />} />
            <Route path="/"       element={<Guard><HomeScreen /></Guard>} />
            <Route path="/detail" element={<Guard><DetailScreen /></Guard>} />
            <Route path="/player" element={<Guard><PlayerScreen /></Guard>} />
            <Route path="*"       element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  );
}
