/**
 * Game Actions Module
 * Handles game-related actions like starting game, timers, leaderboards, etc.
 */

/* global PowerPoint */

import { API_BASE } from './api.js';
import { getGameHashId, getSlideData } from './presentation-state.js';
import { showStatus, showError, updateUIForSlideType, initializeStartScreen } from './ui-manager.js';
import { updateCurrentSlideQuestionTime } from './elements/question_timer.js';
import { processAnswersAndScores, sendResultsToServer } from './scoring.js';

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
        
        // Switch view to Game Mode
        const mainContent = document.getElementById('mainContent');
        const tabs = document.querySelector('.tabs');
        const slideContentArea = document.getElementById('slideContentArea');
        
        if (mainContent) mainContent.style.display = 'none';
        if (tabs) tabs.style.display = 'none';
        if (slideContentArea) slideContentArea.style.display = 'block';
        
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
let questionStartTime = null; // Track when the question timer started (for scoring)

/**
 * Start question timer with delay
 * Implements the flow:
 * 1. Wait for clockActivationDelay seconds
 * 2. Start countdown from questionWaitTime
 * 3. Update kahoot-question-time elements in real-time
 * 4. Send WebSocket messages to server at key points
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
        
        // Record the start time for scoring calculations
        questionStartTime = Date.now();
        console.log(`📍 Question start time recorded: ${questionStartTime}`);
        
        // Send "answer time started" to server
        sendAnswerTimeStarted();
        
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
                
                // Process scores and send results
                handleQuestionEnd();
                
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
        
        // Process scores and send results when timer is manually stopped (all answered)
        handleQuestionEnd();
        
        console.log('✅ Timer stopped');
        showStatus('⏸️ טיימר הופסק', 'info');
    } else {
        console.log('⚠️ No active timer to stop');
    }
}

/**
 * Handle question end - process scores and send to server
 */
async function handleQuestionEnd() {
    try {
        console.log('🎯 Handling question end - processing scores...');
        
        // Get current slide ID
        const slideId = window.currentSlideId;
        if (!slideId) {
            console.error('❌ No current slide ID available');
            return;
        }
        
        // Get hash ID
        const hashId = window.currentHashId;
        if (!hashId) {
            console.error('❌ No hash ID available');
            return;
        }
        
        // Get question time from settings
        const questionTime = window.presentationSettings?.questionWaitTime || 30;
        
        // Process answers and calculate scores
        const results = await processAnswersAndScores(slideId, questionStartTime, questionTime);
        
        // --- UPDATE GRAPHS BEFORE SENDING RESULTS ---
        try {
            console.log('📊 Updating graphs with final answers...');
            const { getCurrentQuestionAnswers } = await import('./websocket.js');
            const answersMap = getCurrentQuestionAnswers();
            
            // Aggregate answers
            const answersCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
            let totalRespondents = 0;
            
            answersMap.forEach((answerData) => {
                const idx = answerData.answerIndex;
                if (answersCount[idx] !== undefined) {
                    answersCount[idx]++;
                    totalRespondents++;
                }
            });
            
            console.log('📊 Aggregated answers for graph update:', answersCount);
            
            const { updateAnswersDistribution, updateLeaderboard } = await import('./elements/answers_analysis.js');
            const { updateAllRespondentsCountElements } = await import('./elements/question_timer.js');
            
            // Update all answer distribution graphs (heights and value labels)
            await updateAnswersDistribution(answersCount);
            
            // Update total respondents count text
            await updateAllRespondentsCountElements(totalRespondents);

            // Update leaderboard with current results
            if (results && results.length > 0) {
                console.log('🏆 Updating leaderboard with results...');
                const leaderboardData = results.map(r => ({
                    name: r.nickname,
                    score: r.cumulativeScore
                }));
                await updateLeaderboard(leaderboardData);
            }
            
            console.log('✅ Graphs, respondent counts, and leaderboard updated');
            
        } catch (updateError) {
            console.error('❌ Error updating graphs:', updateError);
        }
        // --------------------------------------------
        
        if (results) {
            // Send results to server (this also signals end of question)
            await sendResultsToServer(hashId, results);
            
            console.log('✅ Scores processed and sent to server');
        }
        
    } catch (error) {
        console.error('❌ Error handling question end:', error);
    }
}

/**
 * Send "answer time started" message to server via REST API
 */
function sendAnswerTimeStarted() {
    try {
        console.log('📤 Attempting to send answer_time_started via REST...');
        
        const hashId = window.currentHashId;
        if (!hashId) {
            console.warn('⚠️ No hashId available - cannot send answer_time_started');
            return;
        }
        
        const data = {
            hashId: hashId,
            timestamp: Date.now(),
            questionWaitTime: window.presentationSettings?.questionWaitTime || 30
        };
        
        // Send via REST API instead of WebSocket
        const url = `${API_BASE}answer_time_started`;
        console.log(`📡 Sending to: ${url}`);
        
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            console.log('✅ Successfully sent answer_time_started to server:', result);
        })
        .catch(error => {
            console.error('❌ Error sending answer_time_started:', error);
        });
        
    } catch (error) {
        console.error('❌ Error sending answer_time_started:', error);
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

// End of file


