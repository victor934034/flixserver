import Link from 'next/link';
import styles from '../result.module.css';

export default function SubscriptionPendentePage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <span className={`${styles.icon} ${styles.iconPending}`}>⏳</span>
        <h1 className={styles.title}>Pagamento em análise</h1>
        <p className={styles.desc}>
          Seu pagamento está sendo processado. Assim que for aprovado, sua assinatura será ativada automaticamente.
        </p>
        <Link href="/" className={styles.btn}>Ir para o início</Link>
      </div>
    </main>
  );
}
