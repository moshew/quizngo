/**
 * Game Actions Module
 * Handles game-related actions like starting game, timers, leaderboards, etc.
 * 
 * NEW ARCHITECTURE:
 * - gamePin is generated here when game starts
 * - WebSocket connects only when game starts, disconnects on game end
 */

/* global PowerPoint */

import { API_BASE, registerRoom, createRoom } from '../core/api.js';
import { 
    getSlideData,
    getPresentationSettings,
    getCurrentSlideId,
    getCurrentSlideNumber,
    getGamePIN,
    setGamePIN,
    generateGamePin
} from '../core/state.js';
import { showStatus, showError, loadStartScreen, initializeStartScreen } from '../ui/manager.js';
import { updateCurrentSlideQuestionTime } from '../elements/question_timer.js';
import { processAnswersAndScores, sendResultsToServer } from './scoring.js';
import { connectWebSocket, disconnectWebSocket } from '../core/websocket.js';

/**
 * Start presentation mode (game start screen)
 * This is where the gamePin is generated and WebSocket connects
 * NOTE: This only creates a room - Admin must click "Start Game" to begin accepting participants
 */
export async function startPresentationMode() {
    console.log('🎮 Start game button clicked - generating gamePin and creating room...');
    
    try {
        // Generate a new gamePin (Add-in is responsible for this)
        const gamePin = generateGamePin();
        setGamePIN(gamePin);
        
        console.log('✅ Generated Game PIN:', gamePin);
        
        // Create room on server (does NOT start accepting participants yet)
        const createResult = await createRoom(gamePin);
        if (createResult.status !== 'success') {
            showError('⚠️ שגיאה ביצירת חדר: ' + createResult.message);
            return;
        }
        
        console.log('✅ Room created on server (waiting for Admin to start game)');
        
        // Connect WebSocket with the gamePin
        const socket = await connectWebSocketForGame(gamePin);
        if (!socket) {
            showError('⚠️ שגיאה בחיבור WebSocket');
            return;
        }
        
        console.log('✅ WebSocket connected for game:', gamePin);
        
        // Load the start screen UI
        loadStartScreen();
        
        // Switch view to Game Mode
        const mainContent = document.getElementById('mainContent');
        const tabs = document.querySelector('.tabs');
        const slideContentArea = document.getElementById('slideContentArea');
        
        if (mainContent) mainContent.style.display = 'none';
        if (tabs) tabs.style.display = 'none';
        if (slideContentArea) slideContentArea.style.display = 'block';
        
        // Initialize the start screen with QR code
        await initializeStartScreen();
        
        // Format PIN as XXX-XXX for display
        const formattedPin = gamePin.slice(0, 3) + '-' + gamePin.slice(3);
        showStatus(`✅ חדר נוצר! PIN: ${formattedPin} - ממתין ל-Admin להתחיל משחק`, 'success');
        
    } catch (error) {
        console.error('❌ Error starting presentation mode:', error);
        showError('שגיאה בהפעלת המשחק: ' + error.message);
    }
}

/**
 * Connect WebSocket for the game with appropriate event handlers
 */
async function connectWebSocketForGame(gamePin) {
    const { connectWebSocket } = await import('../core/websocket.js');
    const { registerRoom } = await import('../core/api.js');
    const { 
        resetParticipantAcceptanceState,
        setParticipantAcceptanceState
    } = await import('./events.js');
    const { resetParticipantsList } = await import('../core/websocket.js');
    const { 
        goToFirstSlideInPowerPoint,
        goToNextSlideInPowerPoint,
        simulateClickInPowerPoint,
        resetAnimationState
    } = await import('./navigation.js');
    const { 
        updateParticipantsNumInSlides,
        updateParticipantsListInSlides,
        resetParticipantsNumInSlides
    } = await import('../elements/participants_management.js');
    const { 
        resetAnswersDistribution,
        resetLeaderboard
    } = await import('../elements/answers_analysis.js');
    const { 
        updateAllQuestionTimeElements,
        updateAllRespondentsCountElements
    } = await import('../elements/question_timer.js');
    const { 
        updateGameIdInSlides,
        updateQrCodeInSlides
    } = await import('../elements/game_management.js');
    const { 
        setCurrentUsers,
        triggerRefreshSlideList,
        setSocket
    } = await import('../core/state.js');
    const { t } = await import('../i18n/index.js');
    
    const socket = connectWebSocket(gamePin, {
        onConnect: async (socket, pin) => {
            console.log('✅ Connected to WebSocket for game:', pin);
            
            // Register to room using gamePin
            await registerRoom(socket.id, pin);
            
            // === UPDATE GAME ID & QR CODE IN SLIDES (only this, no initialization) ===
            try {
                await updateGameIdInSlides(pin);
                await updateQrCodeInSlides(pin);
            } catch (updateError) {
                console.error('❌ Error updating Game ID/QR Code:', updateError);
            }
            
            // NOTE: Game initialization happens when Admin clicks "Start Game"
            // and we receive the game_started event
            console.log('🕐 Room ready, waiting for Admin to start game...');
        },
        
        onDisconnect: (reason) => {
            console.log('❌ Disconnected from game:', reason);
        },
        
        onError: (msg) => {
            showError(msg);
        },
        
        onSlideNavigation: async (data) => {
            console.log('🎯 Handling slide navigation:', data.action);
            
            try {
                switch (data.action) {
                    case 'go_to_first_slide':
                        await goToFirstSlideInPowerPoint();
                        break;
                    case 'go_to_next_slide':
                    case 'next_slide':
                        await goToNextSlideInPowerPoint();
                        break;
                    default:
                        console.warn('⚠️ Unknown slide navigation action:', data.action);
                }
            } catch (error) {
                console.error('❌ Error handling slide navigation:', error);
            }
        },
        
        onClickNavigation: async (data) => {
            if (data.action === 'simulate_click') {
                try {
                    await simulateClickInPowerPoint();
                } catch (error) {
                    console.error('❌ Error handling click navigation:', error);
                }
            }
        },
        
        onAnimationReset: async (data) => {
            if (data.action === 'reset_animations') {
                resetAnimationState();
            }
        },
        
        onParticipantUpdate: async (data, participantIds) => {
            setCurrentUsers(participantIds.length);
            
            try {
                await updateParticipantsNumInSlides(participantIds.length);
                await updateParticipantsListInSlides();
            } catch (error) {
                console.error('❌ Error updating participants in slides:', error);
            }
            
            triggerRefreshSlideList();
        },
        
        onPlayerAnswer: (data, answersMap) => {
            console.log('📝 Player answer handled, total answers:', answersMap.size);
        },
        
        onGameClosed: (data) => {
            console.log('🛑 Game closed:', data);
            showError('המשחק נסגר: ' + (data.message || 'סיום'));
        },
        
        onReconnectionFailed: () => {
            console.log('❌ Reconnection failed after 30 seconds');
            showError('החיבור אבד. המשחק נסגר.');
        },
        
        onGameStarted: async (data) => {
            console.log('🎮 Game started by Admin - initializing game state');
            showStatus('✅ המשחק התחיל! מקבל משתתפים...', 'success');
            
            // Initialize all add-in state for the game
            try {
                resetParticipantAcceptanceState();
                resetParticipantsList();
                resetAnimationState();
                
                // Note: acceptingParticipants will be set to true when reaching opening slide
                
                const settings = getPresentationSettings();
                const initialTime = settings?.questionWaitTime || 30;
                await updateAllQuestionTimeElements(initialTime);
                await updateAllRespondentsCountElements(0);
                await resetParticipantsNumInSlides();
                await updateParticipantsListInSlides();
                await resetAnswersDistribution();
                await resetLeaderboard();
                
                console.log('✅ Game state initialized after admin started game');
            } catch (error) {
                console.error('❌ Error initializing game state:', error);
            }
            
            // Navigate to first slide when game starts
            try {
                console.log('📄 Navigating to first slide...');
                await goToFirstSlideInPowerPoint();
            } catch (error) {
                console.error('❌ Error navigating to first slide:', error);
            }
        }
    });
    
    setSocket(socket);
    return socket;
}

/**
 * End the current game and disconnect WebSocket
 */
export async function endGame() {
    console.log('🛑 Ending game...');
    
    const gamePin = getGamePIN();
    if (gamePin) {
        try {
            const { closeGameSession } = await import('../core/api.js');
            await closeGameSession(gamePin);
        } catch (error) {
            console.error('❌ Error closing game session:', error);
        }
    }
    
    disconnectWebSocket();
    setGamePIN(null);
    
    console.log('✅ Game ended');
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
    
    // Get settings from state
    const settings = getPresentationSettings();
    
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
        
        // Get current slide ID from state
        const slideId = getCurrentSlideId();
        if (!slideId) {
            console.error('❌ No current slide ID available');
            return;
        }
        
        // Get gamePin from state (primary identifier)
        const gamePin = getGamePIN();
        if (!gamePin) {
            console.error('❌ No gamePin available');
            return;
        }
        
        // Get question time from settings
        const settings = getPresentationSettings();
        const questionTime = settings?.questionWaitTime || 30;
        
        // Process answers and calculate scores
        const results = await processAnswersAndScores(slideId, questionStartTime, questionTime);
        
        // --- UPDATE GRAPHS BEFORE SENDING RESULTS ---
        try {
            console.log('📊 Updating graphs with final answers...');
            const { getCurrentQuestionAnswers } = await import('../core/websocket.js');
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
            
            const { updateAnswersDistribution, updateLeaderboard } = await import('../elements/answers_analysis.js');
            const { updateAllRespondentsCountElements } = await import('../elements/question_timer.js');
            
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
            await sendResultsToServer(gamePin, results);
            
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
        
        const gamePin = getGamePIN();
        if (!gamePin) {
            console.warn('⚠️ No gamePin available - cannot send answer_time_started');
            return;
        }
        
        const settings = getPresentationSettings();
        
        const data = {
            gamePin: gamePin,
            timestamp: Date.now(),
            questionWaitTime: settings?.questionWaitTime || 30
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
        // Use the slide number from state (updated by processSlideChange)
        const slideNumber = getCurrentSlideNumber() || null;
        
        await updateCurrentSlideQuestionTime(timeValue, slideNumber);
    } catch (error) {
        console.error('❌ Error updating question time display:', error);
    }
}

// End of file
