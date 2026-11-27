import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Easing, AppState, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Desenha as ilustrações animadas do passo a passo a partir dos dados do design
// (palco de 312×280; `k` é a escala). Só posição, escala, rotação e opacidade.

const LENGTHS = [
  'width', 'height', 'top', 'left', 'right', 'bottom', 'minWidth', 'borderRadius', 'borderWidth', 'borderTopWidth',
  'borderBottomWidth', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight',
  'paddingBottom', 'paddingLeft', 'gap', 'fontSize', 'lineHeight', 'letterSpacing',
];
// Momento do ciclo usado quando a pessoa pede menos movimento: quase tudo já apareceu
const STILL_AT = 0.8;

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub?.remove?.();
  }, []);
  return reduce;
}

// Um relógio por duração de ciclo; para quando o app vai para o fundo
function useClocks(reduce) {
  const clocks = useRef(new Map()).current;
  const loops = useRef(new Map()).current;
  const paused = useRef(false);

  const start = (T) => {
    const value = clocks.get(T);
    loops.get(T)?.stop();
    if (reduce) { value.setValue(STILL_AT); return; }
    if (paused.current) return;
    value.setValue(0);
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration: T, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    loops.set(T, loop);
    loop.start();
  };

  const get = (T) => {
    if (!clocks.has(T)) clocks.set(T, new Animated.Value(0));
    return clocks.get(T);
  };

  useEffect(() => {
    clocks.forEach((_, T) => start(T));
    const sub = AppState.addEventListener('change', (state) => {
      paused.current = state !== 'active';
      if (paused.current) loops.forEach(l => l.stop());
      else clocks.forEach((_, T) => start(T));
    });
    return () => { sub.remove(); loops.forEach(l => l.stop()); };
  }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  return get;
}

function scale(style, k) {
  if (!style) return {};
  const out = { ...style };
  delete out.dashed;
  LENGTHS.forEach(p => { if (typeof out[p] === 'number') out[p] *= k; });
  if (out.transform) {
    out.transform = out.transform.map(t => {
      const [name, value] = Object.entries(t)[0];
      return name.startsWith('translate') ? { [name]: value * k } : t;
    });
  }
  return out;
}

function animatedStyle(anim, clock, k, base) {
  const style = {};
  const transform = [...(base || [])];
  ['translateX', 'translateY', 'scale', 'scaleX', 'scaleY', 'rotate', 'opacity'].forEach(prop => {
    const track = anim.p[prop];
    if (!track) return;
    const [inputRange, values] = track;
    const outputRange = prop === 'rotate' ? values.map(v => `${v}deg`)
      : prop.startsWith('translate') ? values.map(v => v * k) : values;
    const node = clock.interpolate({ inputRange, outputRange });
    if (prop === 'opacity') style.opacity = node;
    else transform.push({ [prop]: node });
  });
  if (transform.length) style.transform = transform;
  return style;
}

export default function TutorialScene({ nodes, k = 1, name, reduce = false }) {
  const clock = useClocks(reduce);
  const clean = String(name || '').trim() || 'Você';
  const fill = useMemo(() => (t) => t.replace('__NOME__', clean.slice(0, 10)).replace('__INI__', clean[0].toUpperCase()), [clean]);

  const draw = (node, key) => {
    if (node.x !== undefined) {
      const text = fill(node.x);
      return (
        <Text key={key} allowFontScaling={false} numberOfLines={text.includes(' ') ? undefined : 1} adjustsFontSizeToFit={!text.includes(' ')} style={[{ includeFontPadding: false, flexShrink: text.includes(' ') ? 1 : 0 }, scale(node.s, k)]}>
          {text}
        </Text>
      );
    }
    const style = scale(node.s, k);
    const moving = node.a ? animatedStyle(node.a, clock(node.a.T), k, style.transform) : null;

    if (node.i) {
      const icon = <Ionicons name={node.i} size={node.z * k} color={node.c} />;
      return <Animated.View key={key} style={[style, moving]}>{icon}</Animated.View>;
    }

    if (node.s?.dashed) {
      const color = style.borderColor;
      const width = style.borderTopWidth || 2;
      delete style.borderTopWidth;
      delete style.borderColor;
      return (
        <View key={key} style={[style, { height: width, flexDirection: 'row', overflow: 'hidden' }]}>
          {Array.from({ length: 30 }, (_, i) => <View key={i} style={{ width: 5 * k, height: width, marginRight: 4 * k, backgroundColor: color }} />)}
        </View>
      );
    }

    const g = node.g;
    const children = (
      <>
        {g && (
          <LinearGradient
            colors={g.c} locations={g.l} start={{ x: g.s[0], y: g.s[1] }} end={{ x: g.e[0], y: g.e[1] }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: style.borderRadius || 0 }}
          />
        )}
        {node.k?.map(draw)}
      </>
    );
    return moving
      ? <Animated.View key={key} style={[style, moving]}>{children}</Animated.View>
      : <View key={key} style={style}>{children}</View>;
  };

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: 312 * k, height: 280 * k, borderRadius: 16 * k, backgroundColor: '#141414', overflow: 'hidden' }}
    >
      {nodes.map(draw)}
    </View>
  );
}
