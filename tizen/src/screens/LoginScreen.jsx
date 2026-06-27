import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }  from '../contexts/AuthContext.jsx';
import { authAPI } from '../api/index.js';
import { KEY, useKeyDown } from '../hooks/useNav.js';

function Spinner({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size,
      border: '4px solid rgba(255,255,255,0.08)', borderTopColor: '#E50914',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  );
}

function CodeLogin({ onSuccess }) {
  const { loginWithToken } = useAuth();
  const [code,   setCode]   = useState('');
  const [status, setStatus] = useState('loading'); // 'loading'|'waiting'|'error'
  const codeRef     = useRef('');
  const pollRef     = useRef(null);

  useEffect(() => {
    requestCode();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
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
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (!codeRef.current) return;
      try {
        const { data } = await authAPI.tvCodeStatus(codeRef.current);
        if (data.status === 'authorized') {
          clearInterval(pollRef.current);
          loginWithToken(data.token, data.user);
          onSuccess();
        }
      } catch {}
    }, 3000);
  }

  const formatted = code ? code.replace(/(.{2})/g, '$1 ').trim() : '';

  if (status === 'loading') return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <Spinner />
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 16 }}>Gerando código…</div>
    </div>
  );

  if (status === 'error') return (
    <div style={{ textAlign: 'center', paddingTop: 24 }}>
      <p style={{ color: '#ff7070', fontSize: 14, marginBottom: 20 }}>Erro ao gerar código. Verifique a conexão.</p>
      <button
        onClick={requestCode}
        style={{ padding: '12px 28px', background: '#E50914', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
      >
        Tentar novamente
      </button>
    </div>
  );

  return (
    <div>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
        Código de acesso
      </p>

      <div style={{
        textAlign: 'center', fontSize: 42, fontWeight: 900, color: '#fff',
        letterSpacing: 10, background: 'rgba(229,9,20,0.10)',
        border: '2px solid rgba(229,9,20,0.28)', borderRadius: 12,
        padding: '14px 28px', marginBottom: 28,
      }}>
        {formatted}
      </div>

      <div style={{ marginBottom: 22 }}>
        {[
          'Abra o app FlixHome no celular',
          'Vá em Perfil → Autorizar TV',
          'Digite o código: ' + formatted,
        ].map(function(txt, i) {
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: '#E50914', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
              </div>
              <span style={{ color: '#bbb', fontSize: 14, lineHeight: 1.5 }}>{txt}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 18 }}>
        <Spinner size={18} />
        Aguardando aprovação no celular…
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={requestCode}
          style={{
            display: 'inline-block', padding: '10px 22px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 13,
          }}
        >
          Gerar novo código
        </button>
      </div>
    </div>
  );
}

export default function LoginScreen() {
  const navigate = useNavigate();

  useKeyDown(function(e) {
    if (e.keyCode === KEY.BACK || e.keyCode === KEY.BACKSPACE) e.preventDefault();
  }, []);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse at 30% 40%, #1a0606 0%, #141414 60%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 520, padding: '44px 48px',
        background: 'rgba(18,18,18,0.97)',
        borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#E50914', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>F</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>FLIXHOME</span>
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
          Entre no app FlixHome no celular e use o código abaixo para acessar a TV.
        </p>
        <CodeLogin onSuccess={function() { navigate('/', { replace: true }); }} />
      </div>
    </div>
  );
}
