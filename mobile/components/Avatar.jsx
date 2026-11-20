import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Avatar do design: círculo com iniciais (ou foto), anel verde 3px quando fala, selo de mudo.
const COLORS = ['#7c3aed', '#0ea5e9', '#f97316', '#e11d48', '#14b8a6', '#eab308', '#6366f1', '#84cc16'];
export const colorOf = (id) => COLORS[[...String(id || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
export const initials = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

export default function Avatar({ name, userId, photo, size = 52, speaking = false, muted = false, onPress, label, sub }) {
  const inner = (
    <View style={{ alignItems: 'center', width: size + 14 }}>
      <View style={[s.ring, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }, speaking && s.ringOn]}>
        {photo
          ? <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />
          : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colorOf(userId || name), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.34 }}>{initials(name)}</Text>
            </View>}
        {muted && <View style={s.mute}><Ionicons name="mic-off" size={10} color="#fff" /></View>}
      </View>
      {label ? <Text style={s.label} numberOfLines={1}>{label}</Text> : null}
      {sub ? <Text style={s.sub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
  return onPress ? <TouchableOpacity activeOpacity={0.8} onPress={onPress}>{inner}</TouchableOpacity> : inner;
}

// "+ Convidar" (círculo tracejado)
export function InviteBubble({ size = 52, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={{ alignItems: 'center', width: size + 14 }}>
      <View style={[s.ring, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
        <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#555', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={22} color="#888" />
        </View>
      </View>
      <Text style={s.label}>Convidar</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  ringOn: { borderColor: '#22C55E' },
  mute: { position: 'absolute', right: 0, bottom: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: '#3a3a3a', borderWidth: 2, borderColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#E5E5E5', fontSize: 12, fontWeight: '600', marginTop: 6, maxWidth: 72 },
  sub: { color: '#888', fontSize: 11, marginTop: 1 },
});
