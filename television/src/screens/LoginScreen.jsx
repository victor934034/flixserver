import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableHighlight,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

const { width: W } = Dimensions.get('window');

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({ label, active, onPress, onFocus, onBlur }) {
  const [focused, setFocused] = useState(false);
  return (
    <TouchableHighlight
      underlayColor="transparent"
      onPress={onPress}
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => { setFocused(false); onBlur?.(); }}
      style={[styles.tabBtn, active && styles.tabBtnActive, focused && styles.tabBtnFocused]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableHighlight>
  );
}

// ── Direct login ──────────────────────────────────────────────────────────────
function DirectLogin({ onSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState('email');
  const passwordRef = useRef(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Preencha email e senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.error || 'Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View>
      <TextInput
        style={[styles.input, focused === 'email' && styles.inputFocused]}
        placeholder="Email"
        placeholderTextColor="#444"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="next"
        onFocus={() => setFocused('email')}
        onBlur={() => setFocused('')}
        onSubmitEditing={() => passwordRef.current?.focus()}
        hasTVPreferredFocus
      />

      <TextInput
        ref={passwordRef}
        style={[styles.input, focused === 'password' && styles.inputFocused]}
        placeholder="Senha"
        placeholderTextColor="#444"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        returnKeyType="done"
        onFocus={() => setFocused('password')}
        onBlur={() => setFocused('')}
        onSubmitEditing={handleLogin}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableHighlight
        onPress={handleLogin}
        underlayColor="#c50911"
        style={[styles.btn, focused === 'btn' && styles.btnFocused]}
        onFocus={() => setFocused('btn')}
        onBlur={() => setFocused('')}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Entrar</Text>
        }
      </TouchableHighlight>
    </View>
  );
}

// ── Remote login (code) ───────────────────────────────────────────────────────
function RemoteLogin({ onSuccess }) {
  const { loginWithToken } = useAuth();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('loading'); // loading | waiting | error
  const codeRef = useRef('');
  const intervalRef = useRef(null);

  useEffect(() => {
    requestCode();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  async function requestCode() {
    setStatus('loading');
    try {
      const { data } = await api.post('/auth/tv/code');
      codeRef.current = data.code;
      setCode(data.code);
      setStatus('waiting');
      startPolling();
    } catch {
      setStatus('error');
    }
  }

  function startPolling() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      if (!codeRef.current) return;
      try {
        const { data } = await api.get(`/auth/tv/code/${codeRef.current}`);
        if (data.status === 'authorized') {
          clearInterval(intervalRef.current);
          await loginWithToken(data.token, data.user);
          onSuccess();
        }
      } catch {}
    }, 3000);
  }

  // Format code as pairs: "AB 1C 2D"
  const formatted = code
    ? code.replace(/(.{2})/g, '$1 ').trim()
    : '';

  return (
    <View style={styles.codeBox}>
      {status === 'loading' && (
        <ActivityIndicator color="#E50914" size="large" style={{ marginVertical: 32 }} />
      )}

      {status === 'error' && (
        <>
          <Text style={styles.codeError}>Não foi possível gerar o código.</Text>
          <TouchableHighlight
            onPress={requestCode}
            underlayColor="#c50911"
            style={styles.btn}
            hasTVPreferredFocus
          >
            <Text style={styles.btnText}>Tentar novamente</Text>
          </TouchableHighlight>
        </>
      )}

      {status === 'waiting' && (
        <>
          <Text style={styles.codeLabel}>Seu código de acesso</Text>
          <Text style={styles.code}>{formatted}</Text>

          <View style={styles.codeSteps}>
            <View style={styles.codeStep}>
              <View style={styles.codeStepNum}><Text style={styles.codeStepNumText}>1</Text></View>
              <Text style={styles.codeStepText}>
                No celular ou computador, acesse o app e faça login
              </Text>
            </View>
            <View style={styles.codeStep}>
              <View style={styles.codeStepNum}><Text style={styles.codeStepNumText}>2</Text></View>
              <Text style={styles.codeStepText}>
                Vá em <Text style={{ color: '#E50914' }}>Perfil → Autorizar TV</Text> e insira o código acima
              </Text>
            </View>
            <View style={styles.codeStep}>
              <View style={styles.codeStepNum}><Text style={styles.codeStepNumText}>3</Text></View>
              <Text style={styles.codeStepText}>
                A TV entrará automaticamente
              </Text>
            </View>
          </View>

          <View style={styles.codeExpiry}>
            <ActivityIndicator color="#E50914" size="small" style={{ marginRight: 8 }} />
            <Text style={styles.codeExpiryText}>Aguardando confirmação… (expira em 10 min)</Text>
          </View>

          <TouchableHighlight
            onPress={requestCode}
            underlayColor="rgba(255,255,255,0.1)"
            style={styles.btnOutline}
            hasTVPreferredFocus
          >
            <Text style={styles.btnOutlineText}>Gerar novo código</Text>
          </TouchableHighlight>
        </>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const [tab, setTab] = useState('direct'); // 'direct' | 'remote'

  function onSuccess() {
    navigation.replace('Home');
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a0000', '#0d0000', '#000']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.card}>
        <Text style={styles.logo}>FLIXHOME</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TabBtn
            label="Email e Senha"
            active={tab === 'direct'}
            onPress={() => setTab('direct')}
          />
          <TabBtn
            label="Login via Código"
            active={tab === 'remote'}
            onPress={() => setTab('remote')}
          />
        </View>

        {tab === 'direct'
          ? <DirectLogin onSuccess={onSuccess} />
          : <RemoteLogin onSuccess={onSuccess} />
        }
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
    width: 480,
    backgroundColor: 'rgba(15,15,15,0.96)',
    borderRadius: 14,
    padding: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  logo: {
    fontSize: 34,
    fontWeight: '900',
    color: '#E50914',
    textAlign: 'center',
    letterSpacing: 5,
    marginBottom: 24,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: 'rgba(229,9,20,0.15)' },
  tabBtnFocused: { backgroundColor: 'rgba(255,255,255,0.1)' },
  tabText: { color: '#555', fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: '#E50914' },

  // Direct login
  input: {
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#1f1f1f',
    borderRadius: 7,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#fff',
    marginBottom: 14,
  },
  inputFocused: {
    borderColor: '#E50914',
    backgroundColor: '#1a1a1a',
  },
  error: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  btn: {
    backgroundColor: '#E50914',
    borderRadius: 7,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  btnFocused: { backgroundColor: '#c50911' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 7,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  btnOutlineText: { color: '#aaa', fontSize: 15 },

  // Remote login
  codeBox: { alignItems: 'center', paddingTop: 8 },
  codeLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  code: {
    fontSize: 46,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 28,
    backgroundColor: 'rgba(229,9,20,0.12)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(229,9,20,0.3)',
    overflow: 'hidden',
  },
  codeSteps: { width: '100%', gap: 12, marginBottom: 24 },
  codeStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  codeStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E50914',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  codeStepNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  codeStepText: { flex: 1, color: '#bbb', fontSize: 15, lineHeight: 22 },
  codeExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  codeExpiryText: { color: '#666', fontSize: 13 },
  codeError: { color: '#ff6b6b', fontSize: 15, marginBottom: 20, textAlign: 'center' },
});
