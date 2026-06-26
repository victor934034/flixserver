import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { parseM3U, groupChannels } from '../utils/parseM3U';

// Listas públicas gratuitas para teste rápido
const QUICK_LISTS = [
  { label: 'IPTV-org Brasil', url: 'https://iptv-org.github.io/iptv/countries/br.m3u' },
  { label: 'IPTV-org Português', url: 'https://iptv-org.github.io/iptv/languages/por.m3u' },
  { label: 'IPTV-org Todos (mundial)', url: 'https://iptv-org.github.io/iptv/index.m3u' },
];

export default function HomeScreen() {
  const router   = useRouter();
  const [url,    setUrl]    = useState('');
  const [loading, setLoading] = useState(false);

  async function loadList(m3uUrl) {
    const target = (m3uUrl || url).trim();
    if (!target) { Alert.alert('Informe uma URL da lista M3U'); return; }

    setLoading(true);
    try {
      const res  = await fetch(target, { headers: { 'User-Agent': 'IPTV-Test/1.0' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text     = await res.text();
      const channels = parseM3U(text);
      if (!channels.length) throw new Error('Nenhum canal encontrado na lista');
      const groups  = groupChannels(channels);
      router.push({ pathname: '/channels', params: { data: JSON.stringify({ groups, total: channels.length, source: target }) } });
    } catch (e) {
      Alert.alert('Erro ao carregar lista', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>📺</Text>
          <Text style={styles.title}>IPTV Test</Text>
          <Text style={styles.sub}>Cole a URL da sua lista M3U abaixo</Text>
        </View>

        {/* Input */}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="http://provedor.com/lista.m3u"
            placeholderTextColor="#444"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => loadList(url)}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Carregar Lista</Text>
          }
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou teste com</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Quick lists */}
        {QUICK_LISTS.map(item => (
          <TouchableOpacity
            key={item.url}
            style={styles.quickBtn}
            onPress={() => loadList(item.url)}
            disabled={loading}
          >
            <Text style={styles.quickLabel}>{item.label}</Text>
            <Text style={styles.quickUrl} numberOfLines={1}>{item.url}</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.hint}>
          Você também pode colar o conteúdo de um arquivo .m3u em vez da URL.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 40 },

  logo: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  sub: { fontSize: 14, color: '#555', marginTop: 6 },

  inputWrap: {
    backgroundColor: '#141414', borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 12,
  },
  input: {
    color: '#fff', fontSize: 14, padding: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  btn: {
    backgroundColor: '#c91c2c', borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 32,
  },
  btnDisabled: { backgroundColor: '#3a0a0a' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1e1e1e' },
  dividerText: { color: '#444', fontSize: 12, marginHorizontal: 12 },

  quickBtn: {
    backgroundColor: '#111', borderRadius: 10,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  quickLabel: { color: '#fff', fontWeight: '600', fontSize: 14, marginBottom: 4 },
  quickUrl: { color: '#444', fontSize: 11 },

  hint: { color: '#333', fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
});
