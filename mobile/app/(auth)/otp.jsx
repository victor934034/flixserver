import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function OTPScreen() {
  const { email, password, name, mode } = useLocalSearchParams();
  const { verifyOTP, registerWithOTP, sendOTP } = useAuth();
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
      if (mode === 'register') {
        await registerWithOTP(email, code, password, name);
        router.replace('/profile-select');
      } else {
        await verifyOTP(email, code);
        router.replace('/(tabs)');
      }
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Código inválido. Tente novamente.');
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  }, [digits, email, mode, password, name]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await sendOTP(email);
      setDigits(['', '', '', '', '', '']);
      startCooldown();
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      Alert.alert('Código reenviado', `Verifique a caixa de entrada de ${email} e também a caixa de spam.`);
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.error || 'Não foi possível reenviar.');
    }
  };

  const code = digits.join('');
  const [focusIdx, setFocusIdx] = useState(0);
  const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backSq} onPress={() => router.back()}><Ionicons name="chevron-back" size={20} color="#fff" /></TouchableOpacity>
        <Text style={styles.logo}>FLIXHOME</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.mailTile}><Ionicons name="mail-outline" size={28} color="#E50914" /></View>
        <Text style={styles.title}>Verifique seu e-mail</Text>
        <Text style={styles.subtitle}>Enviamos um código de 6 dígitos para</Text>
        <Text style={styles.email}>{email}</Text>

        <View style={styles.boxRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={r => { inputRefs.current[i] = r; }}
              style={[styles.box, focusIdx === i && styles.boxFocus]}
              value={d}
              onFocus={() => setFocusIdx(i)}
              onChangeText={v => handleDigit(i, v)}
              onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace') handleBackspace(i); }}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
              caretHidden
            />
          ))}
        </View>

        <View style={styles.callout}>
          <Ionicons name="file-tray-outline" size={22} color="#FBBF24" />
          <Text style={styles.calloutTxt}>Não chegou? Olhe também a caixa de <Text style={{ fontWeight: '900', color: '#FBBF24' }}>spam / lixo eletrônico.</Text></Text>
        </View>

        <View style={styles.resendRow}>
          <TouchableOpacity onPress={handleResend} disabled={cooldown > 0}>
            <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>Reenviar código</Text>
          </TouchableOpacity>
          {cooldown > 0 ? <Text style={styles.cool}>disponível em <Text style={{ color: '#fff', fontWeight: '900' }}>{mmss}</Text></Text> : null}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, code.length < 6 && styles.buttonDisabled]} onPress={handleVerify} disabled={loading || code.length < 6} activeOpacity={0.9}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirmar</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backText}>Usar outro e-mail</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', paddingTop: 48 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backSq: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 18, fontWeight: '900', color: '#E50914', letterSpacing: 6 },
  content: { flex: 1, padding: 24, paddingTop: 28 },
  mailTile: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(229,9,20,0.10)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#E5E5E5', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#A3A3A3' },
  email: { color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 2 },
  boxRow: { flexDirection: 'row', gap: 10, marginTop: 28, marginBottom: 22 },
  box: { flex: 1, height: 64, borderRadius: 14, backgroundColor: '#1F1F1F', borderWidth: 1.5, borderColor: '#2A2A2A', color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  boxFocus: { borderColor: '#E50914' },
  callout: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', borderRadius: 14, padding: 16 },
  calloutTxt: { flex: 1, color: '#FDE68A', fontSize: 15, lineHeight: 21 },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 },
  resendText: { color: '#E50914', fontSize: 15, fontWeight: '800' },
  resendDisabled: { color: '#666' },
  cool: { color: '#A3A3A3', fontSize: 15 },
  footer: { paddingHorizontal: 24, paddingBottom: 34 },
  button: { height: 58, borderRadius: 14, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  backBtn: { padding: 16, alignItems: 'center' },
  backText: { color: '#fff', fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
});
