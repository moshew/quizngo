import { useState, useEffect, useRef } from 'react'

// Server configuration
// Get server URL from environment or use default
// For network access, set VITE_SERVER_URL to your machine's IP, e.g., http://192.168.1.100:5000
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://192.168.31.22:5000'

function App() {
  const [status, setStatus] = useState('')
  const [gameId, setGameId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [error, setError] = useState(null)
  const hasInitialized = useRef(false)

  // Extract game ID from URL and generate session ID on mount
  useEffect(() => {
    // Prevent double execution in React.StrictMode (development)
    if (hasInitialized.current) {
      console.log('⚠️ useEffect already ran, skipping...')
      return
    }
    hasInitialized.current = true
    
    // Get game ID (hash) from URL path (e.g., /abc123def456)
    const pathParts = window.location.pathname.split('/').filter(Boolean)
    const hashId = pathParts[0] // First part after domain
    
    console.log('🔍 Checking for game hash in URL:', window.location.pathname)
    console.log('📋 Extracted hash ID:', hashId)
    
    if (!hashId || hashId.length < 8) {
      console.error('❌ No valid game hash found in URL')
      setError('❌ לא נמצא מזהה משחק בכתובת URL')
      return
    }
    
    // Validate game hash (alphanumeric only)
    if (!/^[a-zA-Z0-9]+$/.test(hashId)) {
      console.error('❌ Invalid game hash format')
      setError('❌ מזהה משחק לא תקין')
      return
    }
    
    console.log('✅ Valid game hash found:', hashId)
    setGameId(hashId)
    
    // Generate unique session ID for this admin session
    const newSessionId = generateSessionId()
    console.log('🎲 Generated session ID:', newSessionId)
    setSessionId(newSessionId)
    
    // Send session ID to server to register with add-in
    registerSession(hashId, newSessionId)
  }, []) // Empty dependency array = run only once on mount
  
  // Generate a unique session ID
  const generateSessionId = () => {
    // Generate 6-digit game PIN
    return Math.floor(100000 + Math.random() * 900000).toString()
  }
  
  // Register session with server (also resets to first slide automatically)
  const registerSession = async (hashId, gamePin) => {
    try {
      console.log('📡 Registering session with server...')
      const url = `${SERVER_URL}/?register_session&hash_id=${hashId}&game_pin=${gamePin}`
      console.log('📤 Sending to:', url)
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'success') {
        console.log('✅ Session registered successfully')
        if (data.resetSent) {
          console.log('✅ Presentation reset to first slide')
        }
        setStatus('')
      } else {
        console.error('❌ Failed to register session:', data.message)
        setStatus('⚠️ חיבור למשחק נכשל')
      }
    } catch (error) {
      console.error('❌ Error registering session:', error)
      setStatus('⚠️ שגיאה בחיבור לשרת')
    }
  }

  const handleNextSlide = async () => {
    if (!gameId) {
      setStatus('❌ אין מזהה משחק')
      return
    }

    try {
      // Send game ID (hash) with the request
      const url = `${SERVER_URL}/?next_slide&hash_id=${gameId}`
      console.log('📤 Sending to:', url)
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.status === 'success') {
        // Success - no message needed
      } else {
        setStatus('❌ שגיאה: ' + data.message)
      }
    } catch (error) {
      setStatus('❌ שגיאת רשת: ' + error.message)
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

  // Loading state while checking for game ID
  if (!gameId) {
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
        <h1>🎮 Kahoot Admin Panel</h1>
        <p className="subtitle">לוח בקרה לניהול המשחק</p>
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
            }}>{gameId}</code>
          </div>
          
          {sessionId && (
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
              }}>{sessionId.slice(0, 3) + '-' + sessionId.slice(3)}</code>
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
          >
            ➡️ עבור לשקף הבא
          </button>

          {status && (
            <div className={`status-message ${status.includes('✅') ? 'success' : 'error'}`}>
              {status}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App


