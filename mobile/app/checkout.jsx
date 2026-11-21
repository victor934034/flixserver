import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, ActivityIndicator,
  Animated, Easing, Image, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const ACCENT = '#E50914';
const brl = v => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
const digits = v => String(v || '').replace(/\D/g, '');

function maskCpfCnpj(v) {
  const d = digits(v).slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
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
const docState = v => { const d = digits(v); if (!d.length) return 'empty'; if (d.length === 14 || validCpf(d)) return 'ok'; if (d.length < 11) return 'partial'; return 'bad'; };
const maskPhone = v => digits(v).slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
const maskCard = v => digits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
const maskCep = v => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
function cardBrand(n) {
  const d = digits(n);
  if (/^4/.test(d)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'MASTERCARD';
  if (/^3[47]/.test(d)) return 'AMEX';
  if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650|6516|6550)/.test(d)) return 'ELO';
  return '';
}
const STEPS = ['Plano', 'Pagamento', 'Confirmação'];
const METHODS = [
  { v: 'PIX', abbr: 'PIX', color: '#22C55E', title: 'PIX', sub: 'QR code ou copia e cola', tag: 'Aprovação na hora' },
  { v: 'CREDIT_CARD', abbr: 'CC', title: 'Cartão de crédito', sub: 'Visa, Master, Elo, Amex' },
  { v: 'BOLETO', abbr: 'BOL', title: 'Boleto', sub: 'Compensa em 1–3 dias úteis' },
];
const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');

// Checkout nativo (design): Pagamento → PIX / Boleto / Recusado → Plano ativado
export default function Checkout() {
  const { kind = 'plan', plan_id: planId, amount: donateAmt } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const [item, setItem] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('PIX');
  const [card, setCard] = useState({ number: '', holderName: '', exp: '', ccv: '', cep: '', num: '' });
  const [ccvFocus, setCcvFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pay, setPay] = useState(null);
  const [paid, setPaid] = useState(false);
  const [refused, setRefused] = useState('');
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(null);
  const [until, setUntil] = useState(null);

  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        if (kind === 'donate') {
          setItem({ name: 'Apoio ao FlixHome', price: Number(donateAmt) || 10, old: null, days: null, sub: 'Contribuição única' });
        } else if (kind === 'iptv') {
          const { data } = await api.get('/iptv/plans');
          const p = (data || []).find(x => x.id === planId);
          if (!p) throw new Error();
          setItem({ name: `IPTV · ${p.name}`, price: Number(p.price), old: null, days: (p.duration_months || 1) * 30, sub: p.description || `${p.duration_months || 1} mês(es)` });
        } else {
          const { data } = await api.get('/payments/plans');
          const p = (data || []).find(x => x.id === planId);
          if (!p) throw new Error();
          const price = p.promo_price != null ? p.promo_price : p.price;
          setItem({ name: p.name, price: Number(price), old: p.promo_price != null && p.promo_price < p.price ? Number(p.price) : null, days: p.duration_days });
        }
      } catch { setLoadErr('Plano não encontrado ou indisponível.'); }
    })();
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => { clearInterval(timer.current); loop.stop(); };
  }, [kind, planId]);

  const show = () => { fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); };

  // polling do PIX/boleto a cada 3s
  useEffect(() => {
    if (!pay || paid || refused) return;
    timer.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/status/${pay.payment_id}`);
        if (data.paid) { onPaid(); }
        else if (/REFUSED|DECLINED|FAILED|CANCEL/i.test(data.status || '')) { setRefused('O banco emissor recusou a transação.'); clearInterval(timer.current); show(); }
      } catch {}
    }, 3000);
    return () => clearInterval(timer.current);
  }, [pay, paid, refused]);

  useEffect(() => {
    if (!pay?.pix?.expires_at) return;
    const exp = new Date(String(pay.pix.expires_at).replace(' ', 'T')).getTime();
    const t = setInterval(() => setLeft(Math.max(0, Math.floor((exp - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [pay]);

  const onPaid = async () => {
    clearInterval(timer.current);
    try { await refreshUser?.(); const { data } = await api.get('/auth/me'); if (data?.plan_expires_at) setUntil(data.plan_expires_at); } catch {}
    setPaid(true); show();
  };

  const dState = docState(cpf);
  const docOk = dState === 'ok';
  const mmss = left == null ? '--:--' : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  const copy = async (text) => { await Clipboard.setStringAsync(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  async function submit() {
    setError('');
    if (!docOk) return setError('Informe um CPF ou CNPJ válido.');
    if (method === 'CREDIT_CARD') {
      const [mm, yy] = card.exp.split('/');
      if (digits(card.number).length < 13 || !card.holderName.trim() || !mm || !yy || digits(card.ccv).length < 3 || digits(card.cep).length !== 8) {
        return setError('Confira os dados do cartão.');
      }
    }
    setBusy(true);
    try {
      const body = { kind, plan_id: planId, amount: Number(donateAmt) || undefined, method, cpf: digits(cpf), phone: digits(phone) };
      if (method === 'CREDIT_CARD') {
        const [mm, yy] = card.exp.split('/');
        body.card = { holderName: card.holderName.trim(), number: digits(card.number), expiryMonth: mm, expiryYear: yy, ccv: digits(card.ccv) };
        body.holder = { postalCode: digits(card.cep), addressNumber: card.num || 'S/N' };
      }
      const { data } = await api.post('/payments/checkout', body);
      setPay(data);
      if (data.status === 'CONFIRMED' || data.status === 'RECEIVED') onPaid(); else show();
    } catch (e) {
      const msg = e.response?.data?.error || 'Não foi possível processar o pagamento.';
      if (method === 'CREDIT_CARD') { setRefused(msg); show(); } else setError(msg);
    } finally { setBusy(false); }
  }

  const finish = () => router.replace('/profile-select');
  const resetToForm = (keepCard) => { setPay(null); setRefused(''); setError(''); if (!keepCard) setMethod('PIX'); show(); };

  if (loadErr) return (
    <View style={[s.root, { paddingTop: insets.top + 20, alignItems: 'center', padding: 24 }]}>
      <Text style={s.err}>{loadErr}</Text>
      <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={() => router.back()}><Text style={s.btnTxt}>Ver planos</Text></TouchableOpacity>
    </View>
  );
  if (!item) return <View style={[s.root, { justifyContent: 'center' }]}><ActivityIndicator color={ACCENT} size="large" /></View>;

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const ringOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const Header = ({ title, onBack, secure }) => (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack || (() => router.back())} style={s.backBtn}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
      <Text style={s.title}>{title}</Text>
      {secure ? <View style={s.secure}><Ionicons name="lock-closed-outline" size={14} color="#22C55E" /><Text style={s.secureTxt}>Seguro</Text></View> : null}
    </View>
  );

  // ───── Plano ativado ─────
  if (paid) {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={{ flex: 1, opacity: fade, alignItems: 'center', paddingHorizontal: 20 }}>
          <Confetti />
          <View style={s.okOuter}><View style={s.okIcon}><Ionicons name="checkmark" size={44} color="#0a0a0a" /></View></View>
          <Text style={s.bigTitle}>{kind === 'donate' ? 'Obrigado pelo apoio!' : kind === 'iptv' ? 'Pedido recebido!' : 'Plano ativado!'}</Text>
          <Text style={s.mutedC}>{kind === 'donate' ? 'Seu apoio ajuda a manter o FlixHome no ar. Muito obrigado! 💛' : kind === 'iptv' ? 'Pagamento confirmado. Vamos ativar seu IPTV em até 30 minutos.' : 'Pagamento confirmado. Aproveite o FlixHome sem limites.'}</Text>
          <View style={[s.card, { alignSelf: 'stretch', marginTop: 24 }]}>
            <Row k="Plano" v={item.name} />
            {until && kind !== 'iptv' ? <Row k="Válido até" v={fmtDate(until)} /> : null}
            <Row k="Pago com" v={pay?.method === 'PIX' ? 'PIX' : pay?.method === 'BOLETO' ? 'Boleto' : 'Cartão'} />
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }]} onPress={finish}><Ionicons name="play" size={16} color="#fff" /><Text style={s.btnTxt}>Começar a assistir</Text></TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ───── Pagamento recusado ─────
  if (refused) {
    return (
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={{ flex: 1, opacity: fade, alignItems: 'center', paddingHorizontal: 20, paddingTop: 70 }}>
          <View style={s.badOuter}><View style={s.badIcon}><Ionicons name="close" size={44} color="#fff" /></View></View>
          <Text style={s.bigTitle}>Pagamento recusado</Text>
          <Text style={s.mutedC}>O banco emissor recusou a transação.</Text>
          <View style={s.reason}><Text style={s.reasonTxt}><Text style={{ color: '#F87171', fontWeight: '800' }}>Motivo:  </Text>{refused}</Text></View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }]} onPress={() => { setMethod('PIX'); resetToForm(false); }}><Text style={s.btnTxt}>Tentar outra forma</Text></TouchableOpacity>
          <TouchableOpacity style={[s.ghostBtn, { alignSelf: 'stretch', marginTop: 10 }]} onPress={() => resetToForm(true)}><Text style={s.ghostTxt}>Tentar o mesmo cartão</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/ajuda')} style={{ marginTop: 14 }}><Text style={s.link}>Falar com o suporte</Text></TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ───── PIX ─────
  if (pay?.method === 'PIX') {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <Header title="Pague com PIX" onBack={() => resetToForm(true)} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom, gap: 14 }}>
          <Animated.View style={{ opacity: fade, gap: 14 }}>
            <View style={s.waiting}>
              <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={[s.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOp }]} />
                <View style={s.pulseDot} />
              </View>
              <Text style={s.waitTxt}>Aguardando confirmação...</Text>
            </View>
            <View style={[s.card, { alignItems: 'center', paddingVertical: 20 }]}>
              <Text style={s.muted}>Total a pagar</Text>
              <Text style={s.bigPrice}>{brl(item.price)}</Text>
              {pay.pix?.qr_image ? <Image style={s.qr} source={{ uri: `data:image/png;base64,${pay.pix.qr_image}` }} /> : null}
              <View style={s.expire}><Ionicons name="time-outline" size={16} color="#FBBF24" /><Text style={s.muted}>Expira em  <Text style={{ color: '#FBBF24', fontWeight: '800' }}>{mmss}</Text></Text></View>
            </View>
            <Text style={s.label}>PIX copia e cola</Text>
            <View style={s.codeBox}><Text style={s.codeTxt} numberOfLines={2}>{pay.pix?.payload}</Text></View>
            <TouchableOpacity style={[s.greenBtn, !copied && { backgroundColor: ACCENT }]} onPress={() => copy(pay.pix.payload)} activeOpacity={0.9}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? '#04150A' : '#fff'} />
              <Text style={[s.btnTxt, copied && { color: '#04150A' }]}>{copied ? 'Copiado!' : 'Copiar código PIX'}</Text>
            </TouchableOpacity>
            <View style={s.how}>
              <Text style={s.howH}>Como pagar</Text>
              {['Abra o app do seu banco e escolha pagar com PIX.', 'Escaneie o QR code ou cole o código copiado.', 'Confirme o pagamento. Seu plano é ativado na hora.'].map((t, i) => (
                <View key={i} style={s.howRow}><View style={s.howNum}><Text style={s.howNumTxt}>{i + 1}</Text></View><Text style={s.howT}>{t}</Text></View>
              ))}
            </View>
            <Text style={s.mutedC}>Esta tela atualiza sozinha quando o pagamento for confirmado. Pode deixar o app aberto.</Text>
            <TouchableOpacity onPress={() => resetToForm(false)}><Text style={[s.link, { textAlign: 'center' }]}>Escolher outra forma de pagamento</Text></TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ───── Boleto ─────
  if (pay?.method === 'BOLETO') {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom, gap: 14 }}>
          <Animated.View style={{ opacity: fade, gap: 14 }}>
            <View style={s.statusRow}><View style={s.pendBadge}><Text style={s.pendTxt}>PENDENTE</Text></View><Text style={s.muted}>Aguardando compensação</Text></View>
            <Text style={s.bigTitleL}>Boleto gerado</Text>
            <Text style={s.muted}>Pague até o vencimento. Ativamos seu plano automaticamente em 1–3 dias úteis após o pagamento.</Text>
            <View style={s.card}>
              <Row k="Valor" v={brl(item.price)} />
              <Row k="Vencimento" v={pay.boleto?.due_date ? fmtDate(pay.boleto.due_date) : '—'} />
              {pay.boleto?.line ? <Text style={s.line} selectable>{pay.boleto.line}</Text> : null}
              {pay.boleto?.line ? (
                <TouchableOpacity style={[s.whiteBtn, copied && { backgroundColor: '#22C55E' }]} onPress={() => copy(pay.boleto.line)}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#111" /><Text style={s.whiteTxt}>{copied ? 'Copiado!' : 'Copiar linha digitável'}</Text>
                </TouchableOpacity>
              ) : null}
              {pay.boleto?.url ? <TouchableOpacity style={s.ghostBtn} onPress={() => Linking.openURL(pay.boleto.url)}><Text style={s.ghostTxt}>Abrir boleto (PDF)</Text></TouchableOpacity> : null}
            </View>
            <Text style={s.mutedC}>Também enviamos o boleto para o seu e-mail.</Text>
            <TouchableOpacity style={s.ghostBtn} onPress={finish}><Text style={s.ghostTxt}>Voltar ao início</Text></TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }
  if (pay) {
    return (
      <View style={[s.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', gap: 14 }]}>
        <Text style={s.bigTitle}>Pagamento em análise</Text>
        <View style={s.waiting}><ActivityIndicator color="#22C55E" size="small" /><Text style={s.waitTxt}>Aguardando confirmação do cartão…</Text></View>
      </View>
    );
  }

  // ───── Formulário: Dados + Forma de pagamento ─────
  const brand = cardBrand(card.number);
  const numShown = (() => { const d = digits(card.number).padEnd(16, '•'); return d.replace(/(.{4})/g, '$1 ').trim(); })();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.root, { paddingTop: insets.top }]}>
      <Header title="Pagamento" secure />
      <View style={s.steps}>
        {STEPS.map((t, i) => (
          <View key={t} style={{ flex: 1, gap: 6 }}>
            <View style={[s.bar, i <= 1 && { backgroundColor: ACCENT }]} />
            <Text style={[s.stepTxt, i === 1 && { color: '#fff' }]}>{i + 1} {t}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 150 + insets.bottom, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <View style={s.sumHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.kicker}>RESUMO DO PEDIDO</Text>
              <Text style={s.sName}>{kind === 'iptv' || kind === 'donate' ? item.name : `Plano ${item.name}`}{item.days ? ` · ${item.days} dias` : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => router.back()}><Text style={s.alterar}>Alterar</Text></TouchableOpacity>
          </View>
          {item.old ? (<>
            <Row k="Preço" v={brl(item.old)} />
            <Row k="Desconto" v={`– ${brl(item.old - item.price)}`} green />
          </>) : <Row k="Preço" v={brl(item.price)} />}
          <View style={s.hr} />
          <View style={s.totalRow}><Text style={s.totalK}>Total</Text><Text style={s.totalV}>{brl(item.price)}</Text></View>
        </View>

        <Text style={s.h2}>Dados do pagador</Text>
        <View style={s.row}>
          <View style={[s.ro, { flex: 1 }]}><Text style={s.roK}>Nome</Text><Text style={s.roV} numberOfLines={1}>{user?.name || '—'}</Text></View>
          <View style={[s.ro, { flex: 1.3 }]}><Text style={s.roK}>E-mail</Text><Text style={s.roV} numberOfLines={1}>{user?.email || '—'}</Text></View>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={s.label}>CPF ou CNPJ</Text>
          <TextInput style={[s.input, dState === 'ok' && s.inputOk, (dState === 'bad') && s.inputBad]} keyboardType="number-pad" placeholder="000.000.000-00" placeholderTextColor="#555" value={cpf} onChangeText={t => setCpf(maskCpfCnpj(t))} />
          {dState === 'ok' && <Text style={s.okTxt}>CPF válido</Text>}
          {dState === 'partial' && <Text style={s.warnTxt}>CPF incompleto — faltam {11 - digits(cpf).length} dígito(s)</Text>}
          {dState === 'bad' && <Text style={s.err}>Documento inválido.</Text>}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={s.label}>Celular (opcional)</Text>
          <TextInput style={s.input} keyboardType="phone-pad" placeholder="(41) 90000-0000" placeholderTextColor="#555" value={phone} onChangeText={t => setPhone(maskPhone(t))} />
        </View>

        <Text style={s.h2}>Forma de pagamento</Text>
        {METHODS.map(m => {
          const on = method === m.v;
          return (
            <TouchableOpacity key={m.v} activeOpacity={0.85} onPress={() => setMethod(m.v)} style={[s.method, on && s.methodOn]}>
              <View style={[s.mIcon, m.color && { backgroundColor: 'rgba(34,197,94,0.14)' }]}><Text style={[s.mAbbr, m.color && { color: m.color }]}>{m.abbr}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.mTitle}>{m.title}</Text>
                <Text style={s.mSub}>{m.sub}</Text>
              </View>
              {m.tag && <View style={s.tag}><Text style={s.tagTxt}>{m.tag}</Text></View>}
              <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
            </TouchableOpacity>
          );
        })}

        {method === 'CREDIT_CARD' && (
          <View style={{ gap: 12 }}>
            <View style={s.cardPrev}>
              <View style={s.cardTopRow}><View style={s.chip} /><Text style={s.cardBrand}>{brand || 'CARTÃO'}</Text></View>
              <Text style={s.cardNum}>{ccvFocus ? '•••• •••• •••• ••••' : numShown}</Text>
              <View style={s.cardBot}>
                <View><Text style={s.cardK}>Nome impresso</Text><Text style={s.cardV} numberOfLines={1}>{ccvFocus ? 'CVV  ' + (card.ccv || '•••') : (card.holderName || 'SEU NOME')}</Text></View>
                <View style={{ alignItems: 'flex-end' }}><Text style={s.cardK}>Validade</Text><Text style={s.cardV}>{card.exp || 'MM/AA'}</Text></View>
              </View>
            </View>
            <Text style={s.mutedC}>O cartão vira ao focar no CVV</Text>
            <View style={{ gap: 6 }}>
              <Text style={s.label}>Número do cartão</Text>
              <TextInput style={s.input} keyboardType="number-pad" placeholder="0000 0000 0000 0000" placeholderTextColor="#555" value={card.number} onChangeText={t => setCard({ ...card, number: maskCard(t) })} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={s.label}>Nome impresso no cartão</Text>
              <TextInput style={s.input} autoCapitalize="characters" value={card.holderName} onChangeText={t => setCard({ ...card, holderName: t.toUpperCase() })} />
            </View>
            <View style={s.row}>
              <View style={{ flex: 1, gap: 6 }}><Text style={s.label}>Validade</Text>
                <TextInput style={s.input} keyboardType="number-pad" placeholder="MM/AAAA" placeholderTextColor="#555" maxLength={7} value={card.exp}
                  onChangeText={t => { const d = digits(t).slice(0, 6); setCard({ ...card, exp: d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d }); }} /></View>
              <View style={{ flex: 1, gap: 6 }}><Text style={s.label}>CVV</Text>
                <TextInput style={s.input} keyboardType="number-pad" placeholder="123" placeholderTextColor="#555" maxLength={4} secureTextEntry value={card.ccv} onFocus={() => setCcvFocus(true)} onBlur={() => setCcvFocus(false)} onChangeText={t => setCard({ ...card, ccv: digits(t) })} /></View>
            </View>
            <View style={s.row}>
              <View style={{ flex: 2, gap: 6 }}><Text style={s.label}>CEP</Text>
                <TextInput style={s.input} keyboardType="number-pad" placeholder="00000-000" placeholderTextColor="#555" value={card.cep} onChangeText={t => setCard({ ...card, cep: maskCep(t) })} /></View>
              <View style={{ flex: 1, gap: 6 }}><Text style={s.label}>Nº</Text>
                <TextInput style={s.input} value={card.num} onChangeText={t => setCard({ ...card, num: t.slice(0, 10) })} /></View>
            </View>
          </View>
        )}
        {!!error && <Text style={s.err}>{error}</Text>}
      </ScrollView>

      <View style={[s.cta, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={[s.btn, (busy || !docOk) && { opacity: 0.6 }]} disabled={busy || !docOk} onPress={submit} activeOpacity={0.9}>
          {busy ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.btnTxt}>Processando…</Text></> : <Text style={s.btnTxt}>Pagar  ·  {brl(item.price)}</Text>}
        </TouchableOpacity>
        <View style={s.safeRow}><Ionicons name="lock-closed-outline" size={12} color="#777" /><Text style={s.safeTxt}>Dados criptografados · processado por Asaas</Text></View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ k, v, green }) {
  return <View style={s.kv}><Text style={s.kvK}>{k}</Text><Text style={[s.kvV, green && { color: '#22C55E' }]}>{v}</Text></View>;
}
function Confetti() {
  const pieces = [['#E50914', 20, 30], ['#FBBF24', 60, 70], ['#22C55E', 110, 40], ['#fff', 170, 90], ['#0ea5e9', 230, 50], ['#E50914', 280, 100], ['#FBBF24', 330, 60], ['#22C55E', 40, 130], ['#fff', 300, 140]];
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180 }}>
    {pieces.map(([c, x, y], i) => <View key={i} style={{ position: 'absolute', left: x, top: y, width: 8, height: 14, borderRadius: 2, backgroundColor: c, transform: [{ rotate: `${(i * 37) % 90 - 40}deg` }] }} />)}
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#fff', fontSize: 24, fontWeight: '800' },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  secureTxt: { color: '#22C55E', fontWeight: '700', fontSize: 13 },
  steps: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 6 },
  bar: { height: 3, borderRadius: 2, backgroundColor: '#2A2A2A' },
  stepTxt: { color: '#888', fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: '#141414', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1F1F1F', gap: 10 },
  sumHead: { flexDirection: 'row', alignItems: 'flex-start' },
  kicker: { color: '#888', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  sName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },
  alterar: { color: '#fff', textDecorationLine: 'underline', fontWeight: '700', fontSize: 14 },
  kv: { flexDirection: 'row', justifyContent: 'space-between' },
  kvK: { color: '#A3A3A3', fontSize: 15 }, kvV: { color: '#E5E5E5', fontSize: 15, fontWeight: '700' },
  hr: { height: 1, backgroundColor: '#262626' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalK: { color: '#fff', fontSize: 18, fontWeight: '800' }, totalV: { color: '#fff', fontSize: 22, fontWeight: '900' },
  h2: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 6 },
  row: { flexDirection: 'row', gap: 10 },
  ro: { backgroundColor: '#141414', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#1F1F1F' },
  roK: { color: '#888', fontSize: 12 }, roV: { color: '#E5E5E5', fontSize: 15, fontWeight: '700', marginTop: 2 },
  label: { color: '#E5E5E5', fontSize: 14, fontWeight: '700' },
  input: { height: 54, borderRadius: 12, backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#2A2A2A', color: '#fff', paddingHorizontal: 16, fontSize: 17 },
  inputOk: { borderColor: '#22C55E' }, inputBad: { borderColor: '#F87171' },
  okTxt: { color: '#22C55E', fontSize: 13, fontWeight: '600' }, warnTxt: { color: '#FBBF24', fontSize: 13 },
  err: { color: '#F87171', fontSize: 13 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#141414', borderWidth: 2, borderColor: '#1F1F1F' },
  methodOn: { borderColor: ACCENT, backgroundColor: '#150d0d' },
  mIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  mAbbr: { color: '#E5E5E5', fontWeight: '900', fontSize: 13 },
  mTitle: { color: '#fff', fontSize: 17, fontWeight: '800' }, mSub: { color: '#A3A3A3', fontSize: 13, marginTop: 2 },
  tag: { backgroundColor: 'rgba(34,197,94,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagTxt: { color: '#22C55E', fontSize: 11, fontWeight: '800' },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: ACCENT }, radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: ACCENT },
  cardPrev: { borderRadius: 18, padding: 20, backgroundColor: '#8a0a12', gap: 22, shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { width: 46, height: 34, borderRadius: 8, backgroundColor: '#D4B26A' },
  cardBrand: { color: '#fff', fontWeight: '900', fontStyle: 'italic', fontSize: 20 },
  cardNum: { color: '#fff', fontSize: 21, fontWeight: '800', letterSpacing: 3 },
  cardBot: { flexDirection: 'row', justifyContent: 'space-between' },
  cardK: { color: 'rgba(255,255,255,0.7)', fontSize: 12 }, cardV: { color: '#fff', fontWeight: '800', fontSize: 15, marginTop: 2, maxWidth: 190 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(10,10,10,0.97)', borderTopWidth: 1, borderTopColor: '#1F1F1F', gap: 8 },
  btn: { height: 56, borderRadius: 14, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  safeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, safeTxt: { color: '#777', fontSize: 12 },
  ghostBtn: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  ghostTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  whiteBtn: { height: 50, borderRadius: 12, backgroundColor: '#E5E5E5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  whiteTxt: { color: '#111', fontWeight: '800', fontSize: 15 },
  greenBtn: { height: 56, borderRadius: 14, backgroundColor: '#22C55E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  link: { color: '#fff', textDecorationLine: 'underline', fontWeight: '600', fontSize: 14 },
  muted: { color: '#A3A3A3', fontSize: 14 },
  mutedC: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.5)', backgroundColor: 'rgba(34,197,94,0.08)', paddingHorizontal: 18, height: 56 },
  waitTxt: { color: '#22C55E', fontWeight: '800', fontSize: 16 },
  pulseDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#22C55E' },
  pulseRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#22C55E' },
  bigPrice: { color: '#fff', fontSize: 40, fontWeight: '900', marginVertical: 8 },
  qr: { width: 230, height: 230, borderRadius: 14, backgroundColor: '#fff', marginVertical: 10 },
  expire: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  codeBox: { borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#333', padding: 14, backgroundColor: '#101010' },
  codeTxt: { color: '#E5E5E5', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  how: { backgroundColor: '#141414', borderRadius: 16, padding: 18, gap: 16, borderWidth: 1, borderColor: '#1F1F1F' },
  howH: { color: '#fff', fontSize: 17, fontWeight: '800' },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  howNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  howNumTxt: { color: '#fff', fontWeight: '800' }, howT: { flex: 1, color: '#E5E5E5', fontSize: 15, lineHeight: 21 },
  okOuter: { marginTop: 90, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center' },
  okIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  badOuter: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center' },
  badIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  bigTitle: { color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center', marginTop: 24, marginBottom: 8 },
  bigTitleL: { color: '#fff', fontSize: 32, fontWeight: '900' },
  reason: { alignSelf: 'stretch', marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', padding: 14 },
  reasonTxt: { color: '#E5E5E5', fontSize: 14, lineHeight: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendBadge: { backgroundColor: 'rgba(251,191,36,0.16)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  pendTxt: { color: '#FBBF24', fontWeight: '900', fontSize: 11 },
  line: { color: '#E5E5E5', fontSize: 13, letterSpacing: 0.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', paddingVertical: 10 },
});
