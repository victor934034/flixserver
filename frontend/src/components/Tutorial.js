'use client';
// Passo a passo para novos usuários. Segue o design "FlixHome — Passo a passo para
// novos usuários": tela inteira, 12 passos na web (sem Downloads).
import { useEffect, useMemo, useRef, useState } from 'react';
import { STEPS, SCENES, SCENE_CSS } from '../lib/tutorialData';

const LAST = STEPS.length - 1;
const DICE = 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 15.5h.01M12 12h.01';

const CSS = `
.fht{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2000;display:flex;flex-direction:column;overflow:hidden;background:#0A0A0A;color:#E5E5E5;font-family:Inter,system-ui,sans-serif;text-align:left;outline:none}
.fht *{box-sizing:border-box;margin:0;padding:0}
.fht button{font-family:inherit;cursor:pointer;border:0}
.fht .logo{font-weight:900;letter-spacing:.08em;color:#E50914}
.fht .count{font-size:13px;font-weight:600;color:#888;font-variant-numeric:tabular-nums}
.fht .segs{display:flex;gap:4px;width:100%}
.fht .segs>div{flex:1;height:4px;border-radius:999px;background:#2A2A2A;overflow:hidden}
.fht .segs i{display:block;height:100%;background:#E50914;transform-origin:left center;transition:transform 300ms cubic-bezier(.2,.8,.2,1)}
.fht .top{flex:0 0 auto;height:96px;padding:0 48px;display:flex;align-items:center;gap:24px}
.fht .top .logo{flex:1;font-size:22px}
.fht .top .mid{width:520px;max-width:50vw;display:flex;flex-direction:column;gap:8px;align-items:center}
.fht .top .end{flex:1;display:flex;justify-content:flex-end}
.fht.narrow .top{height:auto;padding:16px 12px 0 24px;display:block}
.fht.narrow .row{height:44px;display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.fht.narrow .segs{padding-right:12px}
.fht .skip{height:44px;min-width:64px;padding:0 16px;border-radius:999px;background:transparent;color:#E5E5E5;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:10px}
.fht.narrow .skip{font-size:14px;padding:0 12px}
.fht .kc{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:24px;padding:0 6px;border-radius:6px;border:1px solid #3A3A3A;border-bottom-width:3px;background:#1F1F1F;color:#E5E5E5;font-size:12px;font-weight:700}
.fht .body{position:relative;flex:1;min-height:0;touch-action:pan-y}
.fht .step{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;gap:80px;padding:0 96px 48px;overflow-y:auto}
.fht.narrow .step{flex-direction:column;align-items:stretch;justify-content:flex-start;gap:0;padding:0;overflow:hidden}
.fht .scroll{flex:0 0 auto}
.fht.narrow .scroll{flex:1;min-height:0;overflow-y:auto;padding:16px 24px 8px;display:flex;flex-direction:column;gap:20px}
.fht .art{display:flex;justify-content:center;flex:0 0 auto}
.fht .stage{width:312px;height:280px;position:relative;overflow:hidden;border-radius:16px;background:#141414;font-size:16px;line-height:normal}
.fht .col{flex:0 1 480px;min-width:0;display:flex;flex-direction:column;gap:16px}
.fht.narrow .col{flex:0 0 auto}
.fht .text{display:flex;flex-direction:column;gap:16px}
.fht.narrow .text{gap:8px}
.fht h2{font-size:40px;line-height:48px;font-weight:800;letter-spacing:-.02em;color:#fff}
.fht p{font-size:18px;line-height:28px;color:#888}
.fht ul{list-style:none;margin-top:8px;display:flex;flex-direction:column;gap:14px}
.fht li{display:flex;align-items:center;gap:14px;font-size:16px;line-height:24px;font-weight:500}
.fht li span{width:40px;height:40px;border-radius:50%;background:#1F1F1F;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.fht.narrow h2{font-size:24px;line-height:30px}
.fht.narrow p{font-size:16px;line-height:24px}
.fht.narrow ul{gap:10px}
.fht.narrow li{gap:12px;font-size:14px;line-height:20px}
.fht.narrow li span{width:36px;height:36px}
.fht .foot{margin-top:20px;display:flex;flex-direction:column;gap:16px}
.fht.narrow .foot{margin-top:0;padding:12px 24px 24px;gap:8px;background:#0A0A0A;flex:0 0 auto}
.fht .btns{display:flex;gap:12px;flex-wrap:wrap}
.fht .btn{height:48px;padding:0 24px;border-radius:12px;background:#1F1F1F;color:#E5E5E5;font-size:16px;font-weight:700;transition:transform 120ms ease-out;display:flex;align-items:center;justify-content:center;gap:8px}
.fht .btn.pri{background:#E50914;color:#fff;font-weight:800;min-width:180px;padding:0 32px}
.fht.narrow .btn{height:52px;flex:1}
.fht.narrow .btn.pri{flex:2}
.fht.narrow .btn.sq{flex:0 0 52px;padding:0}
.fht.narrow .btn.alt{flex:1 1 100%;font-size:15px}
.fht .btn.sq{width:48px;padding:0}
.fht .hint{display:flex;align-items:center;gap:6px;font-size:13px;color:#888}
.fht button:hover{transform:scale(1.02)}
.fht button:active{transform:scale(.97)}
.fht .btn.pri:active{background:#B20710}
.fht button:focus-visible{outline:3px solid #fff;outline-offset:2px}
.fht .in{animation:fhIn 300ms cubic-bezier(.2,.8,.2,1) both}
.fht .d1{animation-delay:60ms}.fht .d2{animation-delay:120ms}.fht .d3{animation-delay:180ms}
.fht .out{animation:fhOut 220ms cubic-bezier(.4,0,1,1) forwards;pointer-events:none}
.fht-toast{position:fixed;z-index:2000;left:50%;bottom:32px;width:520px;max-width:calc(100vw - 24px);transform:translateX(-50%)}
.fht-toast>div{padding:12px 8px 12px 16px;border-radius:12px;background:#1F1F1F;color:#E5E5E5;display:flex;align-items:center;gap:12px;box-shadow:0 12px 32px rgba(0,0,0,.6);animation:fhToast 250ms cubic-bezier(.2,.8,.2,1) both;transition:opacity 200ms}
.fht-toast.bye>div{animation:none;opacity:0}
.fht-toast span{flex:1;font-size:14px;line-height:20px;font-weight:600}
.fht-toast button{height:44px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:#FF4D57;font-size:14px;font-weight:800;cursor:pointer}
@keyframes fhIn{from{opacity:0;transform:translateX(var(--dx))}to{opacity:1;transform:none}}
@keyframes fhOut{from{opacity:1;transform:none}to{opacity:0;transform:translateX(var(--dxo))}}
@keyframes fhFadeIn{from{opacity:0}to{opacity:1}}
@keyframes fhFadeOut{from{opacity:1}to{opacity:0}}
@keyframes fhToast{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.fht .in,.fht-toast>div{animation-name:fhFadeIn}.fht .out{animation-name:fhFadeOut}.fht .stage *{animation:none!important}.fht .segs i{transition:none}}
`;

const escapeHtml = t => String(t).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function Icon({ d, size = 20, width = 2, color = '#E5E5E5' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function useWindowSize() {
  const [size, setSize] = useState({ w: 1440, h: 900 });
  useEffect(() => {
    const read = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return size;
}

function Scene({ k, name, zoom }) {
  const html = useMemo(() => {
    const clean = String(name || '').trim() || 'Você';
    return SCENES[k]
      .replace(/__NOME__/g, escapeHtml(clean.slice(0, 10)))
      .replace(/__INI__/g, escapeHtml(clean[0].toUpperCase()));
  }, [k, name]);
  return <div className="stage fhs" aria-hidden="true" style={{ zoom }} dangerouslySetInnerHTML={{ __html: html }} />;
}

// onClose(motivo): 'skip' (pulou), 'finish' (começar a assistir) ou 'surprise'
export function TutorialScreen({ name, onClose }) {
  const [state, setState] = useState({ cur: 0, prev: null, dir: 1 });
  const { w, h } = useWindowSize();
  const rootRef = useRef(null);
  const touchX = useRef(null);
  const { cur, prev, dir } = state;

  const wide = w >= 1000;
  // Palco 312×280: ×1,6 no computador, ×1 em janela estreita, 70% em tela baixa
  const zoom = wide ? (h < 640 ? 1.15 : 1.6) : (h < 700 ? 0.7 : 1);

  const go = n => setState(s => (n < 0 || n > LAST || n === s.cur ? s : { cur: n, prev: s.cur, dir: n > s.cur ? 1 : -1 }));
  const skip = () => onClose(cur === LAST ? 'finish' : 'skip');

  useEffect(() => {
    if (prev === null) return undefined;
    const t = setTimeout(() => setState(s => ({ ...s, prev: null })), 300);
    return () => clearTimeout(t);
  }, [prev, cur]);

  useEffect(() => {
    rootRef.current?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, []);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); skip(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const swipeStart = e => { touchX.current = e.clientX; };
  const swipeEnd = e => {
    if (wide || touchX.current === null) return;
    const d = e.clientX - touchX.current;
    touchX.current = null;
    if (d < -50) go(cur + 1); else if (d > 50) go(cur - 1);
  };

  const skipLabel = cur === LAST ? 'Fechar' : 'Pular';
  const skipButton = cur !== 0 && (
    <button type="button" className="skip" onClick={skip}>{skipLabel}{wide && <span className="kc">Esc</span>}</button>
  );
  const bars = (
    <div className="segs" aria-hidden="true">
      {STEPS.map((s, i) => <div key={s.k}><i style={{ transform: i <= cur ? 'scaleX(1)' : 'scaleX(0)' }} /></div>)}
    </div>
  );
  const counter = <span className="count" aria-live="polite">{cur + 1} de {LAST + 1}</span>;

  const footer = i => (
    <div className="foot in d3">
      {i === 0 && (
        <div className="btns">
          <button type="button" className="btn" onClick={() => onClose('skip')}>Pular</button>
          <button type="button" className="btn pri" onClick={() => go(1)}>Começar</button>
        </div>
      )}
      {i > 0 && i < LAST && (
        <div className="btns">
          <button type="button" className="btn" onClick={() => go(i - 1)}>Voltar</button>
          <button type="button" className="btn pri" onClick={() => go(i + 1)}>Continuar</button>
        </div>
      )}
      {i === LAST && (
        <div className="btns">
          <button type="button" className="btn sq" aria-label="Voltar" onClick={() => go(i - 1)}><Icon d="M15 18l-6-6 6-6" width={2.4} /></button>
          <button type="button" className="btn pri" onClick={() => onClose('finish')}>Começar a assistir</button>
          <button type="button" className="btn alt" onClick={() => onClose('surprise')}><Icon d={DICE} size={18} />Surpreenda-me</button>
        </div>
      )}
      {wide && (
        <div className="hint" aria-hidden="true"><span className="kc">←</span><span className="kc">→</span><span style={{ marginLeft: 4 }}>para navegar pelo teclado</span></div>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={`fht ${wide ? 'wide' : 'narrow'}`}
      role="dialog"
      aria-modal="true"
      aria-label="Como usar o FlixHome"
      style={{ '--dx': dir > 0 ? '32px' : '-32px', '--dxo': dir > 0 ? '-32px' : '32px' }}
    >
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS + CSS }} />
      {wide ? (
        <div className="top">
          <div className="logo">FLIXHOME</div>
          <div className="mid">{counter}{bars}</div>
          <div className="end">{skipButton}</div>
        </div>
      ) : (
        <div className="top">
          <div className="row">{counter}{skipButton}</div>
          {bars}
        </div>
      )}
      <div className="body" onPointerDown={swipeStart} onPointerUp={swipeEnd}>
        {STEPS.map((s, i) => {
          if (i !== cur && i !== prev) return null;
          const title = s.t.replace('__NOME__', String(name || '').trim() || 'Você');
          const text = (
            <div className="text">
              <h2 className="in d1">{title}</h2>
              <p className="in d2">{s.b}</p>
              {s.h.length > 0 && (
                <ul className="in d2">
                  {s.h.map(([d, label]) => <li key={label}><span><Icon d={d} size={wide ? 20 : 18} /></span>{label}</li>)}
                </ul>
              )}
            </div>
          );
          const art = <div className="art in"><Scene k={s.k} name={name} zoom={zoom} /></div>;
          return (
            <div key={s.k} className={`step ${i === cur ? '' : 'out'}`}>
              {wide ? (
                <>
                  <div className="scroll">{art}</div>
                  <div className="col">{text}{footer(i)}</div>
                </>
              ) : (
                <>
                  <div className="scroll">{art}{text}</div>
                  {footer(i)}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Aviso depois de pular: fica 4 s, com "Ver agora"
export function TutorialToast({ onReopen, onDone }) {
  const [bye, setBye] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setBye(true), 4000);
    const b = setTimeout(onDone, 4200);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`fht-toast ${bye ? 'bye' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div role="status">
        <Icon d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8h.01" />
        <span>Você pode ver o passo a passo de novo no Perfil</span>
        <button type="button" onClick={onReopen}>Ver agora</button>
      </div>
    </div>
  );
}
