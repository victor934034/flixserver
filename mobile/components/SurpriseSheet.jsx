import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CachedImage from './CachedImage';
import api from '../lib/api';
import { onSurprise } from '../lib/tutorial';

const GENRES = ['Ação', 'Aventura', 'Animação', 'Comédia', 'Crime', 'Documentário', 'Drama', 'Fantasia', 'Ficção Científica', 'Mistério', 'Romance', 'Terror', 'Thriller'];

// "Surpreenda-me": botão na Home que sorteia um filme, com gênero opcional.
export default function SurpriseSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [genre, setGenre] = useState('');
  const [movie, setMovie] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drawn = useRef([]); // já sorteados, pra não repetir

  const pickGenre = (g) => { setGenre(g); setMovie(null); setError(''); drawn.current = []; };
  const close = () => setOpen(false);

  // Atalho "Surpreenda-me" do último passo do passo a passo
  useEffect(() => onSurprise(() => { pickGenre(''); setOpen(true); }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const draw = async () => {
    if (busy) return;
    setBusy(true); setError('');
    const ask = () => api.get('/movies/surprise', { params: { genre: genre || undefined, exclude: drawn.current.join(',') || undefined } });
    try {
      let res;
      try { res = await ask(); } catch (e) {
        // acabaram os inéditos: recomeça a rodada
        if (e.response?.status !== 404 || !drawn.current.length) throw e;
        drawn.current = [];
        res = await ask();
      }
      drawn.current.push(res.data.id);
      setMovie(res.data);
    } catch (e) {
      setMovie(null);
      setError(e.response?.status === 404 ? 'Nenhum filme desse gênero ainda.' : 'Não deu para sortear. Tente de novo.');
    }
    setBusy(false);
  };

  return (
    <>
      <TouchableOpacity style={s.trigger} onPress={() => { pickGenre(''); setOpen(true); }} activeOpacity={0.85}>
        <Text style={s.triggerEmoji}>🎲</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.triggerTitle}>Surpreenda-me</Text>
          <Text style={s.triggerDesc}>Não sabe o que ver? A gente sorteia um filme.</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View style={s.overlay}>
          <Pressable style={{ flex: 1 }} onPress={close} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}>
            <Text style={s.title}>🎲 Surpreenda-me</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              {['', ...GENRES].map(g => (
                <TouchableOpacity key={g || 'all'} style={[s.chip, genre === g && s.chipOn]} onPress={() => pickGenre(g)}>
                  <Text style={[s.chipTxt, genre === g && s.chipTxtOn]}>{g || 'Qualquer um'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {movie && (
              <View style={s.result}>
                {movie.poster_url ? <CachedImage source={{ uri: movie.poster_url }} style={s.poster} resizeMode="cover" /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={s.movieTitle} numberOfLines={2}>{movie.title}</Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {[movie.year, movie.rating ? `★ ${Number(movie.rating).toFixed(1)}` : null, (movie.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join('  ·  ')}
                  </Text>
                  <Text style={s.synopsis} numberOfLines={5}>{movie.synopsis}</Text>
                </View>
              </View>
            )}
            {!!error && <Text style={s.error}>{error}</Text>}

            {movie && (
              <TouchableOpacity style={s.primary} onPress={() => { close(); router.push(`/filme/${movie.id}`); }}>
                <Text style={s.primaryTxt}>Assistir este</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={movie ? s.secondary : s.primary} onPress={draw} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>{movie ? 'Sortear outro' : 'Sortear'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 4, marginBottom: 24, padding: 14, borderRadius: 14, backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626' },
  triggerEmoji: { fontSize: 26 },
  triggerTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  triggerDesc: { color: '#8a8a8a', fontSize: 12, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { backgroundColor: '#141414', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 12 },
  title: { color: '#fff', fontSize: 19, fontWeight: '800' },
  chips: { gap: 8, paddingRight: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#333' },
  chipOn: { backgroundColor: '#fff', borderColor: '#fff' },
  chipTxt: { color: '#ccc', fontSize: 13 },
  chipTxtOn: { color: '#000', fontWeight: '800' },
  result: { flexDirection: 'row', gap: 12 },
  poster: { width: 92, height: 138, borderRadius: 8, backgroundColor: '#1a1a1a' },
  movieTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  meta: { color: '#a3a3a3', fontSize: 12, marginTop: 4 },
  synopsis: { color: '#bbb', fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
  primary: { backgroundColor: '#E50914', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondary: { borderWidth: 1, borderColor: '#333', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
