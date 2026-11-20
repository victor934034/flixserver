import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { DATE_PRESETS } from '../lib/datePresets';

// Faixa de chips de data de lançamento + ordenação por lançamento
export default function DateChips({ value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row} style={{ flexGrow: 0 }}>
      {DATE_PRESETS.map(p => {
        const on = value === p.key;
        return (
          <TouchableOpacity key={p.key || 'all'} onPress={() => onChange(p.key)} activeOpacity={0.7}
            style={[s.chip, on && s.chipOn]}>
            <Text style={[s.txt, on && s.txtOn]}>{p.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  chipOn: { borderColor: '#E50914', backgroundColor: 'rgba(229,9,20,0.14)' },
  txt: { color: '#b3b3b3', fontSize: 12.5, fontWeight: '600' },
  txtOn: { color: '#fff' },
});
