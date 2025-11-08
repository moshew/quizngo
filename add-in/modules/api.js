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
            const text = await response.text();
            console.error('❌ Failed to start accepting participants:', text);
            return false;
        }
        
        const data = await response.json();
        console.log('✅ Start accepting participants response:', data);
        return data.status === 'success';
    } catch (error) {
        console.error('❌ Error calling start_accepting_participants:', error);
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

