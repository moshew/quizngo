/**
 * Game Actions Module
 * Handles game-related actions like starting game, timers, leaderboards, etc.
 */

import { API_BASE } from './api.js';
import { getGameHashId } from './presentation-state.js';
import { showStatus, showError, updateUIForSlideType, initializeStartScreen } from './ui-manager.js';

/**
 * Start presentation mode (game start screen)
 */
export async function startPresentationMode(htmlCache) {
    console.log('🎮 Start game button clicked - loading start screen');
    
    try {
        // Check if presentation is saved
        const hashId = await getGameHashId();
        
        if (!hashId) {
            showError('⚠️ שמור תחילה את המצגת לפני הפעלת המשחק');
            return;
        }
        
        console.log('✅ Hash ID:', hashId);
        
        // Load the start screen UI
        await updateUIForSlideType('start', htmlCache);
        
        // Initialize the start screen with QR code
        await initializeStartScreen();
        
        showStatus('✅ מסך התחלה נטען - סרוק את קוד ה-QR', 'success');
        
    } catch (error) {
        console.error('❌ Error starting presentation mode:', error);
        showError('שגיאה בהפעלת המשחק: ' + error.message);
    }
}

/**
 * Start timer (stub implementation)
 */
export async function startTimer() { 
    console.log('startTimer called'); 
}

/**
 * Stop timer (stub implementation)
 */
export async function stopTimer() { 
    console.log('stopTimer called'); 
}

/**
 * Show leaderboard (stub implementation)
 */
export async function showLeaderboard() {
    console.log('🏆 Show leaderboard - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

/**
 * Insert leaderboard table (stub implementation)
 */
export async function insertLeaderboardTable() {
    console.log('📋 Insert leaderboard table - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

/**
 * Show final results (stub implementation)
 */
export async function showFinalResults() {
    console.log('🎯 Show final results - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

/**
 * Insert final leaderboard (stub implementation)
 */
export async function insertFinalLeaderboard() {
    console.log('🏅 Insert final leaderboard - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

/**
 * End game
 */
export async function endGame() {
    console.log('🔚 End game');
    const confirmed = confirm('האם אתה בטוח שברצונך לסיים את המשחק?');
    if (confirmed) {
        try {
            // Send end game signal to server
            const response = await fetch(`${API_BASE}end-game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gameId: window.gameId
                })
            });
            
            if (response.ok) {
                console.log('✅ Game ended successfully');
                showError('✅ המשחק הסתיים בהצלחה!');
            } else {
                throw new Error('Failed to end game');
            }
        } catch (error) {
            console.error('❌ Error ending game:', error);
            showError('שגיאה בסיום המשחק: ' + error.message);
        }
    }
}

/**
 * Show statistics (stub implementation)
 */
export async function showStatistics() {
    console.log('📈 Show statistics - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

/**
 * Insert answer statistics (stub implementation)
 */
export async function insertAnswerStats() {
    console.log('📊 Insert answer stats - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

