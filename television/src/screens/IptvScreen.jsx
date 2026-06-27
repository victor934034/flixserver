import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

const { width: W, height: H } = Dimensions.get('window');
const S      = Math.min(W / 1920, H / 1080);
const r      = v => Math.max(1, Math.round(v * S));
const ACCENT = '#E50914';
const COLS   = 4;
const CARD_H = r(110);
const GAP    = r(16);
const PAD    = r(60);

let _catCache    = null;
let _statusCache = null;

function TVPressable({ children, style, onPress, onFocus, onBlur, hasTVPreferredFocus }) {
  return (
    <Pressable
      focusable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={onFocus}
      onBlur={onBlur}
      onPress={onPress}
      style={style}
    >
      {children}
    </Pressable>
  );
}

function CategoryCard({ item, onPress, hasTVPreferredFocus }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setFoc(true)}
      onBlur={() => setFoc(false)}
      onPress={onPress}
      style={[s.card, foc && s.cardFoc]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.catName, foc && s.catNameFoc]} numberOfLines={2}>
          {item.category_name}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={r(18)} color={foc ? '#0a0a0a' : 'rgba(255,255,255,0.25)'} />
    </TVPressable>
  );
}

function ActionBtn({ label, icon, primary, onPress, onFocus, onBlur, hasTVPreferredFocus }) {
  const [foc, setFoc] = useState(false);
  return (
    <TVPressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => { setFoc(true); onFocus?.(); }}
      onBlur={() => { setFoc(false); onBlur?.(); }}
      onPress={onPress}
      style={[s.actionBtn, foc && (primary ? s.actionBtnPrimaryFoc : s.actionBtnFoc), primary && !foc && s.actionBtnPrimary]}
    >
      <View style={s.actionBtnRow}>
        <Ionicons name={icon} size={r(20)} color={foc || (primary && !foc) ? (primary ? '#fff' : '#fff') : 'rgba(255,255,255,0.7)'} />
        <Text style={[s.actionBtnTxt, foc && s.actionBtnTxtFoc]}>{label}</Text>
      </View>
    </TVPressable>
  );
}

export default function IptvScreen({ navigation }) {
  const [status,     setStatus]     = useState(_statusCache || 'loading');
  const [categories, setCategories] = useState(_catCache || []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/iptv/status');
        _statusCache = data.status;
        setStatus(data.status);
        if (data.status === 'active') {
          if (!_catCache) {
            const res = await api.get('/iptv/categories');
            _catCache = Array.isArray(res.data) ? res.data : [];
          }
          setCategories(_catCache);
        }
      } catch {
        if (!_catCache) setStatus('none');
      }
    })();
  }, []);

  const goBack   = useCallback(() => navigation.goBack(), [navigation]);
  const goToSub  = useCallback(() => navigation.navigate('Subscription', { tab: 'iptv' }), [navigation]);
  const goToChan = useCallback((cat) => navigation.navigate('IptvChannels', {
    category_id:   cat.category_id,
    category_name: cat.category_name,
  }), [navigation]);

  if (status === 'loading') {
    return (
      <View style={s.center}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={s.loadingTxt}>Carregando IPTV…</Text>
      </View>
    );
  }

  if (status === 'none') {
    return (
      <View style={s.center}>
        <LinearGradient colors={['#07070f', '#0a0a14']} style={StyleSheet.absoluteFill} />
        <Text style={{ fontSize: r(72), marginBottom: r(24) }}>📺</Text>
        <Text style={s.noneTitle}>Acesso IPTV não ativo</Text>
        <Text style={s.noneSub}>
          Você ainda não tem um plano com IPTV.{'\n'}
          Adicione ao seu plano ou assine um completo.
        </Text>
        <View style={s.actionRow}>
          <ActionBtn
            label="Voltar"
            icon="arrow-back"
            hasTVPreferredFocus
            onPress={goBack}
          />
          <ActionBtn
            label="Ver planos com IPTV"
            icon="tv"
            primary
            onPress={goToSub}
          />
        </View>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={s.center}>
        <LinearGradient colors={['#07070f', '#0a0a14']} style={StyleSheet.absoluteFill} />
        <Text style={{ fontSize: r(72), marginBottom: r(24) }}>⏳</Text>
        <Text style={s.noneTitle}>Ativação em andamento</Text>
        <Text style={s.noneSub}>
          Seu plano IPTV foi recebido e está sendo ativado.{'\n'}
          O administrador será notificado e ativará em breve.
        </Text>
        <View style={s.actionRow}>
          <ActionBtn
            label="Voltar ao início"
            icon="home"
            hasTVPreferredFocus
            onPress={goBack}
          />
        </View>
      </View>
    );
  }

  // Active — show category grid
  return (
    <View style={s.root}>
      <LinearGradient colors={['#07070f', '#0a0a14']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TVPressable onPress={goBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={r(22)} color="#fff" />
        </TVPressable>
        <View style={s.headerInfo}>
          <View style={s.headerTitleRow}>
            <Ionicons name="tv" size={r(26)} color={ACCENT} />
            <Text style={s.headerTitle}>IPTV</Text>
          </View>
          <Text style={s.headerSub}>{categories.length} categorias disponíveis</Text>
        </View>
      </View>

      {/* Category grid */}
      <FlatList
        data={categories}
        numColumns={COLS}
        keyExtractor={it => String(it.category_id)}
        contentContainerStyle={s.grid}
        columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
        renderItem={({ item, index }) => (
          <View style={{ flex: 1 }}>
            <CategoryCard
              item={item}
              hasTVPreferredFocus={index === 0}
              onPress={() => goToChan(item)}
            />
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: r(12) },
  loadingTxt:     { color: 'rgba(255,255,255,0.35)', fontSize: r(16), marginTop: r(12) },
  noneTitle:      { fontSize: r(32), fontWeight: '900', color: '#fff', textAlign: 'center' },
  noneSub:        { fontSize: r(16), color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: r(26), marginBottom: r(40) },
  actionRow:      { flexDirection: 'row', gap: r(16) },
  actionBtn:      { paddingHorizontal: r(36), paddingVertical: r(15), borderRadius: r(10), backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  actionBtnFoc:   { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: '#fff' },
  actionBtnPrimary:{ backgroundColor: ACCENT, borderColor: ACCENT },
  actionBtnPrimaryFoc:{ backgroundColor: '#fff', borderColor: '#fff' },
  actionBtnRow:   { flexDirection: 'row', alignItems: 'center', gap: r(10) },
  actionBtnTxt:   { color: '#fff', fontSize: r(16), fontWeight: '700' },
  actionBtnTxtFoc:{ color: '#fff' },

  header:         { flexDirection: 'row', alignItems: 'center', gap: r(20), padding: r(32), paddingBottom: r(20) },
  backBtn:        { width: r(44), height: r(44), borderRadius: r(22), backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  headerInfo:     { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: r(10) },
  headerTitle:    { fontSize: r(26), fontWeight: '900', color: '#fff' },
  headerSub:      { fontSize: r(13), color: 'rgba(255,255,255,0.3)', marginTop: r(3) },

  grid:           { paddingHorizontal: PAD, paddingBottom: r(40) },
  card:           { flex: 1, height: CARD_H, borderRadius: r(12), backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: r(22), gap: r(12) },
  cardFoc:        { backgroundColor: '#fff', borderColor: '#fff' },
  catName:        { fontSize: r(14), fontWeight: '600', color: '#fff', lineHeight: r(20) },
  catNameFoc:     { color: '#0a0a0a', fontWeight: '800' },
});
