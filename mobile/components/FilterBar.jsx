import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { DATE_PRESETS, dateLabel, presetQuery, MIN_YEAR, MAX_YEAR } from '../lib/datePresets';

export const SORTS = [
  { key: 'recent', label: 'Mais recentes', q: '' },
  { key: 'oldest', label: 'Mais antigos', q: '&sort=release_date&order=asc' },
  { key: 'rating', label: 'Melhor avaliados', q: '&sort=rating' },
  { key: 'az', label: 'A–Z', q: '&sort=title&order=asc' },
];
export const sortQuery = (k) => (SORTS.find(x => x.key === k) || SORTS[0]).q;
const RATINGS = [0, 5, 6, 7, 8, 9];

// Cabeçalho + folha de filtros do design (ano, gênero, nota mínima, ordenar) com chips removíveis
export default function FilterBar({ kind = 'movies', title, genres = [], genre, onGenre, dateKey, onDate, minRating = 0, onMinRating, sortKey = 'recent', onSort }) {
  const [open, setOpen] = useState(false);
  const [g, setG] = useState([]);
  const [d, setD] = useState('');
  const [r, setR] = useState(0);
  const [so, setSo] = useState('recent');
  const [from, setFrom] = useState(2020);
  const [to, setTo] = useState(MAX_YEAR);
  const [total, setTotal] = useState(null);

  const sel = genre ? String(genre).split(',').filter(Boolean) : [];
  const count = sel.length + (dateKey ? 1 : 0) + (minRating > 0 ? 1 : 0) + (sortKey !== 'recent' ? 1 : 0);

  const openSheet = () => {
    setG(sel); setD(dateKey || ''); setR(minRating || 0); setSo(sortKey || 'recent');
    const m = /^range:(\d{4})-(\d{4})$/.exec(dateKey || '');
    if (m) { setFrom(+m[1]); setTo(+m[2]); }
    setOpen(true);
  };
  const apply = () => { onGenre(g.length ? g.join(',') : null); onDate(d); onMinRating?.(r); onSort?.(so); setOpen(false); };
  const clear = () => { setG([]); setD(''); setR(0); setSo('recent'); };
  const toggleG = (x) => setG(l => (l.includes(x) ? l.filter(y => y !== x) : [...l, x]));
  const step = (set, v, dv) => set(Math.min(MAX_YEAR, Math.max(MIN_YEAR, v + dv)));
  const applyRange = (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b); setD(`range:${lo}-${hi}`); };

  // "Ver N resultados" com os filtros do rascunho
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        let url = `/${kind}?page=1&limit=1`;
        if (g.length) url += `&genre=${encodeURIComponent(g.join(','))}`;
        url += presetQuery(d);
        if (r > 0) url += `&min_rating=${r}`;
        const res = await api.get(url);
        if (alive) setTotal(res.data?.total ?? null);
      } catch { if (alive) setTotal(null); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [open, g, d, r, kind]);

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
          {sel.map(x => (
            <TouchableOpacity key={x} style={s.chip} onPress={() => onGenre(sel.filter(y => y !== x).join(',') || null)} activeOpacity={0.8}>
              <Text style={s.chipTxt}>{x}</Text><Ionicons name="close" size={14} color="#111" />
            </TouchableOpacity>
          ))}
          {!!dateKey && (
            <TouchableOpacity style={s.chip} onPress={() => onDate('')} activeOpacity={0.8}>
              <Text style={s.chipTxt}>{dateLabel(dateKey)}</Text><Ionicons name="close" size={14} color="#111" />
            </TouchableOpacity>
          )}
          {minRating > 0 && (
            <TouchableOpacity style={s.chip} onPress={() => onMinRating?.(0)} activeOpacity={0.8}>
              <Text style={s.chipTxt}>★ {minRating},0+</Text><Ionicons name="close" size={14} color="#111" />
            </TouchableOpacity>
          )}
          {sortKey !== 'recent' && (
            <TouchableOpacity style={s.chip} onPress={() => onSort?.('recent')} activeOpacity={0.8}>
              <Text style={s.chipTxt}>{SORTS.find(x => x.key === sortKey)?.label}</Text><Ionicons name="close" size={14} color="#111" />
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
              <TouchableOpacity onPress={clear}><Text style={s.clear}>Limpar filtros</Text></TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Ano de lançamento</Text>
              <View style={s.rangeRow}>
                <Stepper label="De" value={from} onMinus={() => { step(setFrom, from, -1); }} onPlus={() => step(setFrom, from, 1)} onCommit={(v) => applyRange(v, to)} />
                <Text style={{ color: '#888', fontSize: 18, paddingTop: 20 }}>—</Text>
                <Stepper label="Até" value={to} onMinus={() => step(setTo, to, -1)} onPlus={() => step(setTo, to, 1)} onCommit={(v) => applyRange(from, v)} />
              </View>
              <View style={s.wrap}>
                {DATE_PRESETS.filter(p => p.key).map(p => <Opt key={p.key} label={p.label.replace(/ \(\d+\)/, '')} on={d === p.key} onPress={() => setD(d === p.key ? '' : p.key)} />)}
              </View>

              <Text style={[s.label, { marginTop: 22 }]}>Gênero</Text>
              <View style={s.wrap}>
                {genres.map(x => <Opt key={x} label={x} on={g.includes(x)} onPress={() => toggleG(x)} />)}
              </View>

              <View style={[s.rowBetween, { marginTop: 22 }]}>
                <Text style={[s.label, { marginBottom: 0 }]}>Nota mínima</Text>
                <Text style={s.rate}>{r > 0 ? `${r},0+` : 'Qualquer'}</Text>
              </View>
              <View style={[s.wrap, { marginTop: 10 }]}>
                {RATINGS.map(x => <Opt key={x} label={x === 0 ? 'Todas' : `★ ${x}+`} on={r === x} onPress={() => setR(x)} />)}
              </View>

              <Text style={[s.label, { marginTop: 22 }]}>Ordenar por</Text>
              <View style={s.sortGrid}>
                {SORTS.map(x => (
                  <TouchableOpacity key={x.key} style={[s.sortBtn, so === x.key && s.sortOn]} onPress={() => setSo(x.key)} activeOpacity={0.85}>
                    <Text style={s.sortTxt}>{x.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={s.footer}>
              <TouchableOpacity style={s.apply} onPress={apply} activeOpacity={0.85}>
                <Text style={s.applyTxt}>{total != null ? `Ver ${total} resultado${total === 1 ? '' : 's'}` : 'Ver resultados'}</Text>
              </TouchableOpacity>
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
      <Text style={[s.optTxt, on && { color: '#111' }]}>{label}</Text>
    </TouchableOpacity>
  );
}
function Stepper({ label, value, onMinus, onPlus, onCommit }) {
  return (
    <View style={s.stepper}>
      <Text style={s.stepLabel}>{label}</Text>
      <View style={s.stepRow}>
        <TouchableOpacity onPress={() => { onMinus(); onCommit(Math.max(1950, value - 1)); }} style={s.stepBtn} hitSlop={8}><Ionicons name="remove" size={16} color="#fff" /></TouchableOpacity>
        <Text style={s.stepVal}>{value}</Text>
        <TouchableOpacity onPress={() => { onPlus(); onCommit(Math.min(MAX_YEAR, value + 1)); }} style={s.stepBtn} hitSlop={8}><Ionicons name="add" size={16} color="#fff" /></TouchableOpacity>
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
  sheet: { backgroundColor: '#141414', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 14 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
  sheetTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  clear: { color: '#fff', fontWeight: '700', fontSize: 14, textDecorationLine: 'underline' },
  label: { color: '#A3A3A3', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  opt: { minHeight: 42, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333', justifyContent: 'center' },
  optOn: { backgroundColor: '#E5E5E5', borderColor: '#E5E5E5' },
  optTxt: { color: '#E5E5E5', fontSize: 14, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 14 },
  stepper: { flex: 1, gap: 4 },
  stepLabel: { color: '#888', fontSize: 12, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0F0F0F', borderRadius: 12, padding: 6, borderWidth: 1, borderColor: '#2A2A2A' },
  stepBtn: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  stepVal: { color: '#fff', fontWeight: '800', fontSize: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rate: { color: '#FBBF24', fontWeight: '800', fontSize: 15 },
  sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sortBtn: { flexBasis: '48%', flexGrow: 1, height: 52, borderRadius: 12, backgroundColor: '#0F0F0F', borderWidth: 1.5, borderColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  sortOn: { borderColor: '#E50914', backgroundColor: '#1a0b0c' },
  sortTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footer: { padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#1F1F1F', marginTop: 6 },
  apply: { height: 56, borderRadius: 14, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center' },
  applyTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
