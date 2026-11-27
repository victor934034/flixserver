import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { KEY } from '../hooks/useNav.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api/index.js';
import { STEPS, SCENES, SCENE_CSS } from '../lib/tutorialData.js';
import { OPEN_EVENT, SURPRISE_EVENT, HOME_EVENT } from '../lib/tutorial.js';

// Passo a passo para novos usuários, na versão de TV do design (1920×1080, só controle).
// Atenção: TVs antigas (Chrome 68) não têm `gap` em flexbox nem `inset`.

const LAST = STEPS.length - 1;
const SEEN_KEY = 'lastSeenChangelogVersion';

const CSS = `
.fht{position:absolute;top:0;left:0;width:1920px;height:1080px;z-index:9995;overflow:hidden;background:#0A0A0A;color:#E5E5E5;font-family:Inter,'Outfit',system-ui,sans-serif;text-align:left}
.fht *{box-sizing:border-box;margin:0;padding:0}
.fht .top{position:absolute;left:96px;right:96px;top:54px;height:72px;display:flex;align-items:center}
.fht .logo{flex:1;font-size:32px;font-weight:900;letter-spacing:.08em;color:#E50914}
.fht .mid{width:640px;margin:0 32px;display:flex;flex-direction:column;align-items:center}
.fht .count{font-size:26px;font-weight:700;color:#888;line-height:32px;margin-bottom:12px}
.fht .segs{display:flex;width:100%}
.fht .segs>div{flex:1;height:6px;border-radius:999px;background:#2A2A2A;overflow:hidden;margin-left:6px}
.fht .segs>div:first-child{margin-left:0}
.fht .segs i{display:block;height:100%;background:#E50914;transform-origin:left center;transition:transform 300ms cubic-bezier(.2,.8,.2,1)}
.fht .end{flex:1;display:flex;justify-content:flex-end}
.fht .tb,.fht-toast .tb{height:80px;padding:0 40px;border-radius:16px;border:3px solid transparent;background:#1F1F1F;color:#E5E5E5;font-family:inherit;font-size:28px;font-weight:800;transition:transform 200ms ease-out;cursor:pointer}
.fht .tb.pri{background:#E50914;color:#fff}
.fht .tb.focus,.fht-toast .tb.focus{border-color:#fff;transform:scale(1.06)}
.fht .tb.focus:not(.pri),.fht-toast .tb.focus{background:#E5E5E5;color:#0A0A0A}
.fht .tb.skip{height:72px;padding:0 32px;border-radius:999px;font-size:26px}
.fht .step{position:absolute;left:96px;right:96px;top:150px;bottom:126px;display:flex;align-items:center}
.fht .art{flex:0 0 auto;margin-right:96px}
.fht .stage{width:312px;height:280px;position:relative;overflow:hidden;border-radius:16px;background:#141414;zoom:2.1;font-size:16px;line-height:normal}
.fht .col{flex:1;min-width:0}
.fht h2{font-size:64px;line-height:72px;font-weight:900;letter-spacing:-.02em;color:#fff}
.fht p{margin-top:24px;font-size:32px;line-height:44px;color:#888}
.fht ul{list-style:none;margin-top:32px}
.fht li{display:flex;align-items:center;font-size:28px;line-height:36px;font-weight:500;margin-top:20px}
.fht li:first-child{margin-top:0}
.fht li span{width:56px;height:56px;border-radius:50%;background:#1F1F1F;display:flex;align-items:center;justify-content:center;flex:0 0 auto;margin-right:20px}
.fht .btns{margin-top:48px;display:flex;flex-wrap:wrap}
.fht .btns .tb{margin-right:24px}
.fht .keys{position:absolute;left:96px;bottom:54px;display:flex;align-items:center;font-size:24px;font-weight:600;color:#888}
.fht .keys>*{margin-right:16px}
.fht .keys .sp{width:24px}
.fht .tk{display:inline-flex;align-items:center;justify-content:center;min-width:52px;height:44px;padding:0 12px;border-radius:10px;border:2px solid #3A3A3A;border-bottom-width:5px;background:#1F1F1F;color:#E5E5E5;font-size:24px;font-weight:800}
.fht .in{animation:fhIn 320ms cubic-bezier(.2,.8,.2,1) both}
.fht .d1{animation-delay:60ms}.fht .d2{animation-delay:120ms}.fht .d3{animation-delay:180ms}
.fht .out{animation:fhOut 220ms cubic-bezier(.4,0,1,1) forwards}
.fht-toast{position:absolute;z-index:9995;left:440px;bottom:72px;width:1040px;color:#E5E5E5;font-family:Inter,'Outfit',system-ui,sans-serif}
.fht-toast>div{padding:20px 20px 20px 32px;border-radius:16px;background:#1F1F1F;display:flex;align-items:center;box-shadow:0 16px 48px rgba(0,0,0,.7);animation:fhToast 250ms cubic-bezier(.2,.8,.2,1) both;transition:opacity 200ms}
.fht-toast.bye>div{animation:none;opacity:0}
.fht-toast span{flex:1;margin:0 24px;font-size:28px;line-height:36px;font-weight:600}
.fht-toast .tb{height:72px;padding:0 32px;border-radius:12px;font-size:26px}
@keyframes fhIn{from{opacity:0;transform:translateX(var(--dx))}to{opacity:1;transform:none}}
@keyframes fhOut{from{opacity:1;transform:none}to{opacity:0;transform:translateX(var(--dxo))}}
@keyframes fhFadeIn{from{opacity:0}to{opacity:1}}
@keyframes fhFadeOut{from{opacity:1}to{opacity:0}}
@keyframes fhToast{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.fht .in,.fht-toast>div{animation-name:fhFadeIn}.fht .out{animation-name:fhFadeOut}.fht .stage *{animation:none!important}.fht .segs i,.fht .tb{transition:none}}
`;

const escapeHtml = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const cleanName = name => String(name || '').trim() || 'Você';

function Icon({ d, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Scene({ k, name }) {
  const html = useMemo(() => {
    const n = cleanName(name);
    return SCENES[k].replace(/__NOME__/g, escapeHtml(n.slice(0, 10))).replace(/__INI__/g, escapeHtml(n[0].toUpperCase()));
  }, [k, name]);
  return <div className="stage fhs" dangerouslySetInnerHTML={{ __html: html }} />;
}

const buttonsFor = i => (
  i === 0 ? [['back', 'Pular'], ['next', 'Começar']]
    : i === LAST ? [['back', 'Voltar'], ['next', 'Começar a assistir'], ['alt', 'Surpreenda-me']]
      : [['back', 'Voltar'], ['next', 'Continuar']]
);

// Escuta o controle antes das telas: enquanto está aberto, ele é só do passo a passo.
function useRemote(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = e => ref.current(e);
    // o OK que abriu pelo menu ainda está sendo processado: começa no próximo ciclo
    const t = setTimeout(() => document.addEventListener('keydown', fn, true), 0);
    return () => { clearTimeout(t); document.removeEventListener('keydown', fn, true); };
  }, []);
}

const isBack = k => k === KEY.BACK || k === KEY.BACKSPACE;
const swallow = e => { e.preventDefault(); e.stopImmediatePropagation(); };

// onClose(motivo): 'skip' (pulou), 'finish' (começar a assistir) ou 'surprise'
function TutorialScreen({ name, onClose }) {
  const [state, setState] = useState({ cur: 0, prev: null, dir: 1 });
  const [focus, setFocus] = useState('next');
  const { cur, prev, dir } = state;

  const go = n => {
    if (n < 0 || n > LAST || n === cur) return;
    setState({ cur: n, prev: cur, dir: n > cur ? 1 : -1 });
    setFocus('next'); // a cada passo o foco volta para Continuar
  };

  useEffect(() => {
    if (prev === null) return undefined;
    const t = setTimeout(() => setState(s => ({ ...s, prev: null })), 340);
    return () => clearTimeout(t);
  }, [prev, cur]);

  const activate = id => {
    if (id === 'skip') onClose(cur === LAST ? 'finish' : 'skip');
    else if (id === 'back') { if (cur === 0) onClose('skip'); else go(cur - 1); }
    else if (id === 'alt') onClose('surprise');
    else if (cur === LAST) onClose('finish');
    else go(cur + 1);
  };

  useRemote(e => {
    swallow(e);
    const k = e.keyCode;
    const order = buttonsFor(cur).map(b => b[0]);
    if (k === KEY.LEFT || k === KEY.RIGHT) {
      if (focus === 'skip') return;
      const i = Math.max(0, order.indexOf(focus)) + (k === KEY.RIGHT ? 1 : -1);
      setFocus(order[Math.max(0, Math.min(order.length - 1, i))]);
    } else if (k === KEY.UP) { if (cur !== 0) setFocus('skip'); }
    else if (k === KEY.DOWN) { if (focus === 'skip') setFocus('next'); }
    else if (k === KEY.ENTER) { if (!e.repeat) activate(focus); }
    else if (isBack(k)) { if (cur === 0) onClose('skip'); else go(cur - 1); }
  });

  return (
    <div className="fht" role="dialog" aria-label="Como usar o FlixHome" style={{ '--dx': dir > 0 ? '40px' : '-40px', '--dxo': dir > 0 ? '-40px' : '40px' }}>
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS + CSS }} />
      <div className="top">
        <div className="logo">FLIXHOME</div>
        <div className="mid">
          <div className="count">{cur + 1} de {LAST + 1}</div>
          <div className="segs">{STEPS.map((s, i) => <div key={s.k}><i style={{ transform: i <= cur ? 'scaleX(1)' : 'scaleX(0)' }} /></div>)}</div>
        </div>
        <div className="end">
          {cur !== 0 && (
            <button type="button" className={'tb skip' + (focus === 'skip' ? ' focus' : '')} onClick={() => activate('skip')}>{cur === LAST ? 'Fechar' : 'Pular'}</button>
          )}
        </div>
      </div>

      {STEPS.map((s, i) => {
        if (i !== cur && i !== prev) return null;
        return (
          <div key={s.k} className={'step' + (i === cur ? '' : ' out')}>
            <div className="art in"><Scene k={s.k} name={name} /></div>
            <div className="col">
              <h2 className="in d1">{s.t.replace('__NOME__', cleanName(name))}</h2>
              <p className="in d2">{s.b}</p>
              {s.h.length > 0 && (
                <ul className="in d2">{s.h.map(([d, label]) => <li key={label}><span><Icon d={d} size={28} /></span>{label}</li>)}</ul>
              )}
              <div className="btns in d3">
                {buttonsFor(i).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => activate(id)}
                    className={'tb' + (id === 'next' ? ' pri' : '') + (i === cur && focus === id ? ' focus' : '')}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <div className="keys">
        <span className="tk">◀</span><span className="tk">▶</span><span>andar</span><span className="sp" />
        <span className="tk">OK</span><span>escolher</span><span className="sp" />
        <span className="tk">Voltar</span><span>{cur === 0 ? 'pula o passo a passo' : 'volta um passo'}</span>
      </div>
    </div>
  );
}

// Aviso depois de pular: 4 s, com OK para ver agora
function Toast({ onReopen, onDone }) {
  const [bye, setBye] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setBye(true), 4000);
    const b = setTimeout(onDone, 4200);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  useRemote(e => {
    const k = e.keyCode;
    if (k === KEY.ENTER) { swallow(e); if (!e.repeat) onReopen(); }
    else if (isBack(k)) { swallow(e); onDone(); }
    else onDone(); // qualquer seta fecha o aviso e segue navegando
  });

  return (
    <div className={'fht-toast' + (bye ? ' bye' : '')}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div role="status">
        <Icon d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8h.01" size={36} />
        <span>Você pode ver o passo a passo de novo no menu lateral, em “Como usar o FlixHome”</span>
        <button type="button" className="tb focus" onClick={onReopen}>OK</button>
      </div>
    </div>
  );
}

// Decide quando o passo a passo aparece. Os avisos (children) esperam, para uma
// conta nova não receber várias janelas seguidas.
export default function TutorialHost({ children, version }) {
  const { user, activeProfile } = useAuth();
  const { pathname } = useLocation();
  const [view, setView] = useState(null); // null | 'tour' | 'toast'
  const [auto, setAuto] = useState(false);
  const [checked, setChecked] = useState(null); // id da conta já conferida
  const checking = useRef(null);
  const userId = user && user.id;
  const ready = !!userId && !!activeProfile && pathname === '/';

  useEffect(() => {
    if (!ready || checked === userId || checking.current === userId) return;
    checking.current = userId;
    api.get('/api/auth/tutorial')
      .then(r => {
        if (!r.data || !r.data.show) return;
        // Conta nova ainda não usou o app: as Novidades desta versão ficam como vistas
        try { window.localStorage.setItem(SEEN_KEY, version); } catch (e) {}
        setAuto(true);
        setView('tour');
      })
      .catch(() => {})
      .then(() => { checking.current = null; setChecked(userId); });
  }, [ready, userId, checked, version]);

  useEffect(() => {
    const open = () => { setAuto(false); setView('tour'); };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  const close = reason => {
    if (auto) api.post('/api/auth/tutorial/seen').catch(() => {});
    setView(reason === 'skip' && auto ? 'toast' : null);
    if (reason !== 'skip') window.dispatchEvent(new Event(HOME_EVENT));
    if (reason === 'surprise') window.dispatchEvent(new Event(SURPRISE_EVENT));
  };

  const open = ready && view !== null;
  const waiting = open || (ready && checked !== userId);

  return (
    <>
      {open && view === 'tour' && <TutorialScreen name={activeProfile.name} onClose={close} />}
      {open && view === 'toast' && <Toast onReopen={() => { setAuto(false); setView('tour'); }} onDone={() => setView(null)} />}
      {!waiting && children}
    </>
  );
}
