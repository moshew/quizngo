import { useState, useEffect, useRef } from 'react'

// Server configuration
// Get server URL from environment or use default
// For network access, set VITE_SERVER_URL to your machine's IP, e.g., http://192.168.1.100:5000
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://192.168.31.22:5000'

function App() {
  const [gamePin, setGamePin] = useState(null)
  const [error, setError] = useState(null)
  const [gameActive, setGameActive] = useState(true)
  const [gameStarted, setGameStarted] = useState(false) // Track if admin clicked "Start Game"
  const [isStartingGame, setIsStartingGame] = useState(false) // Loading state for start button
  const hasInitialized = useRef(false)

  // Extract game PIN from URL on mount
  useEffect(() => {
    // Prevent double execution in React.StrictMode (development)
    if (hasInitialized.current) {
      console.log('⚠️ useEffect already ran, skipping...')
      return
    }
    hasInitialized.current = true
    
    // Get game PIN from URL path (e.g., /123456)
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    const urlGamePin = pathParts[0] // First part after domain
    
    console.log('🔍 Checking for game PIN in URL:', window.location.pathname)
    console.log('📋 Extracted game PIN:', urlGamePin)
    
    if (!urlGamePin || urlGamePin.length !== 6) {
      console.error('❌ No valid game PIN found in URL')
      setError('❌ לא נמצא PIN משחק בכתובת URL')
      return
    }
    
    // Validate game PIN (digits only)
    if (!/^[0-9]+$/.test(urlGamePin)) {
      console.error('❌ Invalid game PIN format')
      setError('❌ PIN משחק לא תקין')
      return
    }
    
    console.log('✅ Valid game PIN found:', urlGamePin)
    setGamePin(urlGamePin)
    
    // Check if an active game exists for this PIN
    checkActiveGame(urlGamePin)
  }, []) // Empty dependency array = run only once on mount
  
  // Check if an active game exists and if it's already started
  const checkActiveGame = async (gamePin) => {
    try {
      console.log('🔍 Checking for active game with PIN:', gamePin)
      const url = `${SERVER_URL}/?check_active_game&game_pin=${gamePin}`
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'success' && data.active) {
        console.log('✅ Active game found! Game PIN:', gamePin)
        setGameActive(true)
        // Check if game is already started (has gameStarted flag)
        if (data.gameStarted) {
          console.log('✅ Game already started, showing next slide button')
          setGameStarted(true)
        }
      } else {
        console.log('⚠️ No active game found for PIN:', gamePin)
        setError('❌ המשחק לא נמצא או לא פעיל')
        setGameActive(false)
      }
    } catch (error) {
      console.error('❌ Error checking active game:', error)
      setError('❌ שגיאה בבדיקת משחק: ' + error.message)
      setGameActive(false)
    }
  }

  // Handle Start Game button click - calls server to start accepting participants
  const handleStartGame = async () => {
    if (!gamePin || isStartingGame) {
      return
    }

    try {
      setIsStartingGame(true)
      console.log('🎮 Starting game with PIN:', gamePin)
      
      const url = `${SERVER_URL}/?start_game&game_pin=${gamePin}`
      console.log('📤 Sending to:', url)
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'success') {
        console.log('✅ Game started successfully!')
        setGameStarted(true)
      } else if (data.status === 'warning') {
        // Game was already started
        console.log('⚠️ Game was already started')
        setGameStarted(true)
      } else {
        alert('❌ שגיאה בהתחלת המשחק: ' + data.message)
      }
    } catch (error) {
      console.error('❌ Error starting game:', error)
      alert('❌ שגיאת רשת: ' + error.message)
    } finally {
      setIsStartingGame(false)
    }
  }

  const handleNextSlide = async () => {
    if (!gamePin) {
      alert('❌ אין PIN משחק')
      return
    }

    try {
      // Send game PIN with the request
      const url = `${SERVER_URL}/?next_slide&game_pin=${gamePin}`
      console.log('📤 Sending to:', url)
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'success') {
        // Success - no message needed
      } else if (data.status === 'warning' && data.game_closed) {
        // Game was closed - disable the button silently (no error message)
        console.log('⚠️ Game closed - disabling next slide button')
        setGameActive(false)
      } else if (data.game_closed) {
        // Game was closed - disable the button
        console.log('⚠️ Game closed - disabling next slide button')
        setGameActive(false)
      } else if (data.status === 'error') {
        // Only show alerts for actual errors, not warnings
        alert('❌ שגיאה: ' + data.message)
      }
    } catch (error) {
      alert('❌ שגיאת רשת: ' + error.message)
    }
  }

  // If there's an error (no game PIN), show forbidden
  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '72px', marginBottom: '20px' }}>🚫</div>
          <h1 style={{ fontSize: '48px', color: '#d13438', marginBottom: '10px' }}>403</h1>
          <h2 style={{ fontSize: '24px', color: '#666', marginBottom: '20px' }}>Forbidden</h2>
          <p style={{ fontSize: '16px', color: '#999' }}>{error}</p>
        </div>
      </div>
    )
  }

  // Loading state while checking for game PIN
  if (!gamePin) {
    return (
      <div className="admin-container">
        <header>
          <h1>🎮 Kahoot Admin Panel</h1>
        </header>
        <main>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <p>טוען משחק...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="admin-container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <h1>🎮 Kahoot Admin Panel</h1>
            <p className="subtitle">לוח בקרה לניהול המשחק</p>
          </div>
        </div>
        
        <div style={{ 
          fontSize: '14px', 
          color: '#333', 
          marginTop: '15px',
          display: 'flex',
          gap: '15px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{
            backgroundColor: '#e8f5e9',
            padding: '10px 15px',
            borderRadius: '6px',
            border: '2px solid #4caf50'
          }}>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Game PIN</div>
            <code style={{ 
              fontFamily: 'monospace', 
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#2e7d32',
              letterSpacing: '2px'
            }}>{gamePin.slice(0, 3) + '-' + gamePin.slice(3)}</code>
          </div>
        </div>
      </header>

      <main>
        <div className="control-panel">
          <h2>בקרת שקפים</h2>
          
          {/* Show "Start Game" button before game starts, then "Next Slide" */}
          {!gameStarted ? (
            <button 
              className="btn btn-primary"
              onClick={handleStartGame}
              disabled={!gameActive || isStartingGame}
              style={{
                opacity: (gameActive && !isStartingGame) ? 1 : 0.5,
                cursor: (gameActive && !isStartingGame) ? 'pointer' : 'not-allowed',
                backgroundColor: '#4caf50'
              }}
            >
              {isStartingGame ? '⏳ מתחיל...' : '🚀 התחל משחק'}
            </button>
          ) : (
            <button 
              className="btn btn-primary"
              onClick={handleNextSlide}
              disabled={!gameActive}
              style={{
                opacity: gameActive ? 1 : 0.5,
                cursor: gameActive ? 'pointer' : 'not-allowed'
              }}
            >
              ➡️ עבור לשקף הבא
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
