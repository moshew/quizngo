import { useState, useEffect, useRef } from 'react'

// Load Balancer URL - used to resolve game PIN to server
const LB_URL = import.meta.env.VITE_LB_URL || `http://${window.location.hostname}:5000`

const formatPin = (pin = '') => (pin.length === 6 ? `${pin.slice(0, 3)}-${pin.slice(3)}` : pin)
const sanitizePin = (value = '') => value.replace(/[^0-9]/g, '').slice(0, 6)

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
          window.history.replaceState(null, '', '/' + pin)
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

    // Get game PIN from URL path (e.g., /123456)
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    const urlGamePin = pathParts[0]

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
        alert('שגיאה בהתחלת המשחק: ' + data.message)
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
        alert('שגיאה: ' + data.message)
      }
    } catch (err) {
      alert('שגיאת רשת: ' + err.message)
    }
  }

  if (isBootstrapping && isCheckingPin) {
    return (
      <div className="admin-app" dir="rtl">
        <div className="screen">
          <h1 className="title">QuizNGO Admin</h1>
          <p className="subtitle">טוען משחק...</p>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  if (!gamePin) {
    return (
      <div className="admin-app" dir="rtl">
        <div className="screen">
          <h1 className="title">QuizNGO Admin</h1>
          <p className="subtitle">הכנס PIN משחק כדי להתחבר</p>

          <form className="pin-form" onSubmit={handlePinSubmit}>
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

            {pinError && <div className="error-msg">{pinError}</div>}

            <button type="submit" className="btn-primary" disabled={isCheckingPin}>
              {isCheckingPin ? 'בודק...' : 'התחבר'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-app" dir="rtl">
      <div className="screen">
        <h1 className="title">QuizNGO Admin</h1>
        <p className="subtitle">לוח בקרה לניהול המשחק</p>

        <div className="pin-chip">
          <div className="pin-label">Game PIN</div>
          <div className="pin-value">{formatPin(gamePin)}</div>
        </div>

        <div className="admin-card">
          <h2 className="admin-card-title">בקרת שקפים</h2>

          {!gameStarted ? (
            <button className="btn-primary" onClick={handleStartGame} disabled={!gameActive || isStartingGame}>
              {isStartingGame ? 'מתחיל...' : 'התחל משחק'}
            </button>
          ) : (
            <button className="btn-primary" onClick={handleNextSlide} disabled={!gameActive}>
              עבור לשקף הבא
            </button>
          )}

          {!gameActive && <p className="admin-note">המשחק נסגר ואי אפשר להמשיך שקפים.</p>}
        </div>
      </div>
    </div>
  )
}

export default App
