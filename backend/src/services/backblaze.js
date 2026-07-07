const axios = require('axios');

const B2_API_TIMEOUT = 30_000; // 30s para chamadas de API do B2 (não upload de dados)

// Remove acentos/cedilha e troca espacos por ponto
function sanitizeFilename(name) {
  const slash = name.lastIndexOf('/');
  const dir = slash >= 0 ? name.slice(0, slash + 1) : '';
  const base = slash >= 0 ? name.slice(slash + 1) : name;
  const clean = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '');
  return dir + clean;
}

let authCache = null;
let authExpiry = 0;
let bucketNameCache = null;

async function authorize() {
  if (authCache && Date.now() < authExpiry) return authCache;

  const credentials = Buffer.from(
    `${process.env.BACKBLAZE_KEY_ID}:${process.env.BACKBLAZE_APP_KEY}`
  ).toString('base64');

  const { data } = await axios.get(
    'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
    { headers: { Authorization: `Basic ${credentials}` }, timeout: B2_API_TIMEOUT }
  );

  authCache = data;
  authExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23h cache
  return data;
}

async function getUploadUrl() {
  const auth = await authorize();
  const { data } = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_get_upload_url`,
    { bucketId: process.env.BACKBLAZE_BUCKET_ID },
    { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
  );
  return data;
}

async function uploadFile(buffer, filename, contentType = 'video/mp4') {
  const clean = sanitizeFilename(filename);
  const uploadData = await getUploadUrl();

  const sha1 = require('crypto').createHash('sha1').update(buffer).digest('hex');

  const { data } = await axios.post(uploadData.uploadUrl, buffer, {
    headers: {
      Authorization: uploadData.authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(clean),
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'X-Bz-Content-Sha1': sha1,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return {
    fileId: data.fileId,
    fileName: clean,
    cdnUrl: `${process.env.CDN_BASE_URL}/${encodeURIComponent(clean)}`,
  };
}

async function deleteFile(fileId, fileName) {
  const auth = await authorize();
  await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_delete_file_version`,
    { fileId, fileName },
    { headers: { Authorization: auth.authorizationToken } }
  );
}

// Lista todos os arquivos HLS (.ts e .m3u8) sem filtro de extensão de vídeo
async function listHlsFiles() {
  const auth = await authorize();
  const allFiles = [];
  let nextFileName = null;

  do {
    const body = { bucketId: process.env.BACKBLAZE_BUCKET_ID, maxFileCount: 1000 };
    if (nextFileName) body.startFileName = nextFileName;

    const { data } = await axios.post(
      `${auth.apiUrl}/b2api/v2/b2_list_file_names`,
      body,
      { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
    );

    allFiles.push(...data.files.filter(f => /\.(ts|m3u8)$/i.test(f.fileName)));
    nextFileName = data.nextFileName;
  } while (nextFileName);

  return allFiles;
}

const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|mov|m4v|webm|ts|wmv)$/i;

async function listFiles(prefix = '', limit = 1000) {
  const auth = await authorize();
  const allFiles = [];
  let nextFileName = null;

  do {
    const body = { bucketId: process.env.BACKBLAZE_BUCKET_ID, maxFileCount: 1000 };
    if (prefix) body.prefix = prefix;
    if (nextFileName) body.startFileName = nextFileName;

    const { data } = await axios.post(
      `${auth.apiUrl}/b2api/v2/b2_list_file_names`,
      body,
      { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
    );

    allFiles.push(...data.files.filter(f => VIDEO_EXTENSIONS.test(f.fileName)));
    nextFileName = data.nextFileName;
  } while (nextFileName && allFiles.length < limit);

  return allFiles;
}

async function startLargeFile(filename, contentType) {
  const clean = sanitizeFilename(filename);
  const auth = await authorize();
  const { data } = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_start_large_file`,
    { bucketId: process.env.BACKBLAZE_BUCKET_ID, fileName: clean, contentType: contentType || 'video/mp4' },
    { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
  );
  return { ...data, sanitizedFileName: clean };
}

async function getUploadPartUrl(fileId) {
  const auth = await authorize();
  const { data } = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_get_upload_part_url`,
    { fileId },
    { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
  );
  return data;
}

async function listParts(fileId) {
  const auth = await authorize();
  const allParts = [];
  let startPartNumber = 1;
  while (true) {
    const { data } = await axios.post(
      `${auth.apiUrl}/b2api/v2/b2_list_parts`,
      { fileId, maxPartCount: 1000, startPartNumber },
      { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
    );
    allParts.push(...data.parts);
    if (!data.nextPartNumber) break;
    startPartNumber = data.nextPartNumber;
  }
  return allParts; // [{partNumber, contentSha1, contentLength}]
}

async function finishLargeFile(fileId, partSha1Array) {
  const auth = await authorize();
  const { data } = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_finish_large_file`,
    { fileId, partSha1Array },
    { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
  );
  return data;
}

// Cópia server-side no B2 (sem usar banda — ideal para reorganizar arquivos)
async function copyFile(sourceFileId, newFileName) {
  const auth = await authorize();
  const { data } = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_copy_file`,
    { sourceFileId, fileName: newFileName, destinationBucketId: process.env.BACKBLAZE_BUCKET_ID },
    { headers: { Authorization: auth.authorizationToken }, timeout: 600_000 } // 10 min para arquivos grandes
  );
  return data; // { fileId, fileName, ... }
}

async function setupCors() {
  try {
    const auth = await authorize();
    await axios.post(
      `${auth.apiUrl}/b2api/v2/b2_update_bucket`,
      {
        accountId: auth.accountId,
        bucketId: process.env.BACKBLAZE_BUCKET_ID,
        corsRules: [{
          corsRuleName: 'allowBrowserUploads',
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          allowedOperations: ['b2_upload_file', 'b2_upload_part'],
          exposeHeaders: ['x-bz-file-name', 'x-bz-content-sha1', 'authorization'],
          maxAgeSeconds: 3600,
        }],
      },
      { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
    );
    console.log('[B2] CORS rules configured for browser uploads');
  } catch (err) {
    console.warn('[B2] Could not set CORS rules (key may lack writeBucketSettings):', err.response?.data?.message || err.message);
  }
}

// Upload de arquivo local para B2 usando multipart (100 MB por parte)
// Não carrega o arquivo inteiro na memória — ideal para remux de grandes vídeos
async function uploadFileFromPath(filePath, filename, contentType = 'video/mp4') {
  const crypto = require('crypto');
  const PART_SIZE = 100 * 1024 * 1024; // 100 MB

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  // Arquivos pequenos: upload direto (sem multipart)
  if (fileSize <= PART_SIZE) {
    const buffer = fs.readFileSync(filePath);
    return uploadFile(buffer, filename, contentType);
  }

  // Arquivos grandes: multipart
  const auth = await authorize();
  const startRes = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_start_large_file`,
    { bucketId: process.env.BACKBLAZE_BUCKET_ID, fileName: encodeURIComponent(filename), contentType },
    { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
  );
  const fileId = startRes.data.fileId;

  const partCount = Math.ceil(fileSize / PART_SIZE);
  const partSha1Array = [];
  const fd = fs.openSync(filePath, 'r');

  try {
    for (let i = 0; i < partCount; i++) {
      const offset = i * PART_SIZE;
      const length = Math.min(PART_SIZE, fileSize - offset);
      const chunk = Buffer.alloc(length);
      fs.readSync(fd, chunk, 0, length, offset);

      const sha1 = crypto.createHash('sha1').update(chunk).digest('hex');

      const partUrlRes = await axios.post(
        `${auth.apiUrl}/b2api/v2/b2_get_upload_part_url`,
        { fileId },
        { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
      );

      await axios.post(partUrlRes.data.uploadUrl, chunk, {
        headers: {
          Authorization: partUrlRes.data.authorizationToken,
          'X-Bz-Part-Number': i + 1,
          'Content-Length': length,
          'X-Bz-Content-Sha1': sha1,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      partSha1Array.push(sha1);
      console.log(`[B2] parte ${i + 1}/${partCount} enviada (${Math.round(length / 1024 / 1024)} MB)`);
    }
  } finally {
    fs.closeSync(fd);
  }

  await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_finish_large_file`,
    { fileId, partSha1Array },
    { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
  );

  return {
    fileId,
    fileName: filename,
    cdnUrl: `${process.env.CDN_BASE_URL}/${encodeURIComponent(filename)}`,
  };
}

// Retorna a URL de download direta do B2 (sem passar pelo CDN Cloudflare).
// Útil para operações de backend (ffprobe/ffmpeg) que não suportam Cloudflare Workers.
async function getDirectDownloadInfo(filename) {
  const auth = await authorize();

  // Obtém o nome do bucket uma vez (fica em cache)
  if (!bucketNameCache) {
    const { data } = await axios.post(
      `${auth.apiUrl}/b2api/v2/b2_list_buckets`,
      { accountId: auth.accountId, bucketId: process.env.BACKBLAZE_BUCKET_ID },
      { headers: { Authorization: auth.authorizationToken }, timeout: B2_API_TIMEOUT }
    );
    bucketNameCache = data.buckets?.[0]?.bucketName;
  }

  // Inclui o token como query param — FFmpeg acessa sem precisar de header customizado
  const encodedPath = filename.split('/').map(encodeURIComponent).join('/');
  const base = `${auth.downloadUrl}/file/${bucketNameCache}/${encodedPath}`;
  return {
    url: `${base}?Authorization=${encodeURIComponent(auth.authorizationToken)}`,
    token: auth.authorizationToken,
  };
}

const fs = require('fs');

module.exports = { authorize, getUploadUrl, uploadFile, uploadFileFromPath, deleteFile, listFiles, listHlsFiles, setupCors, startLargeFile, getUploadPartUrl, listParts, finishLargeFile, getDirectDownloadInfo, sanitizeFilename, copyFile };
