import { useState, useEffect, useRef } from 'react'

// Load Balancer URL - used to resolve game PIN to server
const DEFAULT_LB_URL = (() => {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://${host}:5000`
  }
  return 'https://srv.quizngo.online'
})()
const LB_URL = (import.meta.env.VITE_LB_URL || DEFAULT_LB_URL).replace(/\/+$/, '')

const formatPin = (pin = '') => (pin.length === 6 ? `${pin.slice(0, 3)}-${pin.slice(3)}` : pin)
const sanitizePin = (value = '') => value.replace(/[^0-9]/g, '').slice(0, 6)
const extractPinFromPath = (pathname = '') => {
  const segments = pathname.split('/').filter(Boolean)
  const pinSegment = [...segments].reverse().find((segment) => /^[0-9]{6}$/.test(segment))
  return pinSegment || ''
}

const SERVER_CODE_MESSAGES_HE = {
  ROOM_NOT_FOUND_ADD_IN_MUST_CREATE_ROOM_FIRST: 'חדר לא נמצא. יש ליצור חדר תחילה.',
  GAME_ALREADY_STARTED: 'המשחק כבר התחיל',
  GAME_SESSION_IS_NOT_ACTIVE_OR_HAS_BEEN_CLOSED: 'המשחק אינו פעיל או נסגר',
  GAME_SESSION_NOT_FOUND: 'סשן משחק לא נמצא',
  GAME_PIN_MUST_BE_6_DIGITS: 'קוד משחק חייב להכיל 6 ספרות',
  MISSING_GAME_PIN: 'חסר קוד משחק',
  SERVER_ERROR: 'שגיאת שרת פנימית',
}

function formatServerMessage(message, fallback = 'שגיאת שרת') {
  if (!message) return fallback
  if (typeof message === 'string') return message

  if (typeof message === 'object') {
    const code = typeof message.code === 'string' ? message.code.toUpperCase() : ''
    if (!code) return fallback

    const params = message.params || {}
    const template = SERVER_CODE_MESSAGES_HE[code] || code.replace(/_/g, ' ').toLowerCase()
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      params[key] !== undefined ? String(params[key]) : '',
    )
  }

  return fallback
}

function AdminShell({ subtitle, children }) {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`

  return (
    <div className="admin-app" dir="ltr">
      <main className="neon-frame">
        <div className="neon-glow neon-glow-orange" />
        <div className="neon-glow neon-glow-green" />
        <div className="scanlines" />

        <div className="brand-lockup">
          <img className="brand-logo" src={logoSrc} alt="QuizNGO" />
          <div className="brand-row">
            <span className="brand-dot" />
            <h1 className="title">QuizNGO_Admin</h1>
            <span className="brand-dot" />
          </div>
        </div>

        <p className="subtitle">{subtitle}</p>
        {children}
      </main>
    </div>
  )
}

function PinBox({ value }) {
  return (
    <div className="pin-chip">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />
      <div className="pin-label">// Game PIN</div>
      <div className="pin-value">{value}</div>
    </div>
  )
}

function App() {
  const [gamePin, setGamePin] = useState(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [gameActive, setGameActive] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [isCheckingPin, setIsCheckingPin] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [serverUrl, setServerUrl] = useState(null)
  const hasInitialized = useRef(false)

  // Check if an active game exists and if it's already started
  const checkActiveGame = async (pin, { updateUrl = false } = {}) => {
    setIsCheckingPin(true)
    setPinError('')

    try {
      console.log('Checking for active game with PIN:', pin)

      // Step 1: Resolve PIN via Load Balancer
      const lbResponse = await fetch(`${LB_URL}/api/resolve/${pin}`)
      const lbData = await lbResponse.json()

      if (!lbResponse.ok || lbData.status !== 'success') {
        console.log('No active game found for PIN:', pin)
        setGamePin(null)
        setGameActive(true)
        setGameStarted(false)
        setPinError('')
        return false
      }

      const resolvedServerUrl = lbData.server_url
      setServerUrl(resolvedServerUrl)

      // Step 2: Check game status on the actual game server
      const url = `${resolvedServerUrl}/?check_active_game&game_pin=${pin}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 'success' && data.active) {
        console.log('Active game found! Game PIN:', pin)
        setGamePin(pin)
        setPinInput(formatPin(pin))
        setGameActive(true)
        setGameStarted(Boolean(data.gameStarted))

        if (updateUrl) {
          window.history.replaceState(null, '', `/admin/${pin}`)
        }

        return true
      }

      console.log('No active game found for PIN:', pin)
      setGamePin(null)
      setGameActive(true)
      setGameStarted(false)
      setPinError('')
      return false
    } catch (err) {
      console.error('Error checking active game:', err)
      setGamePin(null)
      setGameActive(true)
      setGameStarted(false)
      setPinError('שגיאה בבדיקת PIN: ' + err.message)
      return false
    } finally {
      setIsCheckingPin(false)
    }
  }

  // Extract game PIN from URL on mount
  useEffect(() => {
    // Prevent double execution in React.StrictMode (development)
    if (hasInitialized.current) {
      console.log('useEffect already ran, skipping...')
      return
    }
    hasInitialized.current = true

    // Supports /admin/123456 and legacy /123456
    const urlGamePin = extractPinFromPath(window.location.pathname)

    console.log('Checking for game PIN in URL:', window.location.pathname)
    console.log('Extracted game PIN:', urlGamePin)

    if (!urlGamePin) {
      setIsBootstrapping(false)
      return
    }

    if (urlGamePin.length !== 6 || !/^[0-9]+$/.test(urlGamePin)) {
      console.error('Invalid game PIN format')
      setPinError('PIN בכתובת לא תקין, הזן PIN ידני')
      setIsBootstrapping(false)
      return
    }

    checkActiveGame(urlGamePin).finally(() => {
      setIsBootstrapping(false)
    })
  }, [])

  const handlePinSubmit = async (event) => {
    event.preventDefault()

    const cleanedPin = sanitizePin(pinInput)
    if (cleanedPin.length !== 6) {
      setPinError('PIN חייב להכיל 6 ספרות')
      return
    }

    await checkActiveGame(cleanedPin, { updateUrl: true })
  }

  // Handle Start Game button click - calls server to start accepting participants
  const handleStartGame = async () => {
    if (!gamePin || isStartingGame) {
      return
    }

    try {
      setIsStartingGame(true)
      console.log('Starting game with PIN:', gamePin)

      const url = `${serverUrl}/?start_game&game_pin=${gamePin}`
      console.log('Sending to:', url)
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 'success') {
        console.log('Game started successfully!')
        setGameStarted(true)
      } else if (data.status === 'warning') {
        // Game was already started
        console.log('Game was already started')
        setGameStarted(true)
      } else {
        alert('שגיאה בהתחלת המשחק: ' + formatServerMessage(data.message))
      }
    } catch (err) {
      console.error('Error starting game:', err)
      alert('שגיאת רשת: ' + err.message)
    } finally {
      setIsStartingGame(false)
    }
  }

  const handleNextSlide = async () => {
    if (!gamePin) {
      alert('אין PIN משחק')
      return
    }

    try {
      // Send game PIN with the request
      const url = `${serverUrl}/?next_slide&game_pin=${gamePin}`
      console.log('Sending to:', url)
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 'success') {
        // Success - no message needed
      } else if (data.status === 'warning' && data.game_closed) {
        // Game was closed - disable the button silently (no error message)
        console.log('Game closed - disabling next slide button')
        setGameActive(false)
      } else if (data.game_closed) {
        // Game was closed - disable the button
        console.log('Game closed - disabling next slide button')
        setGameActive(false)
      } else if (data.status === 'error') {
        // Only show alerts for actual errors, not warnings
        alert('שגיאה: ' + formatServerMessage(data.message))
      }
    } catch (err) {
      alert('שגיאת רשת: ' + err.message)
    }
  }

  if (isBootstrapping && isCheckingPin) {
    return (
      <AdminShell subtitle="> loading game">
        <div className="spinner" />
      </AdminShell>
    )
  }

  if (!gamePin) {
    return (
      <AdminShell subtitle="> enter pin to connect">
        <form className="pin-form" onSubmit={handlePinSubmit}>
          <label className="input-group">
            <span className="input-label">// PIN</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={7}
              placeholder="123-456"
              value={pinInput}
              onChange={(event) => {
                const cleanedPin = sanitizePin(event.target.value)
                setPinInput(formatPin(cleanedPin))
                if (pinError) {
                  setPinError('')
                }
              }}
              className={`pin-input${pinError ? ' error' : ''}`}
              autoFocus
            />
          </label>

          {pinError && <div className="error-msg">{pinError}</div>}

          <button type="submit" className="btn-primary" disabled={isCheckingPin}>
            {isCheckingPin ? 'Checking...' : 'Connect'}
          </button>
        </form>
      </AdminShell>
    )
  }

  return (
    <AdminShell subtitle="> game control panel">
      <PinBox value={formatPin(gamePin)} />

      <section className="admin-card">
        {!gameStarted ? (
          <button className="btn-primary btn-start" onClick={handleStartGame} disabled={!gameActive || isStartingGame}>
            {isStartingGame ? 'Starting...' : 'Start Game'}
          </button>
        ) : (
          <button className="btn-primary" onClick={handleNextSlide} disabled={!gameActive}>
            Next Slide &gt;
          </button>
        )}
      </section>

      {!gameActive && <p className="admin-note">// session terminated - no more slides</p>}
    </AdminShell>
  )
}

export default App
