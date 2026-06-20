import React, { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import LoginScreen  from './screens/LoginScreen.jsx';
import HomeScreen   from './screens/HomeScreen.jsx';
import DetailScreen from './screens/DetailScreen.jsx';
import PlayerScreen from './screens/PlayerScreen.jsx';
import { castAPI } from './api/index.js';

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ background: '#141414', width: '100%', height: '100%' }} />;
  return user ? children : <Navigate to="/login" replace />;
}

// Polling do cast: quando o celular/web envia um vídeo, abre automaticamente
function CastWatcher() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const lastUrl   = useRef(null);

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
  }, [user]); // navigate é estável

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      {/* HashRouter — works on LG WebOS file:// and local-server URLs */}
      <HashRouter>
        <div style={{ width: 1920, height: 1080, background: '#141414', overflow: 'hidden', position: 'relative', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
          <CastWatcher />
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
