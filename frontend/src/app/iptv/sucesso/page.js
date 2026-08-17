import Link from 'next/link';
import styles from '../../subscription/result.module.css';

export default function IptvSucessoPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <span className={`${styles.icon} ${styles.iconOk}`}>✓</span>
        <h1 className={styles.title}>Pagamento aprovado!</h1>
        <p className={styles.desc}>
          Volte em alguns instantes — o administrador ativará sua assinatura IPTV em breve.
        </p>
        <Link href="/iptv" className={styles.btn}>Ir para o IPTV</Link>
      </div>
    </main>
  );
}
