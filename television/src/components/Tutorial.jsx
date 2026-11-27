import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TutorialScene, { useReduceMotion } from './TutorialScene';
import { STEPS, SCENES } from '../lib/tutorialData';

// Passo a passo para novos usuários — versão de TV do design (1920×1080, só controle).

const { width: W, height: H } = Dimensions.get('window');
const S = Math.min(W / 1920, H / 1080);
const u = v => v * S;
const LAST = STEPS.length - 1;
const IN_EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const OUT_EASE = Easing.bezier(0.4, 0, 1, 1);
const cleanName = name => String(name || '').trim() || 'Você';

function Txt(props) {
  return <Text allowFontScaling={false} {...props} />;
}

// Foco: borda branca 3px + escala 1,06; o botão secundário em foco fica claro
function TVButton({ label, onPress, primary, preferred, pill }) {
  const [focused, setFocused] = useState(false);
  const grow = useRef(new Animated.Value(1)).current;
  const focus = on => {
    setFocused(on);
    Animated.timing(grow, { toValue: on ? 1.06 : 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  };
  const light = focused && !primary;
  return (
    <Pressable hasTVPreferredFocus={preferred} onPress={onPress} onFocus={() => focus(true)} onBlur={() => focus(false)}>
      <Animated.View style={[s.btn, pill && s.pill, primary && s.btnPri, light && s.btnLight, focused && s.btnFocus, { transform: [{ scale: grow }] }]}>
        <Txt style={[s.btnTxt, pill && s.pillTxt, primary && { color: '#fff' }, light && { color: '#0A0A0A' }]}>{label}</Txt>
      </Animated.View>
    </Pressable>
  );
}

const buttonsFor = i => (
  i === 0 ? [['back', 'Pular'], ['next', 'Começar']]
    : i === LAST ? [['back', 'Voltar'], ['next', 'Começar a assistir'], ['alt', 'Surpreenda-me']]
      : [['back', 'Voltar'], ['next', 'Continuar']]
);

function StepLayer({ index, leaving, dir, name, reduce, onPress }) {
  const step = STEPS[index];
  const parts = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const exit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel(parts.map((v, i) => Animated.timing(v, {
      toValue: 1, duration: 320, delay: i * 60, easing: reduce ? Easing.linear : IN_EASE, useNativeDriver: true,
    }))).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (leaving) Animated.timing(exit, { toValue: 1, duration: 220, easing: reduce ? Easing.linear : OUT_EASE, useNativeDriver: true }).start();
    else exit.setValue(0);
  }, [leaving]); // eslint-disable-line react-hooks/exhaustive-deps

  const enter = i => ({
    opacity: parts[i],
    transform: [{ translateX: reduce ? 0 : parts[i].interpolate({ inputRange: [0, 1], outputRange: [u(40) * dir, 0] }) }],
  });
  const layer = {
    opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ translateX: reduce || !leaving ? 0 : exit.interpolate({ inputRange: [0, 1], outputRange: [0, -u(40) * dir] }) }],
  };

  return (
    <Animated.View style={[s.step, layer]}>
      <Animated.View style={[{ marginRight: u(96) }, enter(0)]}>
        <TutorialScene nodes={SCENES[step.k]} k={2.1 * S} name={name} reduce={reduce} />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Animated.View style={enter(1)}>
          <Txt style={s.title}>{step.t.replace('__NOME__', cleanName(name))}</Txt>
        </Animated.View>
        <Animated.View style={enter(2)}>
          <Txt style={s.body}>{step.b}</Txt>
          {step.h.length > 0 && (
            <View style={{ marginTop: u(32), gap: u(20) }}>
              {step.h.map(([icon, label]) => (
                <View key={label} style={s.highlight}>
                  <View style={s.highlightIcon}><Ionicons name={icon} size={u(28)} color="#E5E5E5" /></View>
                  <Txt style={s.highlightTxt}>{label}</Txt>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
        <Animated.View style={[s.btns, enter(3)]}>
          {/* O passo que está saindo não tem botões, para o foco ir direto para o novo */}
          {!leaving && buttonsFor(index).map(([id, label]) => (
            <TVButton key={id} label={label} primary={id === 'next'} preferred={id === 'next'} onPress={() => onPress(id)} />
          ))}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function Key({ children }) {
  return <View style={s.key}><Txt style={s.keyTxt}>{children}</Txt></View>;
}

// onClose(motivo): 'skip' (pulou), 'finish' (começar a assistir) ou 'surprise'
export default function Tutorial({ name, onClose }) {
  const reduce = useReduceMotion();
  const [state, setState] = useState({ cur: 0, prev: null, dir: 1 });
  const { cur, prev, dir } = state;

  const go = n => setState(st => (n < 0 || n > LAST || n === st.cur ? st : { cur: n, prev: st.cur, dir: n > st.cur ? 1 : -1 }));

  useEffect(() => {
    if (prev === null) return undefined;
    const t = setTimeout(() => setState(st => ({ ...st, prev: null })), 340);
    return () => clearTimeout(t);
  }, [prev, cur]);

  const press = id => {
    if (id === 'back') { if (cur === 0) onClose('skip'); else go(cur - 1); }
    else if (id === 'alt') onClose('surprise');
    else if (cur === LAST) onClose('finish');
    else go(cur + 1);
  };

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => { if (cur === 0) onClose('skip'); else go(cur - 1); }}>
      <View style={s.screen}>
        <View style={s.top}>
          <Txt style={s.logo}>FLIXHOME</Txt>
          <View style={s.mid}>
            <Txt style={s.counter}>{cur + 1} de {LAST + 1}</Txt>
            <View style={s.segments}>
              {STEPS.map((step, i) => <View key={step.k} style={[s.segment, i <= cur && { backgroundColor: '#E50914' }]} />)}
            </View>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            {cur !== 0 && <TVButton pill label={cur === LAST ? 'Fechar' : 'Pular'} onPress={() => onClose(cur === LAST ? 'finish' : 'skip')} />}
          </View>
        </View>

        {[prev, cur].filter(i => i !== null).map(i => (
          <StepLayer key={i} index={i} leaving={i !== cur} dir={dir} name={name} reduce={reduce} onPress={press} />
        ))}

        <View style={s.hints}>
          <Key>◀</Key><Key>▶</Key><Txt style={s.hintTxt}>andar</Txt><View style={{ width: u(24) }} />
          <Key>OK</Key><Txt style={s.hintTxt}>escolher</Txt><View style={{ width: u(24) }} />
          <Key>Voltar</Key><Txt style={s.hintTxt}>{cur === 0 ? 'pula o passo a passo' : 'volta um passo'}</Txt>
        </View>
      </View>
    </Modal>
  );
}

// Aviso depois de pular: 4 s, com "OK" em foco para ver agora
export function TutorialToast({ onReopen, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <View style={s.toastWrap}>
        <View style={s.toast}>
          <Ionicons name="information-circle-outline" size={u(36)} color="#E5E5E5" />
          <Txt style={s.toastTxt}>Você pode ver o passo a passo de novo no menu lateral, em “Como usar o FlixHome”</Txt>
          <TVButton label="OK" preferred onPress={onReopen} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' },
  top: { position: 'absolute', left: u(96), right: u(96), top: u(54), height: u(72), flexDirection: 'row', alignItems: 'center', gap: u(32), zIndex: 2 },
  logo: { flex: 1, color: '#E50914', fontSize: u(32), fontWeight: '900', letterSpacing: u(2.5) },
  mid: { width: u(640), alignItems: 'center', gap: u(12) },
  counter: { color: '#888', fontSize: u(26), fontWeight: '700' },
  segments: { alignSelf: 'stretch', flexDirection: 'row', gap: u(6) },
  segment: { flex: 1, height: u(6), borderRadius: 999, backgroundColor: '#2A2A2A' },
  step: { position: 'absolute', left: u(96), right: u(96), top: u(150), bottom: u(126), flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: u(64), lineHeight: u(72), fontWeight: '900' },
  body: { marginTop: u(24), color: '#888', fontSize: u(32), lineHeight: u(44) },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: u(20) },
  highlightIcon: { width: u(56), height: u(56), borderRadius: u(28), backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  highlightTxt: { flex: 1, color: '#E5E5E5', fontSize: u(28), lineHeight: u(36), fontWeight: '500' },
  btns: { marginTop: u(48), minHeight: u(80), flexDirection: 'row', flexWrap: 'wrap', gap: u(24) },
  btn: { height: u(80), paddingHorizontal: u(40), borderRadius: u(16), borderWidth: u(3), borderColor: 'transparent', backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  btnPri: { backgroundColor: '#E50914' },
  btnLight: { backgroundColor: '#E5E5E5' },
  btnFocus: { borderColor: '#fff' },
  btnTxt: { color: '#E5E5E5', fontSize: u(28), fontWeight: '800' },
  pill: { height: u(72), paddingHorizontal: u(32), borderRadius: 999 },
  pillTxt: { fontSize: u(26) },
  hints: { position: 'absolute', left: u(96), bottom: u(54), flexDirection: 'row', alignItems: 'center', gap: u(16) },
  hintTxt: { color: '#888', fontSize: u(24), fontWeight: '600' },
  key: { minWidth: u(52), height: u(44), paddingHorizontal: u(12), borderRadius: u(10), borderWidth: u(2), borderBottomWidth: u(5), borderColor: '#3A3A3A', backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  keyTxt: { color: '#E5E5E5', fontSize: u(24), fontWeight: '800' },
  toastWrap: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: u(72) },
  toast: { width: u(1040), paddingVertical: u(20), paddingLeft: u(32), paddingRight: u(28), borderRadius: u(16), backgroundColor: '#1F1F1F', flexDirection: 'row', alignItems: 'center', gap: u(24) },
  toastTxt: { flex: 1, color: '#E5E5E5', fontSize: u(28), lineHeight: u(36), fontWeight: '600' },
});
