import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Switch, ScrollView, Alert, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useParental, RATINGS } from '../contexts/ParentalContext';

export default function ParentalControlsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { config, saveConfig } = useParental();

  const [enabled, setEnabled]     = useState(config.enabled);
  const [pin, setPin]             = useState(config.pin || '');
  const [confirmPin, setConfirmPin] = useState('');
  const [maxRating, setMaxRating] = useState(config.maxRating || '18');
  const [step, setStep]           = useState(config.pin ? 'main' : 'setup'); // 'setup' | 'main'
  const [pinError, setPinError]   = useState('');

  const handleSave = async () => {
    if (enabled) {
      if (!pin || pin.length < 4) { setPinError('PIN deve ter pelo menos 4 dígitos'); return; }
      if (step === 'setup' && pin !== confirmPin) { setPinError('PINs não coincidem'); return; }
    }
    setPinError('');
    await saveConfig({ enabled, pin: enabled ? pin : null, maxRating });
    Alert.alert('Salvo', 'Controle parental atualizado.', [{ text: 'OK', onPress: () => router.back() }]);
  };

  const [showOldPin, setShowOldPin] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');

  const handleChangePin = () => {
    setOldPinInput('');
    setShowOldPin(true);
  };

  const confirmOldPin = () => {
    if (oldPinInput !== config.pin) {
      Alert.alert('PIN incorreto', 'O PIN atual não confere.');
      setOldPinInput('');
      return;
    }
    setShowOldPin(false);
    setStep('setup');
    setPin('');
    setConfirmPin('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
    <ScrollView style={[s.container, { paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.pageTitle}>Controle Parental</Text>
      </View>

      <View style={s.section}>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Ativar controle parental</Text>
            <Text style={s.rowDesc}>Exige PIN para conteúdo acima do limite</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: '#2a2a2a', true: '#E50914' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {enabled && (
        <>
          <View style={s.section}>
            <Text style={s.sectionLabel}>PIN de acesso</Text>

            {step === 'setup' ? (
              <>
                <View style={s.inputWrap}>
                  <Text style={s.inputLabel}>Novo PIN (mínimo 4 dígitos)</Text>
                  <TextInput
                    style={s.input}
                    value={pin}
                    onChangeText={v => { setPin(v); setPinError(''); }}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    placeholder="••••"
                    placeholderTextColor="#444"
                  />
                </View>
                <View style={s.inputWrap}>
                  <Text style={s.inputLabel}>Confirmar PIN</Text>
                  <TextInput
                    style={s.input}
                    value={confirmPin}
                    onChangeText={v => { setConfirmPin(v); setPinError(''); }}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    placeholder="••••"
                    placeholderTextColor="#444"
                  />
                </View>
              </>
            ) : (
              <TouchableOpacity style={s.changePinBtn} onPress={handleChangePin}>
                <Ionicons name="key-outline" size={18} color="#aaa" />
                <Text style={s.changePinText}>Alterar PIN</Text>
                <Ionicons name="chevron-forward" size={16} color="#333" />
              </TouchableOpacity>
            )}

            {pinError ? <Text style={s.errorText}>{pinError}</Text> : null}
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Classificação máxima permitida</Text>
            <Text style={s.sectionDesc}>Conteúdo acima deste limite exigirá o PIN</Text>
            <View style={s.ratingGrid}>
              {RATINGS.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[s.ratingBtn, maxRating === r.value && s.ratingBtnActive]}
                  onPress={() => setMaxRating(r.value)}
                >
                  <Text style={[s.ratingBtnText, maxRating === r.value && s.ratingBtnTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      <View style={s.section}>
        <View style={s.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#555" style={{ marginTop: 2 }} />
          <Text style={s.infoText}>
            O controle parental bloqueia acesso a conteúdos com classificação indicativa acima do limite escolhido.
            O PIN é armazenado localmente no dispositivo.
          </Text>
        </View>
      </View>

      <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
        <Ionicons name="checkmark-circle" size={20} color="#000" />
        <Text style={s.saveBtnText}>Salvar configurações</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>

    {/* Modal para verificar PIN antes de alterar */}
    <Modal visible={showOldPin} transparent animationType="fade" onRequestClose={() => setShowOldPin(false)}>
      <View style={s.overlay}>
        <View style={s.box}>
          <Text style={s.title}>Verificar PIN atual</Text>
          <Text style={s.sub}>Digite o PIN atual para poder alterá-lo.</Text>
          <TextInput
            style={s.input}
            value={oldPinInput}
            onChangeText={setOldPinInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholder="••••"
            placeholderTextColor="#444"
            autoFocus
          />
          <View style={s.btns}>
            <TouchableOpacity style={s.btnCancel} onPress={() => setShowOldPin(false)}>
              <Text style={s.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnOk} onPress={confirmOldPin}>
              <Text style={s.btnOkText}>Verificar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  backBtn: { padding: 6 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#fff', flex: 1 },

  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  sectionDesc: { color: '#555', fontSize: 12, marginBottom: 12 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1f1f1f',
  },
  rowLabel: { color: '#fff', fontSize: 16 },
  rowDesc: { color: '#555', fontSize: 12, marginTop: 3 },

  inputWrap: { marginBottom: 12 },
  inputLabel: { color: '#777', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, padding: 14, color: '#fff', fontSize: 22,
    textAlign: 'center', letterSpacing: 10,
  },
  errorText: { color: '#E50914', fontSize: 13, marginTop: 8 },

  changePinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#111', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#1f1f1f',
  },
  changePinText: { color: '#bbb', fontSize: 15, flex: 1 },

  ratingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ratingBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a',
  },
  ratingBtnActive: { backgroundColor: '#E50914', borderColor: '#E50914' },
  ratingBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },
  ratingBtnTextActive: { color: '#fff' },

  infoBox: { flexDirection: 'row', gap: 10, backgroundColor: '#111', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1a1a1a' },
  infoText: { color: '#555', fontSize: 13, lineHeight: 20, flex: 1 },

  saveBtn: {
    marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  // Modal styles (reused from ParentalContext pattern)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box: { backgroundColor: '#111', borderRadius: 16, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  sub: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  btns: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 12 },
  btnCancel: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  btnCancelText: { color: '#aaa', fontSize: 15 },
  btnOk: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#E50914', alignItems: 'center' },
  btnOkText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
