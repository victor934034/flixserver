const TIMEOUT_MS = 10000;

async function xcFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`Servidor IPTV retornou erro ${r.status}`);
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function xcGetUserInfo(serverUrl, username, password) {
  const url = `${serverUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  return xcFetch(url);
}

export async function xcGetCategories(serverUrl, username, password) {
  const url = `${serverUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`;
  return xcFetch(url);
}

export async function xcGetStreams(serverUrl, username, password, categoryId) {
  let url = `${serverUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
  if (categoryId) url += `&category_id=${encodeURIComponent(categoryId)}`;
  return xcFetch(url);
}

export function xcStreamUrl(serverUrl, username, password, streamId) {
  return `${serverUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.ts`;
}
