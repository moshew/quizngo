import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  activateServer,
  drainServer,
  fetchPins,
  fetchServerGames,
  fetchServers,
  normalizeBaseUrl,
  removeServer,
} from './api/lbApi'
import './App.css'

const DEFAULT_LB_URL =
  normalizeBaseUrl(import.meta.env.VITE_LB_URL) || `http://${window.location.hostname}:5000`

const AUTO_REFRESH_OPTIONS = [
  { label: 'כבוי', value: 0 },
  { label: '5 שניות', value: 5000 },
  { label: '10 שניות', value: 10000 },
  { label: '30 שניות', value: 30000 },
]

function formatNumber(value, digits = 0) {
  const numericValue = Number(value || 0)
  return numericValue.toLocaleString('he-IL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatDate(unixSeconds) {
  if (!unixSeconds) return '-'
  return new Date(unixSeconds * 1000).toLocaleString('he-IL')
}

function relativeTime(unixSeconds) {
  if (!unixSeconds) return '-'
  const delta = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds))
  if (delta < 60) return `${delta}s ago`
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`
  return `${Math.floor(delta / 86400)}d ago`
}

function statusClass(status) {
  switch (status) {
    case 'active':
      return 'is-active'
    case 'draining':
      return 'is-draining'
    case 'down':
      return 'is-down'
    default:
      return 'is-unknown'
  }
}

function pointsToPolyline(points, maxValue, width, height) {
  if (!points.length) return ''
  const safeMax = Math.max(maxValue, 1)
  return points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width
      const y = height - (Math.max(value, 0) / safeMax) * height
      return `${x},${y}`
    })
    .join(' ')
}

function MetricChart({ title, value, suffix, points, color, maxHint }) {
  const width = 220
  const height = 74
  const maxValue = Math.max(maxHint || 0, ...points, 1)
  const polyline = pointsToPolyline(points, maxValue, width, height)
  const latest = points.length ? points[points.length - 1] : 0

  return (
    <article className="chart-card">
      <header>
        <span>{title}</span>
        <strong>
          {formatNumber(latest, 1)}
          {suffix}
        </strong>
      </header>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1="0" y1={height} x2={width} y2={height} className="chart-base" />
        {polyline ? (
          <polyline
            points={polyline}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <p className="chart-value">
        עכשיו: {formatNumber(value, 1)}
        {suffix}
      </p>
    </article>
  )
}

function App() {
  const [lbUrl, setLbUrl] = useState(DEFAULT_LB_URL)
  const [lbUrlInput, setLbUrlInput] = useState(DEFAULT_LB_URL)
  const [viewMode, setViewMode] = useState('table')
  const [autoRefreshMs, setAutoRefreshMs] = useState(10000)
  const [servers, setServers] = useState([])
  const [pins, setPins] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [history, setHistory] = useState([])
  const [actionBusy, setActionBusy] = useState({})
  const [gamesPanel, setGamesPanel] = useState({
    serverId: null,
    address: '',
    loading: false,
    error: '',
    games: [],
  })

  const totals = useMemo(() => {
    const totalServers = servers.length
    const activeServers = servers.filter((server) => server.status === 'active').length
    const drainingServers = servers.filter((server) => server.status === 'draining').length
    const downServers = servers.filter((server) => server.status === 'down').length
    const totalWsConnections = servers.reduce(
      (sum, server) => sum + Number(server.stats?.active_ws_connections || 0),
      0,
    )
    const totalGames = servers.reduce(
      (sum, server) => sum + Number(server.stats?.active_games_count || 0),
      0,
    )
    const totalMemory = servers.reduce(
      (sum, server) => sum + Number(server.stats?.memory_mb || 0),
      0,
    )
    const avgCpu =
      totalServers > 0
        ? servers.reduce((sum, server) => sum + Number(server.stats?.cpu_percent || 0), 0) /
          totalServers
        : 0

    return {
      totalServers,
      activeServers,
      drainingServers,
      downServers,
      totalWsConnections,
      totalGames,
      totalMemory,
      avgCpu,
      totalPins: pins.length,
    }
  }, [servers, pins])

  const refreshData = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError('')

      try {
        const [serversResponse, pinsResponse] = await Promise.all([
          fetchServers(lbUrl),
          fetchPins(lbUrl),
        ])

        const sortedServers = [...serversResponse].sort((a, b) => {
          const byStatus = (a.status || '').localeCompare(b.status || '')
          if (byStatus !== 0) return byStatus
          return (a.server_id || '').localeCompare(b.server_id || '')
        })

        setServers(sortedServers)
        setPins(pinsResponse)
        setLastUpdatedAt(new Date())

        const snapshot = {
          timestamp: Date.now(),
          avgCpu:
            sortedServers.length > 0
              ? sortedServers.reduce(
                  (sum, server) => sum + Number(server.stats?.cpu_percent || 0),
                  0,
                ) / sortedServers.length
              : 0,
          totalMemory: sortedServers.reduce(
            (sum, server) => sum + Number(server.stats?.memory_mb || 0),
            0,
          ),
          totalWsConnections: sortedServers.reduce(
            (sum, server) => sum + Number(server.stats?.active_ws_connections || 0),
            0,
          ),
          totalGames: sortedServers.reduce(
            (sum, server) => sum + Number(server.stats?.active_games_count || 0),
            0,
          ),
        }

        setHistory((previous) => [...previous.slice(-29), snapshot])
      } catch (requestError) {
        setError(requestError.message || 'Failed to fetch server status')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [lbUrl],
  )

  useEffect(() => {
    refreshData()
  }, [refreshData])

  useEffect(() => {
    if (!autoRefreshMs) return undefined
    const timer = setInterval(() => {
      refreshData({ silent: true })
    }, autoRefreshMs)
    return () => clearInterval(timer)
  }, [autoRefreshMs, refreshData])

  async function onServerAction(server, actionName) {
    if (actionName === 'remove') {
      const shouldRemove = window.confirm(
        `להסיר את ${server.server_id} מהרשימה? כל ה-PINs המשויכים יוסרו.`,
      )
      if (!shouldRemove) return
    }

    const busyKey = `${server.server_id}:${actionName}`
    setActionBusy((prev) => ({ ...prev, [busyKey]: true }))
    setFeedback('')

    try {
      if (actionName === 'drain') {
        await drainServer(lbUrl, server.server_id)
        setFeedback(`השרת ${server.server_id} עבר למצב draining.`)
      } else if (actionName === 'activate') {
        await activateServer(lbUrl, server.server_id)
        setFeedback(`השרת ${server.server_id} הופעל מחדש.`)
      } else if (actionName === 'remove') {
        await removeServer(lbUrl, server.server_id)
        setFeedback(`השרת ${server.server_id} הוסר.`)
      }

      await refreshData({ silent: true })
    } catch (actionError) {
      setError(actionError.message || 'פעולת שרת נכשלה')
    } finally {
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }))
    }
  }

  async function showServerGames(server) {
    setGamesPanel({
      serverId: server.server_id,
      address: server.address || '',
      loading: true,
      error: '',
      games: [],
    })

    try {
      const games = await fetchServerGames(server.address)
      setGamesPanel({
        serverId: server.server_id,
        address: server.address || '',
        loading: false,
        error: '',
        games,
      })
    } catch (gamesError) {
      setGamesPanel({
        serverId: server.server_id,
        address: server.address || '',
        loading: false,
        error: gamesError.message || 'טעינת משחקים נכשלה',
        games: [],
      })
    }
  }

  function applyLbUrl() {
    const nextUrl = normalizeBaseUrl(lbUrlInput)
    if (!nextUrl) {
      setError('יש להזין כתובת תקינה ל-Load Balancer')
      return
    }
    setFeedback('')
    setLbUrl(nextUrl)
  }

  const cpuPoints = history.map((item) => item.avgCpu)
  const memoryPoints = history.map((item) => item.totalMemory)
  const wsPoints = history.map((item) => item.totalWsConnections)
  const gamesPoints = history.map((item) => item.totalGames)

  return (
    <main className="dashboard" dir="rtl">
      <div className="background-blur background-blur-one" />
      <div className="background-blur background-blur-two" />

      <section className="top-panel">
        <div className="heading">
          <p>Dashboard</p>
          <h1>סטאטוס ריצה לשרתי srv-lb</h1>
          <span>
            עודכן לאחרונה:{' '}
            {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('he-IL') : '-'}
          </span>
        </div>

        <div className="top-controls">
          <label className="field">
            <span>כתובת Load Balancer</span>
            <div className="field-row">
              <input
                value={lbUrlInput}
                onChange={(event) => setLbUrlInput(event.target.value)}
                placeholder={`http://${window.location.hostname}:5000`}
              />
              <button type="button" onClick={applyLbUrl}>
                החל
              </button>
            </div>
          </label>

          <label className="field field-small">
            <span>רענון אוטומטי</span>
            <select
              value={autoRefreshMs}
              onChange={(event) => setAutoRefreshMs(Number(event.target.value))}
            >
              {AUTO_REFRESH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="actions">
            <button
              type="button"
              onClick={() => refreshData({ silent: true })}
              disabled={refreshing}
            >
              {refreshing ? 'מרענן...' : 'Refresh'}
            </button>
            <button
              type="button"
              className={viewMode === 'table' ? 'is-selected' : ''}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
            <button
              type="button"
              className={viewMode === 'cards' ? 'is-selected' : ''}
              onClick={() => setViewMode('cards')}
            >
              Cards
            </button>
          </div>
        </div>
      </section>

      {error ? <p className="banner is-error">{error}</p> : null}
      {feedback ? <p className="banner is-info">{feedback}</p> : null}

      <section className="stats-grid">
        <article className="stat-box">
          <span>סה״כ שרתים</span>
          <strong>{formatNumber(totals.totalServers)}</strong>
          <small>
            active: {totals.activeServers} | draining: {totals.drainingServers} | down:{' '}
            {totals.downServers}
          </small>
        </article>
        <article className="stat-box">
          <span>חיבורי WS</span>
          <strong>{formatNumber(totals.totalWsConnections)}</strong>
          <small>שחקנים מחוברים כרגע</small>
        </article>
        <article className="stat-box">
          <span>משחקים פעילים</span>
          <strong>{formatNumber(totals.totalGames)}</strong>
          <small>PINs פעילים: {formatNumber(totals.totalPins)}</small>
        </article>
        <article className="stat-box">
          <span>שימוש משאבים</span>
          <strong>
            CPU {formatNumber(totals.avgCpu, 1)}% | RAM {formatNumber(totals.totalMemory, 1)}MB
          </strong>
          <small>ממוצע CPU, סכום Memory</small>
        </article>
      </section>

      <section className="charts-grid">
        <MetricChart
          title="CPU ממוצע"
          value={totals.avgCpu}
          suffix="%"
          points={cpuPoints}
          color="#ff8a3d"
          maxHint={100}
        />
        <MetricChart
          title="Memory סה״כ"
          value={totals.totalMemory}
          suffix="MB"
          points={memoryPoints}
          color="#00a7b5"
          maxHint={Math.max(1, totals.totalMemory)}
        />
        <MetricChart
          title="WebSocket חיבורים"
          value={totals.totalWsConnections}
          suffix=""
          points={wsPoints}
          color="#18a957"
          maxHint={Math.max(1, totals.totalWsConnections)}
        />
        <MetricChart
          title="משחקים פעילים"
          value={totals.totalGames}
          suffix=""
          points={gamesPoints}
          color="#f43e3e"
          maxHint={Math.max(1, totals.totalGames)}
        />
      </section>

      <section className="servers-panel">
        <header>
          <h2>רשימת שרתים</h2>
          <span>{loading ? 'טוען נתונים...' : `${servers.length} שרתים`}</span>
        </header>

        {viewMode === 'table' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Server ID</th>
                  <th>כתובת</th>
                  <th>סטאטוס</th>
                  <th>שחקנים/WS</th>
                  <th>משחקים</th>
                  <th>CPU</th>
                  <th>Memory</th>
                  <th>PINs</th>
                  <th>Heartbeat</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((server) => {
                  const activePins = server.active_pins || []
                  return (
                    <tr key={server.server_id}>
                      <td>{server.server_id}</td>
                      <td className="mono">{server.address || '-'}</td>
                      <td>
                        <span className={`status-chip ${statusClass(server.status)}`}>
                          {server.status || 'unknown'}
                        </span>
                      </td>
                      <td>{formatNumber(server.stats?.active_ws_connections)}</td>
                      <td>{formatNumber(server.stats?.active_games_count)}</td>
                      <td>{formatNumber(server.stats?.cpu_percent, 1)}%</td>
                      <td>{formatNumber(server.stats?.memory_mb, 1)}MB</td>
                      <td>
                        <div>{activePins.length}</div>
                        <small className="pins-preview">
                          {activePins.slice(0, 3).join(', ') || '-'}
                        </small>
                      </td>
                      <td title={formatDate(server.last_heartbeat)}>
                        {relativeTime(server.last_heartbeat)}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" onClick={() => showServerGames(server)}>
                            משחקים
                          </button>
                          {server.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => onServerAction(server, 'drain')}
                              disabled={actionBusy[`${server.server_id}:drain`]}
                            >
                              עצור פתיחה
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onServerAction(server, 'activate')}
                              disabled={actionBusy[`${server.server_id}:activate`]}
                            >
                              הפעל
                            </button>
                          )}
                          <button
                            type="button"
                            className="danger"
                            onClick={() => onServerAction(server, 'remove')}
                            disabled={actionBusy[`${server.server_id}:remove`]}
                          >
                            הסר
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cards-grid">
            {servers.map((server) => (
              <article key={server.server_id} className="server-card">
                <header>
                  <strong>{server.server_id}</strong>
                  <span className={`status-chip ${statusClass(server.status)}`}>
                    {server.status || 'unknown'}
                  </span>
                </header>
                <p className="mono">{server.address || '-'}</p>
                <ul>
                  <li>WS: {formatNumber(server.stats?.active_ws_connections)}</li>
                  <li>Games: {formatNumber(server.stats?.active_games_count)}</li>
                  <li>CPU: {formatNumber(server.stats?.cpu_percent, 1)}%</li>
                  <li>Memory: {formatNumber(server.stats?.memory_mb, 1)}MB</li>
                  <li>PINs: {formatNumber(server.active_pins?.length)}</li>
                  <li title={formatDate(server.registered_at)}>
                    נרשם: {relativeTime(server.registered_at)}
                  </li>
                </ul>
                <div className="card-actions">
                  <button type="button" onClick={() => showServerGames(server)}>
                    משחקים
                  </button>
                  {server.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => onServerAction(server, 'drain')}
                      disabled={actionBusy[`${server.server_id}:drain`]}
                    >
                      עצור פתיחה
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onServerAction(server, 'activate')}
                      disabled={actionBusy[`${server.server_id}:activate`]}
                    >
                      הפעל
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {gamesPanel.serverId ? (
        <section className="games-panel">
          <header>
            <div>
              <h3>משחקים בשרת {gamesPanel.serverId}</h3>
              <span className="mono">{gamesPanel.address}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setGamesPanel({
                  serverId: null,
                  address: '',
                  loading: false,
                  error: '',
                  games: [],
                })
              }
            >
              סגור
            </button>
          </header>

          {gamesPanel.loading ? <p>טוען משחקים...</p> : null}
          {gamesPanel.error ? <p className="banner is-error">{gamesPanel.error}</p> : null}

          {!gamesPanel.loading && !gamesPanel.error ? (
            gamesPanel.games.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Game PIN</th>
                      <th>Active</th>
                      <th>Game Started</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gamesPanel.games.map((game) => (
                      <tr key={game.gamePin}>
                        <td className="mono">{game.gamePin}</td>
                        <td>{game.active ? 'Yes' : 'No'}</td>
                        <td>{game.gameStarted ? 'Yes' : 'No'}</td>
                        <td>
                          {game.timestamp
                            ? new Date(game.timestamp * 1000).toLocaleString('he-IL')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>לא נמצאו משחקים פעילים/ממתינים על השרת.</p>
            )
          ) : null}
        </section>
      ) : null}
    </main>
  )
}

export default App
