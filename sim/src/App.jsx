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
  const [playerUIDs, setPlayerUIDs] = useState({}) // Store UID for each player
  const [socket, setSocket] = useState(null)
  const [gamePin, setGamePin] = useState('') // Changed from gameId to gamePin
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading] = useState({})
  const [loadingGamePin, setLoadingGamePin] = useState(false)
  
  // Answer time state
  const [isAnswerTime, setIsAnswerTime] = useState(false) // Are we in answer time?
  const [playerAnswers, setPlayerAnswers] = useState({}) // playerId -> answerIndex (1-4)
  const [playerResults, setPlayerResults] = useState({}) // playerId -> { questionScore, cumulativeScore, rank, isCorrect }

  // Reset simulator when game PIN changes
  useEffect(() => {
    console.log('🔄 Game PIN changed, resetting simulator')
    setConnectedPlayers(new Set())
    setPlayerUIDs({})
    setTotalUsers(0)
    setLoading({})
    setIsAnswerTime(false)
    setPlayerAnswers({})
    setPlayerResults({})
  }, [gamePin])

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
    
    newSocket.on('room_registered', (data) => {
      if (data.status === 'success') {
        console.log('✅ Successfully registered to room:', data.hashId)
      } else {
        console.error('❌ Room registration failed:', data.message)
      }
    })

    // קבלת עדכוני משתתפים
    newSocket.on('user_count', (data) => {
      console.log('📊 User count update:', data)
      setTotalUsers(data.count || 0)
    })
    
    // Answer time events
    newSocket.on('answer_time_started', (data) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🎯 ANSWER TIME STARTED!')
      console.log('📦 Data:', data)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      setIsAnswerTime(true)
      setPlayerAnswers({}) // Reset answers for new question
      setPlayerResults({}) // Reset results for new question
    })
    
    // Player results event
    newSocket.on('player_results', (data) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📊 PLAYER RESULTS RECEIVED!')
      console.log('📦 Data:', data)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      // Store results by userId directly, we'll map to playerId in the render
      setPlayerResults(prev => ({
        ...prev,
        [data.userId]: {
          questionScore: data.questionScore,
          cumulativeScore: data.cumulativeScore,
          rank: data.rank,
          isCorrect: data.isCorrect,
          answered: data.answered,
          nickname: data.nickname
        }
      }))
      
      console.log(`✅ Stored results for userId ${data.userId}:`, data)
      
      // When we receive results, it means answer time has ended
      setIsAnswerTime(false)
    })

    setSocket(newSocket)

    return () => {
      console.log('🔌 Disconnecting WebSocket')
      newSocket.close()
    }
  }, [])
  
  // Register to room when game PIN is complete
  useEffect(() => {
    if (socket && socket.connected && gamePin && gamePin.replace(/-/g, '').length === 6) {
      const cleanPin = gamePin.replace(/-/g, '')
      console.log('🔑 Registering sim to room with game PIN:', cleanPin)
      socket.emit('register_room_by_pin', { gamePin: cleanPin })
    }
  }, [socket, gamePin])

  // חיבור משתתף
  const connectPlayer = async (player) => {
    if (!gamePin || gamePin.trim() === '') {
      alert('יש להזין Game PIN קודם!')
      return
    }
    
    setLoading(prev => ({ ...prev, [player.id]: true }))
    
    try {
      console.log(`📥 Connecting player: ${player.name} to game PIN: ${gamePin}`)
      
      // Remove hyphen from game PIN before sending to server
      const cleanGamePin = gamePin.replace(/-/g, '')
      
      const response = await fetch(`${API_BASE}/?join_player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_pin: cleanGamePin,
          name: player.name
        })
      })

      const data = await response.json()
      console.log(`✅ Player connected:`, data)

      if (response.ok && data.uid) {
        // Store the UID for this player
        setPlayerUIDs(prev => ({ ...prev, [player.id]: data.uid }))
        setConnectedPlayers(prev => new Set([...prev, player.id]))
        console.log(`💾 Stored UID for ${player.name}: ${data.uid}`)
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
    
    // Get the UID for this player
    const uid = playerUIDs[player.id]
    if (!uid) {
      alert(`שגיאה: לא נמצא UID עבור ${player.name}`)
      return
    }
    
    setLoading(prev => ({ ...prev, [player.id]: true }))
    
    try {
      console.log(`📤 Disconnecting player: ${player.name} (UID: ${uid})`)
      
      // Send UID as query parameter instead of header (CORS-friendly)
      const response = await fetch(`${API_BASE}/?leave_player&uid=${encodeURIComponent(uid)}`, {
        method: 'POST'
      })

      const data = await response.json()
      console.log(`✅ Player disconnected:`, data)

      if (response.ok) {
        // Remove the UID and player from connected list
        setPlayerUIDs(prev => {
          const newUIDs = { ...prev }
          delete newUIDs[player.id]
          return newUIDs
        })
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
      alert('שגיאה בניתוק ${player.name}: ${error.message}')
    } finally {
      setLoading(prev => ({ ...prev, [player.id]: false }))
    }
  }
  
  // טעינת משחק אוטומטי
  const loadGamePin = async () => {
    setLoadingGamePin(true)
    try {
      console.log('🔄 Loading active games...')
      const response = await fetch(`${API_BASE}/sim_gamePIN`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch active games')
      }
      
      const data = await response.json()
      console.log('📥 Received games:', data)
      
      if (data.status === 'success' && data.games && data.games.length > 0) {
        // קח את ה-PIN הראשון
        const firstGame = data.games[0]
        const pin = firstGame.gamePin
        
        // עיצוב עם קו מפריד
        const formattedPin = `${pin.slice(0, 3)}-${pin.slice(3)}`
        
        console.log(`✅ Loading first game PIN: ${formattedPin}`)
        setGamePin(formattedPin)
      } else {
        alert('אין משחקים פעילים כרגע')
      }
    } catch (error) {
      console.error('❌ Error loading game PIN:', error)
      alert(`שגיאה בטעינת משחק: ${error.message}`)
    } finally {
      setLoadingGamePin(false)
    }
  }
  
  // שליחת תשובה
  const submitAnswer = (player, answerIndex) => {
    if (!isAnswerTime) {
      alert('זמן המענה לא פעיל!')
      return
    }
    
    if (playerAnswers[player.id]) {
      alert('כבר ענית על השאלה!')
      return
    }
    
    const uid = playerUIDs[player.id]
    if (!uid) {
      alert('שגיאה: לא נמצא UID')
      return
    }
    
    console.log(`📝 Player ${player.name} answered: ${answerIndex}`)
    
    // Send answer to server via WebSocket
    if (socket && socket.connected) {
      socket.emit('player_answer', {
        userId: uid,
        answerIndex: answerIndex,
        timestamp: Date.now()
      })
      
      // Update local state
      setPlayerAnswers(prev => ({ ...prev, [player.id]: answerIndex }))
      
      console.log(`✅ Answer sent for ${player.name}`)
    } else {
      alert('לא מחובר לשרת!')
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
            <input 
              type="text" 
              value={gamePin}
              onChange={(e) => {
                // Allow only digits and hyphen
                let value = e.target.value.replace(/[^0-9-]/g, '')
                
                // Auto-format: XXX-XXX
                if (value.length > 0) {
                  // Remove all hyphens first
                  const digitsOnly = value.replace(/-/g, '')
                  
                  // Add hyphen after 3rd digit
                  if (digitsOnly.length > 3) {
                    value = digitsOnly.slice(0, 3) + '-' + digitsOnly.slice(3, 6)
                  } else {
                    value = digitsOnly
                  }
                }
                
                setGamePin(value)
              }}
              placeholder="123-456"
              maxLength="7"
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
            {gamePin && gamePin.replace(/-/g, '').length === 6 && (
              <span style={{ color: '#27ae60', fontSize: '20px' }}>✓</span>
            )}
            <button
              onClick={loadGamePin}
              disabled={loadingGamePin}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                background: loadingGamePin ? '#95a5a6' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loadingGamePin ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (!loadingGamePin) e.target.style.background = '#2980b9'
              }}
              onMouseLeave={(e) => {
                if (!loadingGamePin) e.target.style.background = '#3498db'
              }}
            >
              {loadingGamePin ? '⏳ טוען...' : '📥 טען משחק'}
            </button>
          </div>
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
          const isDisabled = !gamePin || gamePin.replace(/-/g, '').length !== 6
          const playerAnswer = playerAnswers[player.id]
          
          // Get results by userId (not playerId)
          const playerUid = playerUIDs[player.id]
          const results = playerUid ? playerResults[playerUid] : null

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
                
                {/* Show cumulative score and rank if available */}
                {results && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                      🏆 דירוג: #{results.rank}
                    </div>
                    <div style={{ color: '#7f8c8d', marginTop: '4px' }}>
                      ניקוד: {results.cumulativeScore}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Connection buttons */}
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
              
              {/* Answer buttons - only show when connected and answer time is active */}
              {isConnected && (
                isAnswerTime && !playerAnswer ? (
                  <div className="answer-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginTop: '10px' }}>
                    <button 
                      onClick={() => submitAnswer(player, 1)}
                      style={{ 
                        padding: '15px', 
                        background: '#e74c3c', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}
                    >
                      🔴
                    </button>
                    <button 
                      onClick={() => submitAnswer(player, 2)}
                      style={{ 
                        padding: '15px', 
                        background: '#3498db', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}
                    >
                      🔵
                    </button>
                    <button 
                      onClick={() => submitAnswer(player, 3)}
                      style={{ 
                        padding: '15px', 
                        background: '#f1c40f', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}
                    >
                      🟡
                    </button>
                    <button 
                      onClick={() => submitAnswer(player, 4)}
                      style={{ 
                        padding: '15px', 
                        background: '#2ecc71', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '18px'
                      }}
                    >
                      🟢
                    </button>
                  </div>
                ) : playerAnswer && !results ? (
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '10px', 
                    background: '#27ae60', 
                    color: 'white', 
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}>
                    ✅ ענה: {['🔴', '🔵', '🟡', '🟢'][playerAnswer - 1]}
                  </div>
                ) : results ? (
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '12px', 
                    background: results.isCorrect ? '#27ae60' : '#e74c3c', 
                    color: 'white', 
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }}>
                      {results.answered 
                        ? (results.isCorrect ? '✅ תשובה נכונה!' : '❌ תשובה שגויה')
                        : '⏰ לא ענה בזמן'
                      }
                    </div>
                    {results.answered && playerAnswer && (
                      <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                        ענה: {['🔴', '🔵', '🟡', '🟢'][playerAnswer - 1]}
                      </div>
                    )}
                    <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '6px' }}>
                      +{results.questionScore} נקודות
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '10px', 
                    background: '#95a5a6', 
                    color: 'white', 
                    borderRadius: '8px',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}>
                    <div className="spinner" style={{
                      width: '20px',
                      height: '20px',
                      border: '3px solid rgba(255,255,255,0.3)',
                      borderTop: '3px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    ממתין...
                  </div>
                )
              )}
              
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






