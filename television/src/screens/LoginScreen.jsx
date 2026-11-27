import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableHighlight, Image,
  StyleSheet, ActivityIndicator, Dimensions, findNodeHandle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

const { width: W } = Dimensions.get('window');

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({ label, active, onPress, onFocus, onBlur, hasTVPreferredFocus }) {
  const [focused, setFocused] = useState(false);
  return (
    <TouchableHighlight
      underlayColor="transparent"
      onPress={onPress}
      onFocus={() => { setFocused(true); onFocus?.(); }}
      onBlur={() => { setFocused(false); onBlur?.(); }}
      hasTVPreferredFocus={hasTVPreferredFocus}
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
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const eyeRef = useRef(null);
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
        ref={emailRef}
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
        nextFocusDown={findNodeHandle(passwordRef.current)}
        hasTVPreferredFocus
      />

      <View style={styles.passwordWrap}>
        <TextInput
          ref={passwordRef}
          style={[styles.input, styles.passwordInput, focused === 'password' && styles.inputFocused]}
          placeholder="Senha"
          placeholderTextColor="#444"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused('')}
          onSubmitEditing={handleLogin}
          // Em alguns teclados virtuais de Android TV, o botao "Enter" do
          // controle manda um KEYCODE_ENTER cru em vez da acao de IME que
          // onSubmitEditing escuta - sem isso, digitar e apertar Enter na
          // senha parecia nao fazer nada.
          onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Enter') handleLogin(); }}
          nextFocusUp={findNodeHandle(emailRef.current)}
          nextFocusDown={findNodeHandle(btnRef.current)}
          nextFocusRight={findNodeHandle(eyeRef.current)}
        />
        <TouchableHighlight
          ref={eyeRef}
          onPress={() => setShowPassword(v => !v)}
          underlayColor="transparent"
          style={[styles.eyeBtn, focused === 'eye' && styles.eyeBtnFocused]}
          onFocus={() => setFocused('eye')}
          onBlur={() => setFocused('')}
          nextFocusLeft={findNodeHandle(passwordRef.current)}
          nextFocusDown={findNodeHandle(btnRef.current)}
        >
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={focused === 'eye' ? '#E50914' : '#666'} />
        </TouchableHighlight>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableHighlight
        ref={btnRef}
        onPress={handleLogin}
        underlayColor="#c50911"
        style={[styles.btn, focused === 'btn' && styles.btnFocused]}
        onFocus={() => setFocused('btn')}
        onBlur={() => setFocused('')}
        nextFocusUp={findNodeHandle(passwordRef.current)}
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
function RemoteLogin({ onSuccess, onSwitch }) {
  const { loginWithToken } = useAuth();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('loading'); // loading | waiting | error
  const codeRef = useRef('');
  const intervalRef = useRef(null);

  useEffect(() => {
    requestCode();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Retry automatico em erro de rede (sem resposta do servidor) - TV as
  // vezes tem uma falha de conexao passageira logo ao ligar/trocar de Wi-Fi,
  // nao precisa jogar o usuario pra tela de erro por isso.
  async function requestCode(attempt = 0) {
    setStatus('loading');
    try {
      const { data } = await api.post('/auth/tv/code');
      codeRef.current = data.code;
      setCode(data.code);
      setStatus('waiting');
      startPolling();
    } catch (e) {
      const isNetworkError = !e.response;
      if (isNetworkError && attempt < 2) {
        setTimeout(() => requestCode(attempt + 1), 1500);
        return;
      }
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

  const origin = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
  const site = origin.replace(/^https?:\/\//, '');
  const qrUri = origin + '/api/payments/qr?text=' + encodeURIComponent(origin + '/autorizar-tv?code=' + code);
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
        <View style={styles.dWrap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dLogo}>FLIXHOME</Text>
            <Text style={styles.dTitle}>Entre com o celular</Text>
            {[['Escaneie o QR code ou acesse ', site + '/autorizar-tv'], ['Entre com seu e-mail e o código que enviamos', ''], ['Confirme o código da TV abaixo', '']].map(([t, b2], i) => (
              <View key={i} style={styles.dStep}>
                <View style={styles.dNum}><Text style={styles.dNumTxt}>{i + 1}</Text></View>
                <Text style={styles.dStepTxt}>{t}<Text style={{ color: '#fff', fontWeight: '800' }}>{b2}</Text></Text>
              </View>
            ))}
            <View style={styles.dBoxes}>
              {code.split('').map((c, i) => <View key={i} style={styles.dBox}><Text style={styles.dBoxTxt}>{c}</Text></View>)}
            </View>
            <View style={styles.dCallout}>
              <Ionicons name="mail-outline" size={28} color="#FBBF24" />
              <Text style={styles.dCalloutTxt}>O código do e-mail não chegou? Olhe também a caixa de <Text style={{ color: '#FBBF24', fontWeight: '900' }}>spam / lixo eletrônico</Text> no celular.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 20, marginTop: 28 }}>
              <TouchableHighlight onPress={requestCode} underlayColor="rgba(255,255,255,0.1)" style={styles.dBtn} hasTVPreferredFocus>
                <Text style={styles.dBtnTxt}>Gerar novo código</Text>
              </TouchableHighlight>
              <TouchableHighlight onPress={onSwitch} underlayColor="rgba(255,255,255,0.1)" style={styles.dBtn}>
                <Text style={styles.dBtnTxt}>E-mail e senha</Text>
              </TouchableHighlight>
            </View>
          </View>
          <View style={styles.dQrCol}>
            <View style={styles.dQr}>
              <Image source={{ uri: qrUri }} style={{ width: 360, height: 360 }} />
            </View>
            <Text style={styles.dExpire}>Código expira em 10 min</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  // "remote" (codigo) e o padrao — digitar email/senha com controle remoto
  // é sempre ruim, o LG nem oferece essa opcao, so o login por codigo.
  const [tab, setTab] = useState('remote'); // 'direct' | 'remote'

  function onSuccess() {
    navigation.replace('Home');
  }

  if (tab === 'remote') {
    return (
      <View style={[styles.container, { alignItems: 'stretch', justifyContent: 'center', padding: 70 }]}>
        <LinearGradient colors={['#1a0606', '#0A0A0A', '#0A0A0A']} style={StyleSheet.absoluteFill} start={{ x: 1, y: 0.4 }} end={{ x: 0, y: 0.6 }} />
        <RemoteLogin onSuccess={onSuccess} onSwitch={() => setTab('direct')} />
      </View>
    );
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
            label="Login via Código"
            active={tab === 'remote'}
            onPress={() => setTab('remote')}
            hasTVPreferredFocus
          />
          <TabBtn
            label="Email e Senha"
            active={tab === 'direct'}
            onPress={() => setTab('direct')}
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
  dWrap: { flexDirection: 'row', gap: 60, alignItems: 'center' },
  dLogo: { color: '#E50914', fontSize: 22, fontWeight: '900', letterSpacing: 10, marginBottom: 26 },
  dTitle: { color: '#fff', fontSize: 62, fontWeight: '900', marginBottom: 24 },
  dStep: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 14 },
  dNum: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  dNumTxt: { color: '#fff', fontWeight: '800', fontSize: 22 },
  dStepTxt: { color: '#CFCFCF', fontSize: 28 },
  dBoxes: { flexDirection: 'row', gap: 14, marginVertical: 24 },
  dBox: { width: 84, height: 94, borderRadius: 14, backgroundColor: '#1F1F1F', borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  dBoxTxt: { color: '#fff', fontSize: 54, fontWeight: '900' },
  dCallout: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 22, borderRadius: 16, backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)' },
  dCalloutTxt: { flex: 1, color: '#FDE68A', fontSize: 26 },
  dBtn: { paddingHorizontal: 34, paddingVertical: 18, borderRadius: 12, backgroundColor: '#1F1F1F', borderWidth: 3, borderColor: '#2A2A2A' },
  dBtnTxt: { color: '#fff', fontSize: 26, fontWeight: '800' },
  dQrCol: { alignItems: 'center', gap: 20 },
  dQr: { width: 400, height: 400, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  dExpire: { color: '#A3A3A3', fontSize: 24 },
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
  passwordWrap: { position: 'relative', justifyContent: 'center', marginBottom: 14 },
  passwordInput: { paddingRight: 52, marginBottom: 0 },
  eyeBtn: {
    position: 'absolute', right: 4, top: 0, bottom: 0,
    width: 44,
    justifyContent: 'center', alignItems: 'center', borderRadius: 6,
  },
  eyeBtnFocused: { backgroundColor: 'rgba(229,9,20,0.15)' },
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
