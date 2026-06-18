const axios = require('axios');

let authCache = null;
let authExpiry = 0;

async function authorize() {
  if (authCache && Date.now() < authExpiry) return authCache;

  const credentials = Buffer.from(
    `${process.env.BACKBLAZE_KEY_ID}:${process.env.BACKBLAZE_APP_KEY}`
  ).toString('base64');

  const { data } = await axios.get(
    'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
    { headers: { Authorization: `Basic ${credentials}` } }
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
    { headers: { Authorization: auth.authorizationToken } }
  );
  return data;
}

async function uploadFile(buffer, filename, contentType = 'video/mp4') {
  const uploadData = await getUploadUrl();

  const sha1 = require('crypto').createHash('sha1').update(buffer).digest('hex');

  const { data } = await axios.post(uploadData.uploadUrl, buffer, {
    headers: {
      Authorization: uploadData.authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(filename),
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      'X-Bz-Content-Sha1': sha1,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return {
    fileId: data.fileId,
    fileName: data.fileName,
    cdnUrl: `${process.env.CDN_BASE_URL}/${filename}`,
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
      { headers: { Authorization: auth.authorizationToken } }
    );

    allFiles.push(...data.files.filter(f => VIDEO_EXTENSIONS.test(f.fileName)));
    nextFileName = data.nextFileName;
  } while (nextFileName && allFiles.length < limit);

  return allFiles;
}

async function startLargeFile(filename, contentType) {
  const auth = await authorize();
  const { data } = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_start_large_file`,
    { bucketId: process.env.BACKBLAZE_BUCKET_ID, fileName: encodeURIComponent(filename), contentType: contentType || 'video/mp4' },
    { headers: { Authorization: auth.authorizationToken } }
  );
  return data;
}

async function getUploadPartUrl(fileId) {
  const auth = await authorize();
  const { data } = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_get_upload_part_url`,
    { fileId },
    { headers: { Authorization: auth.authorizationToken } }
  );
  return data;
}

async function finishLargeFile(fileId, partSha1Array) {
  const auth = await authorize();
  const { data } = await axios.post(
    `${auth.apiUrl}/b2api/v2/b2_finish_large_file`,
    { fileId, partSha1Array },
    { headers: { Authorization: auth.authorizationToken } }
  );
  return data;
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
      { headers: { Authorization: auth.authorizationToken } }
    );
    console.log('[B2] CORS rules configured for browser uploads');
  } catch (err) {
    console.warn('[B2] Could not set CORS rules (key may lack writeBucketSettings):', err.response?.data?.message || err.message);
  }
}

module.exports = { authorize, getUploadUrl, uploadFile, deleteFile, listFiles, setupCors, startLargeFile, getUploadPartUrl, finishLargeFile };
