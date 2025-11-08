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
    // { nick: "username", type: "add"/"remove", user_id: "uid" }
    
    const { nick, type, user_id } = data;
    
    if (!nick || !type) {
        console.error('❌ Invalid participant update data:', data);
        return;
    }
    
    console.log(`📢 Participant ${type}: ${nick} (user_id: ${user_id})`);
    console.log(`📊 Current participants list BEFORE update:`, participantsList.length, participantsList);
    
    // Simply update the list - no UI elements needed
    if (type === 'add') {
        if (!participantsList.includes(user_id)) {
            participantsList.push(user_id);
            console.log(`✅ Added participant: ${nick} (${user_id})`);
        } else {
            console.log(`⚠️ Participant ${user_id} already in list`);
        }
    } else if (type === 'remove') {
        const index = participantsList.indexOf(user_id);
        if (index !== -1) {
            participantsList.splice(index, 1);
            console.log(`✅ Removed participant: ${user_id}`);
        } else {
            console.log(`⚠️ Participant ${user_id} not found in list`);
        }
    }
    
    console.log(`📊 Current participants list AFTER update:`, participantsList.length, participantsList);
    console.log(`📊 Total participants: ${participantsList.length}`);
    
    // Trigger callback with updated count
    if (callback) {
        callback(data, participantsList);
    }
}

/**
 * Get participants list
 */
export function getParticipantsList() {
    return [...participantsList];
}

/**
 * Get participants count
 */
export function getParticipantsCount() {
    return participantsList.length;
}

/**
 * Reset participants list
 */
export function resetParticipantsList() {
    console.log('🔄 Resetting participants list');
    console.log('📊 Before reset, participants:', participantsList.length, participantsList);
    
    // Clear the array in-place (important for cached code)
    participantsList.length = 0;
    
    console.log('✅ Participants list cleared');
    console.log('📊 After reset, participants:', participantsList.length, participantsList);
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

