import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import PinScreen from './screens/PinScreen'
import NameScreen from './screens/NameScreen'
import LobbyScreen from './screens/LobbyScreen'
import AnswerScreen from './screens/AnswerScreen'
import ResultScreen from './screens/ResultScreen'
import GameOverScreen from './screens/GameOverScreen'
import LanguageSwitcher from './components/LanguageSwitcher'
import { applyDirection } from './i18n'

const LB_URL = import.meta.env.VITE_LB_URL || 'http://localhost:5000'

// Screens: pin -> name -> lobby -> answer -> result -> (answer again) -> gameOver
const SCREENS = {
  PIN: 'pin',
  NAME: 'name',
  LOBBY: 'lobby',
  ANSWER: 'answer',
  RESULT: 'result',
  GAME_OVER: 'gameOver'
}

function App() {
  // Check URL for pin parameter
  const urlParams = new URLSearchParams(window.location.search)
  const urlPin = urlParams.get('pin')
  const urlLang = urlParams.get('lang')

  const [screen, setScreen] = useState(urlPin ? SCREENS.NAME : SCREENS.PIN)
  const [gamePin, setGamePin] = useState(urlPin || '')
  const [playerName, setPlayerName] = useState('')
  const [playerIcon, setPlayerIcon] = useState('')
  const [uid, setUid] = useState(null)
  const [isAnswerTime, setIsAnswerTime] = useState(false)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [pinError, setPinError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingPin, setCheckingPin] = useState(false)
  const [language, setLanguage] = useState(urlLang || 'en')
  const [answerTimeRemaining, setAnswerTimeRemaining] = useState(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [serverUrl, setServerUrl] = useState(null)

  const socketRef = useRef(null)
  const pinErrorTimeoutRef = useRef(null)
  const timerRef = useRef(null)
  const uidRef = useRef(null)

  // Resolve server URL via LB when PIN comes from URL
  useEffect(() => {
    if (urlPin && !serverUrl) {
      const cleanPin = urlPin.replace(/-/g, '')
      fetch(`${LB_URL}/api/resolve/${cleanPin}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            setServerUrl(data.server_url)
          } else {
            // Failed to resolve - show error and go back to PIN screen
            console.error('Failed to resolve PIN:', data.message)
            setPinError(language === 'he' ? 'לא נמצא משחק עם PIN זה' : 'Game not found with this PIN')
            setScreen(SCREENS.PIN)
          }
        })
        .catch(err => {
          // Network error - show error and go back to PIN screen
          console.error('Failed to resolve PIN from URL:', err)
          setPinError(language === 'he' ? 'שגיאת רשת - לא ניתן למצוא את המשחק' : 'Network error - cannot find game')
          setScreen(SCREENS.PIN)
        })
    }
  }, [urlPin, serverUrl, language])

  // Apply direction when language changes
  useEffect(() => {
    applyDirection(language)
  }, [language])

  // Start countdown timer for answer time
  const startAnswerTimer = useCallback((seconds) => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    let remaining = Math.ceil(seconds)
    setAnswerTimeRemaining(remaining)

    timerRef.current = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        clearInterval(timerRef.current)
        timerRef.current = null
        setAnswerTimeRemaining(0)
      } else {
        setAnswerTimeRemaining(remaining)
      }
    }, 1000)
  }, [])

  // Setup socket event listeners
  const setupSocketListeners = useCallback((socket) => {
    socket.on('answer_time_started', (data) => {
      console.log('🎯 Answer time started!', data)
      setIsAnswerTime(true)
      setHasAnswered(false)
      setSelectedAnswer(null)
      setResults(null)
      setScreen(SCREENS.ANSWER)
      // Start timer from full question wait time
      const questionWaitTime = data.questionWaitTime || 30
      startAnswerTimer(questionWaitTime)
    })

    socket.on('player_results', (data) => {
      console.log('📊 Results received!', data)
      // Only process results meant for this player
      if (data.userId && uidRef.current && data.userId !== uidRef.current) {
        console.log('⚠️ Ignoring results for different user:', data.userId)
        return
      }
      // Clear answer timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setAnswerTimeRemaining(null)
      setResults({
        questionScore: data.questionScore,
        cumulativeScore: data.cumulativeScore,
        rank: data.rank,
        isCorrect: data.isCorrect,
        answered: data.answered
      })
      setIsAnswerTime(false)
      setScreen(SCREENS.RESULT)
    })

    socket.on('game_closed', (data) => {
      console.log('🚫 Game closed!', data)
      // Clear answer timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setAnswerTimeRemaining(null)
      setScreen(SCREENS.GAME_OVER)
      socket.disconnect()
      socketRef.current = null
    })

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected')
    })
  }, [startAnswerTimer])

  // Join game
  const joinGame = async (name, icon) => {
    setLoading(true)
    setError('')

    try {
      const cleanPin = gamePin.replace(/-/g, '')

      // Guard: ensure serverUrl is resolved before connecting
      if (!serverUrl) {
        console.error('❌ Cannot join: serverUrl not resolved yet')
        setError(language === 'he' ? 'השרת עדיין לא מוכן, נסו שוב' : 'Server not ready, please try again')
        setLoading(false)
        return
      }

      // Create WebSocket to the resolved game server
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false,
        forceNew: true
      })

      await new Promise((resolve, reject) => {
        socket.on('connect', resolve)
        socket.on('connect_error', reject)
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      })

      console.log(`✅ Socket connected: ${socket.id}`)

      // Join via REST — include stored UID for reconnection
      const storedUid = sessionStorage.getItem(`quizngo_uid_${cleanPin}`)
      const joinBody = {
        game_pin: cleanPin,
        name: name,
        icon: icon,
        socketId: socket.id
      }
      if (storedUid) {
        joinBody.uid = storedUid
      }
      const response = await fetch(`${serverUrl}/?join_player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(joinBody)
      })

      const data = await response.json()

      if (response.ok && data.uid) {
        setUid(data.uid)
        uidRef.current = data.uid
        // Persist UID for reconnection
        sessionStorage.setItem(`quizngo_uid_${cleanPin}`, data.uid)
        setPlayerName(name)
        setPlayerIcon(icon)
        socketRef.current = socket
        setupSocketListeners(socket)

        // Determine which screen to show based on current game state
        const gameState = data.gameState || 'waiting'
        const isGameStarted = data.gameStarted || false
        setGameStarted(isGameStarted)

        if (gameState === 'answering' && data.needsSync && data.remainingTime > 0) {
          // Mid-question join: show answer screen with remaining time
          console.log(`⏱️ Mid-question join: ${data.remainingTime}s remaining`)
          setIsAnswerTime(true)
          setHasAnswered(false)
          setSelectedAnswer(null)
          setResults(null)
          setScreen(SCREENS.ANSWER)
          startAnswerTimer(data.remainingTime)
        } else if (gameState === 'results') {
          // Between questions: wait in lobby for next question
          console.log('📊 Joined between questions, waiting in lobby')
          setScreen(SCREENS.LOBBY)
        } else {
          // Default: lobby (waiting for game to start or next question)
          setScreen(SCREENS.LOBBY)
        }

        console.log(`✅ Joined game! UID: ${data.uid}, state: ${gameState}`)
      } else {
        socket.disconnect()
        setError(data.message || data.error || 'Failed to join game')
      }
    } catch (err) {
      console.error('❌ Join error:', err)
      setError(err.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  const showPinError = useCallback((message) => {
    setPinError(message)
    if (pinErrorTimeoutRef.current) {
      clearTimeout(pinErrorTimeoutRef.current)
    }
    pinErrorTimeoutRef.current = setTimeout(() => {
      setPinError('')
      pinErrorTimeoutRef.current = null
    }, 3000)
  }, [])

  const validatePinAndContinue = async () => {
    if (checkingPin) return

    setCheckingPin(true)
    setPinError('')

    try {
      const cleanPin = gamePin.replace(/-/g, '')

      // Step 1: Resolve PIN via Load Balancer to get the game server URL
      const lbResponse = await fetch(`${LB_URL}/api/resolve/${cleanPin}`)
      const lbData = await lbResponse.json()

      if (!lbResponse.ok || lbData.status !== 'success') {
        showPinError(language === 'he' ? 'לא נמצא חדר עם PIN זה' : 'No room found with this PIN')
        return
      }

      const resolvedServerUrl = lbData.server_url
      setServerUrl(resolvedServerUrl)

      // Step 2: Check game status on the actual game server
      const response = await fetch(`${resolvedServerUrl}/?check_active_game&game_pin=${cleanPin}`)
      const data = await response.json()

      if (response.ok && data.status === 'success' && data.active) {
        if (!data.gameStarted) {
          showPinError(language === 'he' ? 'המשחק עדיין לא התחיל, נסו שוב בעוד רגע' : 'Game has not started yet, try again in a moment')
        } else {
          setError('')
          if (data.language) {
            setLanguage(data.language)
          }
          setScreen(SCREENS.NAME)
        }
      } else {
        showPinError(language === 'he' ? 'לא נמצא חדר עם PIN זה' : 'No room found with this PIN')
      }
    } catch (err) {
      console.error('PIN validation error:', err)
      showPinError(language === 'he' ? 'שגיאה בבדיקת החדר, נסו שוב' : 'Error checking room, try again')
    } finally {
      setCheckingPin(false)
    }
  }

  // Submit answer
  const submitAnswer = async (answerIndex) => {
    if (!uid || hasAnswered) return

    setHasAnswered(true)
    setSelectedAnswer(answerIndex)

    try {
      const response = await fetch(`${serverUrl}/submit_answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          answerIndex: answerIndex,
          timestamp: Date.now()
        })
      })

      const data = await response.json()
      if (data.status !== 'success') {
        console.error('Answer submit failed:', data.message)
      }
    } catch (err) {
      console.error('❌ Submit error:', err)
    }
  }

  // Play again (reset to PIN screen)
  const playAgain = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    // Clear stored UID for old game
    if (gamePin) {
      const cleanPin = gamePin.replace(/-/g, '')
      sessionStorage.removeItem(`quizngo_uid_${cleanPin}`)
    }
    setScreen(SCREENS.PIN)
    setGamePin('')
    setServerUrl(null)
    setPlayerName('')
    setPlayerIcon('')
    setUid(null)
    uidRef.current = null
    setResults(null)
    setHasAnswered(false)
    setSelectedAnswer(null)
    setIsAnswerTime(false)
    setAnswerTimeRemaining(null)
    setError('')
    setPinError('')
    setCheckingPin(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pinErrorTimeoutRef.current) {
        clearTimeout(pinErrorTimeoutRef.current)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  const showLanguageSwitcher = screen !== SCREENS.PIN

  return (
    <div className="game-app">
      {showLanguageSwitcher && (
        <LanguageSwitcher language={language} setLanguage={setLanguage} />
      )}

      {screen === SCREENS.PIN && (
        <PinScreen
          gamePin={gamePin}
          setGamePin={setGamePin}
          onSubmit={validatePinAndContinue}
          error={pinError}
          loading={checkingPin}
          language={language}
        />
      )}

      {screen === SCREENS.NAME && (
        <NameScreen
          onJoin={joinGame}
          error={error}
          loading={loading || (urlPin && !serverUrl)}
          language={language}
        />
      )}

      {screen === SCREENS.LOBBY && (
        <LobbyScreen
          playerName={playerName}
          playerIcon={playerIcon}
          language={language}
          gameStarted={gameStarted}
        />
      )}

      {screen === SCREENS.ANSWER && (
        <AnswerScreen
          onAnswer={submitAnswer}
          hasAnswered={hasAnswered}
          selectedAnswer={selectedAnswer}
          language={language}
          timeRemaining={answerTimeRemaining}
        />
      )}

      {screen === SCREENS.RESULT && (
        <ResultScreen
          results={results}
          selectedAnswer={selectedAnswer}
          language={language}
        />
      )}

      {screen === SCREENS.GAME_OVER && (
        <GameOverScreen
          results={results}
          onPlayAgain={playAgain}
          language={language}
        />
      )}
    </div>
  )
}

export default App
