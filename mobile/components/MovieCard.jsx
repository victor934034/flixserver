import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const COMPACT_W = (width - 40) / 3;
const COMPACT_H = COMPACT_W * 1.5;
const ROW_W = 110;
const ROW_H = 165;

export default function MovieCard({ item, type, compact = false }) {
  const router = useRouter();
  const route = type === 'movie' ? `/filme/${item.id}` : `/serie/${item.id}`;
  const name = item.title || item.name || '';
  const w = compact ? COMPACT_W : ROW_W;
  const h = compact ? COMPACT_H : ROW_H;

  return (
    <TouchableOpacity
      style={[styles.card, { width: w }, compact && styles.compact]}
      onPress={() => router.push(route)}
      activeOpacity={0.75}
    >
      {item.poster_url ? (
        <Image
          source={{ uri: item.poster_url }}
          style={{ width: w, height: h, borderRadius: 6 }}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.placeholder, { width: w, height: h }]}>
          <Text style={styles.placeholderText} numberOfLines={3}>{name}</Text>
        </View>
      )}
      {!compact && (
        <Text style={styles.label} numberOfLines={2}>{name}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 4 },
  compact: { marginHorizontal: 4, marginVertical: 4 },
  placeholder: {
    borderRadius: 6, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center', padding: 8,
  },
  placeholderText: { color: '#555', fontSize: 11, textAlign: 'center' },
  label: { color: '#999', fontSize: 11, marginTop: 5, lineHeight: 15 },
});
