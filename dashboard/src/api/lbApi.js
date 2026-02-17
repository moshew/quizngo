const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

export function normalizeBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '')
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...JSON_HEADERS,
      ...(options.headers || {}),
    },
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok || payload?.status === 'error') {
    const errorMessage =
      payload?.message ||
      payload?.error ||
      `Request failed (${response.status})`
    throw new Error(errorMessage)
  }

  return payload
}

export async function fetchServers(lbUrl) {
  const data = await requestJson(`${normalizeBaseUrl(lbUrl)}/api/admin/servers`)
  return data.servers || []
}

export async function fetchPins(lbUrl) {
  const data = await requestJson(`${normalizeBaseUrl(lbUrl)}/api/admin/pins`)
  return data.pins || []
}

export async function drainServer(lbUrl, serverId) {
  return requestJson(
    `${normalizeBaseUrl(lbUrl)}/api/admin/servers/${serverId}/drain`,
    { method: 'POST' },
  )
}

export async function activateServer(lbUrl, serverId) {
  return requestJson(
    `${normalizeBaseUrl(lbUrl)}/api/admin/servers/${serverId}/activate`,
    { method: 'POST' },
  )
}

export async function removeServer(lbUrl, serverId) {
  return requestJson(`${normalizeBaseUrl(lbUrl)}/api/admin/servers/${serverId}`, {
    method: 'DELETE',
  })
}

export async function fetchServerGames(serverAddress) {
  const base = normalizeBaseUrl(serverAddress)
  if (!base) {
    throw new Error('No server address is available for this server.')
  }

  const data = await requestJson(`${base}/sim_gamePIN`)
  return data.games || []
}
