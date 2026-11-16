// Verificação de segurança dos anexos do chat, em camadas:
//
// 1. Tipo de arquivo: bloqueia extensões perigosas (.exe, .apk, .bat...) e
//    também arquivos cujo CONTEÚDO é um executável (PE/ELF/Mach-O), mesmo
//    renomeados pra .jpg/.pdf.
// 2. ClamAV (antivírus): se CLAMAV_HOST estiver configurado, o arquivo é
//    enviado ao clamd (ex.: container "clamav/clamav" na porta 3310).
// 3. VirusTotal: se VIRUSTOTAL_API_KEY estiver configurado, consulta só o
//    HASH SHA-256 (o arquivo em si não sai do servidor) na base do VirusTotal.
//
// Sem ClamAV/VirusTotal configurados, a camada 1 continua valendo.
const net = require('net');
const crypto = require('crypto');
const axios = require('axios');

const BLOCKED_EXT = new Set([
  'exe', 'msi', 'com', 'scr', 'pif', 'bat', 'cmd', 'ps1', 'psm1', 'vbs', 'vbe', 'js', 'jse',
  'wsf', 'wsh', 'hta', 'cpl', 'dll', 'sys', 'jar', 'apk', 'xapk', 'aab', 'app', 'dmg', 'pkg',
  'deb', 'rpm', 'sh', 'bash', 'run', 'bin', 'elf', 'lnk', 'reg', 'inf', 'iso', 'img', 'vhd',
  'msc', 'gadget', 'scf', 'url', 'docm', 'xlsm', 'pptm', 'dotm', 'xlam', 'svg', 'html', 'htm',
]);

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

// Assinaturas (magic bytes) de executáveis
function looksExecutable(buf) {
  if (!buf || buf.length < 4) return false;
  if (buf[0] === 0x4d && buf[1] === 0x5a) return true;                                  // MZ (Windows PE)
  if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true; // ELF
  const be = buf.readUInt32BE(0);
  if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(be)) return true; // Mach-O / Java class
  if (buf[0] === 0x23 && buf[1] === 0x21) return true;                                  // #! script
  return false;
}

function scanClamd(buffer) {
  const host = process.env.CLAMAV_HOST;
  if (!host) return Promise.resolve(null);
  const port = Number(process.env.CLAMAV_PORT || 3310);
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port });
    let reply = '';
    const done = (r) => { try { sock.destroy(); } catch {} resolve(r); };
    sock.setTimeout(60_000, () => done({ engine: 'clamav', error: 'timeout' }));
    sock.on('error', (e) => done({ engine: 'clamav', error: e.message }));
    sock.on('data', (d) => { reply += d.toString(); });
    sock.on('end', () => {
      const text = reply.replace(/\0/g, '').trim();
      if (/FOUND$/.test(text)) {
        done({ engine: 'clamav', infected: true, threat: text.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '') });
      } else if (/OK$/.test(text)) {
        done({ engine: 'clamav', infected: false });
      } else {
        done({ engine: 'clamav', error: text || 'resposta vazia' });
      }
    });
    sock.on('connect', () => {
      sock.write('zINSTREAM\0');
      const CHUNK = 64 * 1024;
      for (let i = 0; i < buffer.length; i += CHUNK) {
        const part = buffer.subarray(i, i + CHUNK);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length, 0);
        sock.write(len);
        sock.write(part);
      }
      sock.write(Buffer.alloc(4)); // fim do stream
    });
  });
}

async function lookupVirusTotal(sha256) {
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) return null;
  try {
    const { data } = await axios.get(`https://www.virustotal.com/api/v3/files/${sha256}`, {
      headers: { 'x-apikey': key }, timeout: 10_000,
    });
    const stats = data?.data?.attributes?.last_analysis_stats || {};
    const bad = (stats.malicious || 0) + (stats.suspicious || 0);
    return { engine: 'virustotal', infected: bad >= 2, detections: bad };
  } catch (e) {
    if (e.response?.status === 404) return { engine: 'virustotal', infected: false, unknown: true };
    return { engine: 'virustotal', error: e.message };
  }
}

/**
 * Retorna { ok: true } ou { ok: false, reason }.
 */
async function scanFile(buffer, originalName) {
  const ext = extOf(originalName);
  if (BLOCKED_EXT.has(ext)) {
    return { ok: false, reason: `Tipo de arquivo não permitido (.${ext})` };
  }
  if (looksExecutable(buffer)) {
    return { ok: false, reason: 'O arquivo contém um programa executável e foi bloqueado' };
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const [clam, vt] = await Promise.all([scanClamd(buffer), lookupVirusTotal(sha256)]);

  if (clam?.infected) return { ok: false, reason: `Vírus detectado (${clam.threat})` };
  if (vt?.infected) return { ok: false, reason: `Arquivo malicioso detectado (${vt.detections} antivírus)` };
  if (clam?.error) console.warn('[virusScan] ClamAV indisponível:', clam.error);
  if (vt?.error) console.warn('[virusScan] VirusTotal indisponível:', vt.error);

  return { ok: true, sha256, engines: [clam, vt].filter(Boolean).map(r => r.engine) };
}

module.exports = { scanFile };
