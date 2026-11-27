import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchHomeBase, fetchHomeProfile, fetchCatalog, assembleHome, preloadImages, posterOf } from './lib/homeData.js';
import { AuthProvider, useAuth }    from './contexts/AuthContext.jsx';
import LoginScreen                  from './screens/LoginScreen.jsx';
import HomeScreen                   from './screens/HomeScreen.jsx';
import DetailScreen                 from './screens/DetailScreen.jsx';
import PlayerScreen                 from './screens/PlayerScreen.jsx';
import TogetherInvites from './components/TogetherInvites.jsx';
import WhatsNew, { VERSION as CHANGELOG_VERSION } from './components/WhatsNew.jsx';
import ArrivedNotice from './components/ArrivedNotice.jsx';
import TutorialHost from './components/Tutorial.jsx';
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
  const [params] = useSearchParams();
  if (loading) return <Blank />;
  if (!user) return <Navigate to="/login" replace />;
  // "Ver planos IPTV" abre /subscription?tab=iptv mesmo com plano ativo (antes voltava pra Home)
  if (hasValidSubscription() && params.get('tab') !== 'iptv') return activeProfile ? <Navigate to="/" replace /> : <Navigate to="/profile-select" replace />;
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
    // Tempo mínimo da abertura: 5 segundos
    const t = setTimeout(() => { minTimeDone.current = true; tryFinish(); }, 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Pre-fetch home data as soon as auth resolves
    if (authLoading) return;

    // Tudo que o app usa é carregado AQUI, antes de entrar: assim a navegação não espera rede
    const doFetch = async () => {
      try {
        if (user) {
          const profileId = activeProfile && activeProfile.id;
          const work = (async () => {
            const [base, prof, mov, ser] = await Promise.all([
              fetchHomeBase(),
              fetchHomeProfile(profileId, true),
              fetchCatalog('movies'),
              fetchCatalog('series'),
            ]);
            prefetchCache.homeBase = base;
            prefetchCache['profile:' + (profileId || '')] = prof;
            prefetchCache['catalog:movies'] = mov;
            prefetchCache['catalog:series'] = ser;
            const home = assembleHome(base, prof);
            // Banners (capa grande) primeiro: são os que mais demoram a aparecer
            const urls = [home.featured && home.featured.backdrop_url, mov.featured && mov.featured.backdrop_url, ser.featured && ser.featured.backdrop_url];
            home.sections.forEach(s => s.data.slice(0, 14).forEach(it => urls.push(posterOf(it))));
            mov.sections.forEach(s => s.data.slice(0, 32).forEach(it => urls.push(posterOf(it))));
            ser.sections.forEach(s => s.data.slice(0, 32).forEach(it => urls.push(posterOf(it))));
            await preloadImages(urls, 25000);
          })();
          // Limite: se a rede estiver muito ruim, entra mesmo assim depois de 40s
          await Promise.race([work, new Promise(r => setTimeout(r, 40000))]);
        }
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

  // Novidades só depois da abertura, pra não ficar atrás da tela de carregamento
  return <>{children}<TutorialHost version={CHANGELOG_VERSION}><WhatsNew /><ArrivedNotice /></TutorialHost></>;
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
              <TogetherInvites />
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
