/**
 * Game Actions Module
 * Handles game-related actions like starting game, timers, leaderboards, etc.
 * 
 * NEW ARCHITECTURE:
 * - gamePin is generated here when game starts
 * - WebSocket connects only when game starts, disconnects on game end
 */

/* global PowerPoint */

import { getApiUrl, registerRoom, createRoom, resolveServerForNewGame, resetServerUrl } from '../core/api.js';
import { 
    getSlideData,
    getPresentationSettings,
    getCurrentSlideId,
    getGamePIN,
    setCurrentUsers,
    setGamePIN,
    generateGamePin
} from '../core/state.js';
import { showStatus, showError, showAdminConnectionScreen, hideAdminConnectionScreen, isAdminConnectionScreenOpen } from '../ui/manager.js';
import { t, tServerError } from '../i18n/index.js';
import { updateAllQuestionTimeElements } from '../elements/question_timer.js';
import { processAnswersAndScores, sendResultsToServer } from './scoring.js';
import { connectWebSocket, disconnectWebSocket, resetParticipantsList, resetCurrentQuestionAnswers } from '../core/websocket.js';

const QUESTION_WAIT_TIME_LIMITS = {
    min: 5,
    max: 60,
    fallback: 30
};

function getNormalizedQuestionWaitTime(settings = getPresentationSettings()) {
    const rawValue = settings?.questionWaitTime;
    const parsedValue = Number.parseInt(rawValue, 10);
    const normalized = Number.isNaN(parsedValue) ? QUESTION_WAIT_TIME_LIMITS.fallback : parsedValue;
    return Math.min(QUESTION_WAIT_TIME_LIMITS.max, Math.max(QUESTION_WAIT_TIME_LIMITS.min, normalized));
}

/**
 * Start presentation mode (game start screen)
 * This is where the gamePin is generated and WebSocket connects
 * NOTE: This only creates a room - Admin must click "Start Game" to begin accepting participants
 */
export async function startPresentationMode() {
    console.log('🎮 Start game button clicked - generating gamePin and creating room...');

    // Prevent starting a new game while admin connection screen is open
    if (isAdminConnectionScreenOpen()) {
        console.log('⚠️ Admin connection screen already open - ignoring');
        return;
    }

    try {
        // Ensure no participant/answer state leaks from previous sessions.
        resetParticipantsList();
        resetCurrentQuestionAnswers();
        setCurrentUsers(0);

        // Generate a new gamePin (Add-in is responsible for this)
        const gamePin = generateGamePin();
        setGamePIN(gamePin);

        console.log('✅ Generated Game PIN:', gamePin);

        // Step 1: Resolve server via Load Balancer
        const serverUrl = await resolveServerForNewGame(gamePin);
        console.log('✅ Server assigned by LB:', serverUrl);

        // Step 2: Create room on the assigned server (NOT active yet - players can't join until Admin starts)
        const createResult = await createRoom(gamePin);
        if (createResult.status !== 'success') {
            setGamePIN(null);
            resetServerUrl();
            window.updateStartStopButton?.();
            showError(t('errors.createRoom', { message: tServerError(createResult.message) }));
            return;
        }

        console.log('✅ Room created on server (waiting for Admin to start game)');

        // Connect WebSocket with the gamePin
        const socket = await connectWebSocketForGame(gamePin);
        if (!socket) {
            setGamePIN(null);
            resetServerUrl();
            window.updateStartStopButton?.();
            showError(t('errors.websocket'));
            return;
        }

        console.log('✅ WebSocket connected for game:', gamePin);

        // Reset all textboxes in the presentation (but DON'T navigate to any slide)
        // PIN and QR will be updated only after Admin starts the game
        try {
            const {
                resetAnswersDistribution,
                resetLeaderboard
            } = await import('../elements/answers_analysis.js');
            const {
                updateAllQuestionTimeElements,
                updateAllRespondentsCountElements
            } = await import('../elements/question_timer.js');
            const {
                resetParticipantsNumInSlides,
                resetParticipantShapesInSlides
            } = await import('../elements/participants_management.js');
            const {
                resetGameIdInSlides
            } = await import('../elements/game_management.js');
            const {
                resetHiddenParticipants
            } = await import('../core/state.js');

            const settings = getPresentationSettings();
            const initialTime = getNormalizedQuestionWaitTime(settings);
            await updateAllQuestionTimeElements(initialTime);
            await updateAllRespondentsCountElements(0);
            await resetParticipantsNumInSlides();
            await resetParticipantShapesInSlides();
            await resetGameIdInSlides();
            await resetAnswersDistribution();
            await resetLeaderboard();
            resetHiddenParticipants();
            console.log('✅ All textboxes reset');
        } catch (resetError) {
            console.error('❌ Error resetting textboxes:', resetError);
        }

        // Show admin connection overlay (does NOT replace the UI)
        await showAdminConnectionScreen(gamePin);

        // Update button to "Stop Game" now that game is initialized
        window.updateStartStopButton?.();

    } catch (error) {
        console.error('❌ Error starting presentation mode:', error);
        setGamePIN(null);
        resetServerUrl();
        window.updateStartStopButton?.();
        showError(t('errors.startGame', { message: tServerError(error.serverMessage || error.message) }));
    }
}

/**
 * Connect WebSocket for the game with appropriate event handlers
 */
async function connectWebSocketForGame(gamePin) {
    const { connectWebSocket } = await import('../core/websocket.js');
    const { registerRoom } = await import('../core/api.js');
    const { 
        goToFirstSlideInPowerPoint,
        goToNextSlideInPowerPoint,
        simulateClickInPowerPoint,
        resetAnimationState
    } = await import('./navigation.js');
    const {
        updateParticipantsNumInSlides,
        updateParticipantsListInSlides,
        resetParticipantsNumInSlides,
        resetParticipantShapesInSlides
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
        updateQrCodeInSlides,
        resetGameIdInSlides
    } = await import('../elements/game_management.js');
    const {
        setCurrentUsers,
        triggerRefreshSlideList,
        setSocket,
        resetHiddenParticipants
    } = await import('../core/state.js');
    const { t } = await import('../i18n/index.js');
    
    const socket = connectWebSocket(gamePin, {
        onConnect: async (socket, pin) => {
            console.log('✅ Connected to WebSocket for game:', pin);
            
            // Register to room using gamePin
            await registerRoom(socket.id, pin);
            
            // NOTE: Game ID & QR code in slides are NOT updated here.
            // They will be updated only when Admin starts the game (onGameStarted).
            console.log('🕐 Room ready, waiting for Admin to start game...');
        },
        
        onDisconnect: (reason) => {
            console.log('❌ Disconnected from game:', reason);
        },
        
        onError: (msg) => {
            showError(tServerError(msg));
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
            setGamePIN(null);
            resetServerUrl();
            hideAdminConnectionScreen();
            window.updateStartStopButton?.();
            console.log('🛑 Game closed:', data);
            const closeReason = data?.reason || data?.message || { code: 'GAME_SESSION_NOT_FOUND' };
            const reasonCode = (typeof closeReason === 'object' ? closeReason.code : closeReason) || '';
            const message = t('errors.gameClosed', { reason: tServerError(closeReason) });
            if (reasonCode.toUpperCase() === 'MANUAL') {
                showStatus(message, 'success');
            } else {
                showError(message);
            }
        },

        onReconnectionFailed: () => {
            setGamePIN(null);
            resetServerUrl();
            hideAdminConnectionScreen();
            window.updateStartStopButton?.();
            console.log('❌ Reconnection failed after 30 seconds');
            showError(t('errors.connectionLost'));
        },

        onGameStarted: async (data) => {
            console.log('🎮 Game started by Admin - initializing game state');

            // Close admin connection overlay if still open
            hideAdminConnectionScreen();

            // PIN is still set - button remains "Stop Game"
            window.updateStartStopButton?.();

            // Initialize all add-in state for the game
            // NOTE: Do NOT call resetParticipantsList() here - players join BEFORE
            // game_started, so resetting would discard all lobby participants.
            try {
                resetAnimationState();
                resetHiddenParticipants();

                const settings = getPresentationSettings();
                const initialTime = getNormalizedQuestionWaitTime(settings);
                await updateAllQuestionTimeElements(initialTime);
                await updateAllRespondentsCountElements(0);
                await resetParticipantsNumInSlides();
                await resetParticipantShapesInSlides();
                await resetGameIdInSlides();
                await updateParticipantsListInSlides();
                await resetAnswersDistribution();
                await resetLeaderboard();

                console.log('✅ Game state initialized after admin started game');
            } catch (error) {
                console.error('❌ Error initializing game state:', error);
            }

            // Step 1: Navigate to opening slide (shows PIN/QR to audience)
            try {
                const { goToOpeningSlide } = await import('./navigation.js');
                console.log('📄 Navigating to opening slide...');
                await goToOpeningSlide();
                console.log('✅ On opening slide');
            } catch (error) {
                console.error('❌ Error navigating to opening slide:', error);
            }

            // Step 2: Update Game ID & QR code in slides (now that game is active)
            const currentPin = getGamePIN();
            if (currentPin) {
                try {
                    await updateGameIdInSlides(currentPin);
                    await updateQrCodeInSlides(currentPin);
                    console.log('✅ Game ID & QR code updated in slides');
                } catch (updateError) {
                    console.error('❌ Error updating Game ID/QR Code:', updateError);
                }
            }

            // Step 3: Navigate to first slide after a brief delay (so audience sees PIN/QR)
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
    // Stop local timer processes without sending extra results.
    await stopTimer({ finalize: false, silent: true, reason: 'end_game' });
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
    resetServerUrl();
    window.updateStartStopButton?.();

    console.log('✅ Game ended');
}

// Global timer variables
let timerInterval = null;
let timerStartTimeout = null;
let timerRemaining = 0;
let questionStartTime = null; // Track when the question timer started (for scoring)

function clearTimerHandles() {
    let hadDelay = false;
    let hadInterval = false;

    if (timerStartTimeout) {
        clearTimeout(timerStartTimeout);
        timerStartTimeout = null;
        hadDelay = true;
    }

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        hadInterval = true;
    }

    return { hadDelay, hadInterval };
}

/**
 * Start question timer with delay
 * Implements the flow:
 * 1. Wait for clockActivationDelay seconds
 * 2. Start countdown from questionWaitTime
 * 3. Update quizngo-question-time elements in real-time
 * 4. Send WebSocket messages to server at key points
 */
export async function startTimer() { 
    console.log('⏱️ startTimer called');
    
    // Stop any existing timer process first (without finalizing results).
    clearTimerHandles();
    timerRemaining = 0;
    questionStartTime = null;
    
    // Get settings from state
    const settings = getPresentationSettings();
    
    // Use explicit check for undefined/null to allow 0 values
    const questionWaitTime = getNormalizedQuestionWaitTime(settings);
    const clockActivationDelay = settings.clockActivationDelay !== undefined && settings.clockActivationDelay !== null 
        ? settings.clockActivationDelay 
        : 5;
    
    console.log(`⏳ Waiting ${clockActivationDelay} seconds before starting timer...`);
    console.log(`⏱️ Timer will count down from ${questionWaitTime} seconds`);
    
    // Step 1: Wait for clock activation delay
    timerStartTimeout = setTimeout(() => {
        timerStartTimeout = null;

        // If game already ended/closed while waiting, abort.
        const activeGamePin = getGamePIN();
        if (!activeGamePin) {
            console.log('Timer start canceled - no active game PIN');
            return;
        }
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
                clearTimerHandles();
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
export async function stopTimer(options = {}) {
    const normalizedOptions = typeof options === 'boolean'
        ? { finalize: options }
        : (options || {});
    const { finalize = true, silent = false, reason = 'manual' } = normalizedOptions;

    console.log(`⏹️ stopTimer called (finalize=${finalize}, reason=${reason})`);

    const { hadDelay, hadInterval } = clearTimerHandles();
    const hadTimerActivity = hadDelay || hadInterval;

    if (!hadTimerActivity) {
        console.log('⚠️ No active timer to stop');
        return false;
    }

    if (finalize && hadInterval && questionStartTime) {
        // Process scores and send results when timer is intentionally ended.
        await handleQuestionEnd();
    } else {
        questionStartTime = null;
        timerRemaining = 0;
    }

    if (!silent) {
        console.log('✅ Timer stopped');
        showStatus('⏸️ טיימר הופסק', 'info');
    }

    return true;
}

/**
 * Handle question end - process scores and send to server
 */
async function handleQuestionEnd() {
    try {
        console.log('🎯 Handling question end - processing scores...');

        if (!questionStartTime) {
            console.warn('⚠️ Skipping question end processing - no questionStartTime');
            return;
        }
        
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
        const questionTime = getNormalizedQuestionWaitTime(settings);
        
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
    } finally {
        questionStartTime = null;
        timerRemaining = 0;
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
            questionWaitTime: getNormalizedQuestionWaitTime(settings)
        };
        
        // Send via REST API instead of WebSocket
        const url = getApiUrl('answer_time_started');
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
 * Update quizngo-question-time elements in all slides
 * @param {number} timeValue - Time in seconds to display
 */
async function updateQuestionTimeDisplay(timeValue) {
    try {
        await updateAllQuestionTimeElements(timeValue);
    } catch (error) {
        console.error('❌ Error updating question time display:', error);
    }
}

// End of file
