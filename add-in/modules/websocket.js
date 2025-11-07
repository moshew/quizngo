/**
 * WebSocket Module
 * Handles all WebSocket connections and real-time updates
 */

// WebSocket URL
export const WEBSOCKET_URL = 'http://localhost:5000';

// WebSocket instance
let socket = null;

// Participants management
let participantsList = [];
let participantsPositions = new Map(); // nickname -> position index

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
        onError
    } = config;
    
    socket.on('connect', async () => {
        console.log('✅ WebSocket connected successfully');
        
        if (onConnect) {
            await onConnect(socket);
        }
    });
    
    socket.on('room_registered', (data) => {
        if (data.status === 'success') {
            console.log('✅ Successfully registered to room:', data.hashId);
        } else {
            console.error('❌ Room registration failed:', data.message);
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
    
    // Handle user updates
    socket.on('user_update', (data) => {
        console.log('👥 User update received:', data);
        
        if (onUserUpdate) {
            onUserUpdate(data);
        }
    });
    
    // Handle participant updates (new message type)
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
}

/**
 * Handle participant updates from WebSocket
 */
function handleParticipantUpdate(data, callback) {
    // Expected data format:
    // { nick: "username", type: "add"/"remove", total: 5 }
    
    const { nick, type, total } = data;
    
    if (!nick || !type) {
        console.error('❌ Invalid participant update data:', data);
        return;
    }
    
    console.log(`📢 Participant ${type}: ${nick} (total: ${total})`);
    
    if (type === 'add') {
        addParticipant(nick);
    } else if (type === 'remove') {
        removeParticipant(nick);
    }
    
    // Update total count
    if (total !== undefined) {
        window.currentUsers = total;
        const userCountElement = document.getElementById('userCount');
        if (userCountElement) {
            userCountElement.textContent = total;
        }
    }
    
    if (callback) {
        callback(data, participantsList);
    }
}

/**
 * Add participant to list
 */
function addParticipant(nickname) {
    if (!participantsList.includes(nickname)) {
        participantsList.push(nickname);
        console.log(`✅ Added participant: ${nickname}`);
        console.log(`📊 Total participants: ${participantsList.length}`);
        console.log(`👥 Current list: ${participantsList.join(', ')}`);
        
        // Assign position
        const position = calculateNewParticipantPosition();
        participantsPositions.set(nickname, position);
        
        // Create and insert UI element
        const element = createParticipantElement(nickname, position);
        insertParticipantAtPosition(element, position);
    } else {
        console.log(`⚠️ Participant ${nickname} already in list`);
    }
}

/**
 * Remove participant from list
 */
function removeParticipant(nickname) {
    const index = participantsList.indexOf(nickname);
    if (index !== -1) {
        participantsList.splice(index, 1);
        console.log(`✅ Removed participant: ${nickname}`);
        console.log(`📊 Total participants: ${participantsList.length}`);
        console.log(`👥 Current list: ${participantsList.join(', ')}`);
        
        // Remove from positions map
        participantsPositions.delete(nickname);
        
        // Remove UI element
        const element = document.querySelector(`.participant-pill[data-nickname="${nickname}"]`);
        if (element) {
            element.remove();
        }
        
        // Reposition remaining participants
        repositionAllParticipants();
    } else {
        console.log(`⚠️ Participant ${nickname} not found in list`);
    }
}

/**
 * Calculate new participant position
 */
function calculateNewParticipantPosition() {
    // Find the lowest available position index
    const usedPositions = Array.from(participantsPositions.values());
    let position = 0;
    while (usedPositions.includes(position)) {
        position++;
    }
    return position;
}

/**
 * Create participant UI element
 */
function createParticipantElement(nickname, position) {
    const pill = document.createElement('div');
    pill.className = 'participant-pill';
    pill.setAttribute('data-nickname', nickname);
    pill.setAttribute('data-position', position);
    pill.textContent = nickname;
    return pill;
}

/**
 * Insert participant at specific position
 */
function insertParticipantAtPosition(element, position) {
    const container = document.getElementById('liveParticipantsList');
    if (!container) return;
    
    const children = Array.from(container.children);
    const insertIndex = children.findIndex(child => {
        const childPosition = parseInt(child.getAttribute('data-position') || '0');
        return childPosition > position;
    });
    
    if (insertIndex === -1) {
        container.appendChild(element);
    } else {
        container.insertBefore(element, children[insertIndex]);
    }
}

/**
 * Reposition all participants
 */
function repositionAllParticipants() {
    const container = document.getElementById('liveParticipantsList');
    if (!container) return;
    
    const pills = Array.from(container.querySelectorAll('.participant-pill'));
    pills.sort((a, b) => {
        const posA = parseInt(a.getAttribute('data-position') || '0');
        const posB = parseInt(b.getAttribute('data-position') || '0');
        return posA - posB;
    });
    
    pills.forEach(pill => container.appendChild(pill));
}

/**
 * Get participants list
 */
export function getParticipantsList() {
    return [...participantsList];
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

