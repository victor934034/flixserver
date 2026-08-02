import { memo, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import MovieCard from './MovieCard';

function ContentRow({ title, items, type, seeAllRoute }) {
  const router = useRouter();
  if (!items?.length) return null;

  const renderItem = useCallback(({ item }) => (
    <MovieCard item={item} type={type} />
  ), [type]);

  const keyExtractor = useCallback(item => String(item.id), []);

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
      <FlatList
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        initialNumToRender={6}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
}

export default memo(ContentRow);

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
