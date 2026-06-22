import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const { login, sendOTP } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('password');

  const [pwEmail, setPwEmail] = useState('');
  const [pwPassword, setPwPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [otpEmail, setOtpEmail] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const handlePasswordLogin = async () => {
    if (!pwEmail || !pwPassword) return Alert.alert('Preencha todos os campos');
    setPwLoading(true);
    try {
      await login(pwEmail.trim(), pwPassword);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Email ou senha incorretos');
    } finally {
      setPwLoading(false);
    }
  };

  const handleSendOTP = async () => {
    const trimmed = otpEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      return Alert.alert('Email inválido', 'Digite um email válido.');
    }
    setOtpLoading(true);
    try {
      await sendOTP(trimmed);
      router.push({ pathname: '/(auth)/otp', params: { email: trimmed } });
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível enviar o código.');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>FLIXHOME</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'password' && styles.tabActive]}
            onPress={() => setTab('password')}
          >
            <Text style={[styles.tabText, tab === 'password' && styles.tabTextActive]}>Email e senha</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'otp' && styles.tabActive]}
            onPress={() => setTab('otp')}
          >
            <Text style={[styles.tabText, tab === 'otp' && styles.tabTextActive]}>Código por email</Text>
          </TouchableOpacity>
        </View>

        {tab === 'password' ? (
          <View>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#666"
              value={pwEmail}
              onChangeText={setPwEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor="#666"
              value={pwPassword}
              onChangeText={setPwPassword}
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handlePasswordLogin}
            />
            <TouchableOpacity style={styles.button} onPress={handlePasswordLogin} disabled={pwLoading}>
              {pwLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Entrar</Text>}
            </TouchableOpacity>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.linkBtn}>
                <Text style={styles.linkText}>
                  Não tem conta? <Text style={styles.linkHighlight}>Cadastre-se</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        ) : (
          <View>
            <Text style={styles.hint}>Enviamos um código de 6 dígitos para o seu email.</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor="#666"
              value={otpEmail}
              onChangeText={setOtpEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="send"
              onSubmitEditing={handleSendOTP}
            />
            <TouchableOpacity style={styles.button} onPress={handleSendOTP} disabled={otpLoading}>
              {otpLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Enviar código</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: {
    fontSize: 36, fontWeight: '900', color: '#E50914',
    textAlign: 'center', letterSpacing: 6, marginBottom: 32,
  },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#1a1a1a',
    borderRadius: 10, padding: 4, marginBottom: 28,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#E50914' },
  tabText: { color: '#666', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  hint: { color: '#555', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  input: {
    backgroundColor: '#1f1f1f', color: '#fff', padding: 16,
    borderRadius: 8, marginBottom: 14, fontSize: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  button: {
    backgroundColor: '#E50914', padding: 16,
    borderRadius: 8, alignItems: 'center', marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', padding: 8 },
  linkText: { color: '#b3b3b3', fontSize: 14 },
  linkHighlight: { color: '#E50914', fontWeight: '600' },
});
