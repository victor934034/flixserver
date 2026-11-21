import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../lib/api';
import { joinTogether } from '../lib/togetherNav';
import Avatar from '../components/Avatar';

// Convite do "Assistir juntos" (design): capa, quem chamou, quem já está na sala, Entrar / Agora não.
// Aberto por push, link (flixhome://juntos?code=XXXXXX) ou digitando o código.
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
  const decline = () => { api.delete(`/together/invites/${code}`).catch(() => {}); router.back(); };

  const host = (info?.host_name || '').split(' ')[0];
  return (
    <View style={s.root}>
      <LinearGradient colors={['#4a0f12', '#1a0708', '#0A0A0A']} locations={[0, 0.4, 0.8]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, alignItems: 'center', paddingTop: insets.top + 40, paddingHorizontal: 20 }}>
        {!info ? (
          <>
            <Text style={s.title}>Assistir juntos</Text>
            <Text style={s.sub}>Digite o código da sala ou abra um convite.</Text>
            <TextInput value={code} onChangeText={t => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="CÓDIGO" placeholderTextColor="#555"
              autoCapitalize="characters" style={s.input} maxLength={6} />
            {error ? <Text style={s.err}>{error}</Text> : null}
            <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24 }}><Text style={s.muted}>Voltar</Text></TouchableOpacity>
          </>
        ) : (
          <>
            <View>
              {info.poster_url ? <Image source={{ uri: info.poster_url }} style={s.poster} /> : <View style={[s.poster, { backgroundColor: '#3a1013' }]} />}
              <View style={s.hostBadge}><Avatar name={info.host_name} userId={info.host_name} photo={info.host_avatar} size={52} /></View>
            </View>
            <Text style={s.invText}><Text style={{ color: '#fff', fontWeight: '800' }}>{host}</Text> te convidou para assistir</Text>
            <Text style={s.cTitle} numberOfLines={2}>{info.title}</Text>
            <View style={s.pill}>
              <View style={{ flexDirection: 'row' }}>
                {(info.people || []).slice(0, 3).map((p, i) => (
                  <View key={p.userId + i} style={{ marginLeft: i ? -14 : 0 }}><Avatar name={p.name} userId={p.userId} photo={p.avatar} size={30} /></View>
                ))}
              </View>
              <Text style={s.pillTxt}>{info.members} {info.members === 1 ? 'já está' : 'já estão'} na sala</Text>
            </View>
            {error ? <Text style={s.err}>{error}</Text> : null}
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={s.btn} onPress={enter} disabled={busy} activeOpacity={0.9}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Entrar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.ghost} onPress={decline}><Text style={s.ghostTxt}>Agora não</Text></TouchableOpacity>
            <Text style={[s.muted, { marginTop: 16, marginBottom: insets.bottom + 16 }]}>Seu microfone começa desligado.</Text>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  sub: { color: '#A3A3A3', marginTop: 8, marginBottom: 24 },
  input: { width: '100%', maxWidth: 320, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, color: '#fff', fontSize: 28, letterSpacing: 8, textAlign: 'center', paddingVertical: 14 },
  err: { color: '#F87171', marginTop: 12, textAlign: 'center' },
  poster: { width: 190, height: 285, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(229,9,20,0.35)' },
  hostBadge: { position: 'absolute', right: -22, top: -22, borderRadius: 40, borderWidth: 4, borderColor: '#0A0A0A', backgroundColor: '#0A0A0A' },
  invText: { color: '#A3A3A3', fontSize: 16, marginTop: 28 },
  cTitle: { color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1F1F1F', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, marginTop: 18 },
  pillTxt: { color: '#E5E5E5', fontWeight: '800', fontSize: 15 },
  btn: { alignSelf: 'stretch', height: 58, borderRadius: 14, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  ghost: { alignSelf: 'stretch', height: 54, borderRadius: 14, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  ghostTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  muted: { color: '#888', fontSize: 14, textAlign: 'center' },
});
