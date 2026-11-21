import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const ACCENT = '#E50914';
export const brl = (v) => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

// Meses de um plano: IPTV traz duration_months; os planos do app trazem duration_days
export const monthsOf = (p) => Number(p.duration_months) || Math.max(1, Math.round((Number(p.duration_days) || 30) / 30));
export const periodLabel = (m) => (m === 1 ? '1 mês' : `${m} meses`);
export const priceOf = (p) => (p.promo_price != null && Number(p.promo_price) < Number(p.price) ? Number(p.promo_price) : Number(p.price));
const providerOf = (p) => (/^\[([^\]]+)\]/.exec(p.name || '') || [])[1] || null;
const variantOf = (p) => `${p.is_adult ? 1 : 0}-${p.max_streams || 1}`;

// "[ONE X] PACOTE 3 MESES COM ADULTO 2 TELAS" -> "Com adulto"; "Mensal · 2 Telas" -> "2 Telas"
export function titleOf(p) {
  const m = /(COM|SEM)\s+ADULTO/i.exec(p.name || '');
  if (m) return m[1].toUpperCase() === 'COM' ? 'Com adulto' : 'Sem adulto';
  const parts = String(p.name || '').split('·');
  return parts[parts.length - 1].trim();
}

// Escolha de plano sem rolagem: períodos (1/3/6/12 meses) em abas e só os planos do período na tela.
// Trocar o período mantém a variante (tela/adulto) escolhida.
export default function PlanPicker({ plans, selected, onSelect, subtitleOf }) {
  const providers = useMemo(() => [...new Set(plans.map(providerOf).filter(Boolean))], [plans]);
  const selPlan = plans.find(p => p.id === selected) || null;
  const [prov, setProv] = useState(null);
  const activeProv = providers.length > 1 ? (prov || (selPlan && providerOf(selPlan)) || providers[0]) : null;

  const pool = useMemo(() => plans.filter(p => !activeProv || providerOf(p) === activeProv), [plans, activeProv]);
  const periods = useMemo(() => [...new Set(pool.map(monthsOf))].sort((a, b) => a - b), [pool]);
  const period = selPlan && periods.includes(monthsOf(selPlan)) ? monthsOf(selPlan) : periods[0];
  const visible = pool.filter(p => monthsOf(p) === period).sort((a, b) => (a.is_adult ? 1 : 0) - (b.is_adult ? 1 : 0) || (a.max_streams || 1) - (b.max_streams || 1) || priceOf(a) - priceOf(b));

  const bestMonthly = (m) => Math.min(...pool.filter(p => monthsOf(p) === m).map(p => priceOf(p) / m));
  const base = periods.length ? bestMonthly(periods[0]) : 0;
  const saving = (m) => (m === periods[0] || !base ? 0 : Math.round((1 - bestMonthly(m) / base) * 100));

  const pickPeriod = (m) => {
    const list = pool.filter(p => monthsOf(p) === m);
    onSelect((selPlan && list.find(p => variantOf(p) === variantOf(selPlan))) || list.find(p => p.highlight) || list[0]);
  };
  const pickProvider = (name) => {
    setProv(name);
    const list = plans.filter(p => providerOf(p) === name);
    const m = selPlan ? monthsOf(selPlan) : 1;
    const inPeriod = list.filter(p => monthsOf(p) === m);
    onSelect((selPlan && inPeriod.find(p => variantOf(p) === variantOf(selPlan))) || inPeriod[0] || list[0]);
  };

  return (
    <View>
      {providers.length > 1 && (
        <View style={s.provRow}>
          {providers.map(n => (
            <TouchableOpacity key={n} style={[s.prov, activeProv === n && s.provOn]} onPress={() => pickProvider(n)} activeOpacity={0.85}>
              <Text style={[s.provTxt, activeProv === n && { color: '#fff' }]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.periods}>
        {periods.map(m => {
          const on = m === period; const sv = saving(m);
          return (
            <TouchableOpacity key={m} style={[s.chip, on && s.chipOn]} onPress={() => pickPeriod(m)} activeOpacity={0.85}>
              <Text style={[s.chipNum, on && s.chipNumOn]}>{m}</Text>
              <Text style={[s.chipUnit, on && s.chipUnitOn]}>{m === 1 ? 'mês' : 'meses'}</Text>
              {sv >= 5 ? <View style={[s.save, on && s.saveOn]}><Text style={[s.saveTxt, on && { color: '#fff' }]}>-{sv}%</Text></View> : <View style={{ height: 17 }} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ gap: 10, marginTop: 14 }}>
        {visible.map(p => {
          const on = p.id === selected; const m = monthsOf(p); const price = priceOf(p);
          return (
            <TouchableOpacity key={p.id} activeOpacity={0.9} onPress={() => onSelect(p)} style={[s.card, on && s.cardOn]}>
              {p.badge ? <View style={s.badge}><Text style={s.badgeTxt}>{p.badge}</Text></View> : null}
              <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.dot} />}</View>
              <View style={{ flex: 1 }}>
                <View style={s.titleRow}>
                  <Text style={s.title} numberOfLines={1}>{titleOf(p)}</Text>
                  {p.is_adult ? <View style={s.adult}><Text style={s.adultTxt}>18+</Text></View> : null}
                </View>
                {subtitleOf ? <Text style={s.sub} numberOfLines={1}>{subtitleOf(p)}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {p.promo_price != null && Number(p.promo_price) < Number(p.price) ? <Text style={s.old}>{brl(p.price)}</Text> : null}
                <Text style={s.price}>{brl(price)}</Text>
                <Text style={s.per}>{m === 1 ? 'por mês' : `${brl(price / m)}/mês`}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  provRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  prov: { flex: 1, height: 40, borderRadius: 12, backgroundColor: '#141414', borderWidth: 1, borderColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  provOn: { backgroundColor: 'rgba(229,9,20,0.18)', borderColor: ACCENT },
  provTxt: { color: '#A3A3A3', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  periods: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 8, borderRadius: 14, backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#1F1F1F' },
  chipOn: { backgroundColor: '#E5E5E5', borderColor: '#E5E5E5' },
  chipNum: { color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 26 },
  chipNumOn: { color: '#111' },
  chipUnit: { color: '#888', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  chipUnitOn: { color: '#444' },
  save: { backgroundColor: 'rgba(34,197,94,0.16)', borderRadius: 999, paddingHorizontal: 7, height: 17, justifyContent: 'center' },
  saveOn: { backgroundColor: '#16A34A' },
  saveTxt: { color: '#4ADE80', fontSize: 10.5, fontWeight: '900' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#141414', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#1F1F1F' },
  cardOn: { borderColor: ACCENT, backgroundColor: '#150d0d', shadowColor: ACCENT, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  badge: { position: 'absolute', top: -10, left: 16, backgroundColor: ACCENT, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt: { color: '#fff', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: ACCENT },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: ACCENT },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', flexShrink: 1 },
  adult: { backgroundColor: 'rgba(229,9,20,0.2)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  adultTxt: { color: '#F87171', fontSize: 11, fontWeight: '900' },
  sub: { color: '#888', fontSize: 13, marginTop: 3 },
  old: { color: '#666', textDecorationLine: 'line-through', fontSize: 12 },
  price: { color: '#fff', fontSize: 24, fontWeight: '900' },
  per: { color: '#888', fontSize: 12, marginTop: 1 },
});
