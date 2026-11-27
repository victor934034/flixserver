import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet, Animated, Easing, PanResponder, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TutorialScene, { useReduceMotion } from './TutorialScene';
import { STEPS, SCENES } from '../constants/tutorialData';

// Passo a passo para novos usuários — versão celular do design (13 telas).

const LAST = STEPS.length - 1;
const IN_EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const OUT_EASE = Easing.bezier(0.4, 0, 1, 1);
const FONT_CAP = 1.3;
const cleanName = name => String(name || '').trim() || 'Você';

function Txt(props) {
  return <Text maxFontSizeMultiplier={FONT_CAP} {...props} />;
}

function Button({ label, onPress, primary, style, textStyle, icon, accessibilityLabel }) {
  const press = useRef(new Animated.Value(1)).current;
  const to = v => Animated.timing(press, { toValue: v, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  const [down, setDown] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      onPress={onPress}
      onPressIn={() => { setDown(true); to(0.97); }}
      onPressOut={() => { setDown(false); to(1); }}
      style={style}
    >
      <Animated.View style={[s.btn, primary && s.btnPri, primary && down && s.btnPriDown, { transform: [{ scale: press }] }]}>
        {icon && <Ionicons name={icon} size={icon === 'chevron-back' ? 20 : 18} color="#E5E5E5" />}
        {!!label && <Txt style={[s.btnTxt, primary && s.btnTxtPri, textStyle]}>{label}</Txt>}
      </Animated.View>
    </Pressable>
  );
}

// Um passo: entra em sequência (ilustração → título → texto → botões) e sai inteiro
function StepLayer({ index, leaving, dir, name, zoom, reduce, onNext, onBack, onClose, bottom }) {
  const step = STEPS[index];
  const parts = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const exit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel(parts.map((v, i) => Animated.timing(v, {
      toValue: 1, duration: 300, delay: i * 60, easing: reduce ? Easing.linear : IN_EASE, useNativeDriver: true,
    }))).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (leaving) Animated.timing(exit, { toValue: 1, duration: 220, easing: reduce ? Easing.linear : OUT_EASE, useNativeDriver: true }).start();
    else exit.setValue(0);
  }, [leaving]); // eslint-disable-line react-hooks/exhaustive-deps

  const enter = i => ({
    opacity: parts[i],
    transform: [{ translateX: reduce ? 0 : parts[i].interpolate({ inputRange: [0, 1], outputRange: [32 * dir, 0] }) }],
  });
  const layer = {
    opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ translateX: reduce || !leaving ? 0 : exit.interpolate({ inputRange: [0, 1], outputRange: [0, -32 * dir] }) }],
  };
  const first = index === 0;
  const last = index === LAST;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, layer]} pointerEvents={leaving ? 'none' : 'auto'}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[{ alignItems: 'center' }, enter(0)]}>
          <TutorialScene nodes={SCENES[step.k]} k={zoom} name={name} reduce={reduce} />
        </Animated.View>
        <View style={{ gap: 8 }}>
          <Animated.View style={enter(1)}>
            <Txt accessibilityRole="header" style={s.title}>{step.t.replace('__NOME__', cleanName(name))}</Txt>
          </Animated.View>
          <Animated.View style={enter(2)}>
            <Txt style={s.body}>{step.b}</Txt>
            {step.h.length > 0 && (
              <View style={s.highlights}>
                {step.h.map(([icon, label]) => (
                  <View key={label} style={s.highlight}>
                    <View style={s.highlightIcon}><Ionicons name={icon} size={18} color="#E5E5E5" /></View>
                    <Txt style={s.highlightTxt}>{label}</Txt>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      <Animated.View style={[s.footer, { paddingBottom: 24 + bottom }, enter(3)]}>
        {first && (
          <View style={s.row}>
            <Button label="Pular" onPress={() => onClose('skip')} style={{ flex: 1 }} />
            <Button label="Começar" primary onPress={onNext} style={{ flex: 2 }} />
          </View>
        )}
        {!first && !last && (
          <View style={s.row}>
            <Button label="Voltar" onPress={onBack} style={{ flex: 1 }} />
            <Button label="Continuar" primary onPress={onNext} style={{ flex: 2 }} />
          </View>
        )}
        {last && (
          <>
            <View style={s.row}>
              <Button icon="chevron-back" accessibilityLabel="Voltar" onPress={onBack} style={{ width: 52 }} />
              <Button label="Começar a assistir" primary onPress={() => onClose('finish')} style={{ flex: 1 }} />
            </View>
            <Pressable accessibilityRole="button" onPress={() => onClose('surprise')} style={s.surprise}>
              <Ionicons name="dice-outline" size={18} color="#E5E5E5" />
              <Txt style={s.surpriseTxt}>Surpreenda-me</Txt>
            </Pressable>
          </>
        )}
      </Animated.View>
    </Animated.View>
  );
}

function Segment({ filled, reduce }) {
  const value = useRef(new Animated.Value(filled ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(value, { toValue: filled ? 1 : 0, duration: reduce ? 0 : 300, easing: IN_EASE, useNativeDriver: true }).start();
  }, [filled]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={s.segment}>
      <Animated.View style={[s.segmentFill, { transform: [{ scaleX: value }] }]} />
    </View>
  );
}

function Content({ name, onClose, backRef }) {
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [state, setState] = useState({ cur: 0, prev: null, dir: 1 });
  const { cur, prev, dir } = state;
  const curRef = useRef(0);
  curRef.current = cur;

  // Tela baixa ou fonte ampliada: ilustração a 70%; nunca mais larga que a tela
  const zoom = Math.min(height < 700 || fontScale > 1.1 ? 0.7 : 1, (width - 48) / 312);

  const go = n => setState(st => (n < 0 || n > LAST || n === st.cur ? st : { cur: n, prev: st.cur, dir: n > st.cur ? 1 : -1 }));

  // Botão voltar do Android: volta um passo; no primeiro, pula
  backRef.current = () => { if (curRef.current === 0) onClose('skip'); else go(curRef.current - 1); };

  useEffect(() => {
    if (prev === null) return undefined;
    const t = setTimeout(() => setState(st => ({ ...st, prev: null })), 320);
    return () => clearTimeout(t);
  }, [prev, cur]);

  // Deslizar 50px para os lados
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderRelease: (_, g) => {
      if (g.dx < -50) go(curRef.current + 1);
      else if (g.dx > 50) go(curRef.current - 1);
    },
  })).current;

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={s.headerRow}>
          <Txt style={s.counter} accessibilityLiveRegion="polite">{cur + 1} de {LAST + 1}</Txt>
          {cur !== 0 && (
            <Pressable accessibilityRole="button" style={s.skip} onPress={() => onClose(cur === LAST ? 'finish' : 'skip')}>
              <Txt style={s.skipTxt}>{cur === LAST ? 'Fechar' : 'Pular'}</Txt>
            </Pressable>
          )}
        </View>
        <View style={s.segments}>
          {STEPS.map((step, i) => <Segment key={step.k} filled={i <= cur} reduce={reduce} />)}
        </View>
      </View>

      <View style={{ flex: 1 }} {...swipe.panHandlers}>
        {[prev, cur].filter(i => i !== null).map(i => (
          <StepLayer
            key={i} index={i} leaving={i !== cur} dir={dir} name={name} zoom={zoom} reduce={reduce} bottom={insets.bottom}
            onNext={() => go(i + 1)} onBack={() => go(i - 1)} onClose={onClose}
          />
        ))}
      </View>
    </View>
  );
}

// onClose(motivo): 'skip' (pulou), 'finish' (começar a assistir) ou 'surprise'
export default function Tutorial({ name, onClose }) {
  const backRef = useRef(() => {});
  return (
    <Modal visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => backRef.current()}>
      <SafeAreaProvider>
        <Content name={name} onClose={onClose} backRef={backRef} />
      </SafeAreaProvider>
    </Modal>
  );
}

// Aviso depois de pular: fica 4 s acima da barra de navegação, com "Ver agora"
export function TutorialToast({ onReopen, onDone }) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const show = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(show, { toValue: 1, duration: 250, easing: IN_EASE, useNativeDriver: true }).start();
    const t = setTimeout(() => Animated.timing(show, { toValue: 0, duration: 200, useNativeDriver: true }).start(onDone), 4000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[s.toast, {
        bottom: 52 + insets.bottom + 12,
        opacity: show,
        transform: [{ translateY: reduce ? 0 : show.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }]}
    >
      <Ionicons name="information-circle-outline" size={20} color="#E5E5E5" />
      <Txt style={s.toastTxt}>Você pode ver o passo a passo de novo no Perfil</Txt>
      <Pressable accessibilityRole="button" onPress={onReopen} style={s.toastBtn}>
        <Txt style={s.toastBtnTxt}>Ver agora</Txt>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { paddingLeft: 24, paddingRight: 12, gap: 6 },
  headerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: '#888', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  skip: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  skipTxt: { color: '#E5E5E5', fontSize: 14, fontWeight: '700' },
  segments: { flexDirection: 'row', gap: 4, paddingRight: 12 },
  segment: { flex: 1, height: 4, borderRadius: 999, backgroundColor: '#2A2A2A', overflow: 'hidden' },
  segmentFill: { flex: 1, backgroundColor: '#E50914', transformOrigin: 'left center' },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, gap: 20 },
  title: { color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.2 },
  body: { color: '#888', fontSize: 16, lineHeight: 24 },
  highlights: { marginTop: 16, gap: 10 },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  highlightIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  highlightTxt: { flex: 1, color: '#E5E5E5', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  footer: { paddingTop: 12, paddingHorizontal: 24, gap: 4, backgroundColor: '#0A0A0A' },
  row: { flexDirection: 'row', gap: 12 },
  btn: { minHeight: 52, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#1F1F1F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnPri: { backgroundColor: '#E50914' },
  btnPriDown: { backgroundColor: '#B20710' },
  btnTxt: { color: '#E5E5E5', fontSize: 16, fontWeight: '700' },
  btnTxtPri: { color: '#fff', fontWeight: '800' },
  surprise: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  surpriseTxt: { color: '#E5E5E5', fontSize: 15, fontWeight: '700' },
  toast: { position: 'absolute', left: 12, right: 12, zIndex: 100, elevation: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 8, borderRadius: 12, backgroundColor: '#1F1F1F', flexDirection: 'row', alignItems: 'center', gap: 10 },
  toastTxt: { flex: 1, color: '#E5E5E5', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  toastBtn: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  toastBtnTxt: { color: '#FF4D57', fontSize: 13, fontWeight: '800' },
});
