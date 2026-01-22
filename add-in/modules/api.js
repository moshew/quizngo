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

// Start accepting participants
export async function startAcceptingParticipants(hashId) {
    try {
        console.log('🟢 Calling start_accepting_participants for hash:', hashId);
        const response = await makeApiCall(`?start_accepting_participants&hash_id=${hashId}`);
        
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

// Stop accepting participants
export async function stopAcceptingParticipants(hashId) {
    try {
        console.log('🔴 Calling stop_accepting_participants for hash:', hashId);
        const response = await makeApiCall(`?stop_accepting_participants&hash_id=${hashId}`);
        
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

// Register socket to room by hash ID
export async function registerRoom(socketId, hashId) {
    try {
        console.log('🔗 Registering socket to room:', { socketId, hashId });
        const response = await makeApiCall('register_room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ socketId, hashId })
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

