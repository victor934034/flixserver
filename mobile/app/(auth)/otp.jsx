import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function OTPScreen() {
  const { email } = useLocalSearchParams();
  const { verifyOTP, sendOTP } = useAuth();
  const router = useRouter();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const inputRefs = useRef([]);
  const cooldownRef = useRef(null);

  useEffect(() => {
    startCooldown();
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => clearInterval(cooldownRef.current);
  }, []);

  function startCooldown() {
    setCooldown(60);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function handleDigit(index, value) {
    const clean = value.replace(/\D/g, '');

    // Handle paste (multiple digits at once)
    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split('');
      const next = [...digits];
      chars.forEach((c, i) => { if (index + i < 6) next[index + i] = c; });
      setDigits(next);
      const focusIdx = Math.min(index + chars.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = clean.slice(-1);
    setDigits(next);
    if (clean && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleBackspace(index) {
    if (!digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  }

  const handleVerify = useCallback(async () => {
    const code = digits.join('');
    if (code.length < 6) return Alert.alert('Código incompleto', 'Digite todos os 6 dígitos.');
    setLoading(true);
    try {
      await verifyOTP(email, code);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Código inválido. Tente novamente.');
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }, [digits, email]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await sendOTP(email);
      setDigits(['', '', '', '', '', '']);
      startCooldown();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      Alert.alert('Código reenviado', `Verifique sua caixa de entrada em ${email}`);
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível reenviar.');
    }
  };

  const code = digits.join('');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>FLIXHOME</Text>
        <Text style={styles.title}>Verifique seu email</Text>
        <Text style={styles.subtitle}>
          Enviamos um código de 6 dígitos para{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>

        {/* Caixas OTP */}
        <View style={styles.boxRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={r => { inputRefs.current[i] = r; }}
              style={[styles.box, d ? styles.boxFilled : null]}
              value={d}
              onChangeText={v => handleDigit(i, v)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace') handleBackspace(i);
              }}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
              caretHidden
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, code.length < 6 && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading || code.length < 6}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Verificar</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendBtn}
          onPress={handleResend}
          disabled={cooldown > 0}
        >
          <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Usar outro email</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center' },
  logo: {
    fontSize: 32, fontWeight: '900', color: '#E50914',
    letterSpacing: 6, marginBottom: 32,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  email: { color: '#E50914', fontWeight: '600' },

  boxRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  box: {
    width: 46, height: 56, borderRadius: 10,
    backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a',
    color: '#fff', fontSize: 24, fontWeight: '700',
    textAlign: 'center',
  },
  boxFilled: { borderColor: '#E50914' },

  button: {
    backgroundColor: '#E50914', padding: 16, borderRadius: 10,
    alignItems: 'center', width: '100%', marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  resendBtn: { padding: 12, marginBottom: 8 },
  resendText: { color: '#E50914', fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: '#444' },

  backBtn: { padding: 10 },
  backText: { color: '#555', fontSize: 13 },
});
