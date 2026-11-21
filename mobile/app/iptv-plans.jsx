import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import PlanCard, { brl } from '../components/PlanCard';

const ACCENT = '#E50914';

// Planos IPTV (design): selo, cards com preço grande e rodapé fixo
export default function IptvPlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);


  useEffect(() => {
    api.get('/iptv/plans').then(r => {
      const list = r.data || [];
      setPlans(list);
      setSelected((list.find(p => p.highlight) || list[0])?.id || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const finalPrice = (p) => Number(p.price); // o servidor cobra sempre o preço do plano IPTV
  const sel = plans.find(p => p.id === selected);
  const months = (p) => p.duration_months || 1;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#3a0a0c', '#1a0708', '#0A0A0A']} locations={[0, 0.22, 0.55]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
          <View style={s.live}><View style={s.liveDot} /><Text style={s.liveTxt}>IPTV AO VIVO</Text></View>
        </View>

        <Text style={s.h1}>TV ao vivo no FlixHome</Text>
        <Text style={s.lead}>Assine e o admin ativa seu acesso em poucos minutos.</Text>

        <View style={{ gap: 10, marginTop: 18 }}>
          {[['tv-outline', 'Canais ao vivo 24h'], ['film-outline', 'Filmes e séries do servidor'], ['copy-outline', 'Até 2 telas ao mesmo tempo']].map(([ic, t]) => (
            <View key={t} style={s.feat}>
              <View style={s.featIcon}><Ionicons name={ic} size={20} color="#E5E5E5" /></View>
              <Text style={s.featTxt}>{t}</Text>
            </View>
          ))}
        </View>

        {loading ? <ActivityIndicator color={ACCENT} size="large" style={{ marginTop: 40 }} /> : plans.length === 0 ? (
          <Text style={s.empty}>Nenhum plano IPTV disponível no momento.</Text>
        ) : plans.map(p => (
          <PlanCard key={p.id} plan={{ ...p, promo_price: null, duration_days: months(p) * 30 }} selected={selected === p.id} onPress={() => setSelected(p.id)}
            price={finalPrice(p)}
            subtitle={[p.max_streams ? `${p.max_streams} tela${p.max_streams > 1 ? 's' : ''}` : null, 'canais ao vivo', `${months(p) * 30} dias`].filter(Boolean).join(' · ')} />
        ))}

        <Text style={s.note}>Ativação manual pelo admin após o pagamento (geralmente em até 30 min). Você acompanha o status no app.</Text>
      </ScrollView>

      {!loading && sel && (
        <View style={[s.cta, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.ctaRow}>
            <Text style={s.ctaL}>{sel.name} · {months(sel) === 1 ? 'mensal' : `${months(sel)} meses`}</Text>
            <Text style={s.ctaR}>{brl(finalPrice(sel))}/mês</Text>
          </View>
          <TouchableOpacity style={s.btn} activeOpacity={0.9} onPress={() => router.push({ pathname: '/checkout', params: { kind: 'iptv', plan_id: sel.id } })}>
            <Text style={s.btnTxt}>Assinar agora</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(229,9,20,0.16)', borderRadius: 999, paddingHorizontal: 14, height: 34 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  liveTxt: { color: '#F87171', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  h1: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 22 },
  lead: { color: '#A3A3A3', fontSize: 15, marginTop: 8 },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  featTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty: { color: '#888', textAlign: 'center', marginTop: 40 },
  note: { color: '#777', fontSize: 12.5, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(10,10,10,0.97)', borderTopWidth: 1, borderTopColor: '#1F1F1F', gap: 10 },
  ctaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ctaL: { color: '#A3A3A3', fontSize: 14 }, ctaR: { color: '#fff', fontSize: 14, fontWeight: '800' },
  btn: { height: 56, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
