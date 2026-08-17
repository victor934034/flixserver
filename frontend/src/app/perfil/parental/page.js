'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import { useParental, RATINGS } from '../../../contexts/ParentalContext';
import styles from './page.module.css';

export default function ParentalControlsPage() {
  const router = useRouter();
  const { config, saveConfig } = useParental();

  const [enabled, setEnabled] = useState(config.enabled);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [maxRating, setMaxRating] = useState(config.maxRating || '18');
  const [changingPin, setChangingPin] = useState(!config.pin);
  const [oldPin, setOldPin] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function startChangePin() {
    if (config.pin) {
      const attempt = prompt('Digite o PIN atual para trocar:');
      if (attempt !== config.pin) {
        if (attempt !== null) alert('PIN incorreto.');
        return;
      }
    }
    setPin('');
    setConfirmPin('');
    setChangingPin(true);
  }

  function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaved(false);

    if (enabled) {
      const finalPin = changingPin ? pin : config.pin;
      if (!finalPin || finalPin.length < 4) { setError('PIN deve ter pelo menos 4 dígitos'); return; }
      if (changingPin && pin !== confirmPin) { setError('Os PINs não coincidem'); return; }
      saveConfig({ enabled, pin: finalPin, maxRating });
    } else {
      saveConfig({ enabled: false, pin: config.pin, maxRating });
    }
    setSaved(true);
    setTimeout(() => router.push('/perfil'), 900);
  }

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Controle Parental</h1>
          <p className={styles.subtitle}>
            Configuração salva neste navegador — exige PIN para tocar conteúdo acima da classificação escolhida.
          </p>

          <form onSubmit={handleSave} className={styles.form}>
            <label className={styles.toggleRow}>
              <div>
                <span className={styles.rowLabel}>Ativar controle parental</span>
                <span className={styles.rowDesc}>Exige PIN para conteúdo acima do limite</span>
              </div>
              <span
                className={`${styles.toggleTrack} ${enabled ? styles.toggleTrackOn : ''}`}
                onClick={() => setEnabled(!enabled)}
              >
                <span className={`${styles.toggleThumb} ${enabled ? styles.toggleThumbOn : ''}`} />
              </span>
            </label>

            {enabled && (
              <>
                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Classificação máxima permitida</span>
                  <div className={styles.ratingsRow}>
                    {RATINGS.map(r => (
                      <button
                        type="button"
                        key={r.value}
                        className={`${styles.ratingBtn} ${maxRating === r.value ? styles.ratingBtnActive : ''}`}
                        onClick={() => setMaxRating(r.value)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.section}>
                  <span className={styles.sectionLabel}>PIN de acesso</span>
                  {!changingPin ? (
                    <button type="button" className={styles.changePinBtn} onClick={startChangePin}>
                      Trocar PIN atual
                    </button>
                  ) : (
                    <>
                      <input
                        className={styles.input}
                        type="password"
                        inputMode="numeric"
                        placeholder="Novo PIN (mín. 4 dígitos)"
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                      />
                      <input
                        className={styles.input}
                        type="password"
                        inputMode="numeric"
                        placeholder="Confirme o PIN"
                        value={confirmPin}
                        onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                      />
                    </>
                  )}
                </div>
              </>
            )}

            {error && <p className={styles.error}>{error}</p>}
            {saved && <p className={styles.success}>Salvo!</p>}

            <button type="submit" className={styles.btnSave}>Salvar</button>
          </form>
        </div>
      </main>
    </>
  );
}
