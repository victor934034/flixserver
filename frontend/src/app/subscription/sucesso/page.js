import Link from 'next/link';
import styles from '../result.module.css';

export default function SubscriptionSucessoPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <span className={`${styles.icon} ${styles.iconOk}`}>✓</span>
        <h1 className={styles.title}>Pagamento aprovado!</h1>
        <p className={styles.desc}>
          Sua assinatura foi confirmada. Pode levar alguns instantes para atualizar em sua conta.
        </p>
        <Link href="/" className={styles.btn}>Ir para o início</Link>
      </div>
    </main>
  );
}
