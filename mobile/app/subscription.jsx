import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Linking, BackHandler, AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import PlanCard, { brl, periodOf, periodName } from '../components/PlanCard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

const ACCENT = '#E50914';

const TABS = [
  { key: 'streaming', label: 'Filmes & Séries', icon: 'film-outline' },
  { key: 'iptv',      label: 'Com IPTV',        icon: 'tv-outline' },
];

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { logout, refreshUser } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [tab,         setTab]         = useState(params?.tab === 'iptv' ? 1 : 0);
  const [basicPlans,  setBasicPlans]  = useState([]);
  const [iptvPlans,   setIptvPlans]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState('');
  const [subscribing, setSubscribing] = useState('');
  const [checking,    setChecking]    = useState(false);
  const [trial, setTrial] = useState(null);
  const [trialBusy, setTrialBusy] = useState(false);
  const appState = useRef(AppState.currentState);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, [])
  );

  // Check subscription bypass
  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      if (data.subscription_enabled !== 'true') router.replace('/profile-select');
    }).catch(() => {});
  }, []);

  // Detect return from browser after payment
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        setChecking(true);
        try {
          const { data: settings } = await api.get('/settings');
          if (settings?.subscription_enabled !== 'true') { router.replace('/profile-select'); return; }
          await refreshUser();
          const { data: me } = await api.get('/auth/me');
          const hasValid = me?.plan && me?.plan_expires_at && new Date(me.plan_expires_at).getTime() > Date.now();
          if (hasValid) router.replace('/profile-select');
        } catch {}
        setChecking(false);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // Polling every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data: settings } = await api.get('/settings');
        if (settings?.subscription_enabled !== 'true') { router.replace('/profile-select'); return; }
        const { data: me } = await api.get('/auth/me');
        const hasValid = me?.plan && me?.plan_expires_at && new Date(me.plan_expires_at).getTime() > Date.now();
        if (hasValid) router.replace('/profile-select');
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [basicRes, iptvRes] = await Promise.allSettled([
        api.get('/payments/plans').then(r => r.data || []),
        api.get('/iptv/plans').then(r => r.data || []),
      ]);
      const basic = basicRes.status === 'fulfilled' ? basicRes.value : [];
      const iptv  = iptvRes.status === 'fulfilled'  ? iptvRes.value  : [];
      setBasicPlans(basic.filter(p => !p.includes_iptv));
      // IPTV tab: dedicated iptv plans, or combo plans from basic
      setIptvPlans(iptv.length > 0 ? iptv : basic.filter(p => p.includes_iptv));
    } catch (e) {
      setLoadError(e.message || 'Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, []);
  useEffect(() => { api.get('/payments/trial').then(r => setTrial(r.data)).catch(() => {}); }, []);

  const startTrial = async () => {
    setTrialBusy(true);
    try {
      await api.post('/payments/trial/start');
      await refreshUser();
      router.replace('/profile-select');
    } catch (e) {
      Alert.alert('Teste grátis', e.response?.data?.error || 'Não foi possível ativar o teste grátis.');
    } finally { setTrialBusy(false); }
  };

  const plans = tab === 0 ? basicPlans : iptvPlans;

  const [selected, setSelected] = useState(null);
  useEffect(() => {
    // seleciona o plano em destaque (ou o primeiro) ao carregar/trocar de aba
    const list = tab === 0 ? basicPlans : iptvPlans;
    if (list.length && !list.find(p => p.id === selected)) setSelected((list.find(p => p.highlight) || list[0]).id);
  }, [tab, basicPlans, iptvPlans]);

  const goCheckout = () => {
    if (!selected) return;
    router.push({ pathname: '/checkout', params: { kind: tab === 1 ? 'iptv' : 'plan', plan_id: selected } });
  };

  const fmt = brl;
  const selPlan = plans.find(p => p.id === selected);
  const selPrice = selPlan ? (selPlan.promo_price != null ? selPlan.promo_price : selPlan.price) : 0;
  const featuresOf = (p) => [
    'Catálogo completo',
    p.max_streams ? `${p.max_streams} tela${p.max_streams > 1 ? 's' : ''} simultânea${p.max_streams > 1 ? 's' : ''}` : null,
    p.description || null,
    tab === 1 ? 'Canais ao vivo incluídos' : (p.max_streams >= 2 ? 'Assistir juntos com chat e voz' : null),
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#3a0a0c', '#1a0708', '#0A0A0A']} style={StyleSheet.absoluteFill} locations={[0, 0.25, 0.6]} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={logout} style={styles.circleBtn} hitSlop={8}><Ionicons name="log-out-outline" size={20} color="#fff" /></TouchableOpacity>
          <Text style={styles.logo}>FLIXHOME</Text>
          <View style={{ width: 44 }} />
        </View>

        <Text style={styles.h1}>Assista sem limites.{'\n'}Cancele quando quiser.</Text>
        <Text style={styles.lead}>Escolha o plano ideal para você e sua família.</Text>

        <View style={styles.chips}>
          {['Sem anúncios', 'Até 5 perfis', 'Qualidade até 4K', 'Telas simultâneas'].map(t => (
            <View key={t} style={styles.chip}><Ionicons name="checkmark" size={16} color="#22C55E" /><Text style={styles.chipTxt}>{t}</Text></View>
          ))}
        </View>

        {trial?.available && (
          <View style={styles.trialCard}>
            <View style={styles.trialRow}>
              <View style={styles.gift}><Ionicons name="gift" size={22} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trialTitle}>Teste grátis por {trial.days} dias</Text>
                <Text style={styles.trialSub}>Sem cartão. Acesso completo ao catálogo.</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.trialBtn} onPress={startTrial} disabled={trialBusy} activeOpacity={0.9}>
              {trialBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.trialBtnTxt}>Começar teste grátis</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.seg}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t.key} style={[styles.segBtn, tab === i && styles.segOn]} onPress={() => setTab(i)} activeOpacity={0.85}>
              <Text style={[styles.segTxt, tab === i && { color: '#111' }]}>{i === 1 ? 'IPTV ao vivo' : t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {checking && (
          <View style={styles.checking}><ActivityIndicator color={ACCENT} size="small" /><Text style={styles.checkingTxt}>Verificando pagamento...</Text></View>
        )}

        {loading ? (
          <ActivityIndicator color={ACCENT} size="large" style={{ marginTop: 48 }} />
        ) : loadError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={32} color={ACCENT} />
            <Text style={styles.errorTitle}>Erro ao carregar planos</Text>
            <Text style={styles.errorMsg}>{loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadPlans}><Text style={styles.retryText}>Tentar novamente</Text></TouchableOpacity>
          </View>
        ) : plans.length === 0 ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{tab === 1 ? 'Nenhum plano IPTV disponível' : 'Nenhum plano disponível'}</Text>
            <Text style={styles.errorMsg}>Entre em contato com o administrador.</Text>
          </View>
        ) : (
          plans.map(plan => (
            <PlanCard key={plan.id} plan={plan} selected={selected === plan.id} onPress={() => setSelected(plan.id)}
              subtitle={[plan.max_streams ? `${plan.max_streams} tela${plan.max_streams > 1 ? 's' : ''}` : null, plan.duration_days ? `${plan.duration_days} dias` : null].filter(Boolean).join(' · ')}
              features={featuresOf(plan)} />
          ))
        )}
      </ScrollView>

      {!loading && !loadError && plans.length > 0 && (
        <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.ctaRow}>
            <Text style={styles.ctaLeft}>{selPlan ? `${selPlan.name} · ${periodName(selPlan)}` : ''}</Text>
            <Text style={styles.ctaRight}>{selPlan ? `${brl(selPrice)}${periodOf(selPlan)}` : ''}</Text>
          </View>
          <TouchableOpacity style={[styles.ctaBtn, !selected && { opacity: 0.5 }]} disabled={!selected} onPress={goCheckout} activeOpacity={0.9}>
            <Text style={styles.ctaTxt}>Continuar para pagamento</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circleBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  logo: { color: ACCENT, fontWeight: '900', letterSpacing: 6, fontSize: 17 },
  h1: { color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center', marginTop: 22, lineHeight: 38 },
  lead: { color: '#A3A3A3', fontSize: 15, textAlign: 'center', marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  chip: { flexBasis: '48.5%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  chipTxt: { color: '#E5E5E5', fontWeight: '700', fontSize: 14 },
  trialCard: { marginTop: 20, borderRadius: 18, padding: 14, backgroundColor: 'rgba(229,9,20,0.10)', borderWidth: 1.5, borderColor: 'rgba(229,9,20,0.45)', gap: 14 },
  trialRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gift: { width: 48, height: 48, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  trialTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  trialSub: { color: '#B3B3B3', fontSize: 13.5, marginTop: 2 },
  trialBtn: { height: 52, borderRadius: 12, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  trialBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  seg: { flexDirection: 'row', marginTop: 20, backgroundColor: '#141414', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#1F1F1F' },
  segBtn: { flex: 1, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#E5E5E5' },
  segTxt: { color: '#A3A3A3', fontWeight: '800', fontSize: 14 },
  checking: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#141414', paddingVertical: 10, borderRadius: 10, marginTop: 12 },
  checkingTxt: { color: '#aaa', fontSize: 13 },
  errorBox: { alignItems: 'center', padding: 32, gap: 10 },
  errorTitle: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  errorMsg: { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retryBtn: { backgroundColor: ACCENT, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(10,10,10,0.97)', borderTopWidth: 1, borderTopColor: '#1F1F1F', gap: 10 },
  ctaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ctaLeft: { color: '#A3A3A3', fontSize: 14 },
  ctaRight: { color: '#fff', fontSize: 14, fontWeight: '800' },
  ctaBtn: { height: 56, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
