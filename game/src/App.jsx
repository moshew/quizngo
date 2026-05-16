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
const ACTIVE_GAME_PIN_STORAGE_KEY = 'quizngo_active_game_pin'
const RECONNECT_TIMEOUT_MS = 30000
const RECONNECT_OVERLAY_DELAY_MS = 1200

function normalizePin(pin = '') {
  return String(pin).replace(/[^0-9]/g, '')
}

function readStoredActiveGamePin() {
  try {
    const pin = normalizePin(sessionStorage.getItem(ACTIVE_GAME_PIN_STORAGE_KEY) || '')
    return pin.length === 6 ? pin : ''
  } catch (err) {
    console.warn('Failed to read active game PIN:', err)
    return ''
  }
}

function storeActiveGamePin(pin) {
  try {
    const cleanPin = normalizePin(pin)
    if (cleanPin.length === 6) {
      sessionStorage.setItem(ACTIVE_GAME_PIN_STORAGE_KEY, cleanPin)
    }
  } catch (err) {
    console.warn('Failed to store active game PIN:', err)
  }
}

function clearStoredActiveGamePin() {
  try {
    sessionStorage.removeItem(ACTIVE_GAME_PIN_STORAGE_KEY)
  } catch (err) {
    console.warn('Failed to clear active game PIN:', err)
  }
}

function readStoredUidForPin(pin) {
  try {
    const cleanPin = normalizePin(pin)
    return cleanPin.length === 6 ? sessionStorage.getItem(`quizngo_uid_${cleanPin}`) : null
  } catch (err) {
    console.warn('Failed to read stored player UID:', err)
    return null
  }
}

function removeSocketReconnectListeners(socket) {
  const handlers = socket?.__quizngoReconnectHandlers
  if (!handlers || !socket.io) return

  socket.io.off('reconnect_attempt', handlers.handleReconnectAttempt)
  socket.io.off('reconnect', handlers.handleReconnect)
  socket.io.off('reconnect_error', handlers.handleReconnectError)
  socket.io.off('reconnect_failed', handlers.handleReconnectFailed)
  delete socket.__quizngoReconnectHandlers
}

function disconnectManagedSocket(socket) {
  if (!socket) return
  removeSocketReconnectListeners(socket)
  socket.removeAllListeners()
  socket.disconnect()
}

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
  const initialGamePin = useRef(normalizePin(urlPin || readStoredActiveGamePin())).current

  const [screen, setScreen] = useState(initialGamePin ? SCREENS.NAME : SCREENS.PIN)
  const [gamePin, setGamePin] = useState(initialGamePin)
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
  const [lobbyMode, setLobbyMode] = useState('waiting')
  const [serverUrl, setServerUrl] = useState(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [autoJoinVisible, setAutoJoinVisible] = useState(() => {
    const cleanInitialPin = normalizePin(initialGamePin)
    return cleanInitialPin.length === 6 &&
      !!readStoredUidForPin(cleanInitialPin) &&
      !!storedPlayerProfile.name
  })

  const socketRef = useRef(null)
  const pinErrorTimeoutRef = useRef(null)
  const errorTimeoutRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectOverlayDelayRef = useRef(null)
  const rejoinRetryTimeoutRef = useRef(null)
  const rejoinInProgressRef = useRef(false)
  const autoJoinAttemptedRef = useRef(false)
  const timerRef = useRef(null)
  const uidRef = useRef(null)
  const gamePinRef = useRef(initialGamePin)
  const serverUrlRef = useRef(null)
  const playerNameRef = useRef('')
  const playerIconRef = useRef('')
  const languageRef = useRef(urlLang || DEFAULT_LANGUAGE)
  const screenRef = useRef(initialGamePin ? SCREENS.NAME : SCREENS.PIN)
  const resultsRef = useRef(null)
  const hasAnsweredRef = useRef(false)
  const selectedAnswerRef = useRef(null)
  const reconnectingRef = useRef(false)
  const gameClosedRef = useRef(false)
  const streakCountRef = useRef(0)
  const finalStatsRef = useRef({
    correctAnswers: 0,
    totalQuestions: 0,
    bestStreak: 0
  })

  useEffect(() => {
    gamePinRef.current = gamePin
    serverUrlRef.current = serverUrl
    playerNameRef.current = playerName
    playerIconRef.current = playerIcon
    languageRef.current = language
    screenRef.current = screen
    resultsRef.current = results
    hasAnsweredRef.current = hasAnswered
    selectedAnswerRef.current = selectedAnswer
  }, [gamePin, serverUrl, playerName, playerIcon, language, screen, results, hasAnswered, selectedAnswer])

  useEffect(() => {
    autoJoinAttemptedRef.current = false
    setAutoJoinVisible(false)
  }, [gamePin])

  useEffect(() => {
    const cleanPin = normalizePin(gamePin)
    const canAutoJoin = screen === SCREENS.NAME &&
      cleanPin.length === 6 &&
      !uidRef.current &&
      !autoJoinAttemptedRef.current &&
      !!readStoredUidForPin(cleanPin) &&
      !!storedPlayerProfile.name

    setAutoJoinVisible(canAutoJoin)
  }, [gamePin, screen, storedPlayerProfile.name])

  // Resolve server URL via LB for direct-link or same-tab automatic resume.
  useEffect(() => {
    const cleanPin = normalizePin(gamePin)
    if (screen === SCREENS.NAME && cleanPin.length === 6 && !serverUrl) {
      fetch(`${LB_URL}/api/resolve/${cleanPin}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            serverUrlRef.current = data.server_url
            setServerUrl(data.server_url)
          } else {
            // Failed to resolve - show error and go back to PIN screen
            console.error('Failed to resolve PIN:', data.message)
            clearStoredActiveGamePin()
            setPinError('Game not found with this PIN')
            setScreen(SCREENS.PIN)
          }
        })
        .catch(err => {
          // Network error - show error and go back to PIN screen
          console.error('Failed to resolve PIN from URL:', err)
          clearStoredActiveGamePin()
          setPinError('Network error - cannot find game')
          setScreen(SCREENS.PIN)
        })
    }
  }, [screen, gamePin, serverUrl])

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

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const clearReconnectOverlayDelay = useCallback(() => {
    if (reconnectOverlayDelayRef.current) {
      clearTimeout(reconnectOverlayDelayRef.current)
      reconnectOverlayDelayRef.current = null
    }
  }, [])

  const finishReconnecting = useCallback(() => {
    reconnectingRef.current = false
    clearReconnectTimeout()
    clearReconnectOverlayDelay()
    if (rejoinRetryTimeoutRef.current) {
      clearTimeout(rejoinRetryTimeoutRef.current)
      rejoinRetryTimeoutRef.current = null
    }
    setReconnecting(false)
  }, [clearReconnectOverlayDelay, clearReconnectTimeout])

  const returnHomeSilently = useCallback((socket = null) => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const cleanPin = normalizePin(gamePinRef.current || gamePin)
    if (cleanPin) {
      sessionStorage.removeItem(`quizngo_uid_${cleanPin}`)
    }
    clearStoredActiveGamePin()
    finishReconnecting()
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    const activeSocket = socket || socketRef.current
    if (activeSocket) {
      disconnectManagedSocket(activeSocket)
      if (socketRef.current === activeSocket) {
        socketRef.current = null
      }
    }

    setScreen(SCREENS.PIN)
    setGamePin('')
    gamePinRef.current = ''
    setServerUrl(null)
    serverUrlRef.current = null
    setLanguage(urlLang || DEFAULT_LANGUAGE)
    setPlayerName('')
    playerNameRef.current = ''
    setPlayerIcon('')
    playerIconRef.current = ''
    setUid(null)
    uidRef.current = null
    setResults(null)
    resultsRef.current = null
    setHasAnswered(false)
    hasAnsweredRef.current = false
    setSelectedAnswer(null)
    selectedAnswerRef.current = null
    setIsAnswerTime(false)
    setAnswerTimeRemaining(null)
    setLobbyMode('waiting')
    setError('')
    setPinError('')
    setLoading(false)
    setCheckingPin(false)
    setReconnecting(false)
    gameClosedRef.current = false
    streakCountRef.current = 0
    finalStatsRef.current = {
      correctAnswers: 0,
      totalQuestions: 0,
      bestStreak: 0
    }
  }, [finishReconnecting, gamePin, urlLang])

  const beginReconnecting = useCallback(() => {
    if (gameClosedRef.current) return

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setAnswerTimeRemaining(null)

    if (!reconnectingRef.current) {
      reconnectingRef.current = true
    }

    const pageVisible = !document.visibilityState || document.visibilityState === 'visible'
    if (pageVisible && !reconnectOverlayDelayRef.current) {
      reconnectOverlayDelayRef.current = setTimeout(() => {
        reconnectOverlayDelayRef.current = null
        if (reconnectingRef.current && !gameClosedRef.current) {
          setReconnecting(true)
        }
      }, RECONNECT_OVERLAY_DELAY_MS)
    }

    if (pageVisible && !reconnectTimeoutRef.current) {
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!reconnectingRef.current) return
        reconnectingRef.current = false
        reconnectTimeoutRef.current = null
        returnHomeSilently(socketRef.current)
      }, RECONNECT_TIMEOUT_MS)
    }
  }, [returnHomeSilently])

  const failReconnecting = useCallback((socket = null) => {
    if (gameClosedRef.current) return
    returnHomeSilently(socket)
  }, [returnHomeSilently])

  const applyPlayerResult = useCallback((data) => {
    if (data.userId && uidRef.current && data.userId !== uidRef.current) {
      return false
    }

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
    const nextResults = {
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
    }
    resultsRef.current = nextResults
    setResults(nextResults)
    setIsAnswerTime(false)
    setLobbyMode('waiting')
    setScreen(SCREENS.RESULT)
    screenRef.current = SCREENS.RESULT
    return true
  }, [])

  const applyJoinedGameState = useCallback((data, { preserveCurrentAnswer = false, preserveCurrentResults = false } = {}) => {
    const gameState = data.gameState || 'waiting'
    const isGameStarted = data.gameStarted || false
    setGameStarted(isGameStarted)

    if (gameState === 'results' && data.playerResult && applyPlayerResult(data.playerResult)) {
      console.log('📊 Synced player result after reconnect')
      return
    }

    if (gameState === 'results' && preserveCurrentResults && resultsRef.current) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setAnswerTimeRemaining(null)
      setIsAnswerTime(false)
      setLobbyMode('waiting')
      setScreen(SCREENS.RESULT)
      screenRef.current = SCREENS.RESULT
      console.log('📊 Synced results state, keeping current result screen')
      return
    }

    const currentAnswer = data.currentAnswer || null
    const hasServerAnswer = currentAnswer?.answerIndex !== undefined && currentAnswer?.answerIndex !== null
    if (gameState === 'answering' && data.needsSync && (data.remainingTime > 0 || hasServerAnswer)) {
      console.log(`⏱️ Synced active question: ${data.remainingTime}s remaining`)
      const shouldKeepAnswer = hasServerAnswer || (preserveCurrentAnswer && hasAnsweredRef.current)
      const nextSelectedAnswer = hasServerAnswer ? currentAnswer.answerIndex : selectedAnswerRef.current
      setIsAnswerTime(true)
      setLobbyMode('waiting')
      setHasAnswered(shouldKeepAnswer)
      hasAnsweredRef.current = shouldKeepAnswer
      setSelectedAnswer(shouldKeepAnswer ? nextSelectedAnswer : null)
      if (!shouldKeepAnswer) {
        selectedAnswerRef.current = null
      } else {
        selectedAnswerRef.current = nextSelectedAnswer
      }
      setResults(null)
      resultsRef.current = null
      setScreen(SCREENS.ANSWER)
      screenRef.current = SCREENS.ANSWER
      if (data.remainingTime > 0) {
        startAnswerTimer(data.remainingTime)
      } else {
        setAnswerTimeRemaining(0)
      }
      return
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setAnswerTimeRemaining(null)
    setIsAnswerTime(false)
    setHasAnswered(false)
    hasAnsweredRef.current = false
    setSelectedAnswer(null)
    selectedAnswerRef.current = null

    if (gameState === 'results') {
      console.log('📊 Synced between questions, waiting in lobby')
      setLobbyMode('betweenQuestions')
    } else {
      setLobbyMode('waiting')
    }
    setScreen(SCREENS.LOBBY)
    screenRef.current = SCREENS.LOBBY
  }, [applyPlayerResult, startAnswerTimer])

  const rejoinConnectedSocket = useCallback(async (socket) => {
    if (rejoinInProgressRef.current) return

    const scheduleRejoinRetry = () => {
      if (rejoinRetryTimeoutRef.current || gameClosedRef.current) return
      rejoinRetryTimeoutRef.current = setTimeout(() => {
        rejoinRetryTimeoutRef.current = null
        if (!reconnectingRef.current || socketRef.current !== socket || gameClosedRef.current) {
          return
        }
        if (socket.connected) {
          rejoinConnectedSocket(socket)
        } else {
          socket.connect()
        }
      }, 1000)
    }

    const cleanPin = normalizePin(gamePinRef.current)
    const currentServerUrl = serverUrlRef.current
    const storedUid = readStoredUidForPin(cleanPin)
    const currentUid = uidRef.current || storedUid
    const fallbackProfile = readStoredPlayerProfile()
    const name = (playerNameRef.current || fallbackProfile.name).trim()
    const icon = playerIconRef.current || fallbackProfile.icon

    if (!socket?.connected || !currentServerUrl || cleanPin.length !== 6 || !currentUid || !name) {
      failReconnecting(socket)
      return
    }

    rejoinInProgressRef.current = true
    try {
      const response = await fetch(`${currentServerUrl}/?join_player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_pin: cleanPin,
          name,
          icon,
          socketId: socket.id,
          uid: currentUid
        })
      })
      const data = await response.json()

      if (response.ok && data.uid) {
        if (data.language) {
          setLanguage(data.language)
          languageRef.current = data.language
        }
        setUid(data.uid)
        uidRef.current = data.uid
        sessionStorage.setItem(`quizngo_uid_${cleanPin}`, data.uid)
        storeActiveGamePin(cleanPin)
        setGamePin(cleanPin)
        setPlayerName(name)
        setPlayerIcon(icon)
        playerNameRef.current = name
        playerIconRef.current = icon
        setStoredPlayerProfile({ name, icon })
        storePlayerProfile(name, icon)
        applyJoinedGameState(data, { preserveCurrentAnswer: true, preserveCurrentResults: true })
        finishReconnecting()
        console.log(`✅ Rejoined game after reconnect. UID: ${data.uid}`)
        return
      }

      if (isClosedGameResponse(data)) {
        returnHomeSilently(socket)
        return
      }

      console.error('❌ Rejoin failed:', data)
      beginReconnecting()
      scheduleRejoinRetry()
    } catch (err) {
      console.error('❌ Rejoin error:', err)
      beginReconnecting()
      scheduleRejoinRetry()
    } finally {
      rejoinInProgressRef.current = false
    }
  }, [applyJoinedGameState, beginReconnecting, failReconnecting, finishReconnecting, returnHomeSilently])

  // Setup socket event listeners
  const setupSocketListeners = useCallback((socket) => {
    const scheduleSocketRecovery = () => {
      if (rejoinRetryTimeoutRef.current || gameClosedRef.current) return
      rejoinRetryTimeoutRef.current = setTimeout(() => {
        rejoinRetryTimeoutRef.current = null
        if (!reconnectingRef.current || socketRef.current !== socket || gameClosedRef.current) {
          return
        }
        if (socket.connected) {
          rejoinConnectedSocket(socket)
        } else {
          socket.connect()
        }
      }, 1000)
    }

    socket.on('answer_time_started', (data) => {
      console.log('🎯 Answer time started!', data)
      finishReconnecting()
      setIsAnswerTime(true)
      setLobbyMode('waiting')
      setHasAnswered(false)
      hasAnsweredRef.current = false
      setSelectedAnswer(null)
      selectedAnswerRef.current = null
      setResults(null)
      resultsRef.current = null
      setScreen(SCREENS.ANSWER)
      screenRef.current = SCREENS.ANSWER
      // Start timer from full question wait time
      const questionWaitTime = data.questionWaitTime || 30
      startAnswerTimer(questionWaitTime)
    })

    socket.on('player_results', (data) => {
      console.log('📊 Results received!', data)
      finishReconnecting()
      if (!applyPlayerResult(data)) {
        console.log('⚠️ Ignoring results for different user:', data.userId)
      }
    })

    socket.on('game_closed', (data) => {
      console.log('🚫 Game closed!', data)
      gameClosedRef.current = true
      finishReconnecting()

      const reasonCode = data?.reason?.code || data?.message?.params?.reason
      if (reasonCode === 'COMPLETED' || reasonCode === 'MANUAL') {
        const cleanPin = normalizePin(gamePinRef.current)
        if (cleanPin) {
          sessionStorage.removeItem(`quizngo_uid_${cleanPin}`)
        }
        clearStoredActiveGamePin()
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      setAnswerTimeRemaining(null)
      setIsAnswerTime(false)
      setLobbyMode('waiting')
      setHasAnswered(false)
        hasAnsweredRef.current = false
        setSelectedAnswer(null)
        selectedAnswerRef.current = null
        disconnectManagedSocket(socket)
        if (socketRef.current === socket) {
          socketRef.current = null
        }
        setScreen(SCREENS.GAME_OVER)
        return
      }

      returnHomeSilently(socket)
    })

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason)
      // Show reconnecting while the client tries to recover. Mobile sleep can
      // leave Socket.IO inactive briefly, so let the reconnect timeout decide.
      if (gameClosedRef.current || reason === 'io client disconnect') {
        return
      }

      beginReconnecting()
      if (!socket.active) {
        socket.connect()
      }
    })

    socket.on('connect', () => {
      if (!uidRef.current || gameClosedRef.current) return
      rejoinConnectedSocket(socket)
    })

    socket.on('connect_error', () => {
      if (gameClosedRef.current) return
      beginReconnecting()
      scheduleSocketRecovery()
    })

    const handleReconnectAttempt = () => {
      beginReconnecting()
    }
    const handleReconnect = () => {
      rejoinConnectedSocket(socket)
    }
    const handleReconnectError = () => {
      beginReconnecting()
    }
    const handleReconnectFailed = () => {
      beginReconnecting()
      scheduleSocketRecovery()
    }

    socket.__quizngoReconnectHandlers = {
      handleReconnectAttempt,
      handleReconnect,
      handleReconnectError,
      handleReconnectFailed
    }
    socket.io.on('reconnect_attempt', handleReconnectAttempt)
    socket.io.on('reconnect', handleReconnect)
    socket.io.on('reconnect_error', handleReconnectError)
    socket.io.on('reconnect_failed', handleReconnectFailed)
  }, [
    beginReconnecting,
    failReconnecting,
    applyPlayerResult,
    finishReconnecting,
    rejoinConnectedSocket,
    returnHomeSilently,
    startAnswerTimer
  ])

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
  const joinGame = useCallback(async (name, icon) => {
    setLoading(true)
    setError('')
    let socket = null

    try {
      const cleanPin = normalizePin(gamePinRef.current || gamePin)
      const currentServerUrl = serverUrlRef.current || serverUrl
      const playerProfile = {
        name: name.trim().slice(0, 16),
        icon: USER_ICONS.includes(icon) ? icon : USER_ICONS[0]
      }

      // Guard: ensure serverUrl is resolved before connecting
      if (!currentServerUrl) {
        console.error('❌ Cannot join: serverUrl not resolved yet')
        showError(languageRef.current === 'he' ? 'השרת עדיין לא מוכן, נסו שוב' : 'Server not ready, please try again')
        setLoading(false)
        return
      }

      if (socketRef.current) {
        disconnectManagedSocket(socketRef.current)
        socketRef.current = null
      }

      // Create WebSocket to the resolved game server
      socket = io(currentServerUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 12,
        reconnectionDelay: 800,
        reconnectionDelayMax: 3000,
        timeout: 5000,
        forceNew: true
      })

      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          cleanup()
          reject(new Error('Connection timeout'))
        }, 5000)
        const cleanup = () => {
          clearTimeout(timeoutId)
          socket.off('connect', handleConnect)
          socket.off('connect_error', handleConnectError)
        }
        const handleConnect = () => {
          cleanup()
          resolve()
        }
        const handleConnectError = (err) => {
          cleanup()
          reject(err)
        }
        socket.once('connect', handleConnect)
        socket.once('connect_error', handleConnectError)
      })

      console.log(`✅ Socket connected: ${socket.id}`)

      // Join via REST — include stored UID for reconnection
      const storedUid = sessionStorage.getItem(`quizngo_uid_${cleanPin}`)
      const joinBody = {
        game_pin: cleanPin,
        name: playerProfile.name,
        icon: playerProfile.icon,
        socketId: socket.id
      }
      if (storedUid) {
        joinBody.uid = storedUid
      }
      const response = await fetch(`${currentServerUrl}/?join_player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(joinBody)
      })

      const data = await response.json()

      if (response.ok && data.uid) {
        if (data.language) {
          setLanguage(data.language)
          languageRef.current = data.language
        }
        setUid(data.uid)
        uidRef.current = data.uid
        // Persist UID for reconnection
        sessionStorage.setItem(`quizngo_uid_${cleanPin}`, data.uid)
        storeActiveGamePin(cleanPin)
        setGamePin(cleanPin)
        gamePinRef.current = cleanPin
        setPlayerName(playerProfile.name)
        setPlayerIcon(playerProfile.icon)
        playerNameRef.current = playerProfile.name
        playerIconRef.current = playerProfile.icon
        storePlayerProfile(playerProfile.name, playerProfile.icon)
        setStoredPlayerProfile(playerProfile)
        gameClosedRef.current = false
        finishReconnecting()
        socketRef.current = socket
        setupSocketListeners(socket)
        applyJoinedGameState(data)

        console.log(`✅ Joined game! UID: ${data.uid}, state: ${data.gameState || 'waiting'}`)
      } else {
        if (isClosedGameResponse(data)) {
          returnHomeSilently(socket)
          return
        }
        disconnectManagedSocket(socket)
        socket = null
        showError(formatServerMessage(data.message, languageRef.current, data.error || 'Failed to join game'))
      }
    } catch (err) {
      console.error('❌ Join error:', err)
      if (socket && socketRef.current !== socket) {
        disconnectManagedSocket(socket)
      }
      showError(err.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }, [
    applyJoinedGameState,
    finishReconnecting,
    gamePin,
    returnHomeSilently,
    serverUrl,
    setupSocketListeners,
    showError
  ])

  useEffect(() => {
    const cleanPin = normalizePin(gamePin)
    if (
      autoJoinAttemptedRef.current ||
      screen !== SCREENS.NAME ||
      !serverUrl ||
      loading ||
      uidRef.current ||
      cleanPin.length !== 6
    ) {
      return
    }

    const storedUid = readStoredUidForPin(cleanPin)
    if (!storedUid || !storedPlayerProfile.name) {
      return
    }

    autoJoinAttemptedRef.current = true
    setAutoJoinVisible(true)
    joinGame(storedPlayerProfile.name, storedPlayerProfile.icon).finally(() => {
      if (screenRef.current === SCREENS.NAME) {
        setAutoJoinVisible(false)
      }
    })
  }, [gamePin, joinGame, loading, screen, serverUrl, storedPlayerProfile])

  useEffect(() => {
    const markHidden = () => {
      clearReconnectTimeout()
    }

    const handleResume = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') {
        markHidden()
        return
      }

      const socket = socketRef.current

      if (!socket || !uidRef.current || gameClosedRef.current) {
        return
      }

      if (!socket.connected) {
        beginReconnecting()
        socket.connect()
        return
      }

      if (reconnectingRef.current) {
        beginReconnecting()
        rejoinConnectedSocket(socket)
        return
      }
    }

    document.addEventListener('visibilitychange', handleResume)
    window.addEventListener('pagehide', markHidden)
    window.addEventListener('pageshow', handleResume)

    return () => {
      document.removeEventListener('visibilitychange', handleResume)
      window.removeEventListener('pagehide', markHidden)
      window.removeEventListener('pageshow', handleResume)
    }
  }, [beginReconnecting, clearReconnectTimeout, rejoinConnectedSocket])

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
      const cleanPin = normalizePin(gamePin)

      // Step 1: Resolve PIN via Load Balancer to get the game server URL
      const lbResponse = await fetch(`${LB_URL}/api/resolve/${cleanPin}`)
      const lbData = await lbResponse.json()

      if (!lbResponse.ok || lbData.status !== 'success') {
        showPinError('No room found with this PIN')
        return
      }

      const resolvedServerUrl = lbData.server_url
      serverUrlRef.current = resolvedServerUrl
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
          setGamePin(cleanPin)
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
    hasAnsweredRef.current = true
    selectedAnswerRef.current = answerIndex

    try {
      const response = await fetch(`${serverUrlRef.current || serverUrl}/submit_answer`, {
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
    finishReconnecting()
    if (socketRef.current) {
      disconnectManagedSocket(socketRef.current)
      socketRef.current = null
    }
    // Clear stored UID for old game
    if (gamePin) {
      const cleanPin = normalizePin(gamePin)
      sessionStorage.removeItem(`quizngo_uid_${cleanPin}`)
    }
    clearStoredActiveGamePin()
    // Clear URL params so a page-reload doesn't jump back to NameScreen
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    setScreen(SCREENS.PIN)
    setGamePin('')
    gamePinRef.current = ''
    setServerUrl(null)
    serverUrlRef.current = null
    setLanguage(urlLang || DEFAULT_LANGUAGE)
    setPlayerName('')
    playerNameRef.current = ''
    setPlayerIcon('')
    playerIconRef.current = ''
    setUid(null)
    uidRef.current = null
    setResults(null)
    resultsRef.current = null
    setHasAnswered(false)
    hasAnsweredRef.current = false
    setSelectedAnswer(null)
    selectedAnswerRef.current = null
    setIsAnswerTime(false)
    setAnswerTimeRemaining(null)
    setLobbyMode('waiting')
    setError('')
    setPinError('')
    setCheckingPin(false)
    setReconnecting(false)
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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (reconnectOverlayDelayRef.current) {
        clearTimeout(reconnectOverlayDelayRef.current)
      }
      if (rejoinRetryTimeoutRef.current) {
        clearTimeout(rejoinRetryTimeoutRef.current)
      }
      if (socketRef.current) {
        disconnectManagedSocket(socketRef.current)
      }
    }
  }, [])

  const shouldShowAutoJoinScreen = screen === SCREENS.NAME && autoJoinVisible && !uid
  const shouldShowRecoveryScreen = reconnecting || shouldShowAutoJoinScreen

  return (
    <div>
      {shouldShowRecoveryScreen && (
        <div className="qng-screen qng-screen--disconnect">
          <div className="qng-screen-center">
            <div className="qng-disconnect-icon-tile">
              <div className="qng-spinner" aria-hidden="true" />
            </div>
            <div className="qng-disconnect-title">
              Reconnecting
            </div>
            <div className="qng-disconnect-body">
              Bringing you back into the game automatically...
            </div>
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

      {screen === SCREENS.NAME && !shouldShowAutoJoinScreen && (
        <NameScreen
          onJoin={joinGame}
          error={error}
          loading={loading || (screen === SCREENS.NAME && !!gamePin && !serverUrl)}
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
          mode={lobbyMode}
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
