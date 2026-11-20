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

  return (
    <TVPressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => { setFoc(true); onFocus?.(); }}
      onBlur={() => { setFoc(false); onBlur?.(); }}
      onPress={onPress}
      style={[s.card, foc && s.cardFoc, plan.highlight && s.cardHL]}
    >
      {plan.badge ? (
        <View style={s.badgeWrap}>
          <Text style={s.badge}>{plan.badge}</Text>
        </View>
      ) : null}

      <Text style={[s.planName, foc && s.planNameFoc]}>{plan.name}</Text>

      <View style={s.priceRow}>
        <Text style={[s.price, foc && s.priceFoc]}>
          R$ {Number(price).toFixed(2).replace('.', ',')}
        </Text>
        {plan.promo_price != null && (
          <Text style={s.priceOld}>
            R$ {Number(plan.price).toFixed(2).replace('.', ',')}
          </Text>
        )}
      </View>

      {plan.description ? (
        <Text style={[s.planDesc, foc && s.planDescFoc]}>{plan.description}</Text>
      ) : null}

      {plan.max_streams ? (
        <View style={s.feat}>
          <Ionicons name="people-outline" size={r(14)} color={foc ? '#aaa' : '#444'} />
          <Text style={[s.featTxt, foc && s.featTxtFoc]}>
            {plan.max_streams} tela{plan.max_streams > 1 ? 's' : ''} simultânea{plan.max_streams > 1 ? 's' : ''}
          </Text>
        </View>
      ) : null}

      {isIPTV && (
        <View style={s.feat}>
          <Ionicons name="tv-outline" size={r(14)} color={foc ? '#aaa' : '#444'} />
          <Text style={[s.featTxt, foc && s.featTxtFoc]}>Canais ao vivo incluídos</Text>
        </View>
      )}

      <View style={[s.btn, foc ? (isIPTV ? s.btnIPTV : s.btnFoc) : (plan.highlight ? s.btnHL : s.btnDef)]}>
        {busy
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={[s.btnTxt, !foc && !plan.highlight && s.btnTxtDef]}>Assinar</Text>
        }
      </View>
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
  const [trial,       setTrial]       = useState(null);
  const [trialBusy,   setTrialBusy]   = useState(false);
  const [trialFoc,    setTrialFoc]    = useState(false);

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

  const plans = tab === 0 ? basicPlans : iptvPlans;

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
            onPress={() => setTab(i)}
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

      {loading ? (
        <ActivityIndicator color={ACCENT} size="large" style={{ marginTop: r(64) }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.planRow}
          showsVerticalScrollIndicator={false}
          horizontal={plans.length <= 4}
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
                hasTVPreferredFocus={idx === 0 && !loading}
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

  tabBar:       { flexDirection: 'row', justifyContent: 'center', gap: r(8), marginBottom: r(32) },
  tab:          { flexDirection: 'row', paddingHorizontal: r(40), paddingVertical: r(12), borderRadius: r(10), backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)' },
  tabActive:    { backgroundColor: '#fff', borderColor: '#fff' },
  tabActiveIPTV:{ backgroundColor: ACCENT, borderColor: ACCENT },
  tabRow:       { flexDirection: 'row', alignItems: 'center', gap: r(8) },
  tabTxt:       { fontSize: r(15), fontWeight: '700', color: '#666' },
  tabTxtActive: { color: '#fff' },

  planRow:      { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: r(40), gap: r(20), flexWrap: 'wrap', paddingBottom: r(16) },
  card:         { width: r(300), padding: r(32), borderRadius: r(18), backgroundColor: '#111', borderWidth: 1.5, borderColor: '#1e1e1e' },
  cardFoc:      { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: '#fff', borderWidth: 3, transform: [{ scale: 1.06 }] },
  cardHL:       { borderColor: ACCENT },
  badgeWrap:    { marginBottom: r(8) },
  badge:        { color: ACCENT, fontSize: r(10), fontWeight: '800', letterSpacing: 1.5 },
  planName:     { fontSize: r(18), fontWeight: '800', color: '#ccc', marginBottom: r(8) },
  planNameFoc:  { color: '#fff' },
  priceRow:     { flexDirection: 'row', alignItems: 'baseline', gap: r(8), marginBottom: r(6) },
  price:        { fontSize: r(34), fontWeight: '900', color: ACCENT },
  priceFoc:     { color: '#fff' },
  priceOld:     { fontSize: r(14), color: '#333', textDecorationLine: 'line-through' },
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
