import Link from 'next/link';
import styles from '../../subscription/result.module.css';

export default function IptvPendentePage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <span className={`${styles.icon} ${styles.iconPending}`}>⏳</span>
        <h1 className={styles.title}>Pagamento em análise</h1>
        <p className={styles.desc}>
          Assim que for aprovado, o administrador ativará sua assinatura IPTV.
        </p>
        <Link href="/iptv" className={styles.btn}>Ir para o IPTV</Link>
      </div>
    </main>
  );
}
