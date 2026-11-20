import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';
import { joinTogether } from '../lib/togetherNav';

// Tela "Entrar pela sala": aberta por convite (push/lista), link (flixhome://juntos?code=XXXXXX) ou digitando o código
export default function JuntosScreen() {
  const { code: paramCode } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState(paramCode ? String(paramCode).toUpperCase() : '');
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lookup = async (c) => {
    setError(''); setInfo(null);
    try { const { data } = await api.get(`/together/rooms/${c}`); setInfo(data); }
    catch (e) { setError(e.response?.data?.error || 'Sala não encontrada ou encerrada.'); }
  };
  useEffect(() => { if (code.length === 6) lookup(code); else setInfo(null); }, [code]);

  const enter = async () => {
    setBusy(true);
    try { await joinTogether(router, code); }
    catch (e) { setError(e.response?.data?.error || e.message || 'Não foi possível entrar.'); setBusy(false); }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 24 }]}>
      <Text style={s.title}>Assistir juntos</Text>
      <Text style={s.sub}>Digite o código da sala ou abra um convite.</Text>
      <TextInput value={code} onChangeText={t => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="CÓDIGO" placeholderTextColor="#555"
        autoCapitalize="characters" style={s.input} maxLength={6} />
      {error ? <Text style={s.err}>{error}</Text> : null}
      {info && (
        <View style={s.card}>
          {info.poster_url ? <Image source={{ uri: info.poster_url }} style={s.poster} /> : null}
          <Text style={s.muted}>{info.host_name} chamou você</Text>
          <Text style={s.cardTitle}>{info.title}</Text>
          <Text style={s.muted}>{info.members} {info.members === 1 ? 'pessoa já está' : 'pessoas já estão'} na sala</Text>
          <TouchableOpacity style={s.btn} onPress={enter} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Entrar na sessão</Text>}
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24 }}><Text style={s.muted}>Voltar</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', paddingHorizontal: 20 },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  sub: { color: '#888', marginTop: 6, marginBottom: 20 },
  input: { width: '100%', maxWidth: 320, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, color: '#fff', fontSize: 26, letterSpacing: 8, textAlign: 'center', paddingVertical: 14 },
  err: { color: '#ff6b6b', marginTop: 12 },
  card: { marginTop: 20, width: '100%', maxWidth: 340, backgroundColor: '#141414', borderRadius: 16, padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#1f1f1f' },
  poster: { width: 110, height: 165, borderRadius: 8 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  muted: { color: '#888', fontSize: 14 },
  btn: { marginTop: 10, backgroundColor: '#E50914', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 26, minWidth: 200, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
