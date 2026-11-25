import React, { useRef, useState } from 'react';
import { Modal, View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import api from '../lib/api';

const GENRES = ['', 'Ação', 'Aventura', 'Animação', 'Comédia', 'Crime', 'Documentário', 'Drama', 'Fantasia', 'Ficção Científica', 'Mistério', 'Romance', 'Terror', 'Thriller'];

function Btn({ label, onPress, primary, selected, preferred }) {
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      onPress={onPress}
      style={({ focused }) => [s.btn, primary && s.btnPrimary, selected && s.btnSelected, focused && s.btnFocus]}
    >
      <Text style={[s.btnTxt, selected && { color: '#000' }]}>{label}</Text>
    </Pressable>
  );
}

// "Surpreenda-me": sorteia um filme com gênero opcional.
export default function Surprise({ visible, onClose, onPick }) {
  const [genre, setGenre] = useState('');
  const [movie, setMovie] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drawn = useRef([]);

  if (!visible) return null;

  const pickGenre = (g) => { setGenre(g); setMovie(null); setError(''); drawn.current = []; };

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

  const close = () => { pickGenre(''); onClose(); };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>🎲 Surpreenda-me</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {GENRES.map(g => <Btn key={g || 'all'} label={g || 'Qualquer um'} selected={genre === g} onPress={() => pickGenre(g)} />)}
          </ScrollView>
          {movie && (
            <View style={s.result}>
              {!!movie.poster_url && <Image source={{ uri: movie.poster_url }} style={s.poster} />}
              <View style={{ flex: 1 }}>
                <Text style={s.movieTitle} numberOfLines={2}>{movie.title}</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {[movie.year, movie.rating ? `★ ${Number(movie.rating).toFixed(1)}` : null, (movie.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join('   ·   ')}
                </Text>
                <Text style={s.synopsis} numberOfLines={5}>{movie.synopsis}</Text>
              </View>
            </View>
          )}
          {!!error && <Text style={s.error}>{error}</Text>}
          <View style={s.actions}>
            {movie && <Btn label="Ver este" primary onPress={() => { const m = movie; close(); onPick(m); }} />}
            <Btn label={busy ? 'Sorteando...' : movie ? 'Sortear outro' : 'Sortear'} primary={!movie} preferred onPress={draw} />
            <Btn label="Fechar" onPress={close} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '72%', backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 14 },
  chips: { gap: 8, paddingVertical: 4 },
  result: { flexDirection: 'row', gap: 16, marginTop: 16 },
  poster: { width: 110, height: 165, borderRadius: 8, backgroundColor: '#1a1a1a' },
  movieTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  meta: { color: '#aaa', fontSize: 12, marginTop: 5 },
  synopsis: { color: '#ddd', fontSize: 13, lineHeight: 19, marginTop: 8 },
  error: { color: '#f87171', fontSize: 14, marginTop: 14 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  btn: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 3, borderColor: 'transparent' },
  btnPrimary: { backgroundColor: '#E50914' },
  btnSelected: { backgroundColor: '#fff' },
  btnFocus: { borderColor: '#E50914', transform: [{ scale: 1.06 }] },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
