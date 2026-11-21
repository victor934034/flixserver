import { useEffect, useRef, useState } from 'react';
import { Alert, View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet, Share, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import Avatar from './Avatar';

const COLORS = ['#7c3aed', '#0ea5e9', '#f97316', '#e11d48', '#14b8a6', '#eab308', '#6366f1', '#84cc16'];
const colorOf = (id) => COLORS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const initials = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// Botão flutuante + chip de sincronia + toasts + gaveta (membros, convite, chat)
export default function TogetherOverlay({ tg, visible = true, onLeave }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('chat');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [sent, setSent] = useState({});
  const listRef = useRef(null);

  useEffect(() => { tg.setChatOpen(open && tab === 'chat'); }, [open, tab]);
  useEffect(() => {
    if (q.trim().length < 3) { setFound([]); return; }
    const t = setTimeout(() => api.get('/together/users', { params: { q } }).then(r => setFound(r.data || [])).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);

  if (!tg.active) return null;
  const link = tg.room ? `${(process.env.EXPO_PUBLIC_SITE_URL || 'https://movies0-movie.mgf7wb.easypanel.host')}/juntos/${tg.room.code}` : '';
  const ok = tg.status === 'ready';

  const send = () => { if (!text.trim()) return; tg.sendChat(text); setText(''); };
  const invite = async (u) => { try { await api.post(`/together/rooms/${tg.room.code}/invite`, { user_id: u.id }); setSent(s => ({ ...s, [u.id]: true })); } catch {} };

  return (
    <>
      {/* chip de sincronia + avatares (topo direito) */}
      {visible && (
        <View pointerEvents="box-none" style={s.topRight}>
          <View style={[s.chip, ok ? s.chipOk : s.chipWarn]}>
            <View style={[s.dot, { backgroundColor: ok ? '#22C55E' : '#FBBF24' }]} />
            <Text style={[s.chipTxt, { color: ok ? '#22C55E' : '#FBBF24' }]}>{ok ? `Sincronizado · ${tg.members.length} assistindo` : 'Ressincronizando…'}</Text>
          </View>
          <View style={s.avRow}>
            {tg.members.slice(0, 4).map((m, i) => (
              <View key={m.id} style={{ marginLeft: i ? -8 : 0 }}><Avatar name={m.name} userId={m.userId} photo={m.avatar} size={30} speaking={!!m.voice} muted={false} /></View>
            ))}
          </View>
        </View>
      )}

      {/* toasts de sincronia (entram de cima) */}
      <View pointerEvents="none" style={s.topWrap}>
        {tg.toasts.map(t => <View key={t.id} style={s.toast}><Ionicons name="swap-vertical" size={13} color="#E5E5E5" /><Text style={s.toastTxt}>{t.text}</Text></View>)}
      </View>

      {/* últimas mensagens (embaixo à esquerda) */}
      {visible && tg.messages.length > 0 && (
        <View pointerEvents="none" style={s.recent}>
          {tg.messages.slice(-2).map(m => (
            <View key={m.id} style={s.recentMsg}><Text style={s.recentTxt}><Text style={{ color: colorOf(m.userId), fontWeight: '800' }}>{String(m.name).split(' ')[0]}</Text>  {m.text}</Text></View>
          ))}
        </View>
      )}

      {/* ações (embaixo à direita): mic, chat, sair da sessão */}
      {visible && (
        <View style={s.actions} pointerEvents="box-none">
          {tg.voice?.supported && (
            <TouchableOpacity style={[s.micBtn, tg.voice.on && !tg.voice.muted && { backgroundColor: '#22C55E' }]} onPress={() => (tg.voice.on ? tg.voice.toggleMute() : tg.voice.join())} activeOpacity={0.85}>
              <Ionicons name={tg.voice.on && !tg.voice.muted ? 'mic' : 'mic-off'} size={16} color={tg.voice.on && !tg.voice.muted ? '#04150A' : '#fff'} />
              <Text style={[s.micTxt, tg.voice.on && !tg.voice.muted && { color: '#04150A' }]}>{tg.voice.on ? (tg.voice.muted ? 'Mudo' : 'Mic') : 'Mic'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.round} onPress={() => setOpen(true)} activeOpacity={0.8}>
            <Ionicons name="chatbubble-outline" size={20} color="#fff" />
            {tg.unread > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{tg.unread}</Text></View>}
          </TouchableOpacity>
          <TouchableOpacity style={s.leave} onPress={() => (tg.isHost ? Alert.alert('Sair da sessão', 'Encerrar para todos ou só sair?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Só sair', onPress: () => onLeave?.() },
            { text: 'Encerrar para todos', style: 'destructive', onPress: () => { tg.endRoom(); onLeave?.(); } },
          ]) : onLeave?.())} activeOpacity={0.85}>
            <Text style={s.leaveTxt}>Sair da sessão</Text>
          </TouchableOpacity>
        </View>
      )}

      {open && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetWrap}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[['chat', 'Chat'], ['people', 'Pessoas']].map(([k, l]) => (
                  <TouchableOpacity key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}><Text style={[s.tabTxt, tab === k && { color: '#fff' }]}>{l}</Text></TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => setOpen(false)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </View>

            {tab === 'chat' ? (
              <>
                <FlatList ref={listRef} data={tg.messages} keyExtractor={m => m.id} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, padding: 12 }}
                  onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                  ListEmptyComponent={<Text style={s.empty}>Diga oi pra galera 👋</Text>}
                  renderItem={({ item }) => {
                    const mine = item.from === tg.you?.id;
                    return (
                      <View style={[s.msg, mine && s.mine]}>
                        {!mine && <Text style={s.msgName}>{item.name.split(' ')[0]}</Text>}
                        <Text style={s.msgTxt}>{item.text}</Text>
                      </View>
                    );
                  }} />
                <View style={s.inputRow}>
                  <TextInput value={text} onChangeText={setText} placeholder="Mensagem…" placeholderTextColor="#666" style={s.input} maxLength={500} onSubmitEditing={send} returnKeyType="send" />
                  <TouchableOpacity onPress={send} style={[s.sendBtn, !text.trim() && { backgroundColor: '#1f1f1f' }]}><Ionicons name="send" size={18} color="#fff" /></TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={{ flex: 1, padding: 12, gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                  {tg.members.map(m => (
                    <View key={m.id} style={{ alignItems: 'center', width: 60 }}>
                      <View style={[s.avatar, { backgroundColor: colorOf(m.userId) }]}><Text style={s.avatarTxt}>{initials(m.name)}</Text></View>
                      <Text style={s.avName} numberOfLines={1}>{m.id === tg.you?.id ? 'Você' : m.name.split(' ')[0]}{m.host ? ' ★' : ''}</Text>
                    </View>
                  ))}
                </View>
                {tg.voice.supported && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[s.btn, { flex: 1 }, tg.voice.on && { backgroundColor: '#22C55E' }]} onPress={tg.voice.on ? tg.voice.leave : tg.voice.join}>
                      <Ionicons name={tg.voice.on ? 'call' : 'mic'} size={18} color="#fff" /><Text style={s.btnTxt}>{tg.voice.on ? 'Sair da voz' : 'Entrar na voz'}</Text>
                    </TouchableOpacity>
                    {tg.voice.on && (
                      <TouchableOpacity style={[s.btn, tg.voice.muted && { backgroundColor: '#444' }]} onPress={tg.voice.toggleMute}>
                        <Ionicons name={tg.voice.muted ? 'mic-off' : 'mic'} size={18} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {!!tg.voice.micError && <Text style={{ color: '#ff6b6b', fontSize: 12 }}>{tg.voice.micError}</Text>}
                <Text style={s.label}>Código da sala: <Text style={{ color: '#fff', letterSpacing: 3, fontWeight: '800' }}>{tg.room?.code}</Text></Text>
                <TouchableOpacity style={s.btn} onPress={() => Share.share({ message: `Vem assistir "${tg.room?.title}" comigo no FlixHome! ${link}` })}>
                  <Ionicons name="share-social" size={18} color="#fff" /><Text style={s.btnTxt}>Compartilhar link</Text>
                </TouchableOpacity>
                <TextInput value={q} onChangeText={setQ} placeholder="Chamar um amigo pelo nome ou e-mail" placeholderTextColor="#666" style={s.input} autoCapitalize="none" />
                {found.map(u => (
                  <View key={u.id} style={s.userRow}>
                    <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{u.name}</Text><Text style={{ color: '#666', fontSize: 12 }}>{u.hint}</Text></View>
                    <TouchableOpacity disabled={sent[u.id]} onPress={() => invite(u)} style={[s.smallBtn, sent[u.id] && { opacity: 0.6 }]}><Text style={{ color: sent[u.id] ? '#22C55E' : '#fff', fontWeight: '700' }}>{sent[u.id] ? '✓ Convidado' : 'Convidar'}</Text></TouchableOpacity>
                  </View>
                ))}
                {tg.isHost && <TouchableOpacity onPress={tg.endRoom} style={{ marginTop: 'auto' }}><Text style={{ color: '#ff6b6b', textAlign: 'center', fontWeight: '700' }}>Encerrar para todos</Text></TouchableOpacity>}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </>
  );
}

const s = StyleSheet.create({
  topRight: { position: 'absolute', top: 12, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 50 },
  avRow: { flexDirection: 'row', alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(31,31,31,0.95)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#2A2A2A' },
  recent: { position: 'absolute', left: 16, bottom: 78, gap: 6, zIndex: 40 },
  recentMsg: { alignSelf: 'flex-start', backgroundColor: 'rgba(31,31,31,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  recentTxt: { color: '#E5E5E5', fontSize: 13 },
  actions: { position: 'absolute', right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 50 },
  micBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' },
  micTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  leave: { height: 42, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  leaveTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  topWrap: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center', gap: 6, zIndex: 50 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  chipOk: { backgroundColor: 'rgba(34,197,94,0.16)' }, chipWarn: { backgroundColor: 'rgba(251,191,36,0.16)' },
  dot: { width: 7, height: 7, borderRadius: 4 }, chipTxt: { fontSize: 12, fontWeight: '700' },
  toast: { backgroundColor: 'rgba(31,31,31,0.95)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  toastTxt: { color: '#fff', fontSize: 12.5 },
  fab: { position: 'absolute', right: 16, bottom: 90, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(229,9,20,0.92)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#E50914', fontSize: 11, fontWeight: '800' },
  sheetWrap: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '46%', minWidth: 300, zIndex: 60 },
  sheet: { flex: 1, backgroundColor: 'rgba(20,20,20,0.97)', borderLeftWidth: 1, borderLeftColor: '#1f1f1f' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#1a1a1a' }, tabOn: { backgroundColor: '#E50914' }, tabTxt: { color: '#b3b3b3', fontWeight: '700', fontSize: 13 },
  empty: { color: '#666', textAlign: 'center', marginTop: 24 },
  msg: { alignSelf: 'flex-start', backgroundColor: '#1f1f1f', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', backgroundColor: '#E50914' },
  msgName: { color: '#c4b5fd', fontSize: 11, fontWeight: '700' }, msgTxt: { color: '#fff', fontSize: 14 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  input: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#fff' },
  sendBtn: { width: 40, borderRadius: 10, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, avatarTxt: { color: '#fff', fontWeight: '800' },
  avName: { color: '#b3b3b3', fontSize: 11, marginTop: 3, maxWidth: 60 },
  label: { color: '#888', fontSize: 13 },
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E50914', borderRadius: 10, paddingVertical: 11 }, btnTxt: { color: '#fff', fontWeight: '700' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallBtn: { backgroundColor: '#1f1f1f', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
});
