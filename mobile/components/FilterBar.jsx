import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DATE_PRESETS, dateLabel, MIN_YEAR, MAX_YEAR } from '../lib/datePresets';

// Cabeçalho + filtros combinados (gênero + data de lançamento), com chips removíveis (design: "2020–2026 ×")
export default function FilterBar({ title, genres = [], genre, onGenre, dateKey, onDate }) {
  const [open, setOpen] = useState(false);
  const [g, setG] = useState(null);
  const [d, setD] = useState('');
  const [from, setFrom] = useState(2020);
  const [to, setTo] = useState(MAX_YEAR);

  const count = (genre ? 1 : 0) + (dateKey ? 1 : 0);
  const openSheet = () => {
    setG(genre || null); setD(dateKey || '');
    const m = /^range:(\d{4})-(\d{4})$/.exec(dateKey || '');
    if (m) { setFrom(+m[1]); setTo(+m[2]); }
    setOpen(true);
  };
  const apply = () => { onGenre(g); onDate(d); setOpen(false); };
  const clear = () => { setG(null); setD(''); };
  const step = (set, v, dv) => set(Math.min(MAX_YEAR, Math.max(MIN_YEAR, v + dv)));
  const applyRange = () => { const a = Math.min(from, to), b = Math.max(from, to); setD(`range:${a}-${b}`); };

  return (
    <View>
      <View style={s.headerRow}>
        <Text style={s.title}>{title}</Text>
        <TouchableOpacity style={[s.filterBtn, count > 0 && s.filterBtnOn]} onPress={openSheet} activeOpacity={0.8}>
          <Ionicons name="options-outline" size={17} color="#fff" />
          <Text style={s.filterTxt}>Filtros</Text>
          {count > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{count}</Text></View>}
        </TouchableOpacity>
      </View>

      {count > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {!!genre && (
            <TouchableOpacity style={s.chip} onPress={() => onGenre(null)} activeOpacity={0.8}>
              <Text style={s.chipTxt}>{genre}</Text><Ionicons name="close" size={14} color="#111" />
            </TouchableOpacity>
          )}
          {!!dateKey && (
            <TouchableOpacity style={s.chip} onPress={() => onDate('')} activeOpacity={0.8}>
              <Text style={s.chipTxt}>{dateLabel(dateKey)}</Text><Ionicons name="close" size={14} color="#111" />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.handle} />
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Filtros</Text>
              <TouchableOpacity onPress={clear}><Text style={s.clear}>Limpar</Text></TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              <Text style={s.label}>GÊNERO</Text>
              <View style={s.wrap}>
                <Opt label="Todos" on={!g} onPress={() => setG(null)} />
                {genres.map(x => <Opt key={x} label={x} on={g === x} onPress={() => setG(x)} />)}
              </View>

              <Text style={[s.label, { marginTop: 22 }]}>DATA DE LANÇAMENTO</Text>
              <View style={s.wrap}>
                {DATE_PRESETS.map(p => <Opt key={p.key || 'all'} label={p.label} on={d === p.key} onPress={() => setD(p.key)} />)}
              </View>

              <Text style={[s.sub, { marginTop: 16 }]}>Ou escolha um intervalo de anos</Text>
              <View style={s.rangeRow}>
                <Stepper label="De" value={from} onMinus={() => step(setFrom, from, -1)} onPlus={() => step(setFrom, from, 1)} />
                <Text style={{ color: '#888', fontSize: 18 }}>–</Text>
                <Stepper label="Até" value={to} onMinus={() => step(setTo, to, -1)} onPlus={() => step(setTo, to, 1)} />
                <TouchableOpacity style={[s.useBtn, /^range:/.test(d) && { backgroundColor: '#22C55E' }]} onPress={applyRange}>
                  <Text style={s.useTxt}>{/^range:/.test(d) ? '✓ Usando' : 'Usar'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={s.footer}>
              <TouchableOpacity style={s.apply} onPress={apply} activeOpacity={0.85}><Text style={s.applyTxt}>Mostrar resultados</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function Opt({ label, on, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[s.opt, on && s.optOn]}>
      <Text style={[s.optTxt, on && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}
function Stepper({ label, value, onMinus, onPlus }) {
  return (
    <View style={s.stepper}>
      <Text style={s.stepLabel}>{label}</Text>
      <View style={s.stepRow}>
        <TouchableOpacity onPress={onMinus} style={s.stepBtn} hitSlop={8}><Ionicons name="remove" size={16} color="#fff" /></TouchableOpacity>
        <Text style={s.stepVal}>{value}</Text>
        <TouchableOpacity onPress={onPlus} style={s.stepBtn} hitSlop={8}><Ionicons name="add" size={16} color="#fff" /></TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  title: { fontSize: 26, fontWeight: '900', color: '#fff' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#1F1F1F', borderWidth: 1, borderColor: '#333' },
  filterBtnOn: { borderColor: '#E50914' },
  filterTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  chips: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#E5E5E5' },
  chipTxt: { color: '#111', fontSize: 13, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#141414', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  clear: { color: '#E50914', fontWeight: '700', fontSize: 14 },
  label: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  sub: { color: '#A3A3A3', fontSize: 13, marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { minHeight: 38, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#1F1F1F', borderWidth: 1, borderColor: '#2A2A2A', justifyContent: 'center' },
  optOn: { backgroundColor: 'rgba(229,9,20,0.18)', borderColor: '#E50914' },
  optTxt: { color: '#B3B3B3', fontSize: 13.5, fontWeight: '600' },
  rangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  stepper: { gap: 4 },
  stepLabel: { color: '#888', fontSize: 11, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1F1F1F', borderRadius: 10, padding: 4 },
  stepBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  stepVal: { color: '#fff', fontWeight: '800', minWidth: 44, textAlign: 'center' },
  useBtn: { height: 40, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  useTxt: { color: '#fff', fontWeight: '800' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#1F1F1F', marginTop: 8 },
  apply: { height: 52, borderRadius: 12, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center' },
  applyTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
