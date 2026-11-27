// Quando um arquivo de vídeo muda de endereço (ex.: .mkv convertido para .mp4),
// TODOS os campos que apontam para o endereço antigo precisam mudar juntos: um
// arquivo dual áudio é usado pelo Dublado e pelo Legendado ao mesmo tempo.
const FIELDS = {
  movies: ['file_dubbing', 'file_subtitled', 'file_cinema', 'file_4k', 'file_color', 'file_bw'],
  episodes: ['file_dubbing', 'file_subtitled', 'file_cinema', 'file_color', 'file_bw'],
};

async function replaceMediaUrl(supabase, oldUrl, newUrl) {
  if (!oldUrl || !newUrl || oldUrl === newUrl) return;
  for (const [table, fields] of Object.entries(FIELDS)) {
    for (const field of fields) {
      const { error } = await supabase.from(table).update({ [field]: newUrl }).eq(field, oldUrl);
      // coluna que não existe neste banco não é problema; qualquer outro erro sim
      if (error && error.code !== '42703') throw new Error(`${table}.${field}: ${error.message}`);
    }
  }
}

module.exports = { replaceMediaUrl };
