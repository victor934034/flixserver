import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Linking, BackHandler, AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

  const plans = tab === 0 ? basicPlans : iptvPlans;

  const handleSubscribe = async (plan) => {
    setSubscribing(plan.id);
    try {
      const endpoint = tab === 1 ? '/iptv/subscribe' : '/payments/subscribe';
      const { data } = await api.post(endpoint, { plan_id: plan.id });
      if (data.init_point) {
        await Linking.openURL(data.init_point);
        Alert.alert(
          'Pagamento iniciado',
          'Após o pagamento, volte ao app. O administrador será notificado e ativará sua assinatura.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Solicitação enviada!',
          'O administrador foi notificado e ativará sua assinatura em breve.',
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível iniciar o pagamento.');
    } finally {
      setSubscribing('');
    }
  };

  const fmt = (val) => 'R$ ' + Number(val).toFixed(2).replace('.', ',');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>FLIXHOME</Text>
        <Text style={styles.title}>Escolha seu plano</Text>
        <Text style={styles.subtitle}>
          {tab === 0
            ? 'Acesso ilimitado a filmes e séries'
            : 'Filmes, séries e canais ao vivo IPTV'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === i && (i === 1 ? styles.tabActiveIPTV : styles.tabActive)]}
            onPress={() => setTab(i)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={t.icon}
              size={14}
              color={tab === i ? (i === 0 ? '#111' : '#fff') : '#666'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabText, tab === i && (i === 0 ? styles.tabTextActiveStream : styles.tabTextActiveIPTV)]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {checking && (
        <View style={styles.checkingBanner}>
          <ActivityIndicator color={ACCENT} size="small" />
          <Text style={styles.checkingText}>Verificando pagamento...</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={ACCENT} size="large" style={{ marginTop: 48 }} />
      ) : loadError ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={32} color={ACCENT} />
          <Text style={styles.errorTitle}>Erro ao carregar planos</Text>
          <Text style={styles.errorMsg}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadPlans}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {tab === 1 && (
            <View style={styles.iptvBanner}>
              <Ionicons name="tv" size={22} color={ACCENT} />
              <Text style={styles.iptvBannerText}>
                Inclui todos os canais ao vivo do plano Filmes & Séries
              </Text>
            </View>
          )}

          {plans.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>{tab === 1 ? '📺' : '🎬'}</Text>
              <Text style={styles.emptyTitle}>
                {tab === 1 ? 'Nenhum plano IPTV disponível' : 'Nenhum plano disponível'}
              </Text>
              <Text style={styles.emptySub}>Entre em contato com o administrador.</Text>
            </View>
          ) : (
            plans.map(plan => {
              const price  = plan.promo_price != null ? plan.promo_price : plan.price;
              const isBusy = subscribing === plan.id;
              return (
                <View key={plan.id} style={[styles.card, plan.highlight && styles.cardHighlight]}>
                  {plan.badge && (
                    <View style={styles.badgeWrap}>
                      <Text style={styles.badge}>{plan.badge}</Text>
                    </View>
                  )}

                  <Text style={styles.planName}>{plan.name}</Text>

                  {/* Price */}
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{fmt(price)}</Text>
                    {plan.promo_price != null && (
                      <Text style={styles.priceOld}>{fmt(plan.price)}</Text>
                    )}
                  </View>

                  {plan.description ? (
                    <Text style={styles.desc}>{plan.description}</Text>
                  ) : null}

                  {/* Features */}
                  <View style={styles.features}>
                    {plan.max_streams && (
                      <View style={styles.feature}>
                        <Ionicons name="people-outline" size={14} color="#666" />
                        <Text style={styles.featureText}>
                          {plan.max_streams} tela{plan.max_streams > 1 ? 's' : ''} simultânea{plan.max_streams > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                    {tab === 1 && (
                      <View style={styles.feature}>
                        <Ionicons name="tv-outline" size={14} color="#666" />
                        <Text style={styles.featureText}>Canais ao vivo incluídos</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.btn, plan.highlight && styles.btnHL, isBusy && styles.btnDisabled]}
                    onPress={() => handleSubscribe(plan)}
                    disabled={!!subscribing}
                    activeOpacity={0.85}
                  >
                    {isBusy
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.btnText}>Assinar agora</Text>
                    }
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a' },
  header:       { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8, alignItems: 'center' },
  logo:         { fontSize: 26, fontWeight: '900', color: ACCENT, letterSpacing: 5, marginBottom: 8 },
  title:        { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 6 },
  subtitle:     { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18, marginBottom: 4 },

  tabRow:       { flexDirection: 'row', marginHorizontal: 16, marginVertical: 14, backgroundColor: '#111', borderRadius: 12, padding: 4, gap: 4 },
  tab:          { flex: 1, flexDirection: 'row', paddingVertical: 11, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabActive:           { backgroundColor: '#fff' },
  tabActiveIPTV:       { backgroundColor: ACCENT },
  tabText:             { color: '#666', fontWeight: '700', fontSize: 13 },
  tabTextActiveStream: { color: '#111' },
  tabTextActiveIPTV:   { color: '#fff' },

  iptvBanner:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a0a0a', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#2a0a0a' },
  iptvBannerText:{ color: '#aaa', fontSize: 13, flex: 1, lineHeight: 18 },

  content:      { paddingHorizontal: 16, paddingBottom: 40 },

  emptyBox:     { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIcon:    { fontSize: 48 },
  emptyTitle:   { color: '#fff', fontSize: 17, fontWeight: '700' },
  emptySub:     { color: '#555', fontSize: 13, textAlign: 'center' },

  card:         { backgroundColor: '#111', borderRadius: 16, padding: 22, marginBottom: 14, borderWidth: 1.5, borderColor: '#1a1a1a' },
  cardHighlight:{ borderColor: ACCENT },
  badgeWrap:    { marginBottom: 10 },
  badge:        { color: ACCENT, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  planName:     { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 10 },
  priceRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  price:        { color: '#fff', fontSize: 28, fontWeight: '900' },
  priceOld:     { color: '#444', fontSize: 14, textDecorationLine: 'line-through' },
  desc:         { color: '#666', fontSize: 13, marginBottom: 14, lineHeight: 18 },
  features:     { gap: 8, marginBottom: 18 },
  feature:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText:  { color: '#555', fontSize: 13 },
  btn:          { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, alignItems: 'center' },
  btnHL:        { backgroundColor: ACCENT },
  btnDisabled:  { opacity: 0.5 },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },

  logoutBtn:    { padding: 18, alignItems: 'center', marginTop: 12 },
  logoutText:   { color: '#333', fontSize: 13 },

  errorBox:     { alignItems: 'center', padding: 32, gap: 12 },
  errorTitle:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorMsg:     { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retryBtn:     { backgroundColor: ACCENT, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 4 },
  retryText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkingBanner:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111', paddingVertical: 10, marginHorizontal: 16, borderRadius: 8, marginBottom: 4 },
  checkingText: { color: '#aaa', fontSize: 13 },
});
