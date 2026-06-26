import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../lib/api';

export default function PlansScreen() {
  const router = useRouter();
  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying,  setBuying]  = useState(null);

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
      // Abre o checkout do Mercado Pago no navegador externo
      await Linking.openURL(data.init_point);
      // Ao voltar ao app, mostra mensagem
      Alert.alert(
        'Pagamento iniciado',
        'Após o pagamento, volte ao app e aguarde a ativação pelo administrador (até 24h).',
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível iniciar o pagamento.');
    } finally {
      setBuying(null);
    }
  }

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#c91c2c" />
    </View>
  );

  if (plans.length === 0) return (
    <View style={styles.center}>
      <Text style={styles.icon}>📋</Text>
      <Text style={styles.emptyTitle}>Nenhum plano disponível</Text>
      <Text style={styles.emptyText}>Entre em contato com o administrador.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.headerTitle}>Planos IPTV</Text>
        <Text style={styles.headerSub}>Acesso a centenas de canais ao vivo</Text>
      </View>

      <FlatList
        data={plans}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.planDesc}>{item.description}</Text>
                ) : null}
                <Text style={styles.planDuration}>
                  {item.duration_months} {item.duration_months === 1 ? 'mês' : 'meses'} de acesso
                </Text>
              </View>
              <Text style={styles.planPrice}>
                R${' '}
                <Text style={styles.planPriceValue}>
                  {Number(item.price).toFixed(2).replace('.', ',')}
                </Text>
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, buying === item.id && styles.btnDis]}
              onPress={() => subscribe(item)}
              disabled={!!buying}
              activeOpacity={0.8}
            >
              {buying === item.id
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Assinar agora</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      />

      <Text style={styles.footer}>
        Após o pagamento, seu acesso será ativado em até 24 horas.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },

  headerBox: {
    padding: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#141414',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub:   { color: '#555', fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: '#111', borderRadius: 14,
    padding: 18, borderWidth: 1, borderColor: '#1e1e1e',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  planName:  { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  planDesc:  { color: '#666', fontSize: 13, marginBottom: 4 },
  planDuration: { color: '#555', fontSize: 12 },
  planPrice: { color: '#888', fontSize: 13, textAlign: 'right' },
  planPriceValue: { color: '#c91c2c', fontSize: 26, fontWeight: '800' },

  btn: {
    backgroundColor: '#c91c2c', padding: 14,
    borderRadius: 10, alignItems: 'center',
  },
  btnDis:  { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  icon:       { fontSize: 52 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  emptyText:  { color: '#555', fontSize: 14 },

  footer: {
    color: '#333', fontSize: 12, textAlign: 'center',
    padding: 16, paddingTop: 4,
  },
});
