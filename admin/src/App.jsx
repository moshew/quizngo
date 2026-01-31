import { useState, useEffect, useRef } from 'react'

// Server configuration
// Get server URL from environment or use default
// For network access, set VITE_SERVER_URL to your machine's IP, e.g., http://192.168.1.100:5000
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://192.168.31.22:5000'

function App() {
  const [hashId, setHashId] = useState(null)
  const [gamePin, setGamePin] = useState(null)
  const [error, setError] = useState(null)
  const [gameActive, setGameActive] = useState(true)
  const hasInitialized = useRef(false)

  // Extract game ID from URL and generate session ID on mount
  useEffect(() => {
    // Prevent double execution in React.StrictMode (development)
    if (hasInitialized.current) {
      console.log('⚠️ useEffect already ran, skipping...')
      return
    }
    hasInitialized.current = true
    
    // Get hash ID from URL path (e.g., /abc123def456)
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    const urlHashId = pathParts[0] // First part after domain
    
    console.log('🔍 Checking for hash ID in URL:', window.location.pathname)
    console.log('📋 Extracted hash ID:', urlHashId)
    
    if (!urlHashId || urlHashId.length < 8) {
      console.error('❌ No valid hash ID found in URL')
      setError('❌ לא נמצא מזהה משחק בכתובת URL')
      return
    }
    
    // Validate hash ID (alphanumeric only)
    if (!/^[a-zA-Z0-9]+$/.test(urlHashId)) {
      console.error('❌ Invalid hash ID format')
      setError('❌ מזהה משחק לא תקין')
      return
    }
    
    console.log('✅ Valid hash ID found:', urlHashId)
    setHashId(urlHashId)
    
    // Check if an active game already exists for this hash
    checkActiveGame(urlHashId)
  }, []) // Empty dependency array = run only once on mount
  
  // Check if an active game exists
  const checkActiveGame = async (hashId) => {
    try {
      console.log('🔍 Checking for active game with hash:', hashId)
      const url = `${SERVER_URL}/?check_active_game&hash_id=${hashId}`
      const response = await fetch(url)
      const data = await response.json()
      
      // Check if presentation exists
      if (data.presentationExists === false) {
        console.error('❌ Presentation not found for hash:', hashId)
        setError('❌ המצגת לא נמצאה - וודא שהמצגת פתוחה ב-PowerPoint')
        setGameActive(false)
        return
      }
      
      if (data.status === 'success' && data.active) {
        // Active game found - use existing game PIN
        console.log('✅ Active game found! Game PIN:', data.gamePin)
        setGamePin(data.gamePin)
      } else {
        // No active game - create new one
        console.log('📝 No active game found, creating new game...')
        const newGamePin = generateGamePin()
        console.log('🎲 Generated new Game PIN:', newGamePin)
        setGamePin(newGamePin)
        
        // Register the new game
        registerGame(hashId, newGamePin)
      }
    } catch (error) {
      console.error('❌ Error checking active game:', error)
      // On error, fallback to creating new game
      const newGamePin = generateGamePin()
      setGamePin(newGamePin)
      registerGame(hashId, newGamePin)
    }
  }

  
  // Generate a 6-digit game PIN
  const generateGamePin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }
  
  // Register game with server (also resets to first slide automatically)
  const registerGame = async (hashId, gamePin) => {
    try {
      console.log('📡 Registering game with server...')
      const url = `${SERVER_URL}/?register_session&hash_id=${hashId}&game_pin=${gamePin}`
      console.log('📤 Sending to:', url)
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'success') {
        console.log('✅ Game registered successfully')
        if (data.resetSent) {
          console.log('✅ Presentation reset to first slide')
        }
      } else {
        console.error('❌ Failed to register game:', data.message)
        alert('⚠️ חיבור למשחק נכשל: ' + data.message)
      }
    } catch (error) {
      console.error('❌ Error registering game:', error)
      alert('⚠️ שגיאה בחיבור לשרת: ' + error.message)
    }
  }

  const handleNextSlide = async () => {
    if (!hashId) {
      alert('❌ אין מזהה משחק')
      return
    }

    try {
      // Send hash ID with the request
      const url = `${SERVER_URL}/?next_slide&hash_id=${hashId}`
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

  const handleResetGame = async () => {
    if (!hashId) {
      alert('❌ אין מזהה משחק')
      return
    }

    try {
      console.log('🔄 Resetting game...')
      
      // Generate new game PIN
      const newGamePin = generateGamePin()
      console.log('🎲 Generated new Game PIN:', newGamePin)
      
      // Register new game (even if one exists) - no check needed
      const url = `${SERVER_URL}/?register_session&hash_id=${hashId}&game_pin=${newGamePin}`
      console.log('📤 Sending to:', url)
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'success') {
        // Update state
        setGamePin(newGamePin)
        setGameActive(true)  // Re-enable the button
        console.log('✅ Game reset successfully')
      } else {
        alert('❌ שגיאה באיתחול: ' + data.message)
      }
    } catch (error) {
      console.error('❌ Error resetting game:', error)
      alert('❌ שגיאה באיתחול: ' + error.message)
    }
  }

  // If there's an error (no game ID), show forbidden
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
          <p style={{ fontSize: '16px', color: '#999' }}>Access Denied</p>
        </div>
      </div>
    )
  }

  // Loading state while checking for hash ID
  if (!hashId) {
    return (
      <div className="admin-container">
        <header>
          <h1>🎮 Kahoot Admin Panel</h1>
        </header>
        <main>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <p>טוען מזהה משחק...</p>
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
          
          <button 
            onClick={handleResetGame}
            style={{
              backgroundColor: '#ff9800',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              fontSize: '24px',
              cursor: 'pointer',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              transition: 'all 0.3s ease',
              marginLeft: '20px'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#f57c00'
              e.target.style.transform = 'scale(1.1)'
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#ff9800'
              e.target.style.transform = 'scale(1)'
            }}
            title="אתחל משחק מחדש"
          >
            🔄
          </button>
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
            backgroundColor: '#f0f8ff',
            padding: '10px 15px',
            borderRadius: '6px',
            border: '2px solid #0078d4'
          }}>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Hash ID</div>
            <code style={{ 
              fontFamily: 'monospace', 
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#0078d4'
            }}>{hashId}</code>
          </div>
          
          {gamePin && (
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
          )}
        </div>
      </header>

      <main>
        <div className="control-panel">
          <h2>בקרת שקפים</h2>
          
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
        </div>
      </main>
    </div>
  )
}

export default App


