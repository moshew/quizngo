import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { PLAYER_ICONS } from './icons'
import './App.css'

// 30 שחקנים פיקטיביים
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
  { id: 'p10', name: 'ליאת בר' },
  { id: 'p11', name: 'אביגיל ספקטור' },
  { id: 'p12', name: 'דודו המלך' },
  { id: 'p13', name: 'רותי אהרוני' },
  { id: 'p14', name: 'שלמה שרף' },
  { id: 'p15', name: 'גלית גוטמן' },
  { id: 'p16', name: 'חיים יבין' },
  { id: 'p17', name: 'יונית לוי' },
  { id: 'p18', name: 'עודד בן עמי' },
  { id: 'p19', name: 'אילנה דיין' },
  { id: 'p20', name: 'רפי רשף' },
  { id: 'p21', name: 'ארז טל' },
  { id: 'p22', name: 'אסי עזר' },
  { id: 'p23', name: 'רותם סלע' },
  { id: 'p24', name: 'גיא זוהר' },
  { id: 'p25', name: 'לוסי אהריש' },
  { id: 'p26', name: 'דני קושמרו' },
  { id: 'p27', name: 'קרן מרציאנו' },
  { id: 'p28', name: 'עמית סגל' },
  { id: 'p29', name: 'אמנון אברמוביץ\'' },
  { id: 'p30', name: 'רינה מצליח' }
]

// Load Balancer URL - used to resolve game PIN to server
const LB_URL = import.meta.env.VITE_LB_URL || `http://${window.location.hostname}:5000`

function App() {
  const [connectedPlayers, setConnectedPlayers] = useState(new Set())
  const [playerUIDs, setPlayerUIDs] = useState({}) // Store UID for each player
  const [playerSockets, setPlayerSockets] = useState({}) // Store WebSocket for each player
  const [gamePin, setGamePin] = useState('') // Changed from gameId to gamePin
  const [loading, setLoading] = useState({})
  const [loadingGamePin, setLoadingGamePin] = useState(false)
  const [serverUrl, setServerUrl] = useState(null) // Resolved game server URL
  
  // Answer time state
  const [isAnswerTime, setIsAnswerTime] = useState(false) // Are we in answer time?
  const [playerAnswers, setPlayerAnswers] = useState({}) // playerId -> answerIndex (1-4)
  const [playerResults, setPlayerResults] = useState({}) // playerId -> { questionScore, cumulativeScore, rank, isCorrect }
  const [currentQuestionTimestamp, setCurrentQuestionTimestamp] = useState(null) // Track current question

  // Use ref to track current sockets without causing re-renders
  const playerSocketsRef = useRef({})

  // Resolve server URL via LB when game PIN changes
  useEffect(() => {
    if (!gamePin) {
      setServerUrl(null)
      return
    }
    const cleanPin = gamePin.replace(/-/g, '')
    if (cleanPin.length !== 6) return

    fetch(`${LB_URL}/api/resolve/${cleanPin}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setServerUrl(data.server_url)
          console.log('Server resolved via LB:', data.server_url)
        } else {
          // Failed to resolve - clear server URL
          setServerUrl(null)
          console.error('Failed to resolve PIN:', data.message)
        }
      })
      .catch(err => {
        // Network error or invalid response - clear server URL
        setServerUrl(null)
        console.error('Failed to resolve PIN via LB:', err)
      })
  }, [gamePin])

  // Reset simulator when game PIN changes
  useEffect(() => {
    // Only reset if gamePin actually has a value and changes
    // Don't reset on initial mount
    if (!gamePin) return;

    console.log('Game PIN changed, resetting simulator')
    
    Object.values(playerSocketsRef.current).forEach(socket => {
      if (socket) socket.disconnect()
    })
    
    // Clear ref
    playerSocketsRef.current = {}
    
    setConnectedPlayers(new Set())
    setPlayerUIDs({})
    setPlayerSockets({})
    setLoading({})
    setIsAnswerTime(false)
    setPlayerAnswers({})
    setPlayerResults({})
  }, [gamePin]) // Only when gamePin changes

  // Cleanup all sockets on unmount ONLY
  useEffect(() => {
    return () => {
      console.log('🔌 Cleanup on unmount: Disconnecting all player WebSockets')
      Object.values(playerSocketsRef.current).forEach(socket => {
        if (socket) socket.disconnect()
      })
    }
  }, []) // Empty deps - only run on unmount

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
      const playerIcon = PLAYER_ICONS[player.id] || '👤'; // Default if not found
      
      // 1. Create WebSocket FIRST to get socketId
      console.log(`🔌 Creating WebSocket for player: ${player.name}`)
      const playerSocket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false,
        forceNew: true
      })

      // Wait for socket to connect
      await new Promise((resolve, reject) => {
        playerSocket.on('connect', resolve)
        playerSocket.on('connect_error', reject)
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Socket connection timeout')), 5000)
      })

      console.log(`✅ WebSocket connected for ${player.name}, socketId: ${playerSocket.id}`)

      // 2. Send single REST request with socketId to join AND register to room
      const response = await fetch(`${serverUrl}/?join_player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_pin: cleanGamePin,
          name: player.name,
          icon: playerIcon,
          socketId: playerSocket.id  // Include socketId to register socket to room
        })
      })

      const data = await response.json()
      console.log(`✅ Player connected:`, data)

      if (response.ok && data.uid) {
        // Store the UID for this player
        setPlayerUIDs(prev => ({ ...prev, [player.id]: data.uid }))
        setConnectedPlayers(prev => new Set([...prev, player.id]))
        console.log(`💾 Stored UID for ${player.name}: ${data.uid}, socket registered to room ${data.gamePin}`)

        // Handle mid-game join: check game state from response
        const gameState = data.gameState || 'waiting'
        if (gameState === 'answering' && data.needsSync && data.remainingTime > 0) {
          console.log(`⏱️ Mid-question join for ${player.name}: ${data.remainingTime}s remaining`)
          setIsAnswerTime(true)
          setCurrentQuestionTimestamp(data.syncData?.timestamp || null)
        } else {
          // waiting / results / any other state — ensure answer mode is off
          setIsAnswerTime(false)
          if (gameState === 'results') {
            console.log(`📊 ${player.name} joined between questions, waiting for next question`)
          }
        }

        // Setup socket event handlers (socket was already created and connected above)
        playerSocket.on('disconnect', () => {
          console.log(`❌ WebSocket disconnected for ${player.name}`)
        })

        // Answer time events
        playerSocket.on('answer_time_started', (answerData) => {
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          console.log(`🎯 ANSWER TIME STARTED! (detected by ${player.name})`)
          console.log('📦 Data:', answerData)
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          
          setIsAnswerTime(true)
          
          // Only reset answers/results if this is a NEW question (different timestamp)
          setCurrentQuestionTimestamp(prev => {
            if (prev !== answerData.timestamp) {
              console.log(`🆕 New question detected, resetting state`)
              setPlayerAnswers({}) // Reset answers for new question
              setPlayerResults({}) // Reset results for new question
            } else {
              console.log(`🔄 Same question (reconnection sync), keeping existing answers`)
            }
            return answerData.timestamp
          })
        })
                // Game closed event - reset player to "join" state
        playerSocket.on('game_closed', (closeData) => {
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          console.log(`🚫 GAME CLOSED for ${player.name}!`)
          console.log('📦 Data:', closeData)
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          
          // Disconnect this player's socket
          playerSocket.disconnect()
          
          // Remove from ref
          delete playerSocketsRef.current[player.id]
          
          // Reset player to "join" state - clear UID so they need to rejoin
          setPlayerUIDs(prev => {
            const newUIDs = { ...prev }
            delete newUIDs[player.id]
            return newUIDs
          })
          
          // Remove from connected players
          setConnectedPlayers(prev => {
            const newSet = new Set(prev)
            newSet.delete(player.id)
            return newSet
          })
          
          // Remove socket from state
          setPlayerSockets(prev => {
            const newSockets = { ...prev }
            delete newSockets[player.id]
            return newSockets
          })
          
          // Clear answer state
          setPlayerAnswers(prev => {
            const newAnswers = { ...prev }
            delete newAnswers[player.id]
            return newAnswers
          })
          
          setPlayerResults(prev => {
            const newResults = { ...prev }
            delete newResults[player.id]
            return newResults
          })
          
          console.log(`✅ ${player.name} reset to JOIN state due to game_closed (reason: ${closeData.reason})`)
        })
        // Player results event
        playerSocket.on('player_results', (resultsData) => {
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          console.log(`📊 PLAYER RESULTS RECEIVED by ${player.name}!`)
          console.log('📦 Data:', resultsData)
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          
          // Store results by userId directly, we'll map to playerId in the render
          setPlayerResults(prev => ({
            ...prev,
            [resultsData.userId]: {
              questionScore: resultsData.questionScore,
              cumulativeScore: resultsData.cumulativeScore,
              rank: resultsData.rank,
              isCorrect: resultsData.isCorrect,
              answered: resultsData.answered,
              nickname: resultsData.nickname
            }
          }))
          
          console.log(`✅ Stored results for userId ${resultsData.userId}:`, resultsData)
          
          // When we receive results, it means answer time has ended
          setIsAnswerTime(false)
        })

        // Store the socket for this player in both state and ref
        playerSocketsRef.current[player.id] = playerSocket
        setPlayerSockets(prev => ({ ...prev, [player.id]: playerSocket }))
        
      } else {
        // Join failed - disconnect the socket we created
        playerSocket.disconnect()
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
      
      // 1. Call leave_player endpoint to check if we should remove permanently (Lobby) or just disconnect
      let shouldRemoveUID = false;
      
      try {
        const response = await fetch(`${serverUrl}/?leave_player&uid=${uid}`, {
          method: 'POST'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Leave response for ${player.name}:`, data);
          if (data.removed) {
            shouldRemoveUID = true;
            console.log(`🧹 Server indicated permanent removal for ${player.name} (Lobby)`);
          }
        }
      } catch (err) {
        console.warn(`⚠️ Failed to call leave_player endpoint:`, err);
        // Continue with local disconnect anyway
      }

      // 2. Disconnect socket
      const playerSocket = playerSockets[player.id]
      if (playerSocket) {
        console.log(`🔌 Closing WebSocket for ${player.name} (connected: ${playerSocket.connected})`)
        playerSocket.disconnect()
      }
      
      // Remove from ref
      delete playerSocketsRef.current[player.id]
      
      // Remove socket and player from connected list
      setPlayerSockets(prev => {
        const newSockets = { ...prev }
        delete newSockets[player.id]
        return newSockets
      })
      setConnectedPlayers(prev => {
        const newSet = new Set(prev)
        newSet.delete(player.id)
        return newSet
      })
      
      // 3. Clear UID if server said so (Lobby mode)
      if (shouldRemoveUID) {
         setPlayerUIDs(prev => {
            const newUIDs = { ...prev }
            delete newUIDs[player.id]
            return newUIDs
         })
         console.log(`🧹 Cleared UID for ${player.name} - Reset to JOIN state`);
      } else {
         console.log(`💾 Note: We keep playerUIDs[player.id] so they can reconnect!`);
      }

    } catch (error) {
      console.error(`❌ Error disconnecting player:`, error)
      alert('שגיאה בניתוק ${player.name}: ${error.message}')
    } finally {
      setLoading(prev => ({ ...prev, [player.id]: false }))
    }
  }
  
  // התחברות מחדש של משתתף
  const reconnectPlayer = async (player) => {
    if (!gamePin || gamePin.trim() === '') {
      alert('יש להזין Game PIN קודם!')
      return
    }
    
    // Get the existing UID for this player
    const uid = playerUIDs[player.id]
    if (!uid) {
      alert(`שגיאה: לא נמצא UID עבור ${player.name}. נא להצטרף מחדש.`)
      return
    }
    
    setLoading(prev => ({ ...prev, [player.id]: true }))
    
    try {
      console.log(`🔄 Reconnecting player: ${player.name} (UID: ${uid})`)
      
      const cleanGamePin = gamePin.replace(/-/g, '')
      
      // 1. Create WebSocket FIRST to get socketId
      console.log(`🔌 Creating WebSocket for reconnected player: ${player.name}`)
      const playerSocket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false,
        forceNew: true
      })

      // Wait for socket to connect
      await new Promise((resolve, reject) => {
        playerSocket.on('connect', resolve)
        playerSocket.on('connect_error', reject)
        setTimeout(() => reject(new Error('Socket connection timeout')), 5000)
      })

      console.log(`✅ WebSocket connected for ${player.name}, socketId: ${playerSocket.id}`)

      // 2. Send single REST request with socketId to rejoin AND register to room
      const response = await fetch(`${serverUrl}/rejoin_player`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: uid,
          gamePin: cleanGamePin,
          socketId: playerSocket.id  // Include socketId to register socket to room
        })
      })

      const data = await response.json()
      console.log(`✅ Rejoin response:`, data)

      if (response.ok && data.status === 'success') {
        console.log(`💾 Player ${player.name} rejoined, socket registered to room ${data.gamePin}`)
        
        // Handle sync data if player reconnected during answer time
        const gameState = data.gameState || 'waiting'
        if (gameState === 'answering' && data.syncData && data.remainingTime > 0) {
          console.log(`🔄 Received sync data for ${player.name}: ${data.remainingTime}s remaining`, data.syncData)
          setIsAnswerTime(true)
          setCurrentQuestionTimestamp(data.syncData.timestamp)
        } else {
          // waiting / results / any other state — ensure answer mode is off
          setIsAnswerTime(false)
        }

        // Setup socket event handlers
        playerSocket.on('disconnect', () => {
          console.log(`❌ WebSocket disconnected for ${player.name}`)
        })

        // Listen for answer_time_started to restore game state
        playerSocket.on('answer_time_started', (answerData) => {
          console.log(`⏰ Answer time started for ${player.name}:`, answerData)
          
          setIsAnswerTime(true)
          
          // Only reset answers/results if this is a NEW question (different timestamp)
          setCurrentQuestionTimestamp(prev => {
            if (prev !== answerData.timestamp) {
              console.log(`🆕 New question detected, resetting state`)
              setPlayerAnswers({}) // Reset answers for new question
              setPlayerResults({}) // Reset results for new question
            } else {
              console.log(`🔄 Same question (reconnection sync), keeping existing answers`)
            }
            return answerData.timestamp
          })
        })

        // Listen for player results
        playerSocket.on('player_results', (resultsData) => {
          console.log(`📊 Results for ${player.name}:`, resultsData)
          
          // Store results by userId, we'll map to playerId in render
          setPlayerResults(prev => ({
            ...prev,
            [resultsData.userId]: resultsData
          }))
          
          // When we receive results, it means answer time has ended
          setIsAnswerTime(false)
        })

        // Game closed event - reset player to "join" state
        playerSocket.on('game_closed', (closeData) => {
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          console.log(`🚫 GAME CLOSED for ${player.name}!`)
          console.log('📦 Data:', closeData)
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          
          // Disconnect this player's socket
          playerSocket.disconnect()
          
          // Remove from ref
          delete playerSocketsRef.current[player.id]
          
          // Reset player to "join" state - clear UID so they need to rejoin
          setPlayerUIDs(prev => {
            const newUIDs = { ...prev }
            delete newUIDs[player.id]
            return newUIDs
          })
          
          // Remove from connected players
          setConnectedPlayers(prev => {
            const newSet = new Set(prev)
            newSet.delete(player.id)
            return newSet
          })
          
          // Remove socket from state
          setPlayerSockets(prev => {
            const newSockets = { ...prev }
            delete newSockets[player.id]
            return newSockets
          })
          
          // Clear answer state
          setPlayerAnswers(prev => {
            const newAnswers = { ...prev }
            delete newAnswers[player.id]
            return newAnswers
          })
          
          setPlayerResults(prev => {
            const newResults = { ...prev }
            delete newResults[player.id]
            return newResults
          })
          
          console.log(`✅ ${player.name} reset to JOIN state due to game_closed (reason: ${closeData.reason})`)
        })

        // Store socket in ref AND state
        playerSocketsRef.current[player.id] = playerSocket
        setPlayerSockets(prev => ({ ...prev, [player.id]: playerSocket }))
        
        // Mark as connected
        setConnectedPlayers(prev => new Set(prev).add(player.id))
        
      } else {
        console.warn(`❌ Rejoin failed with status ${response.status}: ${data.message}`)
        
        // Rejoin failed - disconnect the socket we created
        playerSocket.disconnect()
        
        // If player not found (404), clear UID so they can join fresh
        if (response.status === 404) {
          console.log(`🧹 Player ${player.name} not found on server, clearing UID to allow fresh join`)
          setPlayerUIDs(prev => {
            const newUIDs = { ...prev }
            delete newUIDs[player.id]
            return newUIDs
          })
          alert(`שגיאה בהתחברות מחדש: השחקן לא נמצא בשרת (ייתכן שנמחק). אנא בצע הצטרפות מחדש.`) 
        } else {
          alert(`שגיאה בהתחברות מחדש: ${data.message || 'שגיאה לא ידועה'}`)
        }
      }
    } catch (error) {
      console.error(`❌ Error reconnecting player:`, error)
      alert(`שגיאה בהתחברות מחדש ${player.name}: ${error.message}`)
    } finally {
      setLoading(prev => ({ ...prev, [player.id]: false }))
    }
  }
  
  // טעינת משחק אוטומטי
  const loadGamePin = async () => {
    // אם כבר הוזן PIN תקין - השתמש בו ואל תביא מה-LB
    if (gamePin && gamePin.replace(/-/g, '').length === 6) {
      console.log(`✅ Using existing PIN: ${gamePin}`)
      return
    }

    setLoadingGamePin(true)
    try {
      console.log('Loading active games from LB...')
      const response = await fetch(`${LB_URL}/api/admin/pins`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch active games')
      }
      
      const data = await response.json()
      console.log('📥 Received games:', data)
      
      if (data.status === 'success' && data.pins && data.pins.length > 0) {
        // קח את ה-PIN האחרון (המשחק החדש ביותר לפי assigned_at)
        const latestGame = data.pins.reduce((a, b) => a.assigned_at > b.assigned_at ? a : b)
        const pin = latestGame.game_pin

        // עיצוב עם קו מפריד
        const formattedPin = `${pin.slice(0, 3)}-${pin.slice(3)}`

        console.log(`✅ Loading latest game PIN: ${formattedPin}`)
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
    console.log(`   Using userId: ${uid}`)
    
    // Send answer to server via REST API (only userId needed, gamePin already stored in server)
    fetch(`${serverUrl}/submit_answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: uid,
        answerIndex: answerIndex,
        timestamp: Date.now()
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        // Update local state
        setPlayerAnswers(prev => ({ ...prev, [player.id]: answerIndex }))
        console.log(`✅ Answer sent for ${player.name}`)
      } else {
        alert(`שגיאה: ${data.message}`)
      }
    })
    .catch(error => {
      console.error('Error sending answer:', error)
      alert('שגיאה בשליחת התשובה!')
    })
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎮 QuizNGO Simulator</h1>
        <p>סימולטור משתתפים למשחק QuizNGO</p>
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
          <div className="info-label">מחוברים מהסימולטור:</div>
          <div className="info-value">{connectedPlayers.size}</div>
        </div>
      </div>

      <div className="players-grid">
        {FAKE_PLAYERS.map(player => {
          const isConnected = connectedPlayers.has(player.id)
          const isLoading = loading[player.id]
          const isDisabled = !gamePin || gamePin.replace(/-/g, '').length !== 6 || !serverUrl
          const playerAnswer = playerAnswers[player.id]
          
          // Get results by userId (not playerId)
          const playerUid = playerUIDs[player.id]
          const results = playerUid ? playerResults[playerUid] : null

          return (
            <div 
              key={player.id} 
              className={`player-card ${isConnected ? 'connected' : ''} ${isDisabled ? 'disabled' : ''}`}
            >
              <div className="player-avatar" style={{ fontSize: '40px', background: 'transparent', boxShadow: 'none' }}>
                {PLAYER_ICONS[player.id]}
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
                ) : playerUIDs[player.id] ? (
                  // Has UID - show reconnect button
                  <button 
                    className="btn btn-connect"
                    onClick={() => reconnectPlayer(player)}
                    disabled={isLoading || isDisabled}
                    style={{ background: '#f39c12' }}
                  >
                    {isLoading ? '⏳' : '🔄'} התחבר מחדש
                  </button>
                ) : (
                  // No UID - show join button
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
        <p>WebSockets פעילים: {Object.keys(playerSockets).length}</p>
        <p>LB: {LB_URL} {serverUrl && `| Server: ${serverUrl}`}</p>
      </footer>
    </div>
  )
}

export default App







