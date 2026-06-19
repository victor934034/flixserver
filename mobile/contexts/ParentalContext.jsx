import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = 'flixhome_parental_v1';

export const RATINGS = [
  { label: 'Livre', value: 'L', min: 0 },
  { label: '10+', value: '10', min: 10 },
  { label: '12+', value: '12', min: 12 },
  { label: '14+', value: '14', min: 14 },
  { label: '16+', value: '16', min: 16 },
  { label: '18+', value: '18', min: 18 },
];

function ratingNum(r) {
  if (!r) return 0;
  const s = String(r).replace('+', '').trim().toUpperCase();
  if (s === 'L' || s === 'LIVRE') return 0;
  return parseInt(s) || 0;
}

const ParentalCtx = createContext(null);

export function ParentalProvider({ children }) {
  const [config, setConfig] = useState({ enabled: false, pin: null, maxRating: '18' });
  const [modal, setModal] = useState({ visible: false, item: null });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const resolveRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then(raw => {
      if (raw) setConfig(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  const saveConfig = async (next) => {
    setConfig(next);
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(next));
  };

  const checkAccess = (item) => new Promise((resolve) => {
    if (!config.enabled || !config.pin) { resolve(true); return; }
    const maxNum  = ratingNum(config.maxRating);
    const itemNum = ratingNum(item?.age_rating);
    if (itemNum <= maxNum) { resolve(true); return; }
    resolveRef.current = resolve;
    setPinInput('');
    setPinError(false);
    setModal({ visible: true, item });
  });

  const handleSubmit = () => {
    if (pinInput === config.pin) {
      setModal({ visible: false, item: null });
      resolveRef.current?.(true);
      resolveRef.current = null;
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleCancel = () => {
    setModal({ visible: false, item: null });
    resolveRef.current?.(false);
    resolveRef.current = null;
  };

  return (
    <ParentalCtx.Provider value={{ config, saveConfig, checkAccess, ratingNum, RATINGS }}>
      {children}

      <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={handleCancel}>
        <View style={s.overlay}>
          <View style={s.box}>
            <Text style={s.title}>Controle Parental</Text>
            <Text style={s.sub}>
              {modal.item?.age_rating
                ? `Classificação ${modal.item.age_rating} — acima do limite permitido`
                : 'Conteúdo restrito pelo controle parental'}
            </Text>
            <Text style={s.label}>Digite o PIN para continuar</Text>
            <TextInput
              style={[s.input, pinError && s.inputError]}
              value={pinInput}
              onChangeText={v => { setPinInput(v); setPinError(false); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="••••"
              placeholderTextColor="#444"
              autoFocus
              onSubmitEditing={handleSubmit}
            />
            {pinError && <Text style={s.error}>PIN incorreto. Tente novamente.</Text>}
            <View style={s.btns}>
              <TouchableOpacity style={s.btnCancel} onPress={handleCancel}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnOk} onPress={handleSubmit}>
                <Text style={s.btnOkText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ParentalCtx.Provider>
  );
}

export function useParental() { return useContext(ParentalCtx); }

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box: { backgroundColor: '#111', borderRadius: 16, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  sub: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  label: { color: '#666', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10, alignSelf: 'flex-start' },
  input: {
    width: '100%', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 10, padding: 14, color: '#fff', fontSize: 20, textAlign: 'center',
    letterSpacing: 8, marginBottom: 6,
  },
  inputError: { borderColor: '#E50914' },
  error: { color: '#E50914', fontSize: 12, marginBottom: 10 },
  btns: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 12 },
  btnCancel: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  btnCancelText: { color: '#aaa', fontSize: 15 },
  btnOk: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#E50914', alignItems: 'center' },
  btnOkText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
