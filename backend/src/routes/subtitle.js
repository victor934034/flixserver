const router = require('express').Router();
const axios = require('axios');

const CDN_BASE = process.env.CDN_BASE_URL || '';

// Converte SRT (ou qualquer coisa que não seja WEBVTT) para o formato que o
// <track kind="subtitles"> do HTML5 entende — o navegador NÃO parseia .srt
// diretamente, só WebVTT. Timestamps usam vírgula no SRT, ponto no VTT.
function toVtt(raw) {
  const text = raw.replace(/^﻿/, '').trim();
  if (/^WEBVTT/.test(text)) return text;
  const body = text
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${body}`;
}

// GET /api/subtitle?url=... — busca a legenda na CDN e devolve como WebVTT
// (sem authMiddleware: o <track> do browser não manda header Authorization,
// então exigir login aqui derrubava a legenda com 401 silencioso)
router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url obrigatória' });

  const allowed = CDN_BASE && url.startsWith(CDN_BASE);
  if (CDN_BASE && !allowed) return res.status(403).json({ error: 'URL não autorizada' });

  try {
    const { data } = await axios.get(url, { responseType: 'text', timeout: 15_000 });
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(toVtt(data));
  } catch (err) {
    console.error('[subtitle] erro:', err.message);
    res.status(502).json({ error: 'Não foi possível carregar a legenda' });
  }
});

module.exports = router;
