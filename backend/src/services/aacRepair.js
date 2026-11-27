// Conserto do AAC fora do padrão (channelConfig 0): vários Androids recusam essas
// faixas com "MediaCodecAudioRenderer error". Só as faixas com o defeito são
// reconvertidas, mantendo o surround em 5.1 padrão; vídeo e demais faixas são
// copiados sem alteração.
const { execFile } = require('child_process');

// Mantém mono e estéreo; surround vira 5.1 padrão (mais de 6 canais também)
const LAYOUTS = 'aformat=channel_layouts=mono|stereo|5.1';

// AudioSpecificConfig: tipo (5 bits), frequência (4 bits), configuração de canais (4 bits)
function channelConfigOf(hex) {
  if (!hex || hex.length < 4) return null;
  const bits = [...hex].map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
  let at = 0;
  const read = n => { const v = parseInt(bits.slice(at, at + n), 2); at += n; return v; };
  if (read(5) === 31) read(6);
  if (read(4) === 15) read(24);
  const config = read(4);
  return Number.isNaN(config) ? null : config;
}

// O ffprobe devolve o extradata como um despejo: "00000000: 1180 56e5 00   ..V.."
const dumpToHex = dump => String(dump || '').split('\n')
  .map(line => (line.split(': ')[1] || '').split('  ')[0].replace(/\s+/g, ''))
  .join('');

function parseTrack(s) {
  const config = s.codec_name === 'aac' ? channelConfigOf(dumpToHex(s.extradata)) : null;
  return {
    codec: s.codec_name, profile: s.profile || '', channels: s.channels || 0, config,
    language: s.tags?.language || '', broken: s.codec_name === 'aac' && config === 0,
  };
}

function parseProbe(data) {
  const streams = data.streams || [];
  return {
    duration: Number(data.format?.duration) || 0,
    videos: streams.filter(s => s.codec_type === 'video').length,
    audio: streams.filter(s => s.codec_type === 'audio').map(parseTrack),
  };
}

// Envios novos: a faixa precisa ser convertida se não for AAC comum, se tiver o
// defeito dos canais ou mais de 6 canais. AAC 5.1 no padrão fica como está.
function needsAudioFix(track) {
  const p = String(track.profile || '').toLowerCase();
  const heAac = p.includes('he') || p === 'lc+sbr' || p === 'lc+sbr+ps';
  return (!!track.codec && track.codec !== 'aac') || heAac || track.broken || track.channels > 6;
}

// Argumentos de áudio: copia tudo e converte só o que precisa, mantendo o 5.1.
// Sem a lista de faixas (formato que o ffprobe não lê), converte todas.
function audioArgs(tracks) {
  if (!tracks?.length) return ['-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '192k', '-filter:a', LAYOUTS];
  const args = ['-c:a', 'copy'];
  tracks.forEach((track, i) => {
    if (!needsAudioFix(track)) return;
    args.push(`-c:a:${i}`, 'aac', `-profile:a:${i}`, 'aac_low', `-b:a:${i}`, track.channels > 2 ? '384k' : '192k', `-filter:a:${i}`, LAYOUTS);
  });
  return args;
}

// Primeiro vídeo e TODAS as faixas de áudio (sem isso o dual áudio perde uma)
const mapArgs = output => ['-map', '0:v:0', '-map', '0:a', ...(/\.mkv$/i.test(output) ? ['-map', '0:s?', '-c:s', 'copy'] : [])];

function run(bin, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || err.message).trim().slice(-300) || 'falhou'));
      resolve(stdout);
    });
  });
}

async function probe(ffprobePath, input) {
  const out = await run(ffprobePath, ['-v', 'error', '-show_streams', '-show_format', '-show_data', '-of', 'json', input], 120_000);
  return parseProbe(JSON.parse(out));
}

function buildArgs(input, output, info) {
  const args = ['-hide_banner', '-i', input, '-map', '0:v', '-map', '0:a', '-map', '0:s?', '-c', 'copy'];
  info.audio.forEach((track, i) => {
    if (!track.broken) return;
    args.push(`-c:a:${i}`, 'aac', `-profile:a:${i}`, 'aac_low', `-b:a:${i}`, track.channels > 2 ? '384k' : '192k', `-filter:a:${i}`, LAYOUTS);
  });
  args.push('-movflags', '+faststart', '-y', output);
  return args;
}

// Só aceita o arquivo novo se o defeito sumiu e todo o resto continua igual
function verify(before, after) {
  if (after.videos !== before.videos) return 'o número de faixas de vídeo mudou';
  if (after.audio.length !== before.audio.length) return 'o número de faixas de áudio mudou';
  if (Math.abs(after.duration - before.duration) > 2) return 'a duração mudou';
  for (let i = 0; i < before.audio.length; i++) {
    const a = before.audio[i];
    const b = after.audio[i];
    if (a.broken) {
      if (b.broken || !b.config) return `a faixa ${i + 1} continua com o defeito`;
      if (a.channels > 2 && b.channels < 5) return `a faixa ${i + 1} perdeu o surround`;
    } else if (a.codec !== b.codec || a.channels !== b.channels || a.config !== b.config) {
      return `a faixa ${i + 1}, que estava boa, mudou`;
    }
    if (a.language && a.language !== b.language) return `o idioma da faixa ${i + 1} mudou`;
  }
  return null;
}

async function convert({ ffmpegPath, ffprobePath }, input, output) {
  const before = await probe(ffprobePath, input);
  if (!before.audio.some(t => t.broken)) return { changed: false, before };
  // carregado aqui para os dois arquivos não dependerem um do outro na carga
  await require('./mediaWork').runFfmpeg(ffmpegPath, buildArgs(input, output, before));
  const after = await probe(ffprobePath, output);
  const problem = verify(before, after);
  if (problem) throw new Error('Arquivo novo recusado: ' + problem);
  return { changed: true, before, after };
}

module.exports = { LAYOUTS, channelConfigOf, parseTrack, parseProbe, needsAudioFix, audioArgs, mapArgs, probe, buildArgs, verify, convert };
