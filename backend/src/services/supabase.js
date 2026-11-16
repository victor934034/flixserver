const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// O Supabase devolve no máximo 1000 linhas por consulta. Pra tabelas grandes
// (episódios já passam de 3500) busca página por página até acabar.
// makeQuery deve devolver uma consulta NOVA a cada chamada, com .order() fixo.
async function fetchAll(makeQuery, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) return { data: out, error };
    out.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: out, error: null };
}

module.exports = { supabase, supabaseAnon, fetchAll };
