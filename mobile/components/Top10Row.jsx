import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import CachedImage from './CachedImage';

// Fileira numerada com os mais assistidos da semana
export default function Top10Row({ items }) {
  const router = useRouter();
  // com menos de 3 a lista não diz nada
  if (!items || items.length < 3) return null;
  return (
    <View style={s.section}>
      <Text style={s.title}>Top 10 da semana</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {items.map(item => (
          <TouchableOpacity
            key={`${item.content_type}-${item.id}`}
            style={s.item}
            activeOpacity={0.8}
            accessibilityLabel={`${item.rank}º lugar: ${item.title}`}
            onPress={() => router.push(`/${item.content_type === 'movie' ? 'filme' : 'serie'}/${item.id}`)}
          >
            <Text style={s.rank}>{item.rank}</Text>
            {item.poster_url ? (
              <CachedImage source={{ uri: item.poster_url }} style={s.poster} resizeMode="cover" />
            ) : (
              <View style={[s.poster, s.empty]}><Text style={s.emptyTxt} numberOfLines={3}>{item.title}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 28 },
  title: { fontSize: 17, fontWeight: '700', color: '#fff', paddingHorizontal: 16, marginBottom: 12 },
  row: { paddingHorizontal: 16, gap: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-end' },
  rank: { fontSize: 84, lineHeight: 88, fontWeight: '900', color: '#2b2b2b', textShadowColor: '#8a8a8a', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 3, marginRight: -10, includeFontPadding: false },
  poster: { width: 100, height: 150, borderRadius: 8, backgroundColor: '#1a1a1a' },
  empty: { justifyContent: 'center', alignItems: 'center', padding: 6 },
  emptyTxt: { color: '#777', fontSize: 11, textAlign: 'center' },
});
