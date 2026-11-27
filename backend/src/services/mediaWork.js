// Cuidados para o conserto de vídeos não derrubar o servidor, que é o mesmo que
// atende o app: um trabalho pesado por vez, ffmpeg com prioridade baixa e
// conferência de espaço em disco antes de baixar.
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const axios = require('axios');
const { pipeline } = require('stream/promises');

let owner = null;

// Devolve a função que libera a vez, ou null se outro conserto está rodando
function takeTurn(name) {
  if (owner) return null;
  owner = name;
  return () => { if (owner === name) owner = null; };
}
const busyWith = () => owner;

// ffmpeg "educado": poucas threads, prioridade baixa e só os erros no log (o log
// completo de um filme estoura o limite de memória e mata a conversão no meio)
function runFfmpeg(bin, args, timeout = 3 * 3600_000) {
  return new Promise((resolve, reject) => {
    const proc = execFile(bin, ['-nostdin', '-loglevel', 'error', '-threads', '2', ...args],
      { timeout, killSignal: 'SIGKILL', maxBuffer: 5 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (!err) return resolve(stdout);
        const why = err.killed ? 'passou do tempo limite' : err.signal ? `foi encerrado (${err.signal}), provavelmente por falta de memória` : '';
        reject(new Error(why ? `A conversão ${why}` : String(stderr || err.message).trim().slice(-300) || 'falhou'));
      });
    try { os.setPriority(proc.pid, 10); } catch {}
  });
}

// Baixar e converter precisa de espaço para duas cópias do arquivo
function assertDiskSpace(size, dir = os.tmpdir()) {
  if (!size || !fs.statfsSync) return;
  const { bavail, bsize } = fs.statfsSync(dir);
  const free = bavail * bsize;
  const needed = size * 2 + 500 * 1024 * 1024;
  if (free < needed) {
    const gb = n => (n / 1024 ** 3).toFixed(1);
    throw new Error(`Falta espaço no servidor: precisa de ${gb(needed)} GB e há ${gb(free)} GB livres`);
  }
}

// Baixa para um arquivo, confere o espaço antes e desiste se a conexão parar
async function downloadFile(url, dest, { idleMs = 120_000 } = {}) {
  const abort = new AbortController();
  let idle = setTimeout(() => abort.abort(), idleMs);
  try {
    const res = await axios.get(url, { responseType: 'stream', timeout: idleMs, signal: abort.signal });
    const expected = Number(res.headers['content-length']) || 0;
    try { assertDiskSpace(expected); } catch (e) { res.data.destroy(); throw e; }
    res.data.on('data', () => { clearTimeout(idle); idle = setTimeout(() => abort.abort(), idleMs); });
    await pipeline(res.data, fs.createWriteStream(dest), { signal: abort.signal });
    if (expected && fs.statSync(dest).size !== expected) throw new Error('Download incompleto');
  } catch (e) {
    if (abort.signal.aborted) throw new Error('O download parou de responder');
    throw e;
  } finally {
    clearTimeout(idle);
  }
}

// Sobras de um conserto interrompido por reinício ocupariam o disco para sempre
function cleanLeftovers(dir = os.tmpdir()) {
  try {
    for (const name of fs.readdirSync(dir)) {
      if (/^(aac_(in|out)_|mediafix_(in|out)_|fh_fsa_)/.test(name)) { try { fs.unlinkSync(`${dir}/${name}`); } catch {} }
    }
  } catch {}
}

module.exports = { takeTurn, busyWith, runFfmpeg, assertDiskSpace, downloadFile, cleanLeftovers };
