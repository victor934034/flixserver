import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#E50914';
export const brl = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');
export const periodOf = (p) => (p.duration_days ? (p.duration_days <= 31 ? '/mês' : p.duration_days <= 100 ? '/trimestre' : '/ano') : '/mês');
export const periodName = (p) => (p.duration_days ? (p.duration_days <= 31 ? 'mensal' : p.duration_days <= 100 ? 'trimestral' : 'anual') : 'mensal');

// Card de plano do design: selo, título, rádio, preço grande com risco no antigo, divisor e checklist
export default function PlanCard({ plan, selected, onPress, features = [], subtitle, price }) {
  const final = price != null ? price : (plan.promo_price != null ? plan.promo_price : plan.price);
  const gold = /custo|melhor/i.test(plan.badge || '');
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[s.card, selected && s.cardOn]}>
      {plan.badge ? (
        <View style={[s.pill, gold && { backgroundColor: '#FBBF24' }]}>
          <Text style={[s.pillTxt, gold && { color: '#1a1200' }]}>{plan.badge}</Text>
        </View>
      ) : null}
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{plan.name}</Text>
          {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
        </View>
        <View style={[s.radio, selected && s.radioOn]}>{selected && <View style={s.dot} />}</View>
      </View>
      <View style={s.priceRow}>
        {plan.promo_price != null && plan.promo_price < plan.price ? <Text style={s.old}>{brl(plan.price)}</Text> : null}
        <Text style={s.price}>{brl(final)}</Text>
        <Text style={s.per}>{periodOf(plan)}</Text>
      </View>
      {features.length > 0 && (
        <View style={s.list}>
          {features.map(f => (
            <View key={f} style={s.feat}>
              <Ionicons name="checkmark" size={18} color="#22C55E" />
              <Text style={s.featTxt}>{f}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#141414', borderRadius: 18, padding: 20, paddingTop: 22, marginTop: 14, borderWidth: 1.5, borderColor: '#1F1F1F' },
  cardOn: { borderColor: ACCENT, shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 10, backgroundColor: '#150d0d' },
  pill: { position: 'absolute', top: -12, left: 18, backgroundColor: ACCENT, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  pillTxt: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#888', fontSize: 13.5, marginTop: 3 },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: ACCENT },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: ACCENT },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  old: { color: '#666', textDecorationLine: 'line-through', fontSize: 14, paddingBottom: 8 },
  price: { color: '#fff', fontSize: 36, fontWeight: '900' },
  per: { color: '#888', fontSize: 15, paddingBottom: 8 },
  list: { borderTopWidth: 1, borderTopColor: '#262626', marginTop: 16, paddingTop: 14, gap: 10 },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featTxt: { color: '#E5E5E5', fontSize: 15 },
});
