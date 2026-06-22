import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
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
        <Text style={styles.subtitle}>Digite seu email para entrar</Text>

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

        <Text style={styles.hint}>
          Enviaremos um código de 6 dígitos para o seu email.{'\n'}
          Não é necessário senha.
        </Text>
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
  subtitle: { fontSize: 16, color: '#b3b3b3', textAlign: 'center', marginBottom: 40 },
  input: {
    backgroundColor: '#1f1f1f', color: '#fff', padding: 16,
    borderRadius: 8, marginBottom: 16, fontSize: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  button: {
    backgroundColor: '#E50914', padding: 16,
    borderRadius: 8, alignItems: 'center', marginBottom: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { color: '#444', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
