import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { authAPI } from '../api/index.js';
import { BASE_URL } from '../api/index.js';
import { KEY, useKeyDown } from '../hooks/useNav.js';

function Spinner({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size, border: '4px solid rgba(255,255,255,0.08)', borderTopColor: '#E50914',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  );
}

const fmtTime = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

// Login por celular (design TV): passos + código em caixas + aviso de spam + QR
export default function LoginScreen() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('loading'); // loading | waiting | error
  const [left, setLeft] = useState(600);
  const [focus, setFocus] = useState(0); // 0 gerar novo código, 1 ajuda
  const codeRef = useRef('');
  const pollRef = useRef(null);
  const st = useRef({});
  st.current = { focus };

  async function requestCode() {
    setStatus('loading');
    try {
      const { data } = await authAPI.tvCode();
      codeRef.current = data.code;
      setCode(data.code);
      setLeft(600);
      setStatus('waiting');
      startPolling();
    } catch (e) { setStatus('error'); }
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
          navigate('/', { replace: true });
        }
      } catch (e) {}
    }, 3000);
  }
  useEffect(() => { requestCode(); return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);
  useEffect(() => {
    const t = setInterval(() => setLeft(l => { if (l <= 1) { return 0; } return l - 1; }), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (left === 0 && status === 'waiting') requestCode(); }, [left]);

  useKeyDown(function (e) {
    const k = e.keyCode;
    if (k === KEY.BACK || k === KEY.BACKSPACE) { e.preventDefault(); return; }
    if (k === KEY.RIGHT || k === KEY.DOWN) { e.preventDefault(); setFocus(1); }
    else if (k === KEY.LEFT || k === KEY.UP) { e.preventDefault(); setFocus(0); }
    else if (k === KEY.ENTER) { e.preventDefault(); if (st.current.focus === 0) requestCode(); }
  }, []);

  const qr = code ? ((BASE_URL || '') + '/api/payments/qr?text=' + encodeURIComponent((BASE_URL || '') + '/autorizar-tv?code=' + code)) : '';
  const site = (BASE_URL || '').replace(/^https?:\/\//, '');
  const steps = [
    ['Escaneie o QR code ou acesse ', site ? site + '/autorizar-tv' : 'o site FlixHome'],
    ['Entre com seu e-mail e o código que enviamos', ''],
    ['Confirme o código da TV abaixo', ''],
  ];
  const btn = (i) => ({
    padding: '18px 34px', borderRadius: 12, fontSize: 26, fontWeight: 800, color: '#fff', background: '#1F1F1F',
    border: '3px solid ' + (focus === i ? '#fff' : '#2A2A2A'), transform: focus === i ? 'scale(1.06)' : 'none', transition: 'transform 0.2s',
  });

  return (
    <div style={{
      width: '100%', height: '100%', boxSizing: 'border-box', padding: '70px 90px', color: '#E5E5E5',
      background: 'radial-gradient(ellipse at 85% 45%, rgba(229,9,20,0.16) 0%, #0A0A0A 55%)',
      display: 'flex', gap: 60,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#E50914', letterSpacing: 10, marginBottom: 40 }}>FLIXHOME</div>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -1, marginBottom: 30 }}>Entre com o celular</div>
        {steps.map(function (s, i) {
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16, fontSize: 28, color: '#CFCFCF' }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: '#2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, flexShrink: 0 }}>{i + 1}</div>
              <span>{s[0]}{s[1] && <b style={{ color: '#fff' }}>{s[1]}</b>}</span>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: 14, margin: '26px 0' }}>
          {status === 'loading' ? <Spinner /> : (code || '------').split('').map(function (c, i) {
            return <div key={i} style={{ width: 88, height: 96, borderRadius: 14, background: '#1F1F1F', border: '1px solid #2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 900 }}>{c}</div>;
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '22px 26px', borderRadius: 16, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)', fontSize: 26, color: '#FDE68A', marginBottom: 34, maxWidth: 900 }}>
          <span style={{ fontSize: 30 }}>✉</span>
          <span>O código do e-mail não chegou? Olhe também a caixa de <b style={{ color: '#FBBF24' }}>spam / lixo eletrônico</b> no celular.</span>
        </div>

        {status === 'error' && <div style={{ color: '#F87171', fontSize: 24, marginBottom: 16 }}>Erro ao gerar código. Verifique a conexão.</div>}
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={btn(0)} onClick={requestCode}>Gerar novo código</div>
          <div style={btn(1)}>Ajuda</div>
        </div>
      </div>

      <div style={{ width: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 400, height: 400, borderRadius: 24, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {qr ? <img src={qr} alt="QR code" style={{ width: 380, height: 380 }} /> : <Spinner />}
        </div>
        <div style={{ marginTop: 24, fontSize: 24, color: '#A3A3A3' }}>Código expira em <b style={{ color: '#fff' }}>{fmtTime(left)}</b></div>
      </div>
    </div>
  );
}
