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

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'

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

  const socketRef = useRef(null)
  const pinErrorTimeoutRef = useRef(null)

  // Apply direction when language changes
  useEffect(() => {
    applyDirection(language)
  }, [language])

  // Setup socket event listeners
  const setupSocketListeners = useCallback((socket) => {
    socket.on('answer_time_started', (data) => {
      console.log('🎯 Answer time started!', data)
      setIsAnswerTime(true)
      setHasAnswered(false)
      setSelectedAnswer(null)
      setResults(null)
      setScreen(SCREENS.ANSWER)
    })

    socket.on('player_results', (data) => {
      console.log('📊 Results received!', data)
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
      setScreen(SCREENS.GAME_OVER)
      socket.disconnect()
      socketRef.current = null
    })

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected')
    })
  }, [])

  // Join game
  const joinGame = async (name, icon) => {
    setLoading(true)
    setError('')

    try {
      const cleanPin = gamePin.replace(/-/g, '')

      // Create WebSocket first
      const socket = io(SERVER_URL, {
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

      // Join via REST
      const response = await fetch(`${SERVER_URL}/?join_player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_pin: cleanPin,
          name: name,
          icon: icon,
          socketId: socket.id
        })
      })

      const data = await response.json()

      if (response.ok && data.uid) {
        setUid(data.uid)
        setPlayerName(name)
        setPlayerIcon(icon)
        socketRef.current = socket
        setupSocketListeners(socket)
        setScreen(SCREENS.LOBBY)
        console.log(`✅ Joined game! UID: ${data.uid}`)
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
      const response = await fetch(`${SERVER_URL}/?check_active_game&game_pin=${cleanPin}`)
      const data = await response.json()

      if (response.ok && data.status === 'success' && data.active) {
        setError('')
        // Set language from server if available
        if (data.language) {
          setLanguage(data.language)
        }
        setScreen(SCREENS.NAME)
      } else {
        showPinError(language === 'he' ? 'לא נמצא חדר עם PIN זה' : 'No room found with this PIN')
      }
    } catch (err) {
      console.error('❌ PIN validation error:', err)
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
      const response = await fetch(`${SERVER_URL}/submit_answer`, {
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
    setScreen(SCREENS.PIN)
    setGamePin('')
    setPlayerName('')
    setPlayerIcon('')
    setUid(null)
    setResults(null)
    setHasAnswered(false)
    setSelectedAnswer(null)
    setIsAnswerTime(false)
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
          loading={loading}
          language={language}
        />
      )}

      {screen === SCREENS.LOBBY && (
        <LobbyScreen
          playerName={playerName}
          playerIcon={playerIcon}
          language={language}
        />
      )}

      {screen === SCREENS.ANSWER && (
        <AnswerScreen
          onAnswer={submitAnswer}
          hasAnswered={hasAnswered}
          selectedAnswer={selectedAnswer}
          language={language}
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
