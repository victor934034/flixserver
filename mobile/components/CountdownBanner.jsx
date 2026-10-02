import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

function diffParts(targetMs) {
  const diff = Math.max(0, targetMs - Date.now());
  const sec = Math.floor(diff / 1000);
  return {
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
    done: diff <= 0,
  };
}

// Banner de contagem regressiva pra cronologia marcada como evento
// (event_date vindo de /collections/:slug) — some sozinho quando a data passar.
export default function CountdownBanner({ collection }) {
  const [parts, setParts] = useState(null);

  useEffect(() => {
    if (!collection?.event_date) return;
    const target = new Date(`${collection.event_date}T00:00:00`).getTime();
    setParts(diffParts(target));
    const t = setInterval(() => setParts(diffParts(target)), 1000);
    return () => clearInterval(t);
  }, [collection?.event_date]);

  if (!collection?.event_date || parts?.done) return null;

  const accent = collection.accent_color || '#E50914';

  return (
    <View style={[styles.banner, { borderColor: accent + '73', shadowColor: accent }]}>
      <View style={styles.info}>
        <Text style={[styles.kicker, { color: accent }]}>CONTAGEM REGRESSIVA</Text>
        <Text style={styles.title} numberOfLines={2}>{collection.event_label || collection.name}</Text>
      </View>
      {parts && (
        <View style={styles.timer}>
          {[['dias', parts.days], ['hr', parts.hours], ['min', parts.minutes], ['seg', parts.seconds]].map(([label, val]) => (
            <View key={label} style={[styles.unit, { borderColor: accent + '59' }]}>
              <Text style={styles.unitValue}>{String(val).padStart(2, '0')}</Text>
              <Text style={styles.unitLabel}>{label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#141414',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  info: { marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  timer: { flexDirection: 'row', gap: 8 },
  unit: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  unitValue: { color: '#fff', fontSize: 19, fontWeight: '800' },
  unitLabel: { color: '#888', fontSize: 10, textTransform: 'uppercase', marginTop: 3, letterSpacing: 0.5 },
});
