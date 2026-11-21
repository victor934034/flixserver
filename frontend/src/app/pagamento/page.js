'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';
import { getToken } from '../../lib/auth';
import styles from './page.module.css';

const brl = v => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
const digits = v => String(v || '').replace(/\D/g, '');

function maskCpfCnpj(v) {
  const d = digits(v).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}
function validCpf(c) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== +c[t]) return false;
  }
  return true;
}
const validDoc = v => { const d = digits(v); return d.length === 14 || validCpf(d); };
const maskPhone = v => digits(v).slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
const maskCard = v => digits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
const maskCep = v => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
function cardBrand(n) {
  const d = digits(n);
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650|6516|6550)/.test(d)) return 'Elo';
  return '';
}

const STEPS = ['Dados', 'Pagamento', 'Confirmação'];

function Checkout() {
  const router = useRouter();
  const sp = useSearchParams();
  const kind = sp.get('kind') || 'plan';
  const planId = sp.get('plan_id');
  const donateAmount = Number(sp.get('amount')) || 0;

  const [item, setItem] = useState(null);
  const [provider, setProvider] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('PIX');
  const [card, setCard] = useState({ number: '', holderName: '', exp: '', ccv: '', cep: '', num: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pay, setPay] = useState(null);     // resposta do checkout
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!getToken()) { router.replace('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search)); return; }
    (async () => {
      try {
        const { data: paymentConfig } = await api.get('/payments/config');
        setProvider(paymentConfig.provider || 'mercado_pago');
        if (kind === 'donate') {
          setItem({ name: 'Apoio ao FlixHome', price: donateAmount || 10, sub: 'Contribuição única' });
        } else if (kind === 'iptv') {
          const { data } = await api.get('/iptv/plans');
          const p = (data || []).find(x => x.id === planId);
          if (!p) throw new Error();
          setItem({ name: `IPTV · ${p.name}`, price: Number(p.price), sub: p.description || `${p.duration_months} mês(es)` });
        } else {
          const { data } = await api.get('/payments/plans');
          const p = (data || []).find(x => x.id === planId);
          if (!p) throw new Error();
          const price = p.promo_price != null ? p.promo_price : p.price;
          setItem({
            name: p.name, price: Number(price), old: p.promo_price != null && p.promo_price < p.price ? Number(p.price) : null,
            sub: `${p.max_streams ? p.max_streams + ' tela' + (p.max_streams > 1 ? 's' : '') + ' · ' : ''}${p.duration_days} dias`,
          });
        }
      } catch { setLoadErr('Plano não encontrado ou indisponível.'); }
    })();
    return () => clearInterval(timer.current);
  }, [kind, planId, donateAmount, router]);

  // polling do PIX / boleto a cada 3s
  useEffect(() => {
    if (!pay || paid || pay.status === 'CONFIRMED' || pay.status === 'RECEIVED') return;
    timer.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/status/${pay.payment_id}`);
        if (data.paid) { setPaid(true); clearInterval(timer.current); }
      } catch {}
    }, 3000);
    return () => clearInterval(timer.current);
  }, [pay, paid]);

  // contagem regressiva do PIX
  useEffect(() => {
    if (!pay?.pix?.expires_at) return;
    const exp = new Date(pay.pix.expires_at.replace(' ', 'T')).getTime();
    const t = setInterval(() => setLeft(Math.max(0, Math.floor((exp - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [pay]);

  const go = n => { setDir(n > step ? 1 : -1); setStep(n); setError(''); };
  const docOk = validDoc(cpf);

  async function submit() {
    setError('');
    if (provider === 'asaas' && method === 'CREDIT_CARD') {
      const [mm, yy] = card.exp.split('/');
      if (digits(card.number).length < 13 || !card.holderName.trim() || !mm || !yy || digits(card.ccv).length < 3 || digits(card.cep).length !== 8) {
        return setError('Confira os dados do cartão.');
      }
    }
    setBusy(true);
    try {
      const body = { kind, plan_id: planId, amount: donateAmount };
      if (provider === 'asaas') Object.assign(body, { method, cpf: digits(cpf), phone: digits(phone) });
      if (provider === 'asaas' && method === 'CREDIT_CARD') {
        const [mm, yy] = card.exp.split('/');
        body.card = { holderName: card.holderName.trim(), number: digits(card.number), expiryMonth: mm, expiryYear: yy, ccv: digits(card.ccv) };
        body.holder = { postalCode: digits(card.cep), addressNumber: card.num || 'S/N' };
      }
      const { data } = await api.post('/payments/checkout', body);
      if (data.redirect_url) {
        window.location.assign(data.redirect_url);
        return;
      }
      setPay(data);
      if (data.status === 'CONFIRMED' || data.status === 'RECEIVED') setPaid(true);
      go(2);
    } catch (e) {
      setError(e.response?.data?.error || 'Não foi possível processar o pagamento.');
    } finally { setBusy(false); }
  }

  function copy(text) {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const mmss = useMemo(() => left == null ? '' : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`, [left]);

  if (loadErr) return <main className={styles.main}><div className={styles.card}><p className={styles.err}>{loadErr}</p><Link className={styles.btn} href="/subscription">Ver planos</Link></div></main>;
  if (!item || !provider) return <main className={styles.main}><p className={styles.muted}>Carregando…</p></main>;

  return (
    <main className={styles.main}>
      <Link href="/" className={styles.logo}>FLIXHOME</Link>

      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s} className={`${styles.stepDot} ${i <= step ? styles.stepOn : ''}`}><span>{i + 1}</span>{s}</li>
        ))}
      </ol>

      <div className={styles.layout}>
        <section key={step} className={`${styles.card} ${dir > 0 ? styles.slideR : styles.slideL}`}>
          {paid ? (
            <div className={styles.center}>
              <div className={styles.okIcon}>✓</div>
              <h1 className={styles.h1}>Pagamento confirmado!</h1>
              <p className={styles.muted}>{kind === 'iptv' ? 'Seu pedido de IPTV foi recebido e será ativado em breve.' : kind === 'donate' ? 'Obrigado por apoiar o FlixHome!' : 'Seu plano já está ativo.'}</p>
              <Link className={styles.btn} href="/">Começar a assistir</Link>
            </div>
          ) : step === 0 ? (
            <>
              {provider === 'mercado_pago' ? (
                <>
                  <h1 className={styles.h1}>Pagamento pelo Mercado Pago</h1>
                  <p className={styles.muted}>Na próxima etapa você será encaminhado ao ambiente seguro do Mercado Pago para escolher PIX, cartão ou boleto.</p>
                  <p className={styles.secure}>🔒 O FlixHome não recebe nem armazena os dados do seu cartão.</p>
                  <button className={styles.btn} onClick={() => go(1)}>Continuar</button>
                </>
              ) : (
                <>
                  <h1 className={styles.h1}>Dados do pagador</h1>
                  <label className={styles.label}>CPF ou CNPJ
                    <input className={styles.input} inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(maskCpfCnpj(e.target.value))} />
                  </label>
                  {cpf && !docOk && <p className={styles.err}>Documento inválido.</p>}
                  <label className={styles.label}>Celular <span className={styles.opt}>(opcional)</span>
                    <input className={styles.input} inputMode="tel" placeholder="(11) 90000-0000" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} />
                  </label>
                  <p className={styles.muted}>O CPF é exigido pelo processador de pagamentos. Seus dados são criptografados.</p>
                  <button className={styles.btn} disabled={!docOk} onClick={() => go(1)}>Continuar</button>
                </>
              )}
            </>
          ) : step === 1 ? (
            <>
              <h1 className={styles.h1}>Forma de pagamento</h1>
              {provider === 'mercado_pago' ? (
                <button type="button" className={`${styles.method} ${styles.methodOn}`}>
                  <span className={styles.mTitle}>Mercado Pago</span><span className={styles.mSub}>PIX, cartão ou boleto</span>
                  <span className={styles.tag}>Ambiente seguro</span>
                </button>
              ) : [
                ['PIX', 'PIX', 'QR code ou copia e cola', 'Aprovação na hora'],
                ['CREDIT_CARD', 'Cartão de crédito', 'Visa, Master, Elo, Amex', ''],
                ['BOLETO', 'Boleto', 'Compensa em 1 a 3 dias úteis', ''],
              ].filter(m => !(kind === 'iptv' && false)).map(([v, t, s, tag]) => (
                <button key={v} type="button" onClick={() => setMethod(v)} className={`${styles.method} ${method === v ? styles.methodOn : ''}`}>
                  <span className={styles.mTitle}>{t}</span><span className={styles.mSub}>{s}</span>
                  {tag && <span className={styles.tag}>{tag}</span>}
                </button>
              ))}

              {provider === 'asaas' && method === 'CREDIT_CARD' && (
                <div className={styles.cardForm}>
                  <label className={styles.label}>Número do cartão {cardBrand(card.number) && <b className={styles.brand}>{cardBrand(card.number)}</b>}
                    <input className={styles.input} inputMode="numeric" placeholder="0000 0000 0000 0000" value={card.number} onChange={e => setCard({ ...card, number: maskCard(e.target.value) })} />
                  </label>
                  <label className={styles.label}>Nome impresso
                    <input className={styles.input} value={card.holderName} onChange={e => setCard({ ...card, holderName: e.target.value.toUpperCase() })} />
                  </label>
                  <div className={styles.row}>
                    <label className={styles.label}>Validade
                      <input className={styles.input} inputMode="numeric" placeholder="MM/AAAA" maxLength={7} value={card.exp}
                        onChange={e => { const d = digits(e.target.value).slice(0, 6); setCard({ ...card, exp: d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d }); }} />
                    </label>
                    <label className={styles.label}>CVV
                      <input className={styles.input} inputMode="numeric" maxLength={4} value={card.ccv} onChange={e => setCard({ ...card, ccv: digits(e.target.value) })} />
                    </label>
                  </div>
                  <div className={styles.row}>
                    <label className={styles.label}>CEP
                      <input className={styles.input} inputMode="numeric" placeholder="00000-000" value={card.cep} onChange={e => setCard({ ...card, cep: maskCep(e.target.value) })} />
                    </label>
                    <label className={styles.label}>Nº
                      <input className={styles.input} value={card.num} onChange={e => setCard({ ...card, num: e.target.value.slice(0, 10) })} />
                    </label>
                  </div>
                </div>
              )}

              {error && <p className={styles.err}>{error}</p>}
              <div className={styles.actions}>
                <button className={styles.ghost} onClick={() => go(0)}>Voltar</button>
                <button className={styles.btn} disabled={busy} onClick={submit}>{busy ? 'Processando…' : provider === 'mercado_pago' ? 'Ir para o Mercado Pago' : `Pagar ${brl(item.price)}`}</button>
              </div>
            </>
          ) : pay?.method === 'PIX' ? (
            <div className={styles.center}>
              <h1 className={styles.h1}>Pague com PIX</h1>
              {pay.pix?.qr_image && <img className={styles.qr} alt="QR code PIX" src={`data:image/png;base64,${pay.pix.qr_image}`} />}
              <button className={`${styles.btn} ${copied ? styles.btnOk : ''}`} onClick={() => copy(pay.pix.payload)}>{copied ? '✓ Copiado!' : 'Copiar código PIX'}</button>
              <p className={styles.waiting}><span className={styles.pulse} />Aguardando confirmação…{mmss && <> · expira em {mmss}</>}</p>
              <ol className={styles.how}>
                <li>Abra o app do seu banco e escolha PIX.</li>
                <li>Escaneie o QR code ou use “copia e cola”.</li>
                <li>Confirme — esta tela atualiza sozinha.</li>
              </ol>
            </div>
          ) : pay?.method === 'BOLETO' ? (
            <div className={styles.center}>
              <h1 className={styles.h1}>Boleto gerado</h1>
              {pay.boleto?.line && <p className={styles.code}>{pay.boleto.line}</p>}
              {pay.boleto?.line && <button className={`${styles.btn} ${copied ? styles.btnOk : ''}`} onClick={() => copy(pay.boleto.line)}>{copied ? '✓ Copiado!' : 'Copiar linha digitável'}</button>}
              {pay.boleto?.url && <a className={styles.ghost} href={pay.boleto.url} target="_blank" rel="noreferrer">Abrir boleto (PDF)</a>}
              <p className={styles.muted}>Vencimento: {pay.boleto?.due_date}. Após o pagamento, a confirmação leva de 1 a 3 dias úteis.</p>
            </div>
          ) : (
            <div className={styles.center}>
              <h1 className={styles.h1}>Pagamento em análise</h1>
              <p className={styles.waiting}><span className={styles.pulse} />Aguardando confirmação do cartão…</p>
            </div>
          )}
        </section>

        <aside className={styles.summary}>
          <h2 className={styles.sTitle}>Resumo do pedido</h2>
          <div className={styles.sName}>{item.name}</div>
          <div className={styles.muted}>{item.sub}</div>
          {item.old && <div className={styles.old}>{brl(item.old)}</div>}
          <div className={styles.total}><span>Total</span><b>{brl(item.price)}</b></div>
          <p className={styles.secure}>🔒 Pagamento seguro · PIX, cartão e boleto</p>
        </aside>
      </div>
    </main>
  );
}

export default function PagamentoPage() {
  return <Suspense fallback={null}><Checkout /></Suspense>;
}
