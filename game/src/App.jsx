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
import { USER_ICONS } from './icons'

const DEFAULT_LB_URL = (() => {
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://${host}:5000`
  }
  return 'https://srv.quizngo.online'
})()
const LB_URL = (import.meta.env.VITE_LB_URL || DEFAULT_LB_URL).replace(/\/+$/, '')

// Screens: pin -> name -> lobby -> answer -> result -> (answer again) -> gameOver
const SCREENS = {
  PIN: 'pin',
  NAME: 'name',
  LOBBY: 'lobby',
  ANSWER: 'answer',
  RESULT: 'result',
  GAME_OVER: 'gameOver'
}

const DEFAULT_LANGUAGE = 'en'
const PLAYER_PROFILE_STORAGE_KEY = 'quizngo_player_profile'

function readStoredPlayerProfile() {
  try {
    const rawProfile = localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY)
    if (!rawProfile) return { name: '', icon: USER_ICONS[0] }

    const profile = JSON.parse(rawProfile)
    const name = typeof profile.name === 'string' ? profile.name.trim().slice(0, 16) : ''
    const icon = USER_ICONS.includes(profile.icon) ? profile.icon : USER_ICONS[0]

    return { name, icon }
  } catch (err) {
    console.warn('Failed to read stored player profile:', err)
    return { name: '', icon: USER_ICONS[0] }
  }
}

function storePlayerProfile(name, icon) {
  try {
    localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify({
      name: name.trim().slice(0, 16),
      icon: USER_ICONS.includes(icon) ? icon : USER_ICONS[0]
    }))
  } catch (err) {
    console.warn('Failed to store player profile:', err)
  }
}

function resetViewportPosition() {
  window.scrollTo(0, 0)
  document.documentElement.scrollLeft = 0
  document.body.scrollLeft = 0
}

const SERVER_CODE_MESSAGES = {
  ROOM_NOT_FOUND_ADD_IN_MUST_CREATE_ROOM_FIRST: {
    he: 'חדר לא נמצא. יש ליצור חדר תחילה.',
    en: 'Room not found. Create room first.',
    ar: 'الغرفة غير موجودة. يرجى إنشاء غرفة أولاً.',
    zh: '未找到房间，请先创建房间。',
    es: 'Sala no encontrada. Crea una sala primero.',
    fr: "Salle introuvable. Créez d'abord une salle.",
    de: 'Raum nicht gefunden. Erstelle zuerst einen Raum.',
    pt: 'Sala não encontrada. Crie uma sala primeiro.',
    ru: 'Комната не найдена. Сначала создайте комнату.',
    ja: '部屋が見つかりません。先に部屋を作成してください。',
    hi: 'कमरा नहीं मिला। पहले कमरा बनाएँ।',
    ko: '방을 찾을 수 없습니다. 먼저 방을 만드세요.',
  },
  NO_ACTIVE_GAME_FOUND_WITH_PIN: {
    he: 'לא נמצא משחק פעיל עם הקוד {{gamePin}}',
    en: 'No active game found with PIN {{gamePin}}',
    ar: 'لا توجد لعبة نشطة بالرمز {{gamePin}}',
    zh: '未找到PIN码为 {{gamePin}} 的活跃游戏',
    es: 'No se encontró juego activo con el PIN {{gamePin}}',
    fr: 'Aucun jeu actif trouvé avec le PIN {{gamePin}}',
    de: 'Kein aktives Spiel mit PIN {{gamePin}} gefunden',
    pt: 'Nenhum jogo ativo encontrado com o PIN {{gamePin}}',
    ru: 'Активная игра с PIN {{gamePin}} не найдена',
    ja: 'PIN {{gamePin}} のアクティブなゲームが見つかりません',
    hi: 'PIN {{gamePin}} के साथ कोई सक्रिय गेम नहीं मिला',
    ko: 'PIN {{gamePin}}의 활성 게임을 찾을 수 없습니다',
  },
  GAME_HAS_NOT_STARTED_YET_PLEASE_WAIT_FOR_THE_HOST: {
    he: 'המשחק עדיין לא התחיל. יש להמתין למארח.',
    en: 'Game has not started yet. Please wait for the host.',
    ar: 'لم تبدأ اللعبة بعد. يرجى الانتظار للمضيف.',
    zh: '游戏尚未开始，请等待主持人。',
    es: 'El juego aún no ha comenzado. Por favor espera al anfitrión.',
    fr: "Le jeu n'a pas encore commencé. Veuillez attendre l'hôte.",
    de: 'Das Spiel hat noch nicht begonnen. Bitte warte auf den Gastgeber.',
    pt: 'O jogo ainda não começou. Por favor aguarde o anfitrião.',
    ru: 'Игра ещё не началась. Пожалуйста, подождите ведущего.',
    ja: 'ゲームはまだ始まっていません。ホストをお待ちください。',
    hi: 'गेम अभी तक शुरू नहीं हुआ। कृपया होस्ट की प्रतीक्षा करें।',
    ko: '게임이 아직 시작되지 않았습니다. 호스트를 기다려주세요.',
  },
  GAME_SESSION_NOT_FOUND: {
    he: 'סשן המשחק לא נמצא',
    en: 'Game session not found',
    ar: 'جلسة اللعبة غير موجودة',
    zh: '未找到游戏会话',
    es: 'Sesión de juego no encontrada',
    fr: 'Session de jeu introuvable',
    de: 'Spielsitzung nicht gefunden',
    pt: 'Sessão de jogo não encontrada',
    ru: 'Игровая сессия не найдена',
    ja: 'ゲームセッションが見つかりません',
    hi: 'गेम सत्र नहीं मिला',
    ko: '게임 세션을 찾을 수 없습니다',
  },
  GAME_IS_NO_LONGER_ACTIVE: {
    he: 'המשחק כבר אינו פעיל',
    en: 'Game is no longer active',
    ar: 'اللعبة لم تعد نشطة',
    zh: '游戏已结束',
    es: 'El juego ya no está activo',
    fr: "Le jeu n'est plus actif",
    de: 'Das Spiel ist nicht mehr aktiv',
    pt: 'O jogo não está mais ativo',
    ru: 'Игра больше не активна',
    ja: 'ゲームはすでに終了しました',
    hi: 'गेम अब सक्रिय नहीं है',
    ko: '게임이 더 이상 활성화되어 있지 않습니다',
  },
  INVALID_GAME_PIN: {
    he: 'קוד משחק לא תקין',
    en: 'Invalid game PIN',
    ar: 'رمز اللعبة غير صالح',
    zh: '游戏PIN码无效',
    es: 'PIN de juego inválido',
    fr: 'PIN du jeu invalide',
    de: 'Ungültige Spiel-PIN',
    pt: 'PIN do jogo inválido',
    ru: 'Неверный PIN игры',
    ja: '無効なゲームPINです',
    hi: 'अमान्य गेम PIN',
    ko: '유효하지 않은 게임 PIN',
  },
  SERVER_ERROR: {
    he: 'שגיאת שרת פנימית',
    en: 'Internal server error',
    ar: 'خطأ داخلي في الخادم',
    zh: '服务器内部错误',
    es: 'Error interno del servidor',
    fr: 'Erreur interne du serveur',
    de: 'Interner Serverfehler',
    pt: 'Erro interno do servidor',
    ru: 'Внутренняя ошибка сервера',
    ja: 'サーバー内部エラー',
    hi: 'आंतरिक सर्वर त्रुटि',
    ko: '내부 서버 오류',
  },
  NAME_ALREADY_IN_USE: {
    he: 'השם "{{name}}" כבר תפוס על ידי שחקן אחר',
    en: 'The name "{{name}}" is already taken by another player',
    ar: 'الاسم "{{name}}" محجوز من قِبل لاعب آخر',
    zh: '名字"{{name}}"已被其他玩家使用',
    es: 'El nombre "{{name}}" ya está en uso por otro jugador',
    fr: 'Le nom "{{name}}" est déjà utilisé par un autre joueur',
    de: 'Der Name "{{name}}" wird bereits von einem anderen Spieler verwendet',
    pt: 'O nome "{{name}}" já está em uso por outro jogador',
    ru: 'Имя "{{name}}" уже занято другим игроком',
    ja: '「{{name}}」という名前は他のプレイヤーが使用中です',
    hi: '"{{name}}" नाम पहले से किसी अन्य खिलाड़ी द्वारा उपयोग में है',
    ko: '"{{name}}" 이름은 이미 다른 플레이어가 사용 중입니다',
  },
}

function formatServerMessage(message, language = 'en', fallback = 'Server error') {
  if (!message) return fallback
  if (typeof message === 'string') return message

  if (typeof message === 'object') {
    const code = typeof message.code === 'string' ? message.code.toUpperCase() : ''
    if (!code) return fallback

    const params = message.params || {}
    const templateSet = SERVER_CODE_MESSAGES[code]
    const template = (templateSet && (templateSet[language] || templateSet.en)) || code.replace(/_/g, ' ').toLowerCase()
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      params[key] !== undefined ? String(params[key]) : '',
    )
  }

  return fallback
}

function isClosedGameResponse(data) {
  if (data?.game_closed) return true

  const message = data?.message
  if (typeof message === 'object' && message?.code) {
    const code = message.code.toUpperCase()
    return code === 'NO_ACTIVE_GAME_FOUND_WITH_PIN' ||
      code === 'GAME_IS_NO_LONGER_ACTIVE' ||
      code === 'GAME_SESSION_NOT_FOUND'
  }

  if (typeof message === 'string') {
    return /no active game found|game is no longer active|game session not found|game has been closed/i.test(message)
  }

  return false
}

function App() {
  // Check URL for pin parameter
  const urlParams = new URLSearchParams(window.location.search)
  const urlPin = urlParams.get('pin')
  const urlLang = urlParams.get('lang')

  const [screen, setScreen] = useState(urlPin ? SCREENS.NAME : SCREENS.PIN)
  const [gamePin, setGamePin] = useState(urlPin || '')
  const [storedPlayerProfile, setStoredPlayerProfile] = useState(readStoredPlayerProfile)
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
  const [language, setLanguage] = useState(urlLang || DEFAULT_LANGUAGE)
  const [answerTimeRemaining, setAnswerTimeRemaining] = useState(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [serverUrl, setServerUrl] = useState(null)
  const [disconnected, setDisconnected] = useState(false)

  const socketRef = useRef(null)
  const pinErrorTimeoutRef = useRef(null)
  const errorTimeoutRef = useRef(null)
  const timerRef = useRef(null)
  const uidRef = useRef(null)
  const gameClosedRef = useRef(false)
  const streakCountRef = useRef(0)
  const finalStatsRef = useRef({
    correctAnswers: 0,
    totalQuestions: 0,
    bestStreak: 0
  })

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
            setPinError('Game not found with this PIN')
            setScreen(SCREENS.PIN)
          }
        })
        .catch(err => {
          // Network error - show error and go back to PIN screen
          console.error('Failed to resolve PIN from URL:', err)
          setPinError('Network error - cannot find game')
          setScreen(SCREENS.PIN)
        })
    }
  }, [urlPin, serverUrl, language])

  // Apply direction when language changes. The PIN screen is intentionally
  // language-neutral/LTR, so returning home must clear any previous RTL state.
  useEffect(() => {
    applyDirection(screen === SCREENS.PIN ? DEFAULT_LANGUAGE : language)
    resetViewportPosition()
  }, [language, screen])

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

  const returnHomeSilently = useCallback((socket = null) => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (gamePin) {
      const cleanPin = gamePin.replace(/-/g, '')
      sessionStorage.removeItem(`quizngo_uid_${cleanPin}`)
    }
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    const activeSocket = socket || socketRef.current
    if (activeSocket) {
      activeSocket.off('disconnect')
      activeSocket.disconnect()
      if (socketRef.current === activeSocket) {
        socketRef.current = null
      }
    }

    setScreen(SCREENS.PIN)
    setGamePin('')
    setServerUrl(null)
    setLanguage(urlLang || DEFAULT_LANGUAGE)
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
    setLoading(false)
    setCheckingPin(false)
    setDisconnected(false)
    gameClosedRef.current = false
    streakCountRef.current = 0
    finalStatsRef.current = {
      correctAnswers: 0,
      totalQuestions: 0,
      bestStreak: 0
    }
  }, [gamePin, urlLang])

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
      const fallbackStreakCount = data.isCorrect ? streakCountRef.current + 1 : 0
      const streakCount = data.streakCount ?? fallbackStreakCount
      streakCountRef.current = streakCount
      const fallbackStats = finalStatsRef.current
      const finalStats = {
        correctAnswers: data.correctAnswers ?? (fallbackStats.correctAnswers + (data.isCorrect ? 1 : 0)),
        totalQuestions: data.totalQuestions ?? (fallbackStats.totalQuestions + 1),
        bestStreak: data.bestStreak ?? Math.max(fallbackStats.bestStreak, streakCount)
      }
      finalStatsRef.current = finalStats
      setResults({
        questionScore: data.questionScore,
        cumulativeScore: data.cumulativeScore,
        rank: data.rank,
        isCorrect: data.isCorrect,
        correctAnswer: data.correctAnswer,
        streakCount,
        correctAnswers: finalStats.correctAnswers,
        totalQuestions: finalStats.totalQuestions,
        bestStreak: finalStats.bestStreak,
        answered: data.answered
      })
      setIsAnswerTime(false)
      setScreen(SCREENS.RESULT)
    })

    socket.on('game_closed', (data) => {
      console.log('🚫 Game closed!', data)
      gameClosedRef.current = true

      const reasonCode = data?.reason?.code || data?.message?.params?.reason
      if (reasonCode === 'COMPLETED' || reasonCode === 'MANUAL') {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        setAnswerTimeRemaining(null)
        setIsAnswerTime(false)
        setHasAnswered(false)
        setSelectedAnswer(null)
        socket.off('disconnect')
        socket.disconnect()
        if (socketRef.current === socket) {
          socketRef.current = null
        }
        setScreen(SCREENS.GAME_OVER)
        return
      }

      returnHomeSilently(socket)
    })

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected')
      // Only show disconnected overlay if this wasn't a normal game_closed
      if (!gameClosedRef.current) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        setAnswerTimeRemaining(null)
        setDisconnected(true)
      }
    })
  }, [returnHomeSilently, startAnswerTimer])

  const showError = useCallback((message) => {
    setError(message)
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current)
    }
    errorTimeoutRef.current = setTimeout(() => {
      setError('')
      errorTimeoutRef.current = null
    }, 3000)
  }, [])

  // Join game
  const joinGame = async (name, icon) => {
    setLoading(true)
    setError('')

    try {
      const cleanPin = gamePin.replace(/-/g, '')

      // Guard: ensure serverUrl is resolved before connecting
      if (!serverUrl) {
        console.error('❌ Cannot join: serverUrl not resolved yet')
        showError(language === 'he' ? 'השרת עדיין לא מוכן, נסו שוב' : 'Server not ready, please try again')
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
        const playerProfile = {
          name: name.trim().slice(0, 16),
          icon: USER_ICONS.includes(icon) ? icon : USER_ICONS[0]
        }
        storePlayerProfile(playerProfile.name, playerProfile.icon)
        setStoredPlayerProfile(playerProfile)
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
        if (isClosedGameResponse(data)) {
          returnHomeSilently(socket)
          return
        }
        socket.off('disconnect')
        socket.disconnect()
        showError(formatServerMessage(data.message, language, data.error || 'Failed to join game'))
      }
    } catch (err) {
      console.error('❌ Join error:', err)
      showError(err.message || 'Connection failed')
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
        showPinError('No room found with this PIN')
        return
      }

      const resolvedServerUrl = lbData.server_url
      setServerUrl(resolvedServerUrl)

      // Step 2: Check game status on the actual game server
      const response = await fetch(`${resolvedServerUrl}/?check_active_game&game_pin=${cleanPin}`)
      const data = await response.json()

      if (response.ok && data.status === 'success') {
        if (!data.active) {
          returnHomeSilently()
        } else if (!data.gameStarted) {
          showPinError('Game has not started yet')
        } else {
          setPinError('')
          if (data.language) {
            setLanguage(data.language)
          }
          setScreen(SCREENS.NAME)
        }
      } else {
        showPinError('Error checking room, try again')
      }
    } catch (err) {
      console.error('PIN validation error:', err)
      showPinError('Error checking room, try again')
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
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    // Clear stored UID for old game
    if (gamePin) {
      const cleanPin = gamePin.replace(/-/g, '')
      sessionStorage.removeItem(`quizngo_uid_${cleanPin}`)
    }
    // Clear URL params so a page-reload doesn't jump back to NameScreen
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    setScreen(SCREENS.PIN)
    setGamePin('')
    setServerUrl(null)
    setLanguage(urlLang || DEFAULT_LANGUAGE)
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
    setDisconnected(false)
    gameClosedRef.current = false
    streakCountRef.current = 0
    finalStatsRef.current = {
      correctAnswers: 0,
      totalQuestions: 0,
      bestStreak: 0
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pinErrorTimeoutRef.current) {
        clearTimeout(pinErrorTimeoutRef.current)
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  return (
    <div>
      {disconnected && (
        <div className="qng-screen qng-screen--disconnect">
          <div className="qng-screen-center">
            <div className="qng-disconnect-icon-tile">📡</div>
            <div className="qng-disconnect-title">
              {language === 'he' ? 'החיבור אבד' : 'You got dropped'}
            </div>
            <div className="qng-disconnect-body">
              {language === 'he'
                ? 'השרת לא זמין. המשחק נסגר.'
                : 'The game server vanished. Hop back home to try again.'}
            </div>
            <button className="qng-btn qng-btn--yellow" onClick={playAgain} style={{ marginTop: 14, maxWidth: 320 }}>
              {language === 'he' ? 'חזרה למסך הראשי' : 'BACK TO HOME'}
            </button>
          </div>
        </div>
      )}

      {screen === SCREENS.PIN && (
        <PinScreen
          gamePin={gamePin}
          setGamePin={setGamePin}
          onSubmit={validatePinAndContinue}
          error={pinError}
          loading={checkingPin}
        />
      )}

      {screen === SCREENS.NAME && (
        <NameScreen
          onJoin={joinGame}
          error={error}
          loading={loading || (urlPin && !serverUrl)}
          language={language}
          defaultName={storedPlayerProfile.name}
          defaultIcon={storedPlayerProfile.icon}
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
