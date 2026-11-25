import { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWatched } from '../lib/watched';

export default function WatchedButton({ type, id }) {
  const { enabled, has, toggle } = useWatched();
  const [busy, setBusy] = useState(false);
  if (!enabled || !id) return null;
  const on = has(type, id);

  const press = async () => {
    if (busy) return;
    setBusy(true);
    try { await toggle(type, id); } catch { Alert.alert('Já assisti', 'Não foi possível salvar. Tente de novo.'); }
    setBusy(false);
  };

  return (
    <TouchableOpacity style={[s.btn, on && s.btnOn]} onPress={press} activeOpacity={0.8} accessibilityState={{ checked: on }}>
      {busy
        ? <ActivityIndicator size="small" color="#fff" />
        : <Ionicons name={on ? 'checkmark-circle' : 'checkmark-circle-outline'} size={19} color={on ? '#4ade80' : '#fff'} />}
      <Text style={[s.txt, on && { color: '#4ade80' }]}>{on ? 'Já assisti' : 'Marcar como assistido'}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, paddingVertical: 12, marginBottom: 16 },
  btnOn: { borderColor: '#4ade80' },
  txt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
