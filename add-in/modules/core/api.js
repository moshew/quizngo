// API Configuration and Utilities

// Load Balancer URL - entry point for PIN assignment and resolution
export const LB_URL = 'http://localhost:5000/';

// Dynamic server URL - set after LB assigns a server for the current game
let currentServerUrl = null;

/**
 * Get the current API base URL.
 * Returns the assigned game server URL if set, otherwise falls back to LB_URL.
 */
export function getApiBase() {
    return currentServerUrl || LB_URL;
}

/**
 * Get the current server URL (without trailing slash) for WebSocket connections.
 */
export function getServerUrl() {
    return currentServerUrl ? currentServerUrl.replace(/\/$/, '') : LB_URL.replace(/\/$/, '');
}

/**
 * Reset the server URL (e.g., when game ends).
 */
export function resetServerUrl() {
    currentServerUrl = null;
}

/**
 * Resolve a server for a new game via the Load Balancer.
 * Called by the add-in when creating a new game.
 * @param {string} gamePin - The 6-digit game PIN
 * @returns {Promise<string>} The assigned server URL
 */
export async function resolveServerForNewGame(gamePin) {
    const response = await fetch(`${LB_URL}api/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_pin: gamePin })
    });
    const data = await response.json();
    if (data.status === 'success') {
        currentServerUrl = data.server_url.replace(/\/$/, '') + '/';
        console.log('Server assigned by LB:', currentServerUrl);
        return data.server_url;
    }
    throw new Error(data.message || 'Failed to resolve server from LB');
}

// Legacy constant for backward compatibility (now dynamic)
export const API_BASE = LB_URL;

// Generic API call function (uses dynamic server URL)
export async function makeApiCall(endpoint, options = {}) {
    try {
        const url = `${getApiBase()}${endpoint}`;
        const response = await fetch(url, {
            mode: 'cors',
            ...options
        });
        return response;
    } catch (error) {
        console.error(`API call failed: ${endpoint}`, error);
        throw error;
    }
}

// API call that expects JSON response
export async function makeJsonApiCall(endpoint, options = {}) {
    const response = await makeApiCall(endpoint, options);
    if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

// Initialize quiz - stub for now
export async function initializeQuiz() {
    console.log('initializeQuiz called (stub)');
}


// Register socket to room by game PIN (primary identifier)
export async function registerRoom(socketId, gamePin) {
    try {
        console.log('🔗 Registering socket to room:', { socketId, gamePin });
        const response = await makeApiCall('register_room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ socketId, gamePin })
        });
        
        if (!response.ok) {
            const text = await response.text();
            console.error('❌ Failed to register room:', text);
            return { status: 'error', message: text };
        }
        
        const data = await response.json();
        console.log('✅ Register room response:', data);
        return data;
    } catch (error) {
        console.error('❌ Error registering room:', error);
        return { status: 'error', message: error.message };
    }
}

// Create a room with gamePin (called from Add-in when "Activate Game" is clicked)
// This does NOT start accepting participants - that happens when Admin clicks "Start Game"
export async function createRoom(gamePin, language = null) {
    try {
        // Get current language from i18n if not provided
        if (!language) {
            try {
                const { getLanguage } = await import('../i18n/index.js');
                language = getLanguage();
            } catch (e) {
                language = 'en';
            }
        }
        console.log('🏠 Creating room with PIN:', gamePin, 'language:', language);
        const response = await makeApiCall(`?create_room&game_pin=${gamePin}&language=${language}`);
        
        if (!response.ok) {
            const text = await response.text();
            console.error('❌ Failed to create room:', text);
            return { status: 'error', message: text };
        }
        
        const data = await response.json();
        console.log('✅ Create room response:', data);
        return data;
    } catch (error) {
        console.error('❌ Error creating room:', error);
        return { status: 'error', message: error.message };
    }
}

// Start a new game session with gamePin (called from Add-in - DEPRECATED, use createRoom instead)
export async function registerGameSession(gamePin) {
    try {
        console.log('🎮 Registering game session with PIN:', gamePin);
        const response = await makeApiCall(`?register_session&game_pin=${gamePin}`);
        
        if (!response.ok) {
            const text = await response.text();
            console.error('❌ Failed to register game session:', text);
            return { status: 'error', message: text };
        }
        
        const data = await response.json();
        console.log('✅ Register game session response:', data);
        return data;
    } catch (error) {
        console.error('❌ Error registering game session:', error);
        return { status: 'error', message: error.message };
    }
}

// Close game session
export async function closeGameSession(gamePin) {
    try {
        console.log('🛑 Closing game session:', gamePin);
        const response = await makeApiCall(`?close_game&game_pin=${gamePin}`);
        
        if (!response.ok) {
            const text = await response.text();
            console.error('❌ Failed to close game session:', text);
            return { status: 'error', message: text };
        }
        
        const data = await response.json();
        console.log('✅ Close game session response:', data);
        return data;
    } catch (error) {
        console.error('❌ Error closing game session:', error);
        return { status: 'error', message: error.message };
    }
}
