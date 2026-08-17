'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import styles from './ParentalContext.module.css';

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

export function useParental() {
  return useContext(ParentalCtx);
}

export function ParentalProvider({ children }) {
  const [config, setConfig] = useState({ enabled: false, pin: null, maxRating: '18' });
  const [modal, setModal] = useState({ visible: false, item: null });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const resolveRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setConfig(JSON.parse(raw));
    } catch {}
  }, []);

  const saveConfig = (next) => {
    setConfig(next);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  };

  const checkAccess = (item) => new Promise((resolve) => {
    if (!config.enabled || !config.pin) { resolve(true); return; }
    const maxNum = ratingNum(config.maxRating);
    const itemNum = ratingNum(item?.age_rating);
    if (itemNum <= maxNum) { resolve(true); return; }
    resolveRef.current = resolve;
    setPinInput('');
    setPinError(false);
    setModal({ visible: true, item });
  });

  const handleSubmit = (e) => {
    e?.preventDefault();
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

      {modal.visible && (
        <div className={styles.overlay} onClick={handleCancel}>
          <form className={styles.box} onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2 className={styles.title}>Controle Parental</h2>
            <p className={styles.sub}>
              {modal.item?.age_rating
                ? `Classificação ${modal.item.age_rating} — acima do limite permitido`
                : 'Conteúdo restrito pelo controle parental'}
            </p>
            <label className={styles.label}>Digite o PIN para continuar</label>
            <input
              className={`${styles.input} ${pinError ? styles.inputError : ''}`}
              value={pinInput}
              onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(false); }}
              inputMode="numeric"
              type="password"
              maxLength={6}
              placeholder="••••"
              autoFocus
            />
            {pinError && <p className={styles.error}>PIN incorreto. Tente novamente.</p>}
            <div className={styles.btns}>
              <button type="button" className={styles.btnCancel} onClick={handleCancel}>Cancelar</button>
              <button type="submit" className={styles.btnOk}>Confirmar</button>
            </div>
          </form>
        </div>
      )}
    </ParentalCtx.Provider>
  );
}
