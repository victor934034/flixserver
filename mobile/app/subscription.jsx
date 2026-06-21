import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

export default function SubscriptionScreen() {
  const { logout } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState('');

  useEffect(() => {
    api.get('/payments/plans')
      .then(r => setPlans(r.data))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (plan) => {
    setSubscribing(plan.id);
    try {
      const { data } = await api.post('/payments/subscribe', { plan_id: plan.id });
      if (data.init_point) {
        await Linking.openURL(data.init_point);
      }
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível iniciar o pagamento.');
    } finally {
      setSubscribing('');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.logo}>FLIXHOME</Text>
      <Text style={styles.title}>Escolha seu plano</Text>
      <Text style={styles.subtitle}>Acesso ilimitado a filmes e séries. Cancele quando quiser.</Text>

      {loading ? (
        <ActivityIndicator color="#E50914" size="large" style={{ marginTop: 40 }} />
      ) : plans.length === 0 ? (
        <Text style={styles.noPlans}>Nenhum plano disponível no momento.</Text>
      ) : (
        plans.map(plan => (
          <View key={plan.id} style={[styles.planCard, plan.highlight && styles.planHighlight]}>
            {plan.badge && <Text style={styles.planBadge}>{plan.badge}</Text>}
            <Text style={styles.planLabel}>{plan.name}</Text>
            <Text style={styles.planPrice}>
              {plan.promo_price != null
                ? `R$ ${plan.promo_price.toFixed(2).replace('.', ',')}`
                : `R$ ${plan.price.toFixed(2).replace('.', ',')}`}
              {plan.promo_price != null && (
                <Text style={styles.planPriceOld}> R$ {plan.price.toFixed(2).replace('.', ',')}</Text>
              )}
            </Text>
            {plan.description ? <Text style={styles.planDesc}>{plan.description}</Text> : null}
            <TouchableOpacity
              style={[styles.planBtn, plan.highlight && styles.planBtnHighlight, subscribing === plan.id && styles.planBtnDisabled]}
              onPress={() => handleSubscribe(plan)}
              disabled={!!subscribing}
            >
              {subscribing === plan.id
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.planBtnText}>Assinar agora</Text>
              }
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60 },
  logo: { fontSize: 28, fontWeight: '900', color: '#E50914', textAlign: 'center', letterSpacing: 4, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  noPlans: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
  planCard: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  planHighlight: { borderColor: '#E50914', borderWidth: 2 },
  planBadge: { color: '#E50914', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  planLabel: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  planPrice: { color: '#E50914', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  planPriceOld: { color: '#555', fontSize: 14, fontWeight: '400', textDecorationLine: 'line-through' },
  planDesc: { color: '#888', fontSize: 13, marginBottom: 16 },
  planBtn: { backgroundColor: '#2a2a2a', padding: 14, borderRadius: 8, alignItems: 'center' },
  planBtnHighlight: { backgroundColor: '#E50914' },
  planBtnDisabled: { opacity: 0.6 },
  planBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  logoutBtn: { padding: 14, alignItems: 'center', marginTop: 16 },
  logoutText: { color: '#555', fontSize: 14 },
});
