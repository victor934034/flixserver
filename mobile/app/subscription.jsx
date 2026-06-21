import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Linking, BackHandler, AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

const DURATION_TABS = [
  { key: 'monthly',    label: 'Mensal',     suffix: '/mês' },
  { key: 'quarterly',  label: 'Trimestral', suffix: '/trim.' },
  { key: 'yearly',     label: 'Anual',      suffix: '/ano' },
];

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { logout, refreshUser } = useAuth();
  const router = useRouter();
  const [plans, setPlans]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState('');
  const [tab, setTab]                 = useState('monthly');
  const [subscribing, setSubscribing] = useState('');
  const [checking, setChecking]       = useState(false);
  const appState = useRef(AppState.currentState);

  // Bloqueia botão físico de voltar no Android
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, [])
  );

  // Detecta retorno do browser após pagamento e verifica se o plano foi ativado
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        setChecking(true);
        try {
          await refreshUser();
          // Busca dados frescos do usuário
          const { data: me } = await api.get('/auth/me');
          const now = Date.now();
          const hasValid = me?.plan && me?.plan_expires_at
            && new Date(me.plan_expires_at).getTime() > now;
          if (hasValid) {
            router.replace('/profile-select');
          }
        } catch {}
        setChecking(false);
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    api.get('/payments/plans')
      .then(r => { setPlans(r.data || []); setLoadError(''); })
      .catch(e => {
        setPlans([]);
        const msg = e.response?.data?.error || e.message || 'Erro ao carregar planos';
        setLoadError(msg);
        console.warn('[subscription] plans error:', msg);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (plan) => {
    setSubscribing(plan.id);
    try {
      const { data } = await api.post('/payments/subscribe', { plan_id: plan.id });
      if (data.init_point) await Linking.openURL(data.init_point);
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível iniciar o pagamento.');
    } finally {
      setSubscribing('');
    }
  };

  const tabPlans = plans.filter(p => p.id?.startsWith(tab));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>FLIXHOME</Text>
        <Text style={styles.title}>Escolha seu plano</Text>
        <Text style={styles.subtitle}>Acesso ilimitado a filmes e séries. Cancele quando quiser.</Text>
      </View>

      {/* Tabs de duração */}
      <View style={styles.tabRow}>
        {DURATION_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {checking && (
        <View style={styles.checkingBanner}>
          <ActivityIndicator color="#E50914" size="small" />
          <Text style={styles.checkingText}>Verificando pagamento...</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#E50914" size="large" style={{ marginTop: 48 }} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loadError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={32} color="#E50914" />
              <Text style={styles.errorTitle}>Erro ao carregar planos</Text>
              <Text style={styles.errorMsg}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => {
                setLoading(true); setLoadError('');
                api.get('/payments/plans')
                  .then(r => { setPlans(r.data || []); setLoadError(''); })
                  .catch(e => { setPlans([]); setLoadError(e.response?.data?.error || e.message || 'Erro'); })
                  .finally(() => setLoading(false));
              }}>
                <Text style={styles.retryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : tabPlans.length === 0 ? (
            <Text style={styles.noPlans}>Nenhum plano disponível para esta duração.</Text>
          ) : (
            tabPlans.map(plan => {
              const suffix = DURATION_TABS.find(t => t.key === tab)?.suffix || '';
              const isBusy = subscribing === plan.id;
              return (
                <View key={plan.id} style={[styles.card, plan.highlight && styles.cardHighlight]}>
                  {plan.badge && <Text style={styles.badge}>{plan.badge}</Text>}

                  {/* Telas simultâneas em destaque */}
                  <View style={styles.streamsRow}>
                    <Ionicons name="people" size={16} color={plan.highlight ? '#E50914' : '#aaa'} />
                    <Text style={[styles.streamsText, plan.highlight && styles.streamsTextHL]}>
                      {plan.max_streams} {plan.max_streams === 1 ? 'tela simultânea' : 'telas simultâneas'}
                    </Text>
                  </View>

                  {/* Preço */}
                  <View style={styles.priceRow}>
                    {plan.promo_price != null ? (
                      <>
                        <Text style={styles.price}>
                          R$ {plan.promo_price.toFixed(2).replace('.', ',')}
                        </Text>
                        <Text style={styles.priceOld}>
                          R$ {plan.price.toFixed(2).replace('.', ',')}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.price}>
                        R$ {plan.price.toFixed(2).replace('.', ',')}
                      </Text>
                    )}
                    <Text style={styles.priceSuffix}>{suffix}</Text>
                  </View>

                  {plan.description ? <Text style={styles.desc}>{plan.description}</Text> : null}

                  <TouchableOpacity
                    style={[styles.btn, plan.highlight && styles.btnHL, isBusy && styles.btnDisabled]}
                    onPress={() => handleSubscribe(plan)}
                    disabled={!!subscribing}
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
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8, alignItems: 'center' },
  logo: { fontSize: 26, fontWeight: '900', color: '#E50914', letterSpacing: 4, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18, marginBottom: 4 },

  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginVertical: 16, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#E50914' },
  tabText: { color: '#666', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },

  content: { paddingHorizontal: 16, paddingBottom: 32 },
  noPlans: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },

  card: {
    backgroundColor: '#1a1a1a', borderRadius: 14, padding: 20, marginBottom: 14,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  cardHighlight: { borderColor: '#E50914', borderWidth: 2 },
  badge: { color: '#E50914', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },

  streamsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  streamsText: { color: '#aaa', fontSize: 15, fontWeight: '700' },
  streamsTextHL: { color: '#E50914' },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 4 },
  price: { color: '#fff', fontSize: 24, fontWeight: '900' },
  priceOld: { color: '#555', fontSize: 14, textDecorationLine: 'line-through' },
  priceSuffix: { color: '#666', fontSize: 13 },

  desc: { color: '#666', fontSize: 12, marginBottom: 14, marginTop: 2 },

  btn: { backgroundColor: '#2a2a2a', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnHL: { backgroundColor: '#E50914' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  logoutBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
  logoutText: { color: '#444', fontSize: 13 },
  errorBox: { alignItems: 'center', padding: 24, gap: 12 },
  errorTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorMsg: { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  retryBtn: { backgroundColor: '#E50914', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  checkingBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1a1a1a', paddingVertical: 10, marginHorizontal: 16, borderRadius: 8,
    marginBottom: 4,
  },
  checkingText: { color: '#aaa', fontSize: 13 },
});
