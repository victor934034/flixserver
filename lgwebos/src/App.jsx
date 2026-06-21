import React, { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import LoginScreen         from './screens/LoginScreen.jsx';
import HomeScreen          from './screens/HomeScreen.jsx';
import DetailScreen        from './screens/DetailScreen.jsx';
import PlayerScreen        from './screens/PlayerScreen.jsx';
import SubscriptionScreen  from './screens/SubscriptionScreen.jsx';
import ProfileSelectScreen from './screens/ProfileSelectScreen.jsx';
import { castAPI } from './api/index.js';

function Guard({ children }) {
  const { user, loading, activeProfile, hasValidSubscription } = useAuth();
  if (loading) return <div style={{ background: '#141414', width: '100%', height: '100%' }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasValidSubscription()) return <Navigate to="/subscription" replace />;
  if (!activeProfile) return <Navigate to="/profile-select" replace />;
  return children;
}

function CastWatcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const lastUrl  = useRef(null);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(async () => {
      try {
        const { data } = await castAPI.get();
        if (data.hasContent && data.url !== lastUrl.current) {
          lastUrl.current = data.url;
          castAPI.clear().catch(() => {});
          const tracks = {};
          if (data.version) tracks[data.version] = data.url;
          else tracks.dubbing = data.url;
          const subtitles = data.subtitleUrl ? { pt: data.subtitleUrl } : {};
          navigate('/player', {
            state: { url: data.url, title: data.title || 'FlixHome', tracks, subtitles },
          });
        }
        if (!data.hasContent) lastUrl.current = null;
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [user]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div style={{ width: 1920, height: 1080, background: '#141414', overflow: 'hidden', position: 'relative', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
          <CastWatcher />
          <Routes>
            <Route path="/login"          element={<LoginScreen />} />
            <Route path="/subscription"   element={<SubscriptionGate />} />
            <Route path="/profile-select" element={<ProfileGate />} />
            <Route path="/"               element={<Guard><HomeScreen /></Guard>} />
            <Route path="/detail"         element={<Guard><DetailScreen /></Guard>} />
            <Route path="/player"         element={<Guard><PlayerScreen /></Guard>} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  );
}

// Rota /subscription — só acessível se logado mas sem assinatura válida
function SubscriptionGate() {
  const { user, loading, hasValidSubscription, activeProfile } = useAuth();
  if (loading) return <div style={{ background: '#141414', width: '100%', height: '100%' }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (hasValidSubscription()) {
    return activeProfile ? <Navigate to="/" replace /> : <Navigate to="/profile-select" replace />;
  }
  return <SubscriptionScreen />;
}

// Rota /profile-select — só acessível se logado e com assinatura válida
function ProfileGate() {
  const { user, loading, hasValidSubscription } = useAuth();
  if (loading) return <div style={{ background: '#141414', width: '100%', height: '100%' }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasValidSubscription()) return <Navigate to="/subscription" replace />;
  return <ProfileSelectScreen />;
}
