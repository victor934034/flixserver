import { useEffect, useMemo, useRef, useState } from 'react';
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
const METHODS = [
  { v: 'PIX', title: 'PIX', sub: 'QR code ou copia e cola', tag: 'Aprovação na hora', icon: 'qr-code-outline' },
  { v: 'CREDIT_CARD', title: 'Cartão de crédito', sub: 'Visa, Master, Elo, Amex', icon: 'card-outline' },
  { v: 'BOLETO', title: 'Boleto', sub: 'Compensa em 1 a 3 dias úteis', icon: 'document-text-outline' },
];

// Checkout nativo: Dados → Pagamento → Confirmação (PIX com polling a cada 3s)
export default function Checkout() {
  const { kind = 'plan', plan_id: planId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth();

  const [item, setItem] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [step, setStep] = useState(0);
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('PIX');
  const [card, setCard] = useState({ number: '', holderName: '', exp: '', ccv: '', cep: '', num: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pay, setPay] = useState(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(null);

  const slide = useRef(new Animated.Value(1)).current;
  const dirRef = useRef(1);
  const pulse = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        if (kind === 'iptv') {
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
  }, [kind, planId]);

  // anima a troca de passo: slide horizontal 24px + fade, 260ms
  const go = (n) => {
    dirRef.current = n > step ? 1 : -1;
    slide.setValue(0);
    setStep(n); setError('');
    Animated.timing(slide, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  // polling do PIX/boleto a cada 3s
  useEffect(() => {
    if (!pay || paid) return;
    timer.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/status/${pay.payment_id}`);
        if (data.paid) { setPaid(true); clearInterval(timer.current); refreshUser?.().catch(() => {}); }
      } catch {}
    }, 3000);
    return () => clearInterval(timer.current);
  }, [pay, paid]);

  // pulso do PIX: anel verde 0 → 10px, loop 2s
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (!pay?.pix?.expires_at) return;
    const exp = new Date(String(pay.pix.expires_at).replace(' ', 'T')).getTime();
    const t = setInterval(() => setLeft(Math.max(0, Math.floor((exp - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [pay]);

  const docOk = validDoc(cpf);
  const mmss = left == null ? '' : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;

  const copy = async (text) => {
    await Clipboard.setStringAsync(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  async function submit() {
    setError('');
    if (method === 'CREDIT_CARD') {
      const [mm, yy] = card.exp.split('/');
      if (digits(card.number).length < 13 || !card.holderName.trim() || !mm || !yy || digits(card.ccv).length < 3 || digits(card.cep).length !== 8) {
        return setError('Confira os dados do cartão.');
      }
    }
    setBusy(true);
    try {
      const body = { kind, plan_id: planId, method, cpf: digits(cpf), phone: digits(phone) };
      if (method === 'CREDIT_CARD') {
        const [mm, yy] = card.exp.split('/');
        body.card = { holderName: card.holderName.trim(), number: digits(card.number), expiryMonth: mm, expiryYear: yy, ccv: digits(card.ccv) };
        body.holder = { postalCode: digits(card.cep), addressNumber: card.num || 'S/N' };
      }
      const { data } = await api.post('/payments/checkout', body);
      setPay(data);
      if (data.status === 'CONFIRMED' || data.status === 'RECEIVED') { setPaid(true); refreshUser?.().catch(() => {}); }
      go(2);
    } catch (e) {
      setError(e.response?.data?.error || 'Não foi possível processar o pagamento.');
    } finally { setBusy(false); }
  }

  const finish = () => router.replace('/profile-select');
  const back = () => { if (step === 0 || paid) router.back(); else go(step - 1); };

  if (loadErr) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 20, alignItems: 'center', padding: 24 }]}>
        <Text style={s.err}>{loadErr}</Text>
        <TouchableOpacity style={[s.btn, { marginTop: 16 }]} onPress={() => router.back()}><Text style={s.btnTxt}>Ver planos</Text></TouchableOpacity>
      </View>
    );
  }
  if (!item) return <View style={[s.root, { justifyContent: 'center' }]}><ActivityIndicator color={ACCENT} size="large" /></View>;

  const dx = slide.interpolate({ inputRange: [0, 1], outputRange: [24 * dirRef.current, 0] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={back} style={s.backBtn}><Ionicons name="chevron-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={s.logo}>FLIXHOME</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* passos */}
      <View style={s.steps}>
        {STEPS.map((t, i) => (
          <View key={t} style={s.stepItem}>
            <View style={[s.stepDot, i <= step && s.stepDotOn]}>
              {i < step || paid ? <Ionicons name="checkmark" size={13} color="#fff" /> : <Text style={s.stepNum}>{i + 1}</Text>}
            </View>
            <Text style={[s.stepTxt, i <= step && { color: '#fff' }]}>{t}</Text>
            {i < STEPS.length - 1 && <View style={[s.stepLine, i < step && { backgroundColor: ACCENT }]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom, gap: 14 }} keyboardShouldPersistTaps="handled">
        {/* resumo */}
        <View style={s.summary}>
          <View style={{ flex: 1 }}>
            <Text style={s.sName}>{item.name}</Text>
            <Text style={s.muted}>{item.sub}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {item.old ? <Text style={s.old}>{brl(item.old)}</Text> : null}
            <Text style={s.total}>{brl(item.price)}</Text>
          </View>
        </View>

        <Animated.View style={{ opacity: slide, transform: [{ translateX: dx }], gap: 14 }}>
          {paid ? (
            <View style={s.center}>
              <View style={s.okIcon}><Ionicons name="checkmark" size={38} color="#fff" /></View>
              <Text style={s.h1}>Pagamento confirmado!</Text>
              <Text style={s.mutedC}>{kind === 'iptv' ? 'Seu pedido de IPTV foi recebido e será ativado em breve.' : 'Seu plano já está ativo.'}</Text>
              <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }]} onPress={finish}><Text style={s.btnTxt}>Começar a assistir</Text></TouchableOpacity>
            </View>
          ) : step === 0 ? (
            <>
              <Text style={s.h1}>Dados do pagador</Text>
              <Field label="CPF ou CNPJ">
                <TextInput style={s.input} keyboardType="number-pad" placeholder="000.000.000-00" placeholderTextColor="#555" value={cpf} onChangeText={t => setCpf(maskCpfCnpj(t))} />
              </Field>
              {!!cpf && !docOk && <Text style={s.err}>Documento inválido.</Text>}
              <Field label="Celular (opcional)">
                <TextInput style={s.input} keyboardType="phone-pad" placeholder="(11) 90000-0000" placeholderTextColor="#555" value={phone} onChangeText={t => setPhone(maskPhone(t))} />
              </Field>
              <Text style={s.muted}>O CPF é exigido pelo processador de pagamentos. Seus dados são criptografados.</Text>
              <TouchableOpacity style={[s.btn, !docOk && s.btnOff]} disabled={!docOk} onPress={() => go(1)}><Text style={s.btnTxt}>Continuar</Text></TouchableOpacity>
            </>
          ) : step === 1 ? (
            <>
              <Text style={s.h1}>Forma de pagamento</Text>
              {METHODS.map(m => {
                const on = method === m.v;
                return (
                  <TouchableOpacity key={m.v} activeOpacity={0.85} onPress={() => setMethod(m.v)} style={[s.method, on && s.methodOn]}>
                    <View style={[s.mIcon, m.v === 'PIX' && { backgroundColor: 'rgba(34,197,94,0.14)' }]}>
                      {m.v === 'PIX' ? <Text style={{ color: '#22C55E', fontWeight: '900', fontSize: 11 }}>PIX</Text> : <Ionicons name={m.icon} size={22} color="#E5E5E5" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.mTitle}>{m.title}</Text>
                      <Text style={s.mSub}>{m.sub}</Text>
                    </View>
                    {m.tag && <View style={s.tag}><Text style={s.tagTxt}>{m.tag}</Text></View>}
                  </TouchableOpacity>
                );
              })}

              {method === 'CREDIT_CARD' && (
                <View style={{ gap: 12 }}>
                  <Field label={`Número do cartão${cardBrand(card.number) ? ' · ' + cardBrand(card.number) : ''}`}>
                    <TextInput style={s.input} keyboardType="number-pad" placeholder="0000 0000 0000 0000" placeholderTextColor="#555" value={card.number} onChangeText={t => setCard({ ...card, number: maskCard(t) })} />
                  </Field>
                  <Field label="Nome impresso">
                    <TextInput style={s.input} autoCapitalize="characters" value={card.holderName} onChangeText={t => setCard({ ...card, holderName: t.toUpperCase() })} />
                  </Field>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}><Field label="Validade">
                      <TextInput style={s.input} keyboardType="number-pad" placeholder="MM/AAAA" placeholderTextColor="#555" maxLength={7} value={card.exp}
                        onChangeText={t => { const d = digits(t).slice(0, 6); setCard({ ...card, exp: d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d }); }} />
                    </Field></View>
                    <View style={{ flex: 1 }}><Field label="CVV">
                      <TextInput style={s.input} keyboardType="number-pad" maxLength={4} secureTextEntry value={card.ccv} onChangeText={t => setCard({ ...card, ccv: digits(t) })} />
                    </Field></View>
                  </View>
                  <View style={s.row}>
                    <View style={{ flex: 2 }}><Field label="CEP">
                      <TextInput style={s.input} keyboardType="number-pad" placeholder="00000-000" placeholderTextColor="#555" value={card.cep} onChangeText={t => setCard({ ...card, cep: maskCep(t) })} />
                    </Field></View>
                    <View style={{ flex: 1 }}><Field label="Nº">
                      <TextInput style={s.input} value={card.num} onChangeText={t => setCard({ ...card, num: t.slice(0, 10) })} />
                    </Field></View>
                  </View>
                </View>
              )}

              {!!error && <Text style={s.err}>{error}</Text>}
              <TouchableOpacity style={[s.btn, busy && { opacity: 0.8 }]} disabled={busy} onPress={submit}>
                {busy ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.btnTxt}>Processando…</Text></> : <Text style={s.btnTxt}>Pagar {brl(item.price)}</Text>}
              </TouchableOpacity>
            </>
          ) : pay?.method === 'PIX' ? (
            <View style={s.center}>
              <Text style={s.h1}>Pague com PIX</Text>
              {pay.pix?.qr_image ? <Image style={s.qr} source={{ uri: `data:image/png;base64,${pay.pix.qr_image}` }} /> : null}
              <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }, copied && { backgroundColor: '#22C55E' }]} onPress={() => copy(pay.pix.payload)}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#fff" /><Text style={s.btnTxt}>{copied ? 'Copiado!' : 'Copiar código PIX'}</Text>
              </TouchableOpacity>
              <View style={s.waiting}>
                <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View style={[s.pulseRing, { transform: [{ scale: ringScale }], opacity: ringOp }]} />
                  <View style={s.pulseDot} />
                </View>
                <Text style={s.waitTxt}>Aguardando confirmação…{mmss ? ` · expira em ${mmss}` : ''}</Text>
              </View>
              <View style={s.how}>
                <Text style={s.howT}>1. Abra o app do seu banco e escolha PIX.</Text>
                <Text style={s.howT}>2. Escaneie o QR code ou use “copia e cola”.</Text>
                <Text style={s.howT}>3. Confirme — esta tela atualiza sozinha.</Text>
              </View>
            </View>
          ) : pay?.method === 'BOLETO' ? (
            <View style={s.center}>
              <Text style={s.h1}>Boleto gerado</Text>
              {pay.boleto?.line ? <Text style={s.code} selectable>{pay.boleto.line}</Text> : null}
              {pay.boleto?.line ? (
                <TouchableOpacity style={[s.btn, { alignSelf: 'stretch' }, copied && { backgroundColor: '#22C55E' }]} onPress={() => copy(pay.boleto.line)}>
                  <Text style={s.btnTxt}>{copied ? 'Copiado!' : 'Copiar linha digitável'}</Text>
                </TouchableOpacity>
              ) : null}
              {pay.boleto?.url ? <TouchableOpacity style={[s.ghostBtn, { alignSelf: 'stretch' }]} onPress={() => Linking.openURL(pay.boleto.url)}><Text style={s.ghostTxt}>Abrir boleto (PDF)</Text></TouchableOpacity> : null}
              <Text style={s.mutedC}>Vencimento: {pay.boleto?.due_date}. Após o pagamento, a confirmação leva de 1 a 3 dias úteis.</Text>
            </View>
          ) : (
            <View style={s.center}>
              <Text style={s.h1}>Pagamento em análise</Text>
              <View style={s.waiting}><ActivityIndicator color="#22C55E" size="small" /><Text style={s.waitTxt}>Aguardando confirmação do cartão…</Text></View>
            </View>
          )}
        </Animated.View>

        <Text style={s.secure}>🔒 Pagamento seguro · PIX, cartão e boleto</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }) {
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text>{children}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 },
  backBtn: { padding: 6, width: 36 },
  logo: { color: ACCENT, fontWeight: '900', letterSpacing: 5, fontSize: 18 },
  steps: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  stepDotOn: { backgroundColor: ACCENT },
  stepNum: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stepTxt: { color: '#888', fontSize: 12, fontWeight: '700' },
  stepLine: { width: 22, height: 2, backgroundColor: '#1F1F1F', marginHorizontal: 4 },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1F1F1F' },
  sName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  muted: { color: '#888', fontSize: 13, marginTop: 2 },
  mutedC: { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  old: { color: '#666', textDecorationLine: 'line-through', fontSize: 12 },
  total: { color: '#fff', fontSize: 22, fontWeight: '900' },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  label: { color: '#A3A3A3', fontSize: 13, fontWeight: '600' },
  input: { height: 50, borderRadius: 12, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2A2A2A', color: '#fff', paddingHorizontal: 14, fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  err: { color: '#F87171', fontSize: 13 },
  btn: { height: 52, borderRadius: 12, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  btnOff: { backgroundColor: '#2A2A2A' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ghostBtn: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#333', backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  ghostTxt: { color: '#fff', fontWeight: '700' },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#1F1F1F', borderWidth: 2, borderColor: 'transparent' },
  methodOn: { borderColor: ACCENT, backgroundColor: '#161010' },
  mIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  mTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  mSub: { color: '#888', fontSize: 12.5, marginTop: 1 },
  tag: { backgroundColor: 'rgba(34,197,94,0.14)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagTxt: { color: '#22C55E', fontSize: 11, fontWeight: '800' },
  center: { alignItems: 'center', gap: 14 },
  qr: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#fff' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(34,197,94,0.10)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  waitTxt: { color: '#22C55E', fontWeight: '700', fontSize: 13 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  pulseRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#22C55E' },
  how: { alignSelf: 'stretch', backgroundColor: '#141414', borderRadius: 12, padding: 14, gap: 6 },
  howT: { color: '#A3A3A3', fontSize: 13 },
  code: { color: '#E5E5E5', backgroundColor: '#141414', padding: 14, borderRadius: 12, fontSize: 14, letterSpacing: 1, textAlign: 'center', alignSelf: 'stretch' },
  okIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  secure: { color: '#666', fontSize: 12, textAlign: 'center' },
});
