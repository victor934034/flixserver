import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../lib/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = email, 2 = código + nova senha
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    if (!email.trim()) return Alert.alert('Preencha o email');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setStep(2);
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao enviar código');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!code.trim() || !newPassword) return Alert.alert('Preencha todos os campos');
    if (newPassword !== confirmPassword) return Alert.alert('As senhas não coincidem');
    if (newPassword.length < 6) return Alert.alert('Senha deve ter pelo menos 6 caracteres');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email: email.trim(), code: code.trim(), newPassword });
      Alert.alert('Sucesso', 'Senha alterada! Faça login com a nova senha.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Código incorreto ou expirado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>FLIXHOME</Text>
        <Text style={styles.title}>{step === 1 ? 'Esqueci minha senha' : 'Redefinir senha'}</Text>
        <Text style={styles.subtitle}>
          {step === 1
            ? 'Informe seu email e enviaremos um código de 6 dígitos.'
            : `Código enviado para ${email}. Verifique sua caixa de entrada.`}
        </Text>

        {step === 1 ? (
          <>
            <TextInput
              style={styles.input} placeholder="Email" placeholderTextColor="#666"
              value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email"
            />
            <TouchableOpacity style={styles.button} onPress={handleSendCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar código</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input} placeholder="Código de 6 dígitos" placeholderTextColor="#666"
              value={code} onChangeText={setCode}
              keyboardType="number-pad" maxLength={6}
            />
            <TextInput
              style={styles.input} placeholder="Nova senha (mín. 6 caracteres)" placeholderTextColor="#666"
              value={newPassword} onChangeText={setNewPassword}
              secureTextEntry autoComplete="new-password"
            />
            <TextInput
              style={styles.input} placeholder="Confirmar nova senha" placeholderTextColor="#666"
              value={confirmPassword} onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Alterar senha</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkBtn} onPress={handleSendCode} disabled={loading}>
              <Text style={styles.linkText}>Não recebi o código — <Text style={styles.linkHighlight}>reenviar</Text></Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
          <Text style={styles.linkText}>Voltar ao login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: '900', color: '#E50914', textAlign: 'center', letterSpacing: 6, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#b3b3b3', textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  input: {
    backgroundColor: '#1f1f1f', color: '#fff', padding: 16,
    borderRadius: 8, marginBottom: 16, fontSize: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  button: { backgroundColor: '#E50914', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', padding: 8 },
  linkText: { color: '#b3b3b3', fontSize: 14 },
  linkHighlight: { color: '#E50914', fontWeight: '600' },
});
