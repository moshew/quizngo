/**
 * WebSocket Module
 * Handles all WebSocket connections and real-time updates
 */

import { isParticipantHidden, resetHiddenParticipants, getHiddenParticipantIds, unhideParticipant } from './state.js';

// WebSocket URL
export const WEBSOCKET_URL = 'http://localhost:5000';

// WebSocket instance
let socket = null;

// Participants management - enhanced with scoring data
let participantsData = new Map(); // Map of userId -> { userId, nickname, score, lastAnswerTime, lastAnswerCorrect }

// Current question answer tracking
let currentQuestionAnswers = new Map(); // Map of userId -> { answerIndex, timestamp }

/**
 * Get the current socket instance
 */
export function getSocket() {
    return socket;
}

/**
 * Initialize WebSocket connection
 */
export function initializeWebSocket(config = {}) {
    try {
        console.log('🔌 Initializing WebSocket connection to:', WEBSOCKET_URL);
        
        if (typeof io === 'undefined') {
            console.error('Socket.io not loaded');
            throw new Error('Socket.io לא נטען');
        }
        
        socket = io(WEBSOCKET_URL, {
            transports: ['websocket', 'polling'],
            forceNew: true,
            timeout: 5000
        });
        
        // Setup event handlers
        setupSocketEventHandlers(config);
        
        console.log('🎯 WebSocket event handlers set up successfully');
        
        return socket;
        
    } catch (error) {
        console.error('WebSocket initialization failed:', error);
        throw error;
    }
}

/**
 * Setup socket event handlers
 */
function setupSocketEventHandlers(config) {
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
        onError
    } = config;
    
    socket.on('connect', async () => {
        console.log('✅ WebSocket connected successfully');
        
        if (onConnect) {
            await onConnect(socket);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ WebSocket disconnected');
        
        if (onDisconnect) {
            onDisconnect();
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
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
    // { userId: "uid", answerIndex: 1-4, hashId: "...", timestamp: ... }
    
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
