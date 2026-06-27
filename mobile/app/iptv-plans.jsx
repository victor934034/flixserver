import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

const ACCENT = '#E50914';

export default function IptvPlansScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();

  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying,  setBuying]  = useState(null);

  // If user has a basic plan, compute the base price to deduct
  const basicPrice = user?.plan_price ? Number(user.plan_price) : 0;
  const hasBasic   = !!(user?.plan && !user?.plan_includes_iptv && basicPrice > 0);

  useEffect(() => {
    api.get('/iptv/plans')
      .then(r => setPlans(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function subscribe(plan) {
    setBuying(plan.id);
    try {
      const { data } = await api.post('/iptv/subscribe', { plan_id: plan.id });
      if (data.init_point) {
        await Linking.openURL(data.init_point);
        Alert.alert(
          'Pagamento iniciado',
          'Após o pagamento, volte ao app e aguarde a ativação pelo administrador.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          'Solicitação enviada!',
          'O administrador foi notificado e ativará sua assinatura IPTV em breve.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível iniciar o pagamento.');
    } finally {
      setBuying(null);
    }
  }

  const finalPrice = (plan) => {
    const base = plan.promo_price != null ? Number(plan.promo_price) : Number(plan.price);
    if (!hasBasic) return base;
    return Math.max(0, base - basicPrice);
  };

  const fmt = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planos IPTV</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : plans.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40 }}>📺</Text>
          <Text style={styles.emptyTitle}>Nenhum plano disponível</Text>
          <Text style={styles.emptySub}>Entre em contato com o administrador.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <Ionicons name="tv" size={36} color={ACCENT} />
            <Text style={styles.heroTitle}>Adicionar IPTV</Text>
            <Text style={styles.heroSub}>Centenas de canais ao vivo com qualidade HD e 4K</Text>
          </View>

          {/* Discount notice */}
          {hasBasic && (
            <View style={styles.discountBox}>
              <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
              <Text style={styles.discountText}>
                Você já tem um plano ativo. O valor do seu plano atual ({fmt(basicPrice)}) será descontado.
              </Text>
            </View>
          )}

          {/* Plans */}
          {plans.map(plan => {
            const full  = plan.promo_price != null ? Number(plan.promo_price) : Number(plan.price);
            const final = finalPrice(plan);
            const isBusy = buying === plan.id;

            return (
              <View key={plan.id} style={[styles.card, plan.highlight && styles.cardHL]}>
                {plan.badge ? (
                  <View style={styles.badgeRow}>
                    <Text style={styles.badge}>{plan.badge}</Text>
                  </View>
                ) : null}

                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    {plan.description ? (
                      <Text style={styles.planDesc}>{plan.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.priceCol}>
                    {hasBasic && final !== full && (
                      <Text style={styles.priceStrike}>{fmt(full)}</Text>
                    )}
                    <Text style={styles.price}>{fmt(final)}</Text>
                    {hasBasic && final !== full && (
                      <Text style={styles.priceSave}>economiza {fmt(full - final)}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.features}>
                  <View style={styles.feat}>
                    <Ionicons name="tv-outline" size={14} color="#555" />
                    <Text style={styles.featTxt}>Canais ao vivo incluídos</Text>
                  </View>
                  {plan.max_streams ? (
                    <View style={styles.feat}>
                      <Ionicons name="people-outline" size={14} color="#555" />
                      <Text style={styles.featTxt}>
                        {plan.max_streams} tela{plan.max_streams > 1 ? 's' : ''} simultânea{plan.max_streams > 1 ? 's' : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.btn, plan.highlight && styles.btnHL, isBusy && styles.btnDis]}
                  onPress={() => subscribe(plan)}
                  disabled={!!buying}
                  activeOpacity={0.85}
                >
                  {isBusy
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.btnTxt}>
                        {hasBasic ? 'Adicionar IPTV' : 'Assinar agora'}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111' },
  backBtn:      { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10 },
  headerTitle:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  content:      { padding: 16, paddingBottom: 48 },
  hero:         { alignItems: 'center', paddingVertical: 28, gap: 8 },
  heroTitle:    { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroSub:      { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  discountBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#0a1f0a', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#155215' },
  discountText: { color: '#86efac', fontSize: 13, flex: 1, lineHeight: 18 },
  emptyTitle:   { color: '#fff', fontSize: 17, fontWeight: '700' },
  emptySub:     { color: '#555', fontSize: 13 },
  card:         { backgroundColor: '#111', borderRadius: 16, padding: 20, marginBottom: 14, borderWidth: 1.5, borderColor: '#1a1a1a' },
  cardHL:       { borderColor: ACCENT },
  badgeRow:     { marginBottom: 8 },
  badge:        { color: ACCENT, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  cardRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  planName:     { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  planDesc:     { color: '#666', fontSize: 13, lineHeight: 18 },
  priceCol:     { alignItems: 'flex-end', minWidth: 80 },
  price:        { color: '#fff', fontSize: 26, fontWeight: '900' },
  priceStrike:  { color: '#333', fontSize: 13, textDecorationLine: 'line-through', marginBottom: 2 },
  priceSave:    { color: '#22c55e', fontSize: 11, fontWeight: '700', marginTop: 2 },
  features:     { gap: 6, marginBottom: 16 },
  feat:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featTxt:      { color: '#555', fontSize: 13 },
  btn:          { backgroundColor: '#1e1e1e', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnHL:        { backgroundColor: ACCENT },
  btnDis:       { opacity: 0.5 },
  btnTxt:       { color: '#fff', fontWeight: '700', fontSize: 15 },
});
