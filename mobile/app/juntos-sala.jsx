import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet, Image, Share, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Easing, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useTogether } from '../lib/together';
import Avatar, { InviteBubble, colorOf } from '../components/Avatar';

const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://movies0-movie.mgf7wb.easypanel.host';

// Sala de espera do "Assistir juntos": quem entra pelo link aparece aqui (com foto), dá pra conversar e
// o anfitrião inicia a sessão pra todo mundo ao mesmo tempo.
export default function JuntosSala() {
  const { code, host, player } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tg = useTogether(code ? String(code) : null);
  const playerParams = useMemo(() => { try { return JSON.parse(String(player)); } catch { return null; } }, [player]);

  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [sent, setSent] = useState({});
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const listRef = useRef(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const wentRef = useRef(false);

  const link = `${SITE}/juntos/${code}`;
  const ok = tg.status === 'ready';
  const isHost = tg.isHost || host === '1';

  useEffect(() => {
    Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
  }, []);

  // sessão iniciada -> todo mundo vai pro player
  useEffect(() => {
    if (!tg.started || wentRef.current || !playerParams) return;
    wentRef.current = true;
    router.replace({ pathname: '/player', params: playerParams });
  }, [tg.started]);
  useEffect(() => { if (tg.status === 'ended') { Alert.alert('Sala encerrada', 'O anfitrião encerrou a sala.'); router.back(); } }, [tg.status]);
  useEffect(() => { tg.setChatOpen(true); }, []);

  useEffect(() => {
    if (q.trim().length < 3) { setFound([]); return; }
    const t = setTimeout(() => api.get('/together/users', { params: { q } }).then(r => setFound(r.data || [])).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);

  const copy = async () => {
    await Clipboard.setStringAsync(link);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const share = () => Share.share({ message: `Vem assistir "${tg.room?.title || playerParams?.title}" comigo no FlixHome! ${link}` });
  const invite = async (u) => { try { await api.post(`/together/rooms/${code}/invite`, { user_id: u.id }); setSent(s => ({ ...s, [u.id]: true })); } catch {} };
  const send = () => { if (!text.trim()) return; tg.sendChat(text); setText(''); };

  const start = () => { setStarting(true); tg.startRoom(); setTimeout(() => setStarting(false), 4000); };
  const leave = () => {
    if (isHost) {
      Alert.alert('Sair da sala?', 'Como você é o anfitrião, a sala será encerrada para todos.', [
        { text: 'Ficar', style: 'cancel' },
        { text: 'Encerrar sala', style: 'destructive', onPress: () => { tg.endRoom(); router.back(); } },
      ]);
    } else router.back();
  };

  const pickPhoto = async () => {
    Alert.alert('Sua foto na sala', undefined, [
      { text: 'Escolher da galeria', onPress: uploadFromGallery },
      ...(me?.avatar ? [{ text: 'Remover foto', style: 'destructive', onPress: removePhoto }] : []),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };
  const uploadFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão', 'Permita o acesso às fotos para escolher uma imagem.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', { uri: a.uri, name: a.fileName || 'foto.jpg', type: a.mimeType || 'image/jpeg' });
      const { data } = await api.post('/together/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
      tg.updateAvatar(data.avatar_url);
    } catch (e) {
      Alert.alert('Foto', e.response?.data?.error || 'Não foi possível enviar a foto.');
    }
    setUploading(false);
  };
  const removePhoto = async () => { try { await api.delete('/together/avatar'); tg.updateAvatar(null); } catch {} };

  const me = tg.members.find(m => m.id === tg.you?.id);
  const title = tg.room?.title || playerParams?.title || 'Assistir juntos';
  const poster = tg.room?.poster_url;

  const ring = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });
  const ringOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={leave} style={s.back}><Ionicons name="chevron-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={s.h1}>Sala de espera</Text>
        <View style={[s.chip, ok ? s.chipOk : s.chipWarn]}>
          <View style={[s.dot, { backgroundColor: ok ? '#22C55E' : '#FBBF24' }]} />
          <Text style={[s.chipTxt, { color: ok ? '#22C55E' : '#FBBF24' }]}>{ok ? `${tg.members.length} na sala` : 'Conectando…'}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        {/* Conteúdo */}
        <View style={s.card}>
          {poster ? <Image source={{ uri: poster }} style={s.poster} /> : <View style={[s.poster, { backgroundColor: '#1F1F1F' }]} />}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={s.kicker}>VOCÊS VÃO ASSISTIR</Text>
            <Text style={s.title} numberOfLines={3}>{title}</Text>
            <Text style={s.muted}>Código <Text style={{ color: '#fff', fontWeight: '800', letterSpacing: 3 }}>{code}</Text></Text>
          </View>
        </View>

        {/* Link */}
        <View style={s.card2}>
          <Text style={s.label}>CONVIDE PELO LINK</Text>
          <View style={s.linkRow}>
            <Text style={s.link} numberOfLines={1}>{link}</Text>
            <TouchableOpacity style={[s.copyBtn, copied && { backgroundColor: '#22C55E' }]} onPress={copy}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
              <Text style={s.copyTxt}>{copied ? 'Copiado!' : 'Copiar'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.secBtn} onPress={share}><Ionicons name="share-social" size={18} color="#fff" /><Text style={s.secTxt}>Compartilhar</Text></TouchableOpacity>
        </View>

        {/* Pessoas */}
        <View style={s.card2}>
          <Text style={s.label}>NA SALA · {tg.members.length}</Text>
          <View style={s.people}>
            {tg.members.map(m => {
              const mine = m.id === tg.you?.id;
              return (
                <View key={m.id} style={{ alignItems: 'center' }}>
                  <Avatar name={m.name} userId={m.userId} photo={m.avatar} size={56} muted={false}
                    label={mine ? 'Você' : m.name.split(' ')[0]} sub={m.host ? 'Anfitrião' : undefined}
                    onPress={mine ? pickPhoto : undefined} />
                  {mine && (
                    <TouchableOpacity onPress={pickPhoto} style={s.camBadge} disabled={uploading}>
                      {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={12} color="#fff" />}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            <InviteBubble size={56} onPress={() => setShowInvite(v => !v)} />
          </View>
          {me && !me.avatar && <Text style={s.tip}>Toque no seu avatar para colocar uma foto.</Text>}

          {showInvite && (
            <View style={{ gap: 8, marginTop: 4 }}>
              <TextInput value={q} onChangeText={setQ} placeholder="Chamar um amigo pelo nome ou e-mail" placeholderTextColor="#666" style={s.input} autoCapitalize="none" />
              {found.map(u => (
                <View key={u.id} style={s.userRow}>
                  <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{u.name}</Text><Text style={{ color: '#666', fontSize: 12 }}>{u.hint}</Text></View>
                  <TouchableOpacity disabled={sent[u.id]} onPress={() => invite(u)} style={[s.smallBtn, sent[u.id] && { opacity: 0.6 }]}>
                    <Text style={{ color: sent[u.id] ? '#22C55E' : '#fff', fontWeight: '700' }}>{sent[u.id] ? '✓ Convidado' : 'Convidar'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Chat */}
        <View style={[s.card2, { minHeight: 200 }]}>
          <Text style={s.label}>CONVERSA</Text>
          <FlatList ref={listRef} data={tg.messages} keyExtractor={m => m.id} scrollEnabled={false} contentContainerStyle={{ gap: 6 }}
            ListEmptyComponent={<Text style={s.empty}>Diga oi pra galera 👋</Text>}
            renderItem={({ item }) => {
              const mine = item.userId === tg.you?.userId;
              return (
                <View style={[s.msg, mine && s.mine]}>
                  {!mine && <Text style={[s.msgName, { color: colorOf(item.userId) }]}>{item.name.split(' ')[0]}</Text>}
                  <Text style={s.msgTxt}>{item.text}</Text>
                </View>
              );
            }} />
        </View>
      </ScrollView>

      {/* Mensagem + iniciar */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={s.inputRow}>
          <TextInput value={text} onChangeText={setText} placeholder="Mensagem…" placeholderTextColor="#666" style={s.input2} maxLength={500} onSubmitEditing={send} returnKeyType="send" />
          <TouchableOpacity onPress={send} style={[s.sendBtn, !text.trim() && { backgroundColor: '#1F1F1F' }]}><Ionicons name="send" size={18} color="#fff" /></TouchableOpacity>
        </View>
        {isHost ? (
          <TouchableOpacity style={[s.startBtn, (!ok || starting) && { opacity: 0.6 }]} disabled={!ok || starting} onPress={start}>
            {starting ? <ActivityIndicator color="#fff" /> : <><Ionicons name="play" size={20} color="#fff" /><Text style={s.startTxt}>Iniciar para todos</Text></>}
          </TouchableOpacity>
        ) : (
          <View style={s.waiting}>
            <View>
              <Animated.View style={[s.pulse, { transform: [{ scale: ring.interpolate({ inputRange: [0, 10], outputRange: [1, 2.2] }) }], opacity: ringOp }]} />
              <View style={[s.dot, { backgroundColor: '#22C55E' }]} />
            </View>
            <Text style={s.waitTxt}>Aguardando o anfitrião iniciar…</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  back: { padding: 6 },
  h1: { flex: 1, color: '#fff', fontSize: 22, fontWeight: '800' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  chipOk: { backgroundColor: 'rgba(34,197,94,0.16)' }, chipWarn: { backgroundColor: 'rgba(251,191,36,0.16)' },
  dot: { width: 8, height: 8, borderRadius: 4 }, chipTxt: { fontSize: 12, fontWeight: '700' },
  card: { flexDirection: 'row', gap: 14, backgroundColor: '#141414', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1F1F1F' },
  poster: { width: 84, height: 126, borderRadius: 10 },
  kicker: { color: '#E50914', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },
  muted: { color: '#888', fontSize: 13, marginTop: 8 },
  card2: { backgroundColor: '#141414', borderRadius: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: '#1F1F1F' },
  label: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0A0A0A', borderRadius: 12, padding: 6, paddingLeft: 12 },
  link: { flex: 1, color: '#E5E5E5', fontSize: 13 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E50914', paddingHorizontal: 14, height: 38, borderRadius: 10 },
  copyTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  secBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 12, backgroundColor: '#1F1F1F', borderWidth: 1, borderColor: '#333' },
  secTxt: { color: '#fff', fontWeight: '700' },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  camBadge: { position: 'absolute', right: 6, top: 40, width: 22, height: 22, borderRadius: 11, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#141414' },
  tip: { color: '#888', fontSize: 12 },
  input: { backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12, color: '#fff', paddingHorizontal: 12, height: 44 },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 12, padding: 10 },
  smallBtn: { backgroundColor: '#2A2A2A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  empty: { color: '#666', textAlign: 'center', marginTop: 12 },
  msg: { alignSelf: 'flex-start', backgroundColor: '#1F1F1F', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', backgroundColor: '#E50914' },
  msgName: { fontSize: 11, fontWeight: '800', marginBottom: 1 },
  msgTxt: { color: '#fff', fontSize: 14 },
  footer: { paddingHorizontal: 16, paddingTop: 10, gap: 10, borderTopWidth: 1, borderTopColor: '#1F1F1F', backgroundColor: '#0A0A0A' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input2: { flex: 1, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12, color: '#fff', paddingHorizontal: 12, height: 44 },
  sendBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center' },
  startBtn: { height: 52, borderRadius: 12, backgroundColor: '#E50914', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  waiting: { height: 52, borderRadius: 12, backgroundColor: '#141414', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1, borderColor: '#1F1F1F' },
  pulse: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  waitTxt: { color: '#E5E5E5', fontWeight: '700' },
});
