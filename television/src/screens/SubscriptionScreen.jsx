import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

const { width: W, height: H } = Dimensions.get('window');
const S    = Math.min(W / 1920, H / 1080);
const r    = v => Math.max(1, Math.round(v * S));
const ACCENT = '#E50914';

const TABS = [
  { key: 'streaming', label: 'Filmes & Séries', icon: 'film-outline' },
  { key: 'iptv',      label: 'Com IPTV',        icon: 'tv-outline'   },
];

const monthsOf = p => Number(p.duration_months) || Math.max(1, Math.round((Number(p.duration_days) || 30) / 30));
const priceOf = p => (p.promo_price != null && Number(p.promo_price) < Number(p.price) ? Number(p.promo_price) : Number(p.price));
const titleOf = p => {
  const m = /(COM|SEM)\s+ADULTO/i.exec(p.name || '');
  if (m) return m[1].toUpperCase() === 'COM' ? 'Com adulto 18+' : 'Sem adulto';
  const parts = String(p.name || '').split('·');
  return parts[parts.length - 1].trim();
};

function TVPressable({ children, style, onPress, onFocus, onBlur, hasTVPreferredFocus }) {
  return (
    <Pressable
      focusable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={onFocus}
      onBlur={onBlur}
      onPress={onPress}
      style={style}
    >
      {children}
    </Pressable>
  );
}

function PeriodChip({ months, saving, active, onPress, onFocus }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable onFocus={() => { setFoc(true); onFocus?.(); }} onBlur={() => setFoc(false)} onPress={onPress}
      style={[s.period, active && s.periodOn, foc && s.periodFoc]}>
      <Text style={[s.periodNum, active && { color: '#111' }]}>{months}</Text>
      <Text style={[s.periodUnit, active && { color: '#444' }]}>{months === 1 ? 'mês' : 'meses'}</Text>
      {saving >= 5 ? <Text style={[s.periodSave, active && { color: '#15803D' }]}>-{saving}%</Text> : null}
    </TVPressable>
  );
}

function TabBtn({ label, icon, active, isIPTV, onFocus, onBlur, onPress, hasTVPreferredFocus }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => { setFoc(true); onFocus?.(); }}
      onBlur={() => { setFoc(false); onBlur?.(); }}
      onPress={onPress}
      style={[s.tab, (foc || active) && (isIPTV ? s.tabActiveIPTV : s.tabActive)]}
    >
      <View style={s.tabRow}>
        <Ionicons name={icon} size={r(16)} color={foc || active ? '#fff' : '#666'} />
        <Text style={[s.tabTxt, (foc || active) && s.tabTxtActive]}>{label}</Text>
      </View>
    </TVPressable>
  );
}

function PlanCard({ plan, onFocus, onBlur, onPress, hasTVPreferredFocus, isIPTV, busy }) {
  const [foc, setFoc] = useState(false);
  const price = plan.promo_price != null ? plan.promo_price : plan.price;
  const fmt = v => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
  const gold = /custo|melhor/i.test(plan.badge || '');
  const m = monthsOf(plan);
  const per = m === 1 ? 'por mês' : `${fmt(price / m)}/mês`;
  const feats = [
    plan.max_streams ? `${plan.max_streams} tela${plan.max_streams > 1 ? 's' : ''} simultânea${plan.max_streams > 1 ? 's' : ''}` : null,
    isIPTV ? 'Canais ao vivo + app' : (plan.max_streams >= 2 ? 'Assistir juntos' : 'Catálogo completo'),
  ].filter(Boolean);

  return (
    <TVPressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => { setFoc(true); onFocus?.(); }}
      onBlur={() => { setFoc(false); onBlur?.(); }}
      onPress={onPress}
      style={[s.card, plan.highlight && s.cardHL, foc && s.cardFoc]}
    >
      {plan.badge ? (
        <View style={[s.pill, gold && { backgroundColor: '#FBBF24' }]}>
          <Text style={[s.pillTxt, gold && { color: '#1a1200' }]}>{plan.badge}</Text>
        </View>
      ) : null}
      <Text style={s.planName}>{titleOf(plan)}</Text>
      {plan.promo_price != null && plan.promo_price < plan.price ? <Text style={s.priceOld}>{fmt(plan.price)}</Text> : null}
      <View style={s.priceRow}>
        <Text style={s.price}>{fmt(price)}</Text>
        <Text style={s.per}>{per}</Text>
      </View>
      {feats.map(f => (
        <View key={f} style={s.feat}>
          <Ionicons name="checkmark" size={r(22)} color="#22C55E" />
          <Text style={s.featTxt}>{f}</Text>
        </View>
      ))}
      {busy ? <ActivityIndicator color="#fff" style={{ marginTop: r(12) }} /> : null}
    </TVPressable>
  );
}

export default function SubscriptionScreen({ navigation, route }) {
  const { logout, refreshUser } = useAuth();
  const initialTab = route?.params?.tab === 'iptv' ? 1 : 0;

  const [tab,         setTab]         = useState(initialTab);
  const [basicPlans,  setBasicPlans]  = useState([]);
  const [iptvPlans,   setIptvPlans]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [statusMsg,   setStatusMsg]   = useState('');
  const [qrUrl,       setQrUrl]       = useState('');
  const [busyId,      setBusyId]      = useState('');
  const [payPlan,     setPayPlan]     = useState(null);
  const [trial,       setTrial]       = useState(null);
  const [trialBusy,   setTrialBusy]   = useState(false);
  const [trialFoc,    setTrialFoc]    = useState(false);
  const [sel,         setSel]         = useState({ tab: initialTab, period: null });

  useEffect(() => {
    Promise.all([
      api.get('/payments/plans').then(r => r.data || []).catch(() => []),
      api.get('/iptv/plans').then(r => r.data || []).catch(() => []),
      api.get('/payments/trial').then(r => r.data).catch(() => null),
    ]).then(([basic, iptv, tr]) => {
      setTrial(tr);
      setBasicPlans(basic.filter(p => !p.includes_iptv));
      setIptvPlans(iptv.length > 0 ? iptv : basic.filter(p => p.includes_iptv));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!qrUrl) return undefined;
    // Quem já tem plano (ex.: contratando IPTV) só conta como pago quando a validade AUMENTA
    let baseline = 0;
    api.get('/auth/me').then(r => { baseline = r.data?.plan_expires_at ? new Date(r.data.plan_expires_at).getTime() : 0; }).catch(() => {});
    const t = setInterval(async () => {
      try {
        const { data } = await api.get('/auth/me');
        const exp = data?.plan_expires_at ? new Date(data.plan_expires_at).getTime() : 0;
        if (exp > Date.now() && exp > baseline) { await refreshUser?.(); navigation.replace('Home'); }
      } catch {}
    }, 4000);
    return () => clearInterval(t);
  }, [qrUrl]);

  const allPlans = tab === 0 ? basicPlans : iptvPlans;
  const periods = [...new Set(allPlans.map(monthsOf))].sort((a, b) => a - b);
  const period = periods.includes(sel.period) && sel.tab === tab ? sel.period : periods[0];
  const plans = allPlans.filter(p => monthsOf(p) === period)
    .sort((a, b) => (a.is_adult ? 1 : 0) - (b.is_adult ? 1 : 0) || (a.max_streams || 1) - (b.max_streams || 1));
  const bestMonthly = mo => Math.min(...allPlans.filter(p => monthsOf(p) === mo).map(p => priceOf(p) / mo));
  const saving = mo => (periods.length && mo !== periods[0] ? Math.round((1 - bestMonthly(mo) / bestMonthly(periods[0])) * 100) : 0);
  const pickPeriod = mo => setSel({ tab, period: mo });

  async function startTrial() {
    if (trialBusy) return;
    setTrialBusy(true); setStatusMsg('');
    try {
      await api.post('/payments/trial/start');
      await refreshUser?.();
      navigation.replace('Home');
    } catch (e) {
      setStatusMsg('Erro: ' + (e.response?.data?.error || 'Não foi possível ativar o teste grátis.'));
      setTrialBusy(false);
    }
  }

  async function handleSubscribe(plan) {
    setPayPlan(plan);
    setBusyId(plan.id);
    setStatusMsg('');
    try {
      const endpoint = tab === 1 ? '/iptv/subscribe' : '/payments/subscribe';
      const { data } = await api.post(endpoint, { plan_id: plan.id });
      if (data.init_point) {
        setStatusMsg('Escaneie o QR code com o celular para pagar (PIX, cartão ou boleto).\nOu acesse: ' + data.init_point);
        setQrUrl(String(api.defaults.baseURL || '').replace(/\/api\/?$/, '') + '/api/payments/qr?text=' + encodeURIComponent(data.init_point));
      } else {
        setStatusMsg('Solicitação enviada! O administrador foi notificado e ativará em breve.');
      }
    } catch (e) {
      setStatusMsg('Erro: ' + ((e.response?.data?.error) || e.message));
    } finally {
      setBusyId('');
    }
  }

  if (qrUrl) {
    const fmtP = v => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
    return (
      <View style={[s.root, { padding: r(60), backgroundColor: '#0A0A0A' }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: ACCENT, fontSize: r(22), fontWeight: '900', letterSpacing: 10 }}>FLIXHOME</Text>
          <Text style={{ color: '#4ADE80', fontSize: r(24), fontWeight: '700' }}>Pagamento seguro</Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: r(70) }}>
          <View style={{ width: r(420), height: r(420), borderRadius: r(26), backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Image source={{ uri: qrUrl }} style={{ width: r(396), height: r(396) }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: r(60), fontWeight: '900' }}>Escaneie com o celular para pagar</Text>
            <Text style={{ color: '#A3A3A3', fontSize: r(28), marginVertical: r(22) }}>PIX, cartão ou boleto — a página abre direto no seu celular.</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: r(40), padding: r(26), borderRadius: r(18), backgroundColor: '#141414', borderWidth: 1, borderColor: '#1F1F1F' }}>
              <View><Text style={{ color: '#A3A3A3', fontSize: r(22) }}>Plano</Text><Text style={{ color: '#fff', fontSize: r(34), fontWeight: '800' }}>{payPlan?.name}</Text></View>
              <View><Text style={{ color: '#A3A3A3', fontSize: r(22) }}>Total</Text><Text style={{ color: '#fff', fontSize: r(34), fontWeight: '800' }}>{payPlan ? fmtP(payPlan.promo_price != null ? payPlan.promo_price : payPlan.price) : ''}</Text></View>
              <Text style={{ color: '#4ADE80', fontSize: r(26), fontWeight: '800' }}>● Aguardando pagamento…</Text>
            </View>
            <Text style={{ color: '#A3A3A3', fontSize: r(24), marginTop: r(22) }}>A TV atualiza sozinha assim que o pagamento for confirmado.</Text>
          </View>
        </View>
        <TVPressable hasTVPreferredFocus onPress={() => { setQrUrl(''); setStatusMsg(''); }} style={({ focused }) => [{ alignSelf: 'flex-start', paddingHorizontal: r(34), paddingVertical: r(18), borderRadius: r(12), backgroundColor: '#1F1F1F', borderWidth: 3, borderColor: focused ? '#fff' : '#2A2A2A' }]}>
          <Text style={{ color: '#fff', fontSize: r(26), fontWeight: '800' }}>Voltar aos planos</Text>
        </TVPressable>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#07070f', '#0a0a14', '#0d0d18']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.logo}>FLIXHOME</Text>
        <Text style={s.title}>Escolha seu plano</Text>
        <Text style={s.sub}>
          {tab === 0
            ? 'Acesso ilimitado a filmes e séries em alta qualidade'
            : 'Filmes, séries e centenas de canais ao vivo IPTV'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TabBtn
            key={t.key}
            label={t.label}
            icon={t.icon}
            active={tab === i}
            isIPTV={i === 1}
            hasTVPreferredFocus={i === initialTab && i === 0}
            onPress={() => { setTab(i); setSel({ tab: i, period: null }); }}
          />
        ))}
      </View>

      {trial?.available && (
        <TVPressable
          onFocus={() => setTrialFoc(true)} onBlur={() => setTrialFoc(false)} onPress={startTrial}
          style={[s.trialBox, trialFoc && s.trialBoxFoc]}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.trialTitle}>Teste grátis por {trial.days} dias</Text>
            <Text style={s.trialSub}>Sem cartão. Cancele quando quiser.</Text>
          </View>
          <View style={s.trialBtn}>{trialBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.trialBtnTxt}>Começar</Text>}</View>
        </TVPressable>
      )}

      {!loading && tab === 1 && iptvPlans.length > 0 && (
        <Text style={s.bundle}>🎁 Inclui a assinatura do app (filmes e séries) pelo mesmo período</Text>
      )}

      {!loading && periods.length > 1 && (
        <View style={s.periodBar}>
          {periods.map(mo => <PeriodChip key={mo} months={mo} saving={saving(mo)} active={mo === period} onPress={() => pickPeriod(mo)} onFocus={() => pickPeriod(mo)} />)}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={ACCENT} size="large" style={{ marginTop: r(64) }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.planRow}
          showsVerticalScrollIndicator={false}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {plans.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>{tab === 1 ? '📺' : '🎬'}</Text>
              <Text style={s.emptyTitle}>
                {tab === 1 ? 'Nenhum plano IPTV disponível' : 'Nenhum plano disponível'}
              </Text>
              <Text style={s.emptySub}>Entre em contato com o administrador.</Text>
            </View>
          ) : (
            plans.map((plan, idx) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isIPTV={tab === 1}
                busy={busyId === plan.id}
                hasTVPreferredFocus={idx === 0 && !loading && periods.length <= 1}
                onPress={() => handleSubscribe(plan)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Status */}
      {!!statusMsg && (
        <View style={s.statusBox}>
          {!!qrUrl && <Image source={{ uri: qrUrl }} style={{ width: 220, height: 220, backgroundColor: '#fff', borderRadius: 12, alignSelf: 'center', marginBottom: 14 }} />}
          <Text style={[
            s.statusTxt,
            statusMsg.startsWith('Erro') && { color: '#ff6b6b' }
          ]}>
            {statusMsg}
          </Text>
        </View>
      )}

      {/* Logout */}
      <TVPressable
        onPress={logout}
        style={({ focused }) => [s.logoutBtn, focused && s.logoutBtnFoc]}
      >
        <Text style={s.logoutTxt}>Sair da conta</Text>
      </TVPressable>

      {/* D-pad hint */}
      <Text style={s.hint}>↑↓←→ navegar  •  OK confirmar</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { alignItems: 'center', paddingTop: r(48), paddingBottom: r(28) },
  logo:         { fontSize: r(32), fontWeight: '900', color: ACCENT, letterSpacing: r(6), marginBottom: r(8) },
  title:        { fontSize: r(26), fontWeight: '800', color: '#fff', marginBottom: r(6) },
  sub:          { fontSize: r(15), color: '#555', textAlign: 'center', maxWidth: r(700) },

  periodBar:    { flexDirection: 'row', justifyContent: 'center', gap: r(14), marginBottom: r(30) },
  period:       { minWidth: r(130), alignItems: 'center', paddingVertical: r(10), paddingHorizontal: r(20), borderRadius: r(14), backgroundColor: '#141414', borderWidth: 3, borderColor: '#1F1F1F' },
  periodOn:     { backgroundColor: '#E5E5E5', borderColor: '#E5E5E5' },
  periodFoc:    { borderColor: '#fff', transform: [{ scale: 1.08 }] },
  periodNum:    { color: '#fff', fontSize: r(34), fontWeight: '900' },
  periodUnit:   { color: '#888', fontSize: r(15), fontWeight: '700' },
  periodSave:   { color: '#4ADE80', fontSize: r(14), fontWeight: '900', marginTop: r(2) },
  bundle:       { alignSelf: 'center', color: '#86EFAC', fontSize: r(16), fontWeight: '700', marginTop: -r(14), marginBottom: r(18) },
  tabBar:       { flexDirection: 'row', justifyContent: 'center', gap: r(8), marginBottom: r(32) },
  tab:          { flexDirection: 'row', paddingHorizontal: r(40), paddingVertical: r(12), borderRadius: r(10), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)' },
  tabActive:    { backgroundColor: '#fff', borderColor: '#fff' },
  tabActiveIPTV:{ backgroundColor: ACCENT, borderColor: ACCENT },
  tabRow:       { flexDirection: 'row', alignItems: 'center', gap: r(8) },
  tabTxt:       { fontSize: r(15), fontWeight: '700', color: '#666' },
  tabTxtActive: { color: '#fff' },

  planRow:      { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: r(40), gap: r(20), flexWrap: 'wrap', paddingBottom: r(16) },
  card:         { width: r(400), minHeight: r(330), padding: r(30), paddingTop: r(34), borderRadius: r(20), backgroundColor: '#141414', borderWidth: 3, borderColor: '#1F1F1F' },
  pill:         { position: 'absolute', top: -r(16), left: r(28), backgroundColor: ACCENT, borderRadius: 999, paddingHorizontal: r(16), paddingVertical: r(6) },
  pillTxt:      { color: '#fff', fontSize: r(15), fontWeight: '900' },
  per:          { color: '#A3A3A3', fontSize: r(22), paddingBottom: r(6) },
  feat:         { flexDirection: 'row', alignItems: 'center', gap: r(12), marginBottom: r(8) },
  featTxt:      { color: '#E5E5E5', fontSize: r(24) },
  cardFoc:      { borderColor: '#fff', transform: [{ scale: 1.06 }] },
  cardHL:       { borderColor: ACCENT, backgroundColor: '#190f10', shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12 },
  badgeWrap:    { marginBottom: r(8) },
  badge:        { color: ACCENT, fontSize: r(10), fontWeight: '800', letterSpacing: 1.5 },
  planName:     { fontSize: r(30), fontWeight: '800', color: '#fff', marginBottom: r(12) },
  planNameFoc:  { color: '#fff' },
  priceRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: r(10), marginBottom: r(16) },
  price:        { fontSize: r(52), fontWeight: '900', color: '#fff' },
  priceFoc:     { color: '#fff' },
  priceOld:     { fontSize: r(20), color: '#777', textDecorationLine: 'line-through' },
  planDesc:     { fontSize: r(13), color: '#444', lineHeight: r(18), marginBottom: r(12) },
  planDescFoc:  { color: '#666' },
  feat:         { flexDirection: 'row', alignItems: 'center', gap: r(8), marginBottom: r(8) },
  featTxt:      { fontSize: r(13), color: '#444' },
  featTxtFoc:   { color: '#aaa' },
  btn:          { marginTop: r(20), paddingVertical: r(14), borderRadius: r(10), alignItems: 'center' },
  btnDef:       { backgroundColor: '#1e1e1e' },
  btnFoc:       { backgroundColor: '#fff' },
  btnIPTV:      { backgroundColor: ACCENT },
  btnHL:        { backgroundColor: ACCENT },
  btnTxt:       { fontSize: r(15), fontWeight: '700', color: '#fff' },
  btnTxtDef:    { color: '#888' },

  trialBox:     { alignSelf: 'center', width: r(760), flexDirection: 'row', alignItems: 'center', gap: r(20), padding: r(18), marginBottom: r(24), borderRadius: r(14), backgroundColor: 'rgba(229,9,20,0.10)', borderWidth: 3, borderColor: 'rgba(229,9,20,0.5)' },
  trialBoxFoc:  { borderColor: '#fff', backgroundColor: 'rgba(229,9,20,0.22)', transform: [{ scale: 1.06 }] },
  trialTitle:   { color: '#fff', fontSize: r(22), fontWeight: '800' },
  trialSub:     { color: '#A3A3A3', fontSize: r(14), marginTop: r(2) },
  trialBtn:     { backgroundColor: ACCENT, paddingHorizontal: r(28), paddingVertical: r(12), borderRadius: r(10) },
  trialBtnTxt:  { color: '#fff', fontSize: r(16), fontWeight: '800' },

  emptyBox:     { alignItems: 'center', paddingVertical: r(48), gap: r(10) },
  emptyIcon:    { fontSize: r(48) },
  emptyTitle:   { color: '#fff', fontSize: r(17), fontWeight: '700' },
  emptySub:     { color: '#555', fontSize: r(13) },

  statusBox:    { marginHorizontal: r(40), marginTop: r(8), backgroundColor: '#111', borderRadius: r(12), padding: r(20), borderWidth: 1, borderColor: '#222' },
  statusTxt:    { color: '#fff', fontSize: r(14), textAlign: 'center', lineHeight: r(20) },

  logoutBtn:    { alignSelf: 'center', marginTop: r(16), paddingHorizontal: r(32), paddingVertical: r(12), borderRadius: r(8), borderWidth: 1.5, borderColor: '#222' },
  logoutBtnFoc: { borderColor: ACCENT },
  logoutTxt:    { color: '#444', fontSize: r(13), fontWeight: '600' },
  hint:         { alignSelf: 'center', marginTop: r(12), color: '#2a2a2a', fontSize: r(12) },
});
