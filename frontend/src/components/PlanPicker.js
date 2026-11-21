'use client';
import { useMemo, useState } from 'react';
import styles from './PlanPicker.module.css';

export const brl = v => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
export const monthsOf = p => Number(p.duration_months) || Math.max(1, Math.round((Number(p.duration_days) || 30) / 30));
export const periodLabel = m => (m === 1 ? '1 mês' : `${m} meses`);
export const priceOf = p => (p.promo_price != null && Number(p.promo_price) < Number(p.price) ? Number(p.promo_price) : Number(p.price));
const providerOf = p => (/^\[([^\]]+)\]/.exec(p.name || '') || [])[1] || null;
const variantOf = p => `${p.is_adult ? 1 : 0}-${p.max_streams || 1}`;

// "[ONE X] PACOTE 3 MESES COM ADULTO" -> "Com adulto"; "Mensal · 2 Telas" -> "2 Telas"
export function titleOf(p) {
  const m = /(COM|SEM)\s+ADULTO/i.exec(p.name || '');
  if (m) return m[1].toUpperCase() === 'COM' ? 'Com adulto' : 'Sem adulto';
  const parts = String(p.name || '').split('·');
  return parts[parts.length - 1].trim();
}

// Escolha de plano sem rolagem: períodos (1/3/6/12 meses) em abas e só os planos do período na tela.
export default function PlanPicker({ plans, selected, onSelect, subtitleOf }) {
  const providers = useMemo(() => [...new Set(plans.map(providerOf).filter(Boolean))], [plans]);
  const selPlan = plans.find(p => p.id === selected) || null;
  const [prov, setProv] = useState(null);
  const activeProv = providers.length > 1 ? (prov || (selPlan && providerOf(selPlan)) || providers[0]) : null;

  const pool = useMemo(() => plans.filter(p => !activeProv || providerOf(p) === activeProv), [plans, activeProv]);
  const periods = useMemo(() => [...new Set(pool.map(monthsOf))].sort((a, b) => a - b), [pool]);
  const period = selPlan && periods.includes(monthsOf(selPlan)) ? monthsOf(selPlan) : periods[0];
  const visible = pool.filter(p => monthsOf(p) === period)
    .sort((a, b) => (a.is_adult ? 1 : 0) - (b.is_adult ? 1 : 0) || (a.max_streams || 1) - (b.max_streams || 1) || priceOf(a) - priceOf(b));

  const bestMonthly = m => Math.min(...pool.filter(p => monthsOf(p) === m).map(p => priceOf(p) / m));
  const base = periods.length ? bestMonthly(periods[0]) : 0;
  const saving = m => (m === periods[0] || !base ? 0 : Math.round((1 - bestMonthly(m) / base) * 100));

  const pickPeriod = m => {
    const list = pool.filter(p => monthsOf(p) === m);
    onSelect((selPlan && list.find(p => variantOf(p) === variantOf(selPlan))) || list.find(p => p.highlight) || list[0]);
  };
  const pickProvider = name => {
    setProv(name);
    const list = plans.filter(p => providerOf(p) === name);
    const inPeriod = list.filter(p => monthsOf(p) === (selPlan ? monthsOf(selPlan) : 1));
    onSelect((selPlan && inPeriod.find(p => variantOf(p) === variantOf(selPlan))) || inPeriod[0] || list[0]);
  };

  return (
    <div className={styles.wrap}>
      {providers.length > 1 && (
        <div className={styles.provs}>
          {providers.map(n => <button key={n} className={activeProv === n ? styles.provOn : ''} onClick={() => pickProvider(n)}>{n}</button>)}
        </div>
      )}

      <div className={styles.periods} role="tablist">
        {periods.map(m => {
          const on = m === period; const sv = saving(m);
          return (
            <button key={m} role="tab" aria-selected={on} className={`${styles.chip} ${on ? styles.chipOn : ''}`} onClick={() => pickPeriod(m)}>
              <b>{m}</b><span>{m === 1 ? 'mês' : 'meses'}</span>
              {sv >= 5 ? <em className={styles.save}>-{sv}%</em> : <em className={styles.saveGhost} />}
            </button>
          );
        })}
      </div>

      <div className={styles.cards}>
        {visible.map(p => {
          const on = p.id === selected; const m = monthsOf(p); const price = priceOf(p);
          return (
            <div key={p.id} className={`${styles.card} ${on ? styles.cardOn : ''}`} onClick={() => onSelect(p)}>
              {p.badge && <span className={styles.badge}>{p.badge}</span>}
              <div className={styles.head}>
                <h3>{titleOf(p)}{p.is_adult && <span className={styles.adult}>18+</span>}</h3>
                <span className={`${styles.radio} ${on ? styles.radioOn : ''}`} />
              </div>
              {subtitleOf && <div className={styles.sub}>{subtitleOf(p)}</div>}
              <div className={styles.priceRow}>
                {p.promo_price != null && Number(p.promo_price) < Number(p.price) && <s>{brl(p.price)}</s>}
                <span className={styles.price}>{brl(price)}</span>
              </div>
              <div className={styles.per}>{m === 1 ? 'por mês' : `${brl(price / m)}/mês · ${periodLabel(m)}`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
