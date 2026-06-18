import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

const DEFAULT_CARD_W = 110;
const DEFAULT_CARD_H = 165;

export default function MovieCard({ item, type, compact = false, cardWidth, progress }) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const isSeries = type === 'series' || (type === 'mixed' && (item.total_seasons != null || item.year_start != null));
  const route = isSeries ? `/serie/${item.id}` : `/filme/${item.id}`;
  const name = item.title || item.name || '';

  const w = cardWidth ?? (compact ? (screenWidth - 40) / 3 : DEFAULT_CARD_W);
  const h = cardWidth ? cardWidth * 1.5 : (compact ? w * 1.5 : DEFAULT_CARD_H);

  return (
    <TouchableOpacity
      style={[styles.card, { width: w, marginHorizontal: compact ? 0 : 0, marginBottom: compact ? 8 : 4 }]}
      onPress={() => router.push(route)}
      activeOpacity={0.75}
    >
      <View style={{ width: w, height: h, borderRadius: 7, overflow: 'hidden' }}>
        {item.poster_url ? (
          <Image
            source={{ uri: item.poster_url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholder, { width: w, height: h }]}>
            <Text style={styles.placeholderText} numberOfLines={3}>{name}</Text>
          </View>
        )}

        {item.rating > 0 && !compact && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>★ {Number(item.rating).toFixed(1)}</Text>
          </View>
        )}
      </View>

      {progress != null && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
        </View>
      )}

      {!compact && (
        <Text style={styles.label} numberOfLines={1}>{name}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 4 },
  placeholder: {
    borderRadius: 7, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center', padding: 8,
  },
  placeholderText: { color: '#444', fontSize: 11, textAlign: 'center' },
  ratingBadge: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  ratingText: { color: '#ffa500', fontSize: 10, fontWeight: '700' },
  progressTrack: {
    height: 3, backgroundColor: '#222', borderRadius: 1.5, marginTop: 5,
  },
  progressFill: { height: '100%', backgroundColor: '#E50914', borderRadius: 1.5 },
  label: { color: '#888', fontSize: 11, marginTop: 5, lineHeight: 15 },
});
