// API Configuration and Utilities

// Load Balancer URL - entry point for PIN assignment and resolution.
// Remote-only mode: no localhost fallback.
export const LB_URL = (() => {
    const normalizeBase = (value) => String(value || '').replace(/\/+$/, '') + '/';

    // Preferred source: explicit runtime config.
    if (typeof window !== 'undefined' && window.QUIZNGO_LB_URL) {
        return normalizeBase(window.QUIZNGO_LB_URL);
    }

    return 'https://srv.quizngo.online/';
})();

// Dynamic server URL - set after LB assigns a server for the current game
let currentServerUrl = null;

// srv_id assigned by LB (e.g. 'srv-01') — used as ?srv_id= query param
let currentSrvId = null;

/**
 * Get the current API base URL (always srv.quizngo.online via LB_URL).
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
 * Get the current srv_id (e.g. 'srv-01') for routing via nginx.
 */
export function getSrvId() {
    return currentSrvId;
}

/**
 * Build a full API URL with ?srv_id= appended when a server is assigned.
 */
export function getApiUrl(endpoint) {
    const base = getApiBase();
    const normalizedBase = String(base).endsWith('/') ? String(base) : `${String(base)}/`;
    if (!currentSrvId) return `${normalizedBase}${endpoint}`;
    const sep = endpoint.includes('?') ? '&' : '?';
    return `${normalizedBase}${endpoint}${sep}srv_id=${currentSrvId}`;
}

/**
 * Reset the server URL and srv_id (e.g., when game ends).
 */
export function resetServerUrl() {
    currentServerUrl = null;
    currentSrvId = null;
}

async function parseApiErrorMessage(response, fallbackCode = 'REQUEST_FAILED') {
    const jsonResponse = response.clone();
    const textResponse = response.clone();

    try {
        const data = await jsonResponse.json();
        if (data && typeof data === 'object') {
            return data.message || data.error || { code: fallbackCode };
        }
    } catch (_) {
        // Ignore and fall back to plain-text parsing.
    }

    try {
        const text = await textResponse.text();
        if (text) {
            return text;
        }
    } catch (_) {
        // Ignore.
    }

    return { code: fallbackCode };
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
        currentSrvId = data.srv_id;
        console.log('Server assigned by LB:', data.server_url, '→ srv_id:', currentSrvId);
        return data.server_url;
    }
    const serverMessage = data.message || { code: 'FAILED_TO_RESOLVE_SERVER_FROM_LB' };
    const error = new Error(
        typeof serverMessage === 'string' ? serverMessage : 'SERVER_MESSAGE_OBJECT'
    );
    error.serverMessage = serverMessage;
    throw error;
}

// Generic API call function (uses dynamic server URL)
export async function makeApiCall(endpoint, options = {}) {
    try {
        const url = getApiUrl(endpoint);
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
            const serverMessage = await parseApiErrorMessage(response, 'REGISTER_ROOM_FAILED');
            console.error('Failed to register room:', serverMessage);
            return { status: 'error', message: serverMessage };
        }
        
        const data = await response.json();
        console.log('✅ Register room response:', data);
        return data;
    } catch (error) {
        console.error('❌ Error registering room:', error);
        return { status: 'error', message: error.serverMessage || error.message };
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
            const serverMessage = await parseApiErrorMessage(response, 'CREATE_ROOM_FAILED');
            console.error('Failed to create room:', serverMessage);
            return { status: 'error', message: serverMessage };
        }
        
        const data = await response.json();
        console.log('✅ Create room response:', data);
        return data;
    } catch (error) {
        console.error('❌ Error creating room:', error);
        return { status: 'error', message: error.serverMessage || error.message };
    }
}

// Start a new game session with gamePin (called from Add-in - DEPRECATED, use createRoom instead)
export async function registerGameSession(gamePin) {
    try {
        console.log('🎮 Registering game session with PIN:', gamePin);
        const response = await makeApiCall(`?register_session&game_pin=${gamePin}`);
        
        if (!response.ok) {
            const serverMessage = await parseApiErrorMessage(response, 'REGISTER_SESSION_FAILED');
            console.error('Failed to register game session:', serverMessage);
            return { status: 'error', message: serverMessage };
        }
        
        const data = await response.json();
        console.log('✅ Register game session response:', data);
        return data;
    } catch (error) {
        console.error('❌ Error registering game session:', error);
        return { status: 'error', message: error.serverMessage || error.message };
    }
}

// Close game session
export async function closeGameSession(gamePin) {
    try {
        console.log('🛑 Closing game session:', gamePin);
        const response = await makeApiCall(`?close_game&game_pin=${gamePin}`);
        
        if (!response.ok) {
            const serverMessage = await parseApiErrorMessage(response, 'CLOSE_GAME_FAILED');
            console.error('Failed to close game session:', serverMessage);
            return { status: 'error', message: serverMessage };
        }
        
        const data = await response.json();
        console.log('✅ Close game session response:', data);
        return data;
    } catch (error) {
        console.error('❌ Error closing game session:', error);
        return { status: 'error', message: error.serverMessage || error.message };
    }
}
