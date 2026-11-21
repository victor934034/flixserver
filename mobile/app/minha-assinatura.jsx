import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

const ACCENT = '#E50914';
const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
const METHOD = { PIX: 'PIX', CREDIT_CARD: 'Cartão', BOLETO: 'Boleto' };
const PAID = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];

// Minha assinatura (design): ativa · teste grátis · expirada
export default function MinhaAssinatura() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState(null);
  const [pays, setPays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useFocusEffect(useCallback(() => {
    let alive = true;
    Promise.all([
      api.get('/auth/me').then(r => r.data).catch(() => null),
      api.get('/payments/mine').then(r => r.data).catch(() => []),
    ]).then(([u, p]) => { if (alive) { setMe(u); setPays(p || []); setLoading(false); setNow(Date.now()); } });
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => { alive = false; clearInterval(t); };
  }, []));

  const exp = me?.plan_expires_at ? new Date(me.plan_expires_at).getTime() : 0;
  const active = exp > now;
  const isTrial = me?.plan === 'trial';
  const lastPaid = pays.find(p => PAID.includes(p.status));
  const msLeft = Math.max(0, exp - now);
  const days = Math.floor(msLeft / 86400000), hours = Math.floor((msLeft % 86400000) / 3600000), mins = Math.floor((msLeft % 3600000) / 60000);
  const totalMs = lastPaid ? 30 * 86400000 : 7 * 86400000;
  const pct = Math.min(1, Math.max(0, msLeft / totalMs));
  const planName = me?.plan_name || (me?.plan ? String(me.plan).replace(/^\w/, c => c.toUpperCase()) : 'Plano');

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={ACCENT} style={{ marginTop: 60 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom, gap: 14 }}>
          <Text style={s.kicker}>{!active ? 'EXPIRADO' : isTrial ? 'TESTE GRÁTIS ATIVO' : 'ASSINATURA ATIVA'}</Text>
          <Text style={s.h1}>Minha assinatura</Text>

          {active && !isTrial && (
            <>
              <View style={s.card}>
                <View style={s.row}>
                  <View><Text style={s.k}>Plano atual</Text><Text style={s.plan}>{planName}</Text></View>
                  <View style={s.okBadge}><Text style={s.okTxt}>ATIVO</Text></View>
                </View>
                <View style={s.row}>
                  <Text style={s.k}>Expira em {fmtDate(exp)}</Text>
                  <Text style={s.days}>{Math.max(0, Math.ceil(msLeft / 86400000))} dias restantes</Text>
                </View>
                <View style={s.track}><View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: '#22C55E' }]} /></View>
                <TouchableOpacity style={s.btn} onPress={() => router.push('/subscription')}><Text style={s.btnTxt}>Renovar</Text></TouchableOpacity>
                <TouchableOpacity style={s.ghost} onPress={() => router.push('/subscription')}><Text style={s.ghostTxt}>Trocar de plano</Text></TouchableOpacity>
              </View>
            </>
          )}

          {active && isTrial && (
            <View style={[s.card, s.trialCard]}>
              <View style={s.trialBadge}><Text style={s.trialBadgeTxt}>TESTE GRÁTIS</Text></View>
              <Text style={s.center}>Seu teste termina em</Text>
              <View style={s.clock}>
                {[[days, 'dias'], [hours, 'horas'], [mins, 'min']].map(([v, l]) => (
                  <View key={l} style={s.box}><Text style={s.boxV}>{String(v).padStart(2, '0')}</Text><Text style={s.boxL}>{l}</Text></View>
                ))}
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: ACCENT }]} /></View>
              <Text style={s.centerSm}>Assine agora e continue assistindo sem interrupção. Seu progresso e sua lista ficam salvos.</Text>
              <TouchableOpacity style={s.btn} onPress={() => router.push('/subscription')}><Text style={s.btnTxt}>Assinar agora</Text></TouchableOpacity>
            </View>
          )}

          {!active && (
            <View style={[s.card, s.expCard]}>
              <View style={s.clockIcon}><Ionicons name="time-outline" size={32} color="#FBBF24" /></View>
              <Text style={s.expTitle}>Sua assinatura expirou</Text>
              <Text style={s.centerSm}>{exp ? `O plano ${planName} terminou em ${fmtDate(exp)}. ` : ''}Renove para voltar a assistir — sua lista e o histórico continuam aqui.</Text>
              <TouchableOpacity style={s.btn} onPress={() => router.push('/subscription')}><Text style={s.btnTxt}>Renovar plano</Text></TouchableOpacity>
              <TouchableOpacity style={s.ghost} onPress={() => router.push('/subscription')}><Text style={s.ghostTxt}>Ver outros planos</Text></TouchableOpacity>
              {me?.trial_used_at ? <Text style={[s.centerSm, { marginTop: 4 }]}>Teste grátis indisponível — já utilizado nesta conta.</Text> : null}
            </View>
          )}

          {lastPaid && (
            <View style={s.last}>
              <View>
                <Text style={s.k}>Último pagamento</Text>
                <Text style={s.lastV}>{METHOD[lastPaid.method] || lastPaid.method} · {fmtDate(lastPaid.created_at)}</Text>
              </View>
            </View>
          )}
          {pays.length > 1 && (
            <View style={s.card}>
              <Text style={s.k}>HISTÓRICO</Text>
              {pays.slice(0, 8).map(p => (
                <View key={p.id} style={s.hRow}>
                  <View style={{ flex: 1 }}><Text style={s.hT}>{p.plan_name || (p.kind === 'iptv' ? 'IPTV' : 'Plano')}</Text><Text style={s.k}>{METHOD[p.method] || p.method} · {fmtDate(p.created_at)}</Text></View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.hT}>R$ {Number(p.amount).toFixed(2).replace('.', ',')}</Text>
                    <Text style={[s.st, PAID.includes(p.status) ? { color: '#4ADE80' } : p.status === 'PENDING' ? { color: '#FBBF24' } : { color: '#F87171' }]}>
                      {PAID.includes(p.status) ? 'Pago' : p.status === 'PENDING' ? 'Pendente' : p.status === 'OVERDUE' ? 'Vencido' : 'Estornado'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { paddingHorizontal: 16, paddingVertical: 8 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  kicker: { color: '#888', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  h1: { color: '#fff', fontSize: 30, fontWeight: '900', marginBottom: 4 },
  card: { backgroundColor: '#141414', borderRadius: 18, padding: 18, gap: 14, borderWidth: 1, borderColor: '#1F1F1F' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  k: { color: '#888', fontSize: 13 },
  plan: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 2 },
  okBadge: { backgroundColor: 'rgba(34,197,94,0.16)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  okTxt: { color: '#22C55E', fontWeight: '900', fontSize: 11 },
  days: { color: '#fff', fontWeight: '800', fontSize: 14 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#2A2A2A', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  btn: { height: 52, borderRadius: 12, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ghost: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  ghostTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  trialCard: { backgroundColor: 'rgba(229,9,20,0.08)', borderColor: 'rgba(229,9,20,0.4)', alignItems: 'stretch' },
  trialBadge: { alignSelf: 'center', backgroundColor: ACCENT, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  trialBadgeTxt: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  center: { color: '#B3B3B3', textAlign: 'center', fontSize: 15 },
  centerSm: { color: '#A3A3A3', textAlign: 'center', fontSize: 13.5, lineHeight: 20 },
  clock: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  box: { width: 78, height: 78, borderRadius: 14, backgroundColor: '#0F0F0F', borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  boxV: { color: '#fff', fontSize: 30, fontWeight: '900' }, boxL: { color: '#888', fontSize: 12 },
  expCard: { alignItems: 'stretch', backgroundColor: '#15120a', borderColor: 'rgba(251,191,36,0.25)' },
  clockIcon: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(251,191,36,0.14)', alignItems: 'center', justifyContent: 'center' },
  expTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  last: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141414', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1F1F1F' },
  lastV: { color: '#fff', fontWeight: '800', fontSize: 15, marginTop: 2 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1F1F1F' },
  hT: { color: '#E5E5E5', fontWeight: '700', fontSize: 14 },
  st: { fontSize: 12, fontWeight: '800', marginTop: 2 },
});
