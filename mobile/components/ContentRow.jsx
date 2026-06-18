import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import MovieCard from './MovieCard';

export default function ContentRow({ title, items, type, seeAllRoute }) {
  const router = useRouter();
  if (!items?.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {seeAllRoute && (
          <TouchableOpacity onPress={() => router.push(seeAllRoute)}>
            <Text style={styles.seeAll}>Ver tudo</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map(item => (
          <MovieCard key={item.id} item={item} type={type} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 28 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#fff' },
  seeAll: { color: '#aaa', fontSize: 13 },
  row: { paddingHorizontal: 16, gap: 10 },
});
