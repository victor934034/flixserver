import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth }    from './contexts/AuthContext.jsx';
import LoginScreen                  from './screens/LoginScreen.jsx';
import HomeScreen                   from './screens/HomeScreen.jsx';
import DetailScreen                 from './screens/DetailScreen.jsx';
import PlayerScreen                 from './screens/PlayerScreen.jsx';
import SubscriptionScreen           from './screens/SubscriptionScreen.jsx';
import ProfileSelectScreen          from './screens/ProfileSelectScreen.jsx';
import SplashScreen                 from './screens/SplashScreen.jsx';
import { castAPI, moviesAPI, seriesAPI } from './api/index.js';
import api from './api/index.js';
import IptvScreen         from './screens/IptvScreen.jsx';
import IptvChannelsScreen from './screens/IptvChannelsScreen.jsx';
import IptvPlayerScreen   from './screens/IptvPlayerScreen.jsx';

// Shared pre-fetch cache — HomeScreen reads from here on first load
export const prefetchCache = {};

// ── Error boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, msg: '' };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, msg: err && err.message ? err.message : String(err) };
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ width: '100%', height: '100%', background: '#141414', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{ fontSize: 64, color: '#E50914' }}>!</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Algo deu errado</div>
        <div style={{ fontSize: 14, color: '#666', maxWidth: 600, textAlign: 'center' }}>{this.state.msg}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 24, padding: '14px 40px', background: '#E50914', border: 'none', borderRadius: 10, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          Recarregar
        </button>
      </div>
    );
  }
}

// ── Route guards ──────────────────────────────────────────────────────────────
function Guard({ children }) {
  const { user, loading, activeProfile, hasValidSubscription } = useAuth();
  if (loading) return <Blank />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasValidSubscription()) return <Navigate to="/subscription" replace />;
  if (!activeProfile) return <Navigate to="/profile-select" replace />;
  return children;
}

function SubscriptionGate() {
  const { user, loading, hasValidSubscription, activeProfile } = useAuth();
  if (loading) return <Blank />;
  if (!user) return <Navigate to="/login" replace />;
  if (hasValidSubscription()) return activeProfile ? <Navigate to="/" replace /> : <Navigate to="/profile-select" replace />;
  return <SubscriptionScreen />;
}

function ProfileGate() {
  const { user, loading, hasValidSubscription } = useAuth();
  if (loading) return <Blank />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasValidSubscription()) return <Navigate to="/subscription" replace />;
  return <ProfileSelectScreen />;
}

function Blank() {
  return <div style={{ width: '100%', height: '100%', background: '#141414' }} />;
}

// ── Cast watcher ──────────────────────────────────────────────────────────────
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
          navigate('/player', { state: { url: data.url, title: data.title || 'FlixHome', tracks, subtitles: {} } });
        }
        if (!data.hasContent) lastUrl.current = null;
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [user]);

  return null;
}

// ── Splash + prefetch orchestrator ────────────────────────────────────────────
function SplashOrchestrator({ children }) {
  const { user, loading: authLoading, activeProfile } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const prefetchDone = useRef(false);
  const minTimeDone  = useRef(false);

  function tryFinish() {
    if (prefetchDone.current && minTimeDone.current && window.__splashFinish) {
      window.__splashFinish();
    }
  }

  useEffect(() => {
    // Minimum splash time: 2 seconds
    const t = setTimeout(() => { minTimeDone.current = true; tryFinish(); }, 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Pre-fetch home data as soon as auth resolves
    if (authLoading) return;

    const doFetch = async () => {
      try {
        const profileId = activeProfile && activeProfile.id;

        const [pm, nm, ps, ns, hist] = await Promise.allSettled([
          moviesAPI.popular().then(r => r.data || []),
          moviesAPI.newReleases().then(r => r.data || []),
          seriesAPI.popular().then(r => r.data || []),
          seriesAPI.newReleases().then(r => r.data || []),
          user
            ? api.get('/api/history' + (profileId ? '?profile_id=' + profileId : '')).then(r => r.data || []).catch(() => [])
            : Promise.resolve([]),
        ]);

        const val  = r => r.status === 'fulfilled' ? r.value : [];
        const seen = new Set();
        const dedup = arr => arr.filter(it => {
          if (seen.has(it.id)) return false; seen.add(it.id); return true;
        }).slice(0, 18);

        const history = val(hist).filter(h => h.progress > 0 && h.duration > 0 && !h.completed).slice(0, 12);
        const pm_ = dedup(val(pm));
        const nm_ = dedup(val(nm));
        const ps_ = dedup(val(ps));
        const ns_ = dedup(val(ns));

        const homeSections = [
          history.length > 0 ? { key: 'history', title: 'Continue Assistindo', data: history } : null,
          { key: 'pm', title: 'Filmes em Alta',  data: pm_ },
          { key: 'ps', title: 'Séries em Alta',  data: ps_ },
          { key: 'nm', title: 'Filmes Novos',    data: nm_ },
          { key: 'ns', title: 'Séries Novas',    data: ns_ },
        ].filter(Boolean).filter(s => s.data.length > 0);

        prefetchCache['home']   = { featured: pm_[0] || ps_[0] || null, sections: homeSections };
        prefetchCache['movies'] = {
          featured: pm_[0] || null,
          sections: [
            { key: 'pm', title: 'Mais Assistidos', data: pm_ },
            { key: 'nm', title: 'Novidades',        data: nm_ },
          ].filter(s => s.data.length > 0),
        };
        prefetchCache['series'] = {
          featured: ps_[0] || null,
          sections: [
            { key: 'ps', title: 'Mais Assistidas', data: ps_ },
            { key: 'ns', title: 'Novidades',        data: ns_ },
          ].filter(s => s.data.length > 0),
        };
      } catch {}

      prefetchDone.current = true;
      tryFinish();
    };

    doFetch();
  }, [authLoading, user, activeProfile]);

  if (!splashDone) {
    return (
      <>
        <SplashScreen onReady={() => setSplashDone(true)} />
        {/* Render app underneath (invisible) so React tree is ready */}
        <div style={{ visibility: 'hidden', position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {children}
        </div>
      </>
    );
  }

  return children;
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <div style={{ width: 1920, height: 1080, background: '#0a0a0a', overflow: 'hidden', position: 'relative', fontFamily: "'Outfit', system-ui, -apple-system, sans-serif" }}>
            <SplashOrchestrator>
              <CastWatcher />
              <Routes>
                <Route path="/login"          element={<LoginScreen />} />
                <Route path="/subscription"   element={<SubscriptionGate />} />
                <Route path="/profile-select" element={<ProfileGate />} />
                <Route path="/"               element={<Guard><HomeScreen /></Guard>} />
                <Route path="/detail"         element={<Guard><DetailScreen /></Guard>} />
                <Route path="/player"         element={<Guard><PlayerScreen /></Guard>} />
                <Route path="/iptv"           element={<Guard><IptvScreen /></Guard>} />
                <Route path="/iptv-channels"  element={<Guard><IptvChannelsScreen /></Guard>} />
                <Route path="/iptv-player"    element={<Guard><IptvPlayerScreen /></Guard>} />
                <Route path="*"               element={<Navigate to="/" replace />} />
              </Routes>
            </SplashOrchestrator>
          </div>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
