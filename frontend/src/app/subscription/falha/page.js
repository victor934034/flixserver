import Link from 'next/link';
import styles from '../result.module.css';

export default function SubscriptionFalhaPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <span className={`${styles.icon} ${styles.iconFail}`}>✕</span>
        <h1 className={styles.title}>Pagamento não concluído</h1>
        <p className={styles.desc}>
          Algo deu errado ou o pagamento foi cancelado. Você pode tentar novamente quando quiser.
        </p>
        <Link href="/subscription" className={styles.btn}>Tentar novamente</Link>
      </div>
    </main>
  );
}
