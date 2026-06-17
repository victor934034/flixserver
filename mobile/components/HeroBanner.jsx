import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function HeroBanner({ item }) {
  const router = useRouter();
  const isMovie = !item.total_seasons && !item.year_start;
  const route = isMovie ? `/filme/${item.id}` : `/serie/${item.id}`;
  const name = item.title || item.name;

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: item.backdrop_url || item.poster_url }}
        style={styles.image}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)', '#0a0a0a']}
        locations={[0.3, 0.7, 1]}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{name}</Text>
        {item.synopsis && (
          <Text style={styles.synopsis} numberOfLines={2}>{item.synopsis}</Text>
        )}
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.playBtn} onPress={() => router.push(route)}>
            <Ionicons name="play" size={16} color="#000" />
            <Text style={styles.playText}>Assistir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoBtn} onPress={() => router.push(route)}>
            <Ionicons name="information-circle-outline" size={18} color="#fff" />
            <Text style={styles.infoText}>Detalhes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width, height: height * 0.52 },
  image: { width: '100%', height: '100%' },
  gradient: { ...StyleSheet.absoluteFillObject },
  content: {
    position: 'absolute', bottom: 48, left: 16, right: 16,
  },
  title: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 6 },
  synopsis: { fontSize: 13, color: '#ccc', lineHeight: 19, marginBottom: 16 },
  buttons: { flexDirection: 'row', gap: 12 },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 22, borderRadius: 6,
  },
  playText: { color: '#000', fontSize: 15, fontWeight: '700' },
  infoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  infoText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
