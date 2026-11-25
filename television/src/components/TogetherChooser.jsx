import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

// Mesmo alfabeto dos códigos de sala (sem 0/O e 1/I)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('');

function Btn({ label, onPress, preferred, style }) {
  return (
    <Pressable hasTVPreferredFocus={preferred} onPress={onPress} style={({ focused }) => [s.btn, style, focused && s.btnFocus]}>
      {({ focused }) => <Text style={[s.btnTxt, focused && { color: '#000' }]}>{label}</Text>}
    </Pressable>
  );
}

// "Assistir juntos" na TV: criar uma sala ou digitar o código com o controle.
export default function TogetherChooser({ visible, title, onCreate, onJoin, onClose }) {
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!visible) return null;

  const reset = () => { setTyping(false); setCode(''); setError(''); setBusy(false); };
  const close = () => { reset(); onClose(); };

  const join = async () => {
    if (busy) return;
    if (code.length !== 6) { setError('O código tem 6 letras e números.'); return; }
    setBusy(true); setError('');
    try { await onJoin(code); close(); }
    catch (e) { setError(e.response?.data?.error || 'Sala não encontrada ou encerrada.'); setBusy(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={typing ? reset : close}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>Assistir juntos</Text>
          <Text style={s.sub} numberOfLines={1}>{typing ? 'Digite o código da sala' : title}</Text>
          {!typing ? (
            <View key="choose" style={s.column}>
              <Btn label="Criar uma sala" preferred onPress={() => { close(); onCreate(); }} />
              <Btn label="Entrar com o código" onPress={() => setTyping(true)} />
              <Btn label="Cancelar" onPress={close} />
            </View>
          ) : (
            <View key="code">
              <Text style={s.code}>{(code + '______').slice(0, 6)}</Text>
              <View style={s.grid}>
                {CHARS.map((ch, i) => (
                  <Btn key={ch} label={ch} preferred={i === 0} style={s.key}
                    onPress={() => { setError(''); setCode(c => (c.length < 6 ? c + ch : c)); }} />
                ))}
              </View>
              <View style={s.row}>
                <Btn label="Apagar" style={s.flex} onPress={() => setCode(c => c.slice(0, -1))} />
                <Btn label={busy ? 'Entrando...' : 'Entrar'} style={s.flex} onPress={join} />
                <Btn label="Voltar" style={s.flex} onPress={reset} />
              </View>
            </View>
          )}
          {!!error && <Text style={s.error}>{error}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '52%', backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  sub: { color: '#aaa', fontSize: 13, marginTop: 5, marginBottom: 16 },
  column: { gap: 10 },
  code: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 10, textAlign: 'center', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  key: { width: '11%', paddingHorizontal: 0 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  flex: { flex: 1 },
  btn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#242424', alignItems: 'center' },
  btnFocus: { backgroundColor: '#fff' },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  error: { color: '#f87171', fontSize: 13, marginTop: 12, textAlign: 'center' },
});
