/**
 * WebSocket Module
 * Handles all WebSocket connections and real-time updates
 * 
 * NEW ARCHITECTURE:
 * - WebSocket connects only when game starts (with gamePin)
 * - WebSocket disconnects when game ends
 * - 30-second reconnection timeout - after that, game closes
 * - gamePin is the primary room identifier (not hashId)
 */

import { isParticipantHidden, resetHiddenParticipants, getHiddenParticipantIds, unhideParticipant } from './state.js';

// WebSocket URL
export const WEBSOCKET_URL = 'http://localhost:5000';

// WebSocket instance
let socket = null;

// Connection state
let isConnecting = false;
let reconnectionTimeout = null;
let currentGamePin = null;
let reconnectionAttempts = 0;
const MAX_RECONNECTION_TIME_MS = 30000; // 30 seconds total
let reconnectionStartTime = null;

// Participants management - enhanced with scoring data
let participantsData = new Map(); // Map of userId -> { userId, nickname, score, lastAnswerTime, lastAnswerCorrect }

// Current question answer tracking
let currentQuestionAnswers = new Map(); // Map of userId -> { answerIndex, timestamp }

// Event config reference for reconnection
let eventConfig = null;

/**
 * Get the current socket instance
 */
export function getSocket() {
    return socket;
}

/**
 * Check if socket is connected
 */
export function isSocketConnected() {
    return socket && socket.connected;
}

/**
 * Get current game PIN
 */
export function getCurrentGamePin() {
    return currentGamePin;
}

/**
 * Connect WebSocket when game starts
 * This is called when the Add-in generates a gamePin and starts a game
 * @param {string} gamePin - The 6-digit game PIN
 * @param {object} config - Event handlers configuration
 */
export function connectWebSocket(gamePin, config = {}) {
    if (isConnecting) {
        console.log('⏳ Already connecting to WebSocket...');
        return null;
    }
    
    if (socket && socket.connected && currentGamePin === gamePin) {
        console.log('✅ Already connected to game:', gamePin);
        return socket;
    }
    
    // Disconnect existing socket if different game
    if (socket) {
        console.log('🔄 Disconnecting from previous game');
        disconnectWebSocket();
    }
    
    try {
        console.log('🔌 Connecting WebSocket for game:', gamePin);
        isConnecting = true;
        currentGamePin = gamePin;
        eventConfig = config;
        
        if (typeof io === 'undefined') {
            console.error('Socket.io not loaded');
            isConnecting = false;
            throw new Error('Socket.io לא נטען');
        }
        
        socket = io(WEBSOCKET_URL, {
            transports: ['websocket', 'polling'],
            forceNew: true,
            timeout: 5000,
            reconnection: false // We handle reconnection ourselves
        });
        
        // Setup event handlers
        setupSocketEventHandlers(config, gamePin);
        
        console.log('🎯 WebSocket event handlers set up successfully');
        
        return socket;
        
    } catch (error) {
        console.error('WebSocket connection failed:', error);
        isConnecting = false;
        throw error;
    }
}

/**
 * Disconnect WebSocket when game ends
 */
export function disconnectWebSocket() {
    console.log('🔌 Disconnecting WebSocket...');
    
    // Clear reconnection state
    clearReconnectionTimeout();
    reconnectionAttempts = 0;
    reconnectionStartTime = null;
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    currentGamePin = null;
    isConnecting = false;
    
    console.log('✅ WebSocket disconnected');
}

/**
 * Clear reconnection timeout
 */
function clearReconnectionTimeout() {
    if (reconnectionTimeout) {
        clearTimeout(reconnectionTimeout);
        reconnectionTimeout = null;
    }
}

/**
 * Handle reconnection with 30-second timeout
 */
function handleReconnection() {
    if (!currentGamePin || !eventConfig) {
        console.log('❌ Cannot reconnect - no active game');
        return;
    }
    
    // Start tracking reconnection time
    if (!reconnectionStartTime) {
        reconnectionStartTime = Date.now();
    }
    
    const elapsedTime = Date.now() - reconnectionStartTime;
    
    if (elapsedTime >= MAX_RECONNECTION_TIME_MS) {
        console.log('⏰ Reconnection timeout exceeded (30 seconds) - closing game');
        
        // Notify about game closure
        if (eventConfig.onReconnectionFailed) {
            eventConfig.onReconnectionFailed();
        }
        
        disconnectWebSocket();
        return;
    }
    
    reconnectionAttempts++;
    const remainingTime = Math.ceil((MAX_RECONNECTION_TIME_MS - elapsedTime) / 1000);
    console.log(`🔄 Reconnection attempt ${reconnectionAttempts} (${remainingTime}s remaining)...`);
    
    // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
    const delay = Math.min(1000 * Math.pow(2, reconnectionAttempts - 1), 10000);
    
    reconnectionTimeout = setTimeout(() => {
        if (!socket || !socket.connected) {
            // Try to reconnect
            try {
                socket = io(WEBSOCKET_URL, {
                    transports: ['websocket', 'polling'],
                    forceNew: true,
                    timeout: 5000,
                    reconnection: false
                });
                
                setupSocketEventHandlers(eventConfig, currentGamePin);
                
            } catch (error) {
                console.error('Reconnection failed:', error);
                handleReconnection(); // Try again
            }
        }
    }, delay);
}

/**
 * Initialize WebSocket connection (LEGACY - for backward compatibility)
 * Use connectWebSocket(gamePin, config) for new game-based connection
 */
export function initializeWebSocket(config = {}) {
    console.log('⚠️ initializeWebSocket called - storing config for later game start');
    eventConfig = config;
    
    // Return a mock socket object for compatibility
    // Actual connection happens when game starts
    return {
        connected: false,
        id: null
    };
}

/**
 * Setup socket event handlers
 * @param {object} config - Event handler callbacks
 * @param {string} gamePin - The game PIN for room registration
 */
function setupSocketEventHandlers(config, gamePin) {
    const {
        onConnect,
        onDisconnect,
        onUserUpdate,
        onParticipantUpdate,
        onGamePinRegistered,
        onStatusUpdate,
        onSlideNavigation,
        onClickNavigation,
        onAnimationReset,
        onSlideChange,
        onPlayerAnswer,
        onError,
        onGameClosed,
        onReconnectionFailed,
        onGameStarted
    } = config;
    
    socket.on('connect', async () => {
        console.log('✅ WebSocket connected successfully for game:', gamePin);
        
        // Reset reconnection state on successful connection
        clearReconnectionTimeout();
        reconnectionAttempts = 0;
        reconnectionStartTime = null;
        isConnecting = false;
        
        if (onConnect) {
            await onConnect(socket, gamePin);
        }
    });
    
    socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket disconnected:', reason);
        
        // Only attempt reconnection if game is still active and it wasn't a clean disconnect
        if (currentGamePin && reason !== 'io client disconnect') {
            console.log('🔄 Starting reconnection process...');
            handleReconnection();
        }
        
        if (onDisconnect) {
            onDisconnect(reason);
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        isConnecting = false;
        
        // Attempt reconnection
        if (currentGamePin) {
            handleReconnection();
        }
        
        if (onError) {
            onError('שגיאה בחיבור WebSocket: ' + error.message);
        }
    });
    
    socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (onError) {
            onError('שגיאת WebSocket: ' + error.message);
        }
    });
    
    // Handle participant updates (replaces old user_update)
    socket.on('participant_update', (data) => {
        console.log('🆕 Participant update received:', data);
        handleParticipantUpdate(data, onParticipantUpdate);
    });
    
    // Handle game PIN registration from Admin
    socket.on('game_pin_registered', (data) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎮 RECEIVED game_pin_registered EVENT!');
        console.log('📦 Data:', JSON.stringify(data, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (onGamePinRegistered) {
            onGamePinRegistered(data);
        }
    });
    
    // Handle status updates
    socket.on('status_update', (data) => {
        console.log('📊 Status update received:', data);
        
        if (onStatusUpdate) {
            onStatusUpdate(data);
        }
    });

    // Handle slide navigation commands
    socket.on('slide_navigation', (data) => {
        console.log('🎯 Slide navigation command received:', data);
        
        if (onSlideNavigation) {
            onSlideNavigation(data);
        }
    });

    // Handle click navigation commands (spacebar simulation)
    socket.on('click_navigation', (data) => {
        console.log('⌨️ Spacebar navigation command received:', data);
        
        if (onClickNavigation) {
            onClickNavigation(data);
        }
    });

    // Handle animation reset commands
    socket.on('animation_reset', (data) => {
        console.log('🔄 Animation reset command received:', data);
        
        if (onAnimationReset) {
            onAnimationReset(data);
        }
    });

    // Handle slide change messages (keep for backward compatibility)
    socket.on('slide_change', (data) => {
        console.log('🔄 Slide change message received:', data);
        
        if (onSlideChange) {
            onSlideChange(data);
        }
    });
    
    // Handle player answer submissions
    socket.on('player_answer', (data) => {
        console.log('📝 Player answer received:', data);
        handlePlayerAnswer(data, onPlayerAnswer);
    });
    
    // Handle game closed event (from server)
    socket.on('game_closed', (data) => {
        console.log('🛑 Game closed event received:', data);
        
        // Clear reconnection - game is intentionally closed
        clearReconnectionTimeout();
        
        if (onGameClosed) {
            onGameClosed(data);
        }
        
        // Disconnect and cleanup
        disconnectWebSocket();
    });
    
    // Handle game started event (from Admin clicking "Start Game")
    socket.on('game_started', (data) => {
        console.log('🎮 Game started event received:', data);
        
        if (onGameStarted) {
            onGameStarted(data);
        }
    });
}

/**
 * Handle participant updates from WebSocket
 */
function handleParticipantUpdate(data, callback) {
    // Expected data format:
    // { nick: "username", icon: "icon", type: "add"/"remove", user_id: "uid" }
    
    const { nick, type, user_id, icon } = data;
    
    if (!nick || !type) {
        console.error('❌ Invalid participant update data:', data);
        return;
    }
    
    console.log(`📢 Participant ${type}: ${nick} (user_id: ${user_id})`);
    console.log(`📊 Current participants BEFORE update:`, participantsData.size, Array.from(participantsData.keys()));
    
    // Check if this participant is hidden (from row overflow)
    const isHidden = isParticipantHidden(user_id);
    
    // Update the participants data map
    if (type === 'add') {
        if (!participantsData.has(user_id)) {
            participantsData.set(user_id, {
                userId: user_id,
                nickname: nick,
                icon: icon || '👤', // Default icon if missing
                score: 0,
                lastAnswerTime: null,
                lastAnswerCorrect: null
            });
            
            if (isHidden) {
                console.log(`👻 Participant ${nick} added but HIDDEN (was in hidden row)`);
            } else {
                console.log(`✅ Added participant: ${nick} (${user_id})`);
            }
        } else {
            console.log(`⚠️ Participant ${user_id} already in list`);
        }
    } else if (type === 'remove') {
        if (isHidden) {
            // Hidden participant leaves - remove from data AND from hidden set
            // This allows them to reappear at the end if they reconnect
            participantsData.delete(user_id);
            unhideParticipant(user_id);
            console.log(`👻 Hidden participant ${user_id} removed (no visual change, can reappear if reconnects)`);
        } else if (participantsData.has(user_id)) {
            participantsData.delete(user_id);
            console.log(`✅ Removed participant: ${user_id}`);
        } else {
            console.log(`⚠️ Participant ${user_id} not found in list`);
        }
    }
    
    console.log(`📊 Current participants AFTER update:`, participantsData.size, Array.from(participantsData.keys()));
    console.log(`📊 Total participants: ${participantsData.size}`);
    
    // Trigger callback with updated count
    if (callback) {
        callback(data, Array.from(participantsData.keys()));
    }
}

/**
 * Get participants list
 */
export function getParticipantsList() {
    return Array.from(participantsData.keys());
}

/**
 * Get participants count
 */
export function getParticipantsCount() {
    return participantsData.size;
}

/**
 * Get participants data (full data map)
 */
export function getParticipantsData() {
    return new Map(participantsData);
}

/**
 * Get visible participants data (excluding hidden ones)
 * Returns only participants that are not in hiddenParticipantIds
 */
export function getVisibleParticipantsData() {
    const visibleData = new Map();
    for (const [userId, data] of participantsData) {
        if (!isParticipantHidden(userId)) {
            visibleData.set(userId, data);
        }
    }
    return visibleData;
}

/**
 * Reset participants list
 */
export function resetParticipantsList() {
    console.log('🔄 Resetting participants list');
    console.log('📊 Before reset, participants:', participantsData.size, Array.from(participantsData.keys()));
    
    // Clear the map
    participantsData.clear();
    
    // Also reset hidden participants (from state.js)
    resetHiddenParticipants();
    
    console.log('✅ Participants list cleared (including hidden state)');
    console.log('📊 After reset, participants:', participantsData.size, Array.from(participantsData.keys()));
}

/**
 * Handle player answer from sim via server
 */
function handlePlayerAnswer(data, callback) {
    // Expected data format:
    // { userId: "uid", answerIndex: 1-4, gamePin: "123456", timestamp: ... }
    
    const { userId, answerIndex, timestamp } = data;
    
    if (!userId || !answerIndex) {
        console.error('❌ Invalid player answer data:', data);
        return;
    }
    
    console.log(`📝 Player ${userId} answered: ${answerIndex} at timestamp: ${timestamp}`);
    
    // Store answer with timestamp
    currentQuestionAnswers.set(userId, {
        answerIndex: answerIndex,
        timestamp: timestamp
    });
    
    console.log(`📊 Total answers received: ${currentQuestionAnswers.size} / ${participantsData.size}`);
    
    // Update "מספר עונים" tag
    updateRespondentsCount(currentQuestionAnswers.size);
    
    // Check if all participants have answered
    if (currentQuestionAnswers.size >= participantsData.size && participantsData.size > 0) {
        console.log('✅ All participants have answered!');
        // Stop timer and send "answer time ended"
        stopTimerAndEndAnswerTime();
    }
    
    // Trigger callback
    if (callback) {
        callback(data, currentQuestionAnswers);
    }
}

/**
 * Reset current question answers
 */
export function resetCurrentQuestionAnswers() {
    console.log('🔄 Resetting current question answers');
    currentQuestionAnswers.clear();
    console.log('✅ Answers cleared');
}

/**
 * Get current question answers
 */
export function getCurrentQuestionAnswers() {
    return new Map(currentQuestionAnswers);
}

/**
 * Update "מספר עונים" tag in current slide
 */
async function updateRespondentsCount(count) {
    try {
        // Import question timer module dynamically to avoid circular dependency
        const { updateCurrentSlideRespondentsCount } = await import('../elements/question_timer.js');
        await updateCurrentSlideRespondentsCount(count);
    } catch (error) {
        console.error('❌ Error updating respondents count:', error);
    }
}

/**
 * Stop timer and send "answer time ended" when all answered
 */
async function stopTimerAndEndAnswerTime() {
    try {
        // Import game actions module dynamically to avoid circular dependency
        const { stopTimer } = await import('../game/actions.js');
        await stopTimer();
        console.log('⏹️ Timer stopped - all participants answered');
    } catch (error) {
        console.error('❌ Error stopping timer:', error);
    }
}

/**
 * Emit event to socket
 */
export function emitSocketEvent(event, data) {
    if (socket && socket.connected) {
        socket.emit(event, data);
        console.log(`📤 Emitted ${event}:`, data);
    } else {
        console.error('❌ Socket not connected');
    }
}
