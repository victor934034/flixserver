import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableHighlight,
  StyleSheet, ActivityIndicator, ImageBackground, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';

const { width: W, height: H } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState('');
  const passwordRef = useRef(null);
  const btnRef = useRef(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Preencha email e senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigation.replace('Home');
    } catch (e) {
      setError(e.response?.data?.error || 'Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a0000', '#0a0a0a', '#000']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.card}>
        <Text style={styles.logo}>FLIXHOME</Text>
        <Text style={styles.subtitle}>Faça login para continuar</Text>

        <TextInput
          style={[styles.input, focusedField === 'email' && styles.inputFocused]}
          placeholder="Email"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          onFocus={() => setFocusedField('email')}
          onBlur={() => setFocusedField('')}
          onSubmitEditing={() => passwordRef.current?.focus()}
          hasTVPreferredFocus
        />

        <TextInput
          ref={passwordRef}
          style={[styles.input, focusedField === 'password' && styles.inputFocused]}
          placeholder="Senha"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onFocus={() => setFocusedField('password')}
          onBlur={() => setFocusedField('')}
          onSubmitEditing={handleLogin}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableHighlight
          ref={btnRef}
          onPress={handleLogin}
          underlayColor="#c50911"
          style={styles.btn}
          onFocus={() => setFocusedField('btn')}
          onBlur={() => setFocusedField('')}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Entrar</Text>
          }
        </TouchableHighlight>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  card: {
    width: 420,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: '#E50914',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#fff',
    marginBottom: 16,
  },
  inputFocused: {
    borderColor: '#E50914',
    backgroundColor: '#222',
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#E50914',
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
