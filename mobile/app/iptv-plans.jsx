import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';

export default function IptvPlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      await Linking.openURL(data.init_point);
      Alert.alert(
        'Pagamento iniciado',
        'Após o pagamento, volte ao app e aguarde a ativação pelo administrador (até 24h).',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível iniciar o pagamento.');
    } finally {
      setBuying(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planos IPTV</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E50914" />
        </View>
      ) : plans.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Nenhum plano disponível</Text>
          <Text style={styles.emptySub}>Entre em contato com o administrador.</Text>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.listSub}>Acesso a centenas de canais ao vivo</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{item.name}</Text>
                  {item.description ? <Text style={styles.planDesc}>{item.description}</Text> : null}
                  <Text style={styles.planDuration}>
                    {item.duration_months} {item.duration_months === 1 ? 'mês' : 'meses'} de acesso
                  </Text>
                </View>
                <Text style={styles.planPrice}>
                  R$ <Text style={styles.planPriceValue}>{Number(item.price).toFixed(2).replace('.', ',')}</Text>
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0a0a0a' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#141414' },
  back:           { paddingRight: 12, paddingVertical: 4 },
  backText:       { color: '#E50914', fontSize: 32, lineHeight: 32 },
  headerTitle:    { color: '#fff', fontSize: 17, fontWeight: '700' },
  list:           { padding: 16, gap: 12 },
  listSub:        { color: '#555', fontSize: 13, marginBottom: 8 },
  emptyIcon:      { fontSize: 48 },
  emptyTitle:     { color: '#fff', fontSize: 17, fontWeight: '700' },
  emptySub:       { color: '#555', fontSize: 13 },
  card:           { backgroundColor: '#111', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#1e1e1e' },
  cardTop:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  planName:       { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  planDesc:       { color: '#666', fontSize: 13, marginBottom: 4 },
  planDuration:   { color: '#555', fontSize: 12 },
  planPrice:      { color: '#888', fontSize: 13, textAlign: 'right' },
  planPriceValue: { color: '#E50914', fontSize: 26, fontWeight: '800' },
  btn:            { backgroundColor: '#E50914', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnDis:         { opacity: 0.5 },
  btnText:        { color: '#fff', fontWeight: '700', fontSize: 15 },
});
