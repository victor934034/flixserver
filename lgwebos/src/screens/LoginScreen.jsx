import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { authAPI } from '../api/index.js';
import FocusItem from '../components/FocusItem.jsx';
import { KEY, useKeyDown } from '../hooks/useNav.js';

const INPUT = {
  width: '100%', padding: '14px 16px',
  background: 'rgba(255,255,255,0.06)',
  border: '2px solid rgba(255,255,255,0.12)',
  borderRadius: 10, color: '#fff', fontSize: 16,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

// ── Email/senha ───────────────────────────────────────────────────────────────
function EmailLogin({ onSuccess }) {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const emailRef    = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => { setTimeout(() => emailRef.current?.focus(), 150); }, []);

  useKeyDown(e => {
    if (e.keyCode === KEY.ENTER) {
      if (document.activeElement === emailRef.current) {
        e.preventDefault(); passwordRef.current?.focus();
      }
    }
    if (e.keyCode === KEY.BACK || e.keyCode === KEY.BACKSPACE) e.preventDefault();
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password) { setError('Preencha e-mail e senha'); return; }
    setLoading(true); setError('');
    try {
      await login(email.trim(), password);
      onSuccess();
    } catch {
      setError('E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>E-mail</label>
      <input
        ref={emailRef}
        type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="seu@email.com" autoComplete="off"
        style={{ ...INPUT, marginBottom: 20 }}
        onFocus={e => { e.target.style.borderColor = '#fff'; }}
        onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
      />

      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Senha</label>
      <input
        ref={passwordRef}
        type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="••••••••" autoComplete="off"
        style={{ ...INPUT, marginBottom: 28 }}
        onFocus={e => { e.target.style.borderColor = '#fff'; }}
        onBlur={e  => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
      />

      {!!error && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(229,9,20,0.12)', border: '1px solid rgba(229,9,20,0.4)', borderRadius: 8 }}>
          <span style={{ color: '#ff7070', fontSize: 13 }}>{error}</span>
        </div>
      )}

      <FocusItem
        onEnterPress={handleLogin}
        onClick={handleLogin}
        style={{
          width: '100%', padding: '17px 0',
          background: loading ? 'rgba(229,9,20,0.55)' : '#E50914',
          borderRadius: 11, border: '2px solid transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'none', boxSizing: 'border-box',
        }}
        focusedStyle={{ borderColor: '#fff', transform: 'scale(1.02)' }}
      >
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
          {loading ? 'Entrando…' : 'Entrar'}
        </span>
      </FocusItem>
    </div>
  );
}

// ── Login por código ──────────────────────────────────────────────────────────
function CodeLogin({ onSuccess }) {
  const { loginWithToken } = useAuth();
  const [code,   setCode]   = useState('');
  const [status, setStatus] = useState('loading');
  const codeRef     = useRef('');
  const intervalRef = useRef(null);

  useEffect(() => {
    requestCode();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  async function requestCode() {
    setStatus('loading');
    try {
      const { data } = await authAPI.tvCode();
      codeRef.current = data.code;
      setCode(data.code);
      setStatus('waiting');
      startPolling();
    } catch {
      setStatus('error');
    }
  }

  function startPolling() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      if (!codeRef.current) return;
      try {
        const { data } = await authAPI.tvCodeStatus(codeRef.current);
        if (data.status === 'authorized') {
          clearInterval(intervalRef.current);
          loginWithToken(data.token, data.user);
          onSuccess();
        }
      } catch {}
    }, 3000);
  }

  // Format: "AB1C2D" → "AB 1C 2D"
  const formatted = code ? code.replace(/(.{2})/g, '$1 ').trim() : '';

  if (status === 'loading') return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{
        width: 36, height: 36,
        border: '4px solid rgba(255,255,255,0.08)', borderTopColor: '#E50914',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        margin: '0 auto 16px',
      }} />
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Gerando código…</span>
    </div>
  );

  if (status === 'error') return (
    <div style={{ textAlign: 'center', paddingTop: 24 }}>
      <p style={{ color: '#ff7070', fontSize: 14, marginBottom: 20 }}>Erro ao gerar código</p>
      <FocusItem
        onEnterPress={requestCode} onClick={requestCode}
        style={{ display: 'inline-block', padding: '12px 28px', background: '#E50914', borderRadius: 8, border: '2px solid transparent', cursor: 'none' }}
        focusedStyle={{ borderColor: '#fff' }}
      >
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Tentar novamente</span>
      </FocusItem>
    </div>
  );

  return (
    <div>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
        Código de acesso
      </p>

      {/* Big code display */}
      <div style={{
        textAlign: 'center', fontSize: 42, fontWeight: 900, color: '#fff',
        letterSpacing: 10, background: 'rgba(229,9,20,0.10)',
        border: '2px solid rgba(229,9,20,0.28)', borderRadius: 12,
        padding: '14px 28px', marginBottom: 28,
      }}>
        {formatted}
      </div>

      {/* Steps */}
      <div style={{ marginBottom: 22 }}>
        {[
          'Abra o app FlixHome no celular',
          'Vá em Configurações → Conectar TV',
          `Digite o código: ${formatted}`,
        ].map((txt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 11, background: '#E50914', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
            }}>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
            </div>
            <span style={{ color: '#bbb', fontSize: 14, lineHeight: 1.5 }}>{txt}</span>
          </div>
        ))}
      </div>

      {/* Waiting indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 18 }}>
        <div style={{
          width: 18, height: 18,
          border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#E50914',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        Aguardando aprovação no celular…
      </div>

      <div style={{ textAlign: 'center' }}>
        <FocusItem
          onEnterPress={requestCode} onClick={requestCode}
          style={{
            display: 'inline-block', padding: '10px 22px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
            cursor: 'none',
          }}
          focusedStyle={{ borderColor: '#fff' }}
        >
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Gerar novo código</span>
        </FocusItem>
      </div>
    </div>
  );
}

// ── LoginScreen ───────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('email');

  function onSuccess() { navigate('/', { replace: true }); }

  useKeyDown(e => {
    if (e.keyCode === KEY.BACK || e.keyCode === KEY.BACKSPACE) e.preventDefault();
  }, []);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse at 30% 40%, #1a0606 0%, #141414 60%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        width: 520, padding: '44px 48px',
        background: 'rgba(18,18,18,0.97)',
        borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#E50914', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>F</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>FLIXHOME</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { id: 'email', label: 'E-mail e senha' },
            { id: 'code',  label: 'Código via celular' },
          ].map(t => (
            <FocusItem
              key={t.id}
              onEnterPress={() => setTab(t.id)}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '11px 0', background: 'none', cursor: 'none',
                border: 'none', borderBottom: `3px solid ${tab === t.id ? '#E50914' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: -1,
              }}
              focusedStyle={{ borderBottom: '3px solid rgba(229,9,20,0.5)', transform: 'none', border: 'none' }}
            >
              <span style={{
                fontSize: 14, fontWeight: tab === t.id ? 800 : 600,
                color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.4)',
                letterSpacing: 0.3,
              }}>
                {t.label}
              </span>
            </FocusItem>
          ))}
        </div>

        {tab === 'email'
          ? <EmailLogin onSuccess={onSuccess} />
          : <CodeLogin  onSuccess={onSuccess} />
        }
      </div>
    </div>
  );
}
