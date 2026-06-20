import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../lib/api';

export default function AutorizarTv() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function confirm() {
    const trimmed = code.trim().toUpperCase().replace(/\s/g, '');
    if (trimmed.length !== 6) {
      Alert.alert('Código inválido', 'O código deve ter 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/auth/tv/code/${trimmed}/confirm`);
      Alert.alert('TV autorizada!', 'A TV entrará automaticamente em alguns segundos.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
        <Text style={styles.backText}>Voltar</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Ionicons name="tv-outline" size={56} color="#E50914" style={{ marginBottom: 20 }} />
        <Text style={styles.title}>Autorizar TV</Text>
        <Text style={styles.desc}>
          Na sua TV, abra o FlixHome e selecione{' '}
          <Text style={{ color: '#fff' }}>Login via Código</Text>.{'\n'}
          Insira o código de 6 dígitos mostrado na tela.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ex: AB1C2D"
          placeholderTextColor="#444"
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.btn, (!code.trim() || loading) && styles.btnDisabled]}
          onPress={confirm}
          disabled={!code.trim() || loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Conectar TV</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  back: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backText: { color: '#fff', fontSize: 16 },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingBottom: 60,
  },
  title: {
    fontSize: 26, fontWeight: '800', color: '#fff',
    marginBottom: 12, textAlign: 'center',
  },
  desc: {
    fontSize: 15, color: '#777', textAlign: 'center',
    lineHeight: 22, marginBottom: 32,
  },
  input: {
    width: '100%', backgroundColor: '#111',
    borderWidth: 2, borderColor: '#1f1f1f',
    borderRadius: 10, paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 28, fontWeight: '700', color: '#fff',
    textAlign: 'center', letterSpacing: 8, marginBottom: 20,
  },
  btn: {
    width: '100%', backgroundColor: '#E50914',
    borderRadius: 10, paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
