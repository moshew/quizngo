// API Configuration and Utilities
export const API_BASE = 'http://localhost:5000/';

// Generic API call function
export async function makeApiCall(endpoint, options = {}) {
    try {
        const url = `${API_BASE}${endpoint}`;
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

// Start accepting participants (using gamePin as primary identifier)
export async function startAcceptingParticipants(gamePin) {
    try {
        console.log('🟢 Calling start_accepting_participants for game:', gamePin);
        const response = await makeApiCall(`?start_accepting_participants&game_pin=${gamePin}`);
        
        if (!response.ok) {
            // 403 is expected when no game session exists yet - not an error
            if (response.status === 403) {
                console.log('ℹ️ No active game session yet - waiting for game to start');
                return false;
            }
            const text = await response.text();
            console.warn('⚠️ Could not start accepting participants:', text);
            return false;
        }
        
        const data = await response.json();
        console.log('✅ Start accepting participants response:', data);
        return data.status === 'success';
    } catch (error) {
        console.log('ℹ️ Could not start accepting participants:', error.message);
        return false;
    }
}

// Stop accepting participants (using gamePin as primary identifier)
export async function stopAcceptingParticipants(gamePin) {
    try {
        console.log('🔴 Calling stop_accepting_participants for game:', gamePin);
        const response = await makeApiCall(`?stop_accepting_participants&game_pin=${gamePin}`);
        
        if (!response.ok) {
            const text = await response.text();
            console.error('❌ Failed to stop accepting participants:', text);
            return false;
        }
        
        const data = await response.json();
        console.log('✅ Stop accepting participants response:', data);
        return data.status === 'success';
    } catch (error) {
        console.error('❌ Error calling stop_accepting_participants:', error);
        return false;
    }
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
export async function createRoom(gamePin) {
    try {
        console.log('🏠 Creating room with PIN:', gamePin);
        const response = await makeApiCall(`?create_room&game_pin=${gamePin}`);
        
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
