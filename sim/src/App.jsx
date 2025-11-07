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

const API_BASE = 'http://localhost:5000'
const SOCKET_URL = 'http://localhost:5000'

function App() {
  const [connectedPlayers, setConnectedPlayers] = useState(new Set())
  const [socket, setSocket] = useState(null)
  const [gameId, setGameId] = useState(null)
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

    // קבלת Game ID
    newSocket.on('game_initialized', (data) => {
      console.log('🎮 Game initialized:', data)
      setGameId(data.game_id)
    })

    setSocket(newSocket)

    return () => {
      console.log('🔌 Disconnecting WebSocket')
      newSocket.close()
    }
  }, [])

  // חיבור משתתף
  const connectPlayer = async (player) => {
    setLoading(prev => ({ ...prev, [player.id]: true }))
    
    try {
      console.log(`📥 Connecting player: ${player.name}`)
      
      const response = await fetch(`${API_BASE}/?join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: player.id,
          name: player.name
        })
      })

      const data = await response.json()
      console.log(`✅ Player connected:`, data)

      if (response.ok) {
        setConnectedPlayers(prev => new Set([...prev, player.id]))
        
        // עדכון Game ID אם קיבלנו
        if (data.game_id) {
          setGameId(data.game_id)
        }
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
    setLoading(prev => ({ ...prev, [player.id]: true }))
    
    try {
      console.log(`📤 Disconnecting player: ${player.name}`)
      
      const response = await fetch(`${API_BASE}/?leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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

  // אתחול משחק
  const initializeGame = async () => {
    try {
      console.log('🎮 Initializing game...')
      
      const response = await fetch(`${API_BASE}/?init`, {
        method: 'GET'
      })

      const data = await response.json()
      console.log('✅ Game initialized:', data)

      if (response.ok && data.game_id) {
        setGameId(data.game_id)
        alert(`משחק חדש נוצר!\nGame PIN: ${data.game_id}`)
      } else {
        alert(`שגיאה באתחול משחק: ${data.message || data.error}`)
      }
    } catch (error) {
      console.error('❌ Error initializing game:', error)
      alert(`שגיאה באתחול משחק: ${error.message}`)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎮 Kahoot Simulator</h1>
        <p>סימולטור משתתפים למשחק Kahoot</p>
      </header>

      <div className="game-info">
        <div className="info-card">
          <div className="info-label">Game PIN:</div>
          <div className="info-value">{gameId || '-'}</div>
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

      <div className="controls">
        <button className="btn btn-init" onClick={initializeGame}>
          🚀 התחל משחק חדש
        </button>
      </div>

      <div className="players-grid">
        {FAKE_PLAYERS.map(player => {
          const isConnected = connectedPlayers.has(player.id)
          const isLoading = loading[player.id]

          return (
            <div 
              key={player.id} 
              className={`player-card ${isConnected ? 'connected' : ''}`}
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
                    disabled={isLoading}
                  >
                    {isLoading ? '⏳' : '🚪'} התנתק
                  </button>
                ) : (
                  <button 
                    className="btn btn-connect"
                    onClick={() => connectPlayer(player)}
                    disabled={isLoading}
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
        <p>Server: {API_BASE}</p>
      </footer>
    </div>
  )
}

export default App





