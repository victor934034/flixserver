import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) return Alert.alert('Preencha todos os campos');
    if (password.length < 6) return Alert.alert('Senha deve ter pelo menos 6 caracteres');
    setLoading(true);
    try {
      await register(email.trim(), password, name);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>FLIXHOME</Text>
        <Text style={styles.subtitle}>Crie sua conta grátis</Text>

        <TextInput
          style={styles.input} placeholder="Nome" placeholderTextColor="#666"
          value={name} onChangeText={setName} autoComplete="name"
        />
        <TextInput
          style={styles.input} placeholder="Email" placeholderTextColor="#666"
          value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
        />
        <TextInput
          style={styles.input} placeholder="Senha (mín. 6 caracteres)"
          placeholderTextColor="#666" value={password} onChangeText={setPassword}
          secureTextEntry autoComplete="new-password"
        />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Criar conta</Text>}
        </TouchableOpacity>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.linkBtn}>
            <Text style={styles.linkText}>
              Já tem conta? <Text style={styles.linkHighlight}>Entrar</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
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
    borderRadius: 8, alignItems: 'center', marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', padding: 8 },
  linkText: { color: '#b3b3b3', fontSize: 14 },
  linkHighlight: { color: '#E50914', fontWeight: '600' },
});
