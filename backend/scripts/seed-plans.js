require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

const STREAMING_PLANS = [
  { id: 'monthly_2',   name: 'Mensal · 2 Telas',     price: 9.90,   promo_price: 2.90, duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',        highlight: false, max_streams: 2 },
  { id: 'monthly_3',   name: 'Mensal · 3 Telas',     price: 14.90,  promo_price: 4.90, duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',        highlight: false, max_streams: 3 },
  { id: 'monthly_5',   name: 'Mensal · 5 Telas',     price: 19.90,  promo_price: 6.90, duration_days: 30,  active: true,  badge: null,           description: 'Acesso por 1 mês',        highlight: false, max_streams: 5 },
  { id: 'quarterly_2', name: 'Trimestral · 2 Telas', price: 19.90,  promo_price: null, duration_days: 90,  active: true,  badge: null,           description: 'Equivale a R$ 6,63/mês',  highlight: false, max_streams: 2 },
  { id: 'quarterly_3', name: 'Trimestral · 3 Telas', price: 29.90,  promo_price: null, duration_days: 90,  active: true,  badge: 'MAIS POPULAR', description: 'Equivale a R$ 9,97/mês',  highlight: true,  max_streams: 3 },
  { id: 'quarterly_5', name: 'Trimestral · 5 Telas', price: 44.90,  promo_price: null, duration_days: 90,  active: true,  badge: null,           description: 'Equivale a R$ 14,97/mês', highlight: false, max_streams: 5 },
  { id: 'yearly_2',    name: 'Anual · 2 Telas',      price: 49.90,  promo_price: null, duration_days: 365, active: true,  badge: null,           description: 'Equivale a R$ 4,16/mês',  highlight: false, max_streams: 2 },
  { id: 'yearly_3',    name: 'Anual · 3 Telas',      price: 79.90,  promo_price: null, duration_days: 365, active: true,  badge: null,           description: 'Equivale a R$ 6,66/mês',  highlight: false, max_streams: 3 },
  { id: 'yearly_5',    name: 'Anual · 5 Telas',      price: 119.90, promo_price: null, duration_days: 365, active: true,  badge: 'MELHOR CUSTO', description: 'Equivale a R$ 9,99/mês',  highlight: true,  max_streams: 5 },
];

const IPTV_PLANS = [
  { name: '1 MÊS S/ADULTO',    price: 24.90,  duration_months: 1,  order_index: 0 },
  { name: '1 MÊS C/ADULTO',    price: 27.90,  duration_months: 1,  order_index: 1 },
  { name: '3 MESES S/ADULTO',  price: 54.90,  duration_months: 3,  order_index: 2 },
  { name: '3 MESES C/ADULTO',  price: 57.90,  duration_months: 3,  order_index: 3 },
  { name: '6 MESES S/ADULTO',  price: 109.90, duration_months: 6,  order_index: 4 },
  { name: '6 MESES C/ADULTO',  price: 114.90, duration_months: 6,  order_index: 5 },
  { name: '12 MESES S/ADULTO', price: 159.90, duration_months: 12, order_index: 6 },
  { name: '12 MESES C/ADULTO', price: 164.90, duration_months: 12, order_index: 7 },
];

async function run() {
  // 1. Streaming plans
  console.log('Seeding streaming plans...');
  const { error: settingsErr } = await supabase
    .from('system_settings')
    .upsert({ key: 'plans_config', value: JSON.stringify(STREAMING_PLANS) }, { onConflict: 'key' });
  if (settingsErr) { console.error('ERROR (streaming):', settingsErr.message); process.exit(1); }
  console.log(`✓ ${STREAMING_PLANS.length} streaming plans saved`);

  // 2. IPTV plans — insert if missing, update price if exists
  console.log('\nSeeding IPTV plans...');
  const { data: existing, error: fetchErr } = await supabase
    .from('iptv_plans')
    .select('id, name');

  if (fetchErr) {
    if (fetchErr.message?.includes('does not exist') || fetchErr.code === '42P01') {
      console.warn('iptv_plans table does not exist — skipping (create it in Supabase first)');
      console.log('\nDone!');
      return;
    }
    console.error('ERROR (fetch iptv_plans):', fetchErr.message);
    process.exit(1);
  }

  const existingByName = {};
  for (const row of existing || []) {
    existingByName[row.name.toLowerCase()] = row.id;
  }

  for (const p of IPTV_PLANS) {
    const existingId = existingByName[p.name.toLowerCase()];
    if (existingId) {
      const { error } = await supabase
        .from('iptv_plans')
        .update({ price: p.price, duration_months: p.duration_months })
        .eq('id', existingId);
      if (error) console.warn(`  WARN update [${p.name}]:`, error.message);
      else console.log(`  ✓ updated  ${p.name} → R$ ${p.price}`);
    } else {
      const { error } = await supabase
        .from('iptv_plans')
        .insert({ name: p.name, price: p.price, duration_months: p.duration_months, is_active: true, order_index: p.order_index });
      if (error) console.warn(`  WARN insert [${p.name}]:`, error.message);
      else console.log(`  ✓ inserted ${p.name} → R$ ${p.price}`);
    }
  }

  console.log('\nDone!');
}

run().catch(err => { console.error(err); process.exit(1); });
