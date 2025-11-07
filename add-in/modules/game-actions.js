/**
 * Game Actions Module
 * Handles game-related actions like starting game, timers, leaderboards, etc.
 */

/* global PowerPoint */

import { API_BASE } from './api.js';
import { getGameHashId } from './presentation-state.js';
import { showStatus, showError, updateUIForSlideType, initializeStartScreen } from './ui-manager.js';
import { updateCurrentSlideQuestionTime } from './powerpoint-shapes.js';

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

// Global timer variables
let timerInterval = null;
let timerRemaining = 0;

/**
 * Start question timer with delay
 * Implements the flow:
 * 1. Wait for clockActivationDelay seconds
 * 2. Start countdown from questionWaitTime
 * 3. Update kahoot-question-time elements in real-time
 */
export async function startTimer() { 
    console.log('⏱️ startTimer called');
    
    // Stop any existing timer first
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Get settings
    const settings = window.presentationSettings || {
        questionWaitTime: 30,
        clockActivationDelay: 5
    };
    
    // Use explicit check for undefined/null to allow 0 values
    const questionWaitTime = settings.questionWaitTime !== undefined && settings.questionWaitTime !== null 
        ? settings.questionWaitTime 
        : 30;
    const clockActivationDelay = settings.clockActivationDelay !== undefined && settings.clockActivationDelay !== null 
        ? settings.clockActivationDelay 
        : 5;
    
    console.log(`⏳ Waiting ${clockActivationDelay} seconds before starting timer...`);
    console.log(`⏱️ Timer will count down from ${questionWaitTime} seconds`);
    
    // Step 1: Wait for clock activation delay
    setTimeout(() => {
        console.log('🎬 Delay finished, starting countdown timer...');
        
        // Step 2: Initialize timer
        timerRemaining = questionWaitTime;
        
        // Update immediately
        updateQuestionTimeDisplay(timerRemaining);
        
        // Step 3: Start countdown interval (every 1 second)
        timerInterval = setInterval(() => {
            timerRemaining--;
            
            if (timerRemaining <= 0) {
                // Timer finished
                console.log('⏰ Timer finished!');
                clearInterval(timerInterval);
                timerInterval = null;
                updateQuestionTimeDisplay(0);
                
                // Optional: Play sound or show notification
                showStatus('⏰ זמן התשובה הסתיים!', 'warning');
            } else {
                // Update display
                updateQuestionTimeDisplay(timerRemaining);
            }
        }, 1000); // Update every second
        
        console.log('✅ Timer started successfully');
        
    }, clockActivationDelay * 1000); // Convert to milliseconds
}

/**
 * Stop timer
 */
export async function stopTimer() { 
    console.log('⏹️ stopTimer called');
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerRemaining = 0;
        console.log('✅ Timer stopped');
        showStatus('⏸️ טיימר הופסק', 'info');
    } else {
        console.log('⚠️ No active timer to stop');
    }
}

/**
 * Update kahoot-question-time elements in current slide
 * @param {number} timeValue - Time in seconds to display
 */
async function updateQuestionTimeDisplay(timeValue) {
    try {
        // Use the slide number from window (updated by processSlideChange)
        const slideNumber = window.currentSlideNumber || null;
        
        await updateCurrentSlideQuestionTime(timeValue, slideNumber);
    } catch (error) {
        console.error('❌ Error updating question time display:', error);
    }
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
            // Stop any active timer
            await stopTimer();
            
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

