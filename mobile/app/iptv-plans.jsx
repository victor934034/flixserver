import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import PlanPicker, { brl, monthsOf, periodLabel, priceOf, titleOf } from '../components/PlanPicker';

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

  const sel = plans.find(p => p.id === selected);
  const subtitleOf = (p) => [p.max_streams ? `${p.max_streams} tela${p.max_streams > 1 ? 's' : ''}` : null, 'canais ao vivo + app'].filter(Boolean).join(' · ');

  return (
    <View style={s.root}>
      <LinearGradient colors={['#3a0a0c', '#1a0708', '#0A0A0A']} locations={[0, 0.22, 0.55]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
          <View style={s.live}><View style={s.liveDot} /><Text style={s.liveTxt}>IPTV AO VIVO</Text></View>
        </View>

        <Text style={s.h1}>TV ao vivo no FlixHome</Text>
        <Text style={s.lead}>Assine e o admin ativa seu acesso em poucos minutos.</Text>

        <View style={s.pills}>
          {[['tv-outline', 'Canais 24h'], ['film-outline', 'Filmes e séries'], ['copy-outline', 'Até 2 telas']].map(([ic, tx]) => (
            <View key={tx} style={s.pill}><Ionicons name={ic} size={15} color="#E5E5E5" /><Text style={s.pillTxt}>{tx}</Text></View>
          ))}
        </View>

        <View style={s.bundle}>
          <Ionicons name="gift-outline" size={20} color="#4ADE80" />
          <Text style={s.bundleTxt}>Inclui a assinatura do app (filmes e séries) pelo mesmo período, sem pagar a mais.</Text>
        </View>

        {loading ? <ActivityIndicator color={ACCENT} size="large" style={{ marginTop: 40 }} /> : plans.length === 0 ? (
          <Text style={s.empty}>Nenhum plano IPTV disponível no momento.</Text>
        ) : (
          <View style={{ marginTop: 18 }}>
            <PlanPicker plans={plans} selected={selected} onSelect={(p) => p && setSelected(p.id)} subtitleOf={subtitleOf} />
          </View>
        )}

        <Text style={s.note}>Ativação manual pelo admin após o pagamento (geralmente em até 30 min). Você acompanha o status no app.</Text>
      </ScrollView>

      {!loading && sel && (
        <View style={[s.cta, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.ctaRow}>
            <Text style={s.ctaL}>{titleOf(sel)} · {periodLabel(monthsOf(sel))}</Text>
            <Text style={s.ctaR}>{brl(priceOf(sel))}</Text>
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
  h1: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 16 },
  lead: { color: '#A3A3A3', fontSize: 15, marginTop: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 999, paddingHorizontal: 12, height: 32 },
  pillTxt: { color: '#E5E5E5', fontSize: 13, fontWeight: '700' },
  bundle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(34,197,94,0.10)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)' },
  bundleTxt: { flex: 1, color: '#D1FAE5', fontSize: 13.5, lineHeight: 18, fontWeight: '600' },
  empty: { color: '#888', textAlign: 'center', marginTop: 40 },
  note: { color: '#777', fontSize: 12.5, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(10,10,10,0.97)', borderTopWidth: 1, borderTopColor: '#1F1F1F', gap: 10 },
  ctaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ctaL: { color: '#A3A3A3', fontSize: 14 }, ctaR: { color: '#fff', fontSize: 14, fontWeight: '800' },
  btn: { height: 56, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
