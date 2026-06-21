import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const PLANS = [
  { id: 'monthly',   label: 'Mensal',     price: 'R$ 19,90/mês',   desc: 'Acesso completo por 1 mês',    highlight: false },
  { id: 'quarterly', label: 'Trimestral', price: 'R$ 49,90/3 meses', desc: 'Economia de 16%',             highlight: true  },
  { id: 'yearly',    label: 'Anual',      price: 'R$ 149,90/ano',  desc: 'Melhor custo-benefício (37%)', highlight: false },
];

export default function SubscriptionScreen() {
  const { logout } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.logo}>FLIXHOME</Text>
      <Text style={styles.title}>Escolha seu plano</Text>
      <Text style={styles.subtitle}>Acesso ilimitado a filmes e séries. Cancele quando quiser.</Text>

      {PLANS.map(plan => (
        <View key={plan.id} style={[styles.planCard, plan.highlight && styles.planHighlight]}>
          {plan.highlight && <Text style={styles.planBadge}>MAIS POPULAR</Text>}
          <Text style={styles.planLabel}>{plan.label}</Text>
          <Text style={styles.planPrice}>{plan.price}</Text>
          <Text style={styles.planDesc}>{plan.desc}</Text>
          <TouchableOpacity style={[styles.planBtn, plan.highlight && styles.planBtnHighlight]}
            onPress={() => {/* Mercado Pago — em breve */}}>
            <Text style={styles.planBtnText}>Em breve</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.contactText}>
        Para assinar entre em contato pelo WhatsApp ou aguarde o sistema de pagamento online.
      </Text>

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
  planCard: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  planHighlight: { borderColor: '#E50914', borderWidth: 2 },
  planBadge: { color: '#E50914', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  planLabel: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  planPrice: { color: '#E50914', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  planDesc: { color: '#888', fontSize: 13, marginBottom: 16 },
  planBtn: {
    backgroundColor: '#2a2a2a', padding: 14, borderRadius: 8, alignItems: 'center',
  },
  planBtnHighlight: { backgroundColor: '#E50914' },
  planBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  contactText: { color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 32 },
  logoutBtn: { padding: 14, alignItems: 'center' },
  logoutText: { color: '#555', fontSize: 14 },
});
