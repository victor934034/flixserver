const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { searchTMDB, getDetails, buildMovieData, buildSeriesData } = require('../services/tmdb');
const { adminMiddleware } = require('../middleware/admin');

router.use(adminMiddleware);

// Detecta e importa pelo nome do arquivo
router.post('/detect', async (req, res) => {
  const { fileUrl, version = 'dubbing' } = req.body;
  if (!fileUrl) return res.status(400).json({ error: 'fileUrl é obrigatório' });

  try {
    const { processFiles } = require('../../tmdb-bot');
    const report = await processFiles([{ url: fileUrl, version }]);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Importa por ID TMDB
router.post('/import/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const { type = 'movie', fileUrl, version = 'dubbing' } = req.body;

  try {
    const details = await getDetails(Number(tmdbId), type);
    if (!details) return res.status(404).json({ error: 'ID TMDB não encontrado' });

    if (type === 'movie') {
      const movieData = buildMovieData(details);
      if (fileUrl) movieData[`file_${version}`] = fileUrl;

      const { data, error } = await supabase
        .from('movies')
        .upsert(movieData, { onConflict: 'tmdb_id' })
        .select()
        .single();

      if (error) throw error;
      return res.json({ type: 'movie', data });
    }

    const seriesData = buildSeriesData(details);
    const { data, error } = await supabase
      .from('series')
      .upsert(seriesData, { onConflict: 'tmdb_id' })
      .select()
      .single();

    if (error) throw error;
    res.json({ type: 'series', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Busca no TMDB sem salvar (para o admin pré-visualizar)
router.get('/search', async (req, res) => {
  const { q, type = 'movie' } = req.query;
  if (!q) return res.status(400).json({ error: 'q é obrigatório' });

  try {
    const result = await searchTMDB(q, type);
    if (!result) return res.json(null);

    const details = await getDetails(result.id, type);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Importação em lote via Bot TMDB
router.post('/batch', async (req, res) => {
  const { files } = req.body; // [{ url, version }]
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files deve ser um array não-vazio' });
  }

  try {
    const { processFiles } = require('../../tmdb-bot');
    const report = await processFiles(files);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
