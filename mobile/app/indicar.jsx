import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Share, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

export default function IndicarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/referrals/me').then(r => setInfo(r.data)).catch(() => setInfo({ enabled: false }));
  }, []);

  const share = () => {
    const text = `Vem pro FlixHome! Use meu código ${info.code} ao entrar.`;
    Share.share({ message: info.link ? `${text} ${info.link}` : text }).catch(() => {});
  };

  const apply = async () => {
    if (busy || code.length !== 7) return;
    setBusy(true); setMsg(null);
    try {
      await api.post('/referrals/apply', { code });
      setInfo(i => ({ ...i, can_apply: false }));
      setMsg({ ok: true, text: 'Código aplicado! Quando você assinar, quem te indicou ganha os dias grátis.' });
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.error || 'Não foi possível usar o código.' });
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={s.back} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>🎁 Indique um amigo</Text>

        {!info && <ActivityIndicator color="#E50914" style={{ marginTop: 40 }} />}
        {info && !info.enabled && <Text style={s.text}>As indicações ainda não estão disponíveis.</Text>}
        {info?.enabled && (
          <>
            <Text style={s.text}>Quando um amigo que usou seu código fizer a primeira assinatura, você ganha {info.days} dias grátis.</Text>
            <Text style={s.code} selectable>{info.code}</Text>
            <TouchableOpacity style={s.primary} onPress={share}>
              <Text style={s.primaryTxt}>Compartilhar convite</Text>
            </TouchableOpacity>
            <View style={s.counters}>
              {[[info.invited, 'usaram o código'], [info.rewarded, 'assinaram'], [info.days_earned, 'dias ganhos']].map(([n, label]) => (
                <View key={label} style={s.counter}>
                  <Text style={s.counterNum}>{n}</Text>
                  <Text style={s.counterTxt}>{label}</Text>
                </View>
              ))}
            </View>
            {info.can_apply && (
              <View style={s.box}>
                <Text style={s.text}>Recebeu um código de um amigo? Digite antes da sua primeira assinatura.</Text>
                <TextInput
                  style={s.input} value={code} maxLength={7} autoCapitalize="characters" autoCorrect={false}
                  placeholder="CÓDIGO" placeholderTextColor="#555"
                  onChangeText={v => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                />
                <TouchableOpacity style={[s.secondary, code.length !== 7 && { opacity: 0.45 }]} onPress={apply} disabled={busy || code.length !== 7}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Usar código</Text>}
                </TouchableOpacity>
              </View>
            )}
            {msg && <Text style={[s.msg, { color: msg.ok ? '#4ade80' : '#f87171' }]}>{msg.text}</Text>}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0a' },
  back: { width: 40, height: 40, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6, marginBottom: 10 },
  text: { color: '#a3a3a3', fontSize: 14, lineHeight: 20 },
  code: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 6, textAlign: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#444', borderRadius: 12, paddingVertical: 16, marginVertical: 16 },
  primary: { backgroundColor: '#E50914', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondary: { borderWidth: 1, borderColor: '#333', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  counters: { flexDirection: 'row', gap: 8, marginTop: 16 },
  counter: { flex: 1, backgroundColor: '#141414', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  counterNum: { color: '#fff', fontSize: 20, fontWeight: '800' },
  counterTxt: { color: '#8a8a8a', fontSize: 11, marginTop: 3, textAlign: 'center' },
  box: { marginTop: 24, gap: 12 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 12, color: '#fff', fontSize: 22, letterSpacing: 6, textAlign: 'center', paddingVertical: 12 },
  msg: { fontSize: 13, textAlign: 'center', marginTop: 14 },
});
