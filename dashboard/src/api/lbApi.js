const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

const SERVER_CODE_MESSAGES = {
  SERVER_NOT_FOUND: 'Server not found',
  SERVER_MARKED_AS_DRAINING: 'Server marked as draining',
  SERVER_REACTIVATED: 'Server reactivated',
  SERVER_REMOVED: 'Server removed',
  ADDRESS_IS_REQUIRED: 'address is required',
  STATS_DATA_REQUIRED: 'Stats data required',
  GAME_PIN_IS_REQUIRED: 'game_pin is required',
  NO_ACTIVE_SERVERS_AVAILABLE: 'No active servers available',
  GAME_PIN_NOT_FOUND: 'Game PIN not found',
  GAME_SERVER_IS_UNAVAILABLE: 'Game server is unavailable',
  SERVER_ERROR: 'Server error',
}

function formatServerMessage(message) {
  if (!message) return ''
  if (typeof message === 'string') return message

  if (typeof message === 'object') {
    const code = typeof message.code === 'string' ? message.code.toUpperCase() : ''
    if (!code) return ''

    const params = message.params || {}
    const template = SERVER_CODE_MESSAGES[code] || code.replace(/_/g, ' ').toLowerCase()
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      params[key] !== undefined ? String(params[key]) : '',
    )
  }

  return ''
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
      formatServerMessage(payload?.message) ||
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
