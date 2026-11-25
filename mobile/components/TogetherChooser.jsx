import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../lib/api';

// "Assistir juntos": antes de qualquer coisa a pessoa escolhe criar uma sala ou entrar numa pelo código.
export default function TogetherChooser({ visible, title, onCreate, onClose }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (visible) { setCode(''); setBusy(''); setError(''); } }, [visible]);

  const create = async () => {
    if (busy) return;
    setBusy('create'); setError('');
    try { await onCreate(); onClose(); }
    catch (e) { setError(e.response?.data?.error || e.message || 'Não foi possível criar a sala.'); setBusy(''); }
  };

  const join = async () => {
    if (busy || code.length !== 6) return;
    setBusy('join'); setError('');
    try {
      await api.get(`/together/rooms/${code}`);
      onClose();
      router.push({ pathname: '/juntos', params: { code } });
    } catch (e) { setError(e.response?.data?.error || 'Sala não encontrada ou encerrada.'); setBusy(''); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <Text style={s.title}>Assistir juntos</Text>
          {title ? <Text style={s.sub} numberOfLines={2}>{title}</Text> : null}

          <TouchableOpacity style={s.primary} onPress={create} disabled={!!busy} activeOpacity={0.9}>
            {busy === 'create' ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Criar uma sala</Text>}
          </TouchableOpacity>

          <Text style={s.or}>ou entre na sala de um amigo</Text>
          <TextInput
            value={code}
            onChangeText={t => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="CÓDIGO" placeholderTextColor="#555" autoCapitalize="characters" autoCorrect={false}
            maxLength={6} style={s.input} onSubmitEditing={join}
          />
          <TouchableOpacity style={[s.ghost, code.length !== 6 && { opacity: 0.45 }]} onPress={join} disabled={!!busy || code.length !== 6}>
            {busy === 'join' ? <ActivityIndicator color="#fff" /> : <Text style={s.ghostTxt}>Entrar com o código</Text>}
          </TouchableOpacity>

          {error ? <Text style={s.err}>{error}</Text> : null}
          <TouchableOpacity onPress={onClose} style={{ alignSelf: 'center', padding: 10 }}><Text style={s.cancel}>Cancelar</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#141414', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  sub: { color: '#A3A3A3', textAlign: 'center' },
  primary: { height: 54, borderRadius: 14, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  primaryTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  or: { color: '#777', fontSize: 13, textAlign: 'center' },
  input: { backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#333', borderRadius: 14, color: '#fff', fontSize: 24, letterSpacing: 8, textAlign: 'center', paddingVertical: 12 },
  ghost: { height: 52, borderRadius: 14, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  ghostTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  err: { color: '#F87171', textAlign: 'center' },
  cancel: { color: '#888', fontSize: 15 },
});
