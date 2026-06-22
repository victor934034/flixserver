import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterScreen() {
  const { sendOTP } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      return Alert.alert('Email inválido', 'Digite um email válido para continuar.');
    }
    setLoading(true);
    try {
      await sendOTP(trimmed);
      router.push({ pathname: '/(auth)/otp', params: { email: trimmed } });
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível enviar o código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>FLIXHOME</Text>
        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.subtitle}>
          Digite seu email — enviaremos um código para confirmar.{'\n'}
          Não é necessário senha.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="seu@email.com"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        <TouchableOpacity style={styles.button} onPress={handleSend} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Enviar código</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Já tem conta? Entrar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: {
    fontSize: 36, fontWeight: '900', color: '#E50914',
    textAlign: 'center', letterSpacing: 6, marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 36 },
  input: {
    backgroundColor: '#1f1f1f', color: '#fff', padding: 16,
    borderRadius: 8, marginBottom: 16, fontSize: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  button: {
    backgroundColor: '#E50914', padding: 16,
    borderRadius: 8, alignItems: 'center', marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { alignItems: 'center', padding: 10 },
  backText: { color: '#555', fontSize: 13 },
});
