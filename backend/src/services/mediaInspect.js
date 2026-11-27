// Descobre o que há num vídeo SEM baixá-lo. Em .mp4 basta ler o índice (moov):
// vão sendo pedidos só os pedacinhos necessários, em geral menos de 500 KB de um
// filme de vários GB, sem abrir ffmpeg no servidor.
const axios = require('axios');
const { channelConfigOf, probe } = require('./aacRepair');

const BLOCK = 64 * 1024;
const MAX_REQUESTS = 40;
// A Backblaze bloqueia a conta inteira com muitos pedidos: no máximo ~2 por segundo
const settings = { gapMs: 500 };

let lastRequestAt = 0;
async function pace() {
  const wait = lastRequestAt + settings.gapMs - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function remoteReader(url) {
  const blocks = new Map();
  const stats = { requests: 0, bytes: 0, size: 0 };

  async function block(n) {
    if (blocks.has(n)) return blocks.get(n);
    try {
      return await fetchBlock(n);
    } catch (e) {
      if (e.status === 429 || e.status === 404) throw e;
      return fetchBlock(n); // o CDN às vezes falha ou ignora o pedido parcial uma vez
    }
  }

  async function fetchBlock(n) {
    if (stats.requests >= MAX_REQUESTS) throw httpError('Índice do vídeo grande demais para ler aos pedaços', 0);
    await pace();
    stats.requests += 1;
    let res;
    try {
      res = await axios.get(url, {
        headers: { Range: `bytes=${n * BLOCK}-${(n + 1) * BLOCK - 1}` },
        responseType: 'arraybuffer', timeout: 30_000,
        // se o servidor ignorar o Range, aborta em vez de baixar o filme todo pra memória
        maxContentLength: BLOCK * 2,
      });
    } catch (e) {
      throw httpError(`Não leu o arquivo (${e.response?.status || e.message})`, e.response?.status || 0);
    }
    if (res.status !== 206) throw httpError('O servidor não aceitou leitura parcial', res.status);
    const total = Number(String(res.headers['content-range'] || '').split('/')[1]);
    if (total) stats.size = total;
    const data = Buffer.from(res.data);
    stats.bytes += data.length;
    blocks.set(n, data);
    return data;
  }

  async function read(offset, length) {
    const parts = [];
    for (let at = offset; at < offset + length;) {
      const data = await block(Math.floor(at / BLOCK));
      const from = at % BLOCK;
      const piece = data.subarray(from, Math.min(data.length, from + (offset + length - at)));
      if (!piece.length) break;
      parts.push(piece);
      at += piece.length;
    }
    return Buffer.concat(parts);
  }

  return { read, stats };
}

// Caixas (atoms) do MP4 entre dois pontos do arquivo
async function boxes(reader, start, end) {
  const out = [];
  for (let at = start; at + 8 <= end;) {
    const head = await reader.read(at, 16);
    if (head.length < 8) break;
    let size = head.readUInt32BE(0);
    let header = 8;
    if (size === 1) {
      if (head.length < 16) break;
      size = Number(head.readBigUInt64BE(8));
      header = 16;
    }
    if (size === 0) size = end - at;
    if (size < header) break;
    out.push({ type: head.toString('latin1', 4, 8), body: at + header, end: at + size });
    if (out[out.length - 1].type === 'moov' && start === 0) break; // não precisa do resto
    at += size;
  }
  return out;
}

const child = async (reader, box, type) => box && (await boxes(reader, box.body, box.end)).find(b => b.type === type);

const VIDEO_CODECS = { avc1: 'h264', avc3: 'h264', hvc1: 'hevc', hev1: 'hevc', dvh1: 'hevc', dvhe: 'hevc', av01: 'av1', vp09: 'vp9', vp08: 'vp8', mp4v: 'mpeg4' };
const AUDIO_CODECS = { 'ac-3': 'ac3', 'ec-3': 'eac3', dtsc: 'dts', dtsh: 'dts', dtsl: 'dts', dtse: 'dts', Opus: 'opus', fLaC: 'flac', '.mp3': 'mp3', mlpa: 'truehd', alac: 'alac' };
const OBJECT_TYPES = { 0x69: 'mp3', 0x6b: 'mp3', 0xa5: 'ac3', 0xa6: 'eac3', 0xa9: 'dts', 0xdd: 'vorbis' };

// Dentro do esds: tipo do áudio e o AudioSpecificConfig (onde mora o defeito)
function parseEsds(buf) {
  let at = 4; // versão e flags
  const found = { objectType: 0, config: '' };
  const next = () => {
    const tag = buf[at++];
    let len = 0;
    for (let i = 0; i < 4 && at < buf.length; i++) {
      const b = buf[at++];
      len = (len << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return { tag, len };
  };
  while (at < buf.length) {
    const { tag, len } = next();
    if (tag === 0x03) { const flags = buf[at + 2]; at += 3 + (flags & 0x80 ? 2 : 0) + (flags & 0x20 ? 2 : 0); }
    else if (tag === 0x04) { found.objectType = buf[at]; at += 13; }
    else if (tag === 0x05) { found.config = buf.subarray(at, at + len).toString('hex'); break; }
    else at += len;
  }
  return found;
}

// Idioma do mdhd: três letras compactadas em 15 bits
function language(mdhd) {
  const at = mdhd[0] === 1 ? 32 : 20;
  if (mdhd.length < at + 2) return '';
  const v = mdhd.readUInt16BE(at);
  const text = [10, 5, 0].map(shift => String.fromCharCode(((v >> shift) & 31) + 96)).join('');
  return /^[a-z]{3}$/.test(text) && text !== 'und' ? text : '';
}

async function audioTrack(reader, entry) {
  const raw = await reader.read(entry.body, Math.min(entry.end - entry.body, 2048));
  const declared = raw.length >= 18 ? raw.readUInt16BE(16) : 0;
  const track = { codec: AUDIO_CODECS[entry.type] || entry.type.trim().toLowerCase(), profile: '', channels: declared, config: null, broken: false };
  if (entry.type !== 'mp4a') return track;
  // procura o esds dentro da entrada (às vezes vem dentro de outra caixa, "wave")
  const at = raw.indexOf('esds', 0, 'latin1');
  if (at < 4) throw new Error('Faixa AAC sem descrição');
  const esds = parseEsds(raw.subarray(at + 4, at - 4 + raw.readUInt32BE(at - 4)));
  if (OBJECT_TYPES[esds.objectType]) return { ...track, codec: OBJECT_TYPES[esds.objectType] };
  const config = channelConfigOf(esds.config);
  if (config === null) throw new Error('Faixa AAC sem configuração');
  const objectType = parseInt(esds.config.slice(0, 2), 16) >> 3;
  return {
    codec: 'aac',
    profile: objectType === 5 ? 'HE-AAC' : objectType === 29 ? 'HE-AACv2' : 'LC',
    // com o defeito (0) o número de canais não dá pra saber só pelo índice
    channels: config === 0 ? 0 : config === 7 ? 8 : config,
    config, broken: config === 0,
  };
}

// { videos, videoCodec, audio: [{ codec, profile, channels, config, language, broken }], stats }
async function inspectMp4(url) {
  const reader = remoteReader(url);
  await reader.read(0, 16);
  const size = reader.stats.size || Number.MAX_SAFE_INTEGER;
  const moov = (await boxes(reader, 0, size)).find(b => b.type === 'moov');
  if (!moov) throw new Error('Não é um MP4 legível');

  const info = { videos: 0, videoCodec: null, audio: [], stats: reader.stats };
  for (const trak of (await boxes(reader, moov.body, moov.end)).filter(b => b.type === 'trak')) {
    const mdia = await child(reader, trak, 'mdia');
    if (!mdia) continue;
    const parts = await boxes(reader, mdia.body, mdia.end);
    const hdlr = parts.find(b => b.type === 'hdlr');
    if (!hdlr) continue;
    const kind = (await reader.read(hdlr.body + 8, 4)).toString('latin1');
    if (kind !== 'vide' && kind !== 'soun') continue;
    const minf = parts.find(b => b.type === 'minf');
    const stsd = await child(reader, await child(reader, minf, 'stbl'), 'stsd');
    if (!stsd) continue;
    const entry = (await boxes(reader, stsd.body + 8, stsd.end))[0];
    if (!entry) continue;
    if (kind === 'vide') {
      info.videos += 1;
      info.videoCodec = info.videoCodec || VIDEO_CODECS[entry.type] || entry.type.trim().toLowerCase();
    } else {
      const mdhd = parts.find(b => b.type === 'mdhd');
      const lang = mdhd ? language(await reader.read(mdhd.body, 36)) : '';
      info.audio.push({ ...(await audioTrack(reader, entry)), language: lang });
    }
  }
  if (!info.videos && !info.audio.length) throw new Error('Índice do vídeo sem faixas');
  return info;
}

// Qualquer vídeo: .mp4 pelo índice; os outros (ou um .mp4 fora do comum) pelo
// ffprobe, que lê direto do endereço sem salvar nada no servidor.
async function inspect(url, ffprobePath) {
  if (/\.(mp4|m4v|mov)$/i.test(url.split('?')[0])) {
    try { return await inspectMp4(url); }
    catch (e) { if (e.status === 429 || e.status === 404) throw e; }
  }
  await pace();
  return probe(ffprobePath, url);
}

module.exports = { inspect, inspectMp4, settings };
