import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import './App.css'

// 10 שחקנים פיקטיביים
const FAKE_PLAYERS = [
  { id: 'p1', name: 'אלכס כהן' },
  { id: 'p2', name: 'שרה לוי' },
  { id: 'p3', name: 'דניאל מזרחי' },
  { id: 'p4', name: 'נועה ביטון' },
  { id: 'p5', name: 'יוסי אברהם' },
  { id: 'p6', name: 'מיכל גולן' },
  { id: 'p7', name: 'רונן שמיר' },
  { id: 'p8', name: 'תמר פרידמן' },
  { id: 'p9', name: 'עומר דהן' },
  { id: 'p10', name: 'ליאת בר' }
]

// Get server URL from environment or use default
// For network access, set VITE_SERVER_URL to your machine's IP, e.g., http://192.168.1.100:5000
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'
const API_BASE = SERVER_URL
const SOCKET_URL = SERVER_URL

function App() {
  const [connectedPlayers, setConnectedPlayers] = useState(new Set())
  const [socket, setSocket] = useState(null)
  const [gamePin, setGamePin] = useState('') // Changed from gameId to gamePin
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading] = useState({})

  // התחברות WebSocket
  useEffect(() => {
    console.log('🔌 Connecting to WebSocket:', SOCKET_URL)
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected')
    })

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected')
    })

    // קבלת עדכוני משתתפים
    newSocket.on('user_count', (data) => {
      console.log('📊 User count update:', data)
      setTotalUsers(data.count || 0)
    })

    setSocket(newSocket)

    return () => {
      console.log('🔌 Disconnecting WebSocket')
      newSocket.close()
    }
  }, [])

  // חיבור משתתף
  const connectPlayer = async (player) => {
    if (!gamePin || gamePin.trim() === '') {
      alert('יש להזין Game PIN קודם!')
      return
    }
    
    setLoading(prev => ({ ...prev, [player.id]: true }))
    
    try {
      console.log(`📥 Connecting player: ${player.name} to game PIN: ${gamePin}`)
      
      const response = await fetch(`${API_BASE}/?join_player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_pin: gamePin.trim(),
          user_id: player.id,
          name: player.name
        })
      })

      const data = await response.json()
      console.log(`✅ Player connected:`, data)

      if (response.ok) {
        setConnectedPlayers(prev => new Set([...prev, player.id]))
      } else {
        alert(`שגיאה בחיבור ${player.name}: ${data.message || data.error}`)
      }
    } catch (error) {
      console.error(`❌ Error connecting player:`, error)
      alert(`שגיאה בחיבור ${player.name}: ${error.message}`)
    } finally {
      setLoading(prev => ({ ...prev, [player.id]: false }))
    }
  }

  // ניתוק משתתף
  const disconnectPlayer = async (player) => {
    if (!gamePin || gamePin.trim() === '') {
      alert('יש להזין Game PIN קודם!')
      return
    }
    
    setLoading(prev => ({ ...prev, [player.id]: true }))
    
    try {
      console.log(`📤 Disconnecting player: ${player.name} from game PIN: ${gamePin}`)
      
      const response = await fetch(`${API_BASE}/?leave_player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_pin: gamePin.trim(),
          user_id: player.id
        })
      })

      const data = await response.json()
      console.log(`✅ Player disconnected:`, data)

      if (response.ok) {
        setConnectedPlayers(prev => {
          const newSet = new Set(prev)
          newSet.delete(player.id)
          return newSet
        })
      } else {
        alert(`שגיאה בניתוק ${player.name}: ${data.message || data.error}`)
      }
    } catch (error) {
      console.error(`❌ Error disconnecting player:`, error)
      alert(`שגיאה בניתוק ${player.name}: ${error.message}`)
    } finally {
      setLoading(prev => ({ ...prev, [player.id]: false }))
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎮 Kahoot Simulator</h1>
        <p>סימולטור משתתפים למשחק Kahoot</p>
      </header>

      <div className="game-info">
        <div className="info-card" style={{ gridColumn: '1 / -1', padding: '20px' }}>
          <div className="info-label" style={{ marginBottom: '10px' }}>הזן Game PIN:</div>
          <input 
            type="text" 
            value={gamePin}
            onChange={(e) => setGamePin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="123456"
            maxLength="6"
            style={{
              width: '200px',
              padding: '12px 20px',
              fontSize: '24px',
              textAlign: 'center',
              border: '2px solid #ddd',
              borderRadius: '8px',
              fontWeight: 'bold',
              letterSpacing: '2px'
            }}
          />
          {gamePin && gamePin.length === 6 && (
            <span style={{ marginLeft: '15px', color: '#27ae60', fontSize: '20px' }}>✓</span>
          )}
        </div>
        <div className="info-card">
          <div className="info-label">משתתפים פעילים:</div>
          <div className="info-value">{totalUsers}</div>
        </div>
        <div className="info-card">
          <div className="info-label">מחוברים מהסימולטור:</div>
          <div className="info-value">{connectedPlayers.size}</div>
        </div>
      </div>

      <div className="players-grid">
        {FAKE_PLAYERS.map(player => {
          const isConnected = connectedPlayers.has(player.id)
          const isLoading = loading[player.id]
          const isDisabled = !gamePin || gamePin.length !== 6

          return (
            <div 
              key={player.id} 
              className={`player-card ${isConnected ? 'connected' : ''} ${isDisabled ? 'disabled' : ''}`}
            >
              <div className="player-avatar">
                {player.name.charAt(0)}
              </div>
              <div className="player-info">
                <div className="player-name">{player.name}</div>
                <div className="player-id">ID: {player.id}</div>
              </div>
              <div className="player-actions">
                {isConnected ? (
                  <button 
                    className="btn btn-disconnect"
                    onClick={() => disconnectPlayer(player)}
                    disabled={isLoading || isDisabled}
                  >
                    {isLoading ? '⏳' : '🚪'} התנתק
                  </button>
                ) : (
                  <button 
                    className="btn btn-connect"
                    onClick={() => connectPlayer(player)}
                    disabled={isLoading || isDisabled}
                  >
                    {isLoading ? '⏳' : '🎮'} הצטרף
                  </button>
                )}
              </div>
              {isConnected && (
                <div className="status-indicator">
                  <span className="status-dot"></span>
                  מחובר
                </div>
              )}
            </div>
          )
        })}
      </div>

      <footer className="footer">
        <p>WebSocket: {socket?.connected ? '🟢 מחובר' : '🔴 לא מחובר'}</p>
        <p>Server: {SERVER_URL}</p>
        {SERVER_URL.includes('localhost') && (
          <p style={{ color: '#fbbf24', marginTop: '10px' }}>
            ⚠️ שרת מקומי - לגישה ממחשבים אחרים, עדכן את VITE_SERVER_URL בקובץ .env
          </p>
        )}
      </footer>
    </div>
  )
}

export default App






