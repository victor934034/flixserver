import { View, Text, ScrollView, StyleSheet } from 'react-native';
import MovieCard from './MovieCard';

export default function ContentRow({ title, items, type }) {
  if (!items?.length) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
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
  title: {
    fontSize: 17, fontWeight: '700', color: '#fff',
    paddingHorizontal: 16, marginBottom: 12,
  },
  row: { paddingHorizontal: 16, gap: 10 },
});
