/* global Office, PowerPoint */

/*
 * Kahoot Quiz Manager - Add-in Client (Refactored)
 * 
 * STATE MANAGEMENT:
 * ================
 * - The state (window.slideTypeData) is ONLY managed in PowerPoint (this client)
 * - The server ONLY saves/loads state to/from files - NO CACHE in server memory
 * - Slide types are stored by slide ID (UUID), NOT by slide number
 * - This ensures slide types persist correctly even if slides are reordered
 * 
 * SLIDE IDENTIFICATION:
 * ====================
 * - Each slide has a unique ID provided by PowerPoint (slide.id)
 * - window.slideTypeData uses these IDs as keys: { "256": "opening", "257": "transition", ... }
 * - When loading, we restore window.slideTypeData and look up types by current slide's ID
 * - PowerPoint's slide.id is stable and persists across saves/loads
 * 
 * FILE NAMING & PERSISTENCE:
 * =========================
 * - Data is saved per presentation file using the file name as ID
 * - IMPORTANT: Presentation MUST be saved (File > Save As) before data can be saved
 * - The file name (without .pptx) is used as the unique ID for saving/loading
 * - Example: "MyQuiz.pptx" → saved as "data/saved_presentations/MyQuiz.json"
 * - If presentation is not saved (has no file name), save/load operations are blocked
 * 
 * SERVER ROLE:
 * ============
 * - Server provides /save endpoint: saves state to file (data/saved_presentations/{filename}.json)
 * - Server provides /load endpoint: loads state from file
 * - Server does NOT cache or modify state - it's a pure storage service
 */

console.log('📄 taskpane.js loaded (Refactored Version)!');

// Import modules
import { API_BASE, makeApiCall, makeJsonApiCall, initializeQuiz } from './modules/api.js';
import { 
    initializeWebSocket, 
    getSocket, 
    emitSocketEvent, 
    getParticipantsList 
} from './modules/websocket.js';
import { 
    goToFirstSlideInPowerPoint, 
    goToNextSlideInPowerPoint, 
    simulateClickInPowerPoint, 
    resetAnimationState,
    getCurrentSlideNumber 
} from './modules/navigation.js';
import { 
    savePresentationData, 
    loadPresentationData, 
    getSlideType, 
    setSlideType, 
    getSlideData,
    getGameHashId,
    isPresentationSaved,
    triggerAutoSave
} from './modules/presentation-state.js';
import { 
    updateGameIdInSlides, 
    updateQrCodeInSlides, 
    insertLiveParticipantsArea,
    updateLiveParticipantsInSlide,
    insertGameIdButton,
    insertParticipantsNumButton,
    insertQrCodeButton,
    addQuestionTime,
    addRespondentsCount,
    addStatisticsImage
} from './modules/powerpoint-shapes.js';
import { 
    showStatus, 
    showError, 
    updateDisplayedValues, 
    updateAutoSaveStatus,
    preloadAllHtmlFiles,
    updateUIForSlideType,
    initializeStartScreen,
    loadSettingsIntoUI,
    attachSettingsEventListeners,
    attachQuestionAnswerListener,
    loadSharedActions
} from './modules/ui-manager.js';
import { 
    handleSlideTypeChange, 
    saveSlideType, 
    loadSlideType, 
    openSettings, 
    closeSettings 
} from './modules/slide-manager.js';
import { 
    setupSlideChangeListener, 
    onSlideChanged, 
    processSlideChange 
} from './modules/event-handlers.js';
import { 
    startPresentationMode, 
    startTimer, 
    stopTimer, 
    showLeaderboard, 
    insertLeaderboardTable, 
    showFinalResults, 
    insertFinalLeaderboard, 
    endGame, 
    showStatistics, 
    insertAnswerStats 
} from './modules/game-actions.js';

// State variables
let isInitialized = false;
let autoUpdateInterval = null;
let slideCheckInterval = null;

// IMPORTANT: All state is stored on window object for consistency and global access
window.currentUsers = 0;
window.currentTime = '';
window.currentSlideNumber = 1;
window.currentSlideId = null;
window.slideTypeData = {};
window.lastQuestionSlideIndex = null;

// Presentation settings (shared across all slides)
window.presentationSettings = {
    questionWaitTime: 30,
    clockActivationDelay: 5,
    afterQuestionStatistics: true,
    afterQuestionLeaderboard: false
};

// Auto-save mechanism variables
let autoSaveTimer = null;
let hasUnsavedChanges = false;
const AUTO_SAVE_DELAY = 0; // Immediate save for debugging
window.markUnsavedChanges = null;

let timerActive = false;
let localTimerInterval = null;
let localTimerRemaining = 0;

// Clear any cached data
localStorage.clear();
sessionStorage.clear();

// HTML files cache
const htmlCache = new Map();

// Setup slide change listener
// setupSlideChangeListener, onSlideChanged, processSlideChange moved to event-handlers.js

// Initialize the add-in when Office is ready
Office.onReady((info) => {
    console.log('🚀 Office.onReady called!', info);
    if (info.host === Office.HostType.PowerPoint) {
        console.log('✅ PowerPoint detected - initializing add-in...');
        
        // Set up slide type selection event handler
        const slideTypeElement = document.getElementById('slideType');
        if (slideTypeElement) {
            slideTypeElement.onchange = () => handleSlideTypeChange(htmlCache);
            console.log('✅ slideType dropdown event handler attached');
        } else {
            console.warn('⚠️ slideType dropdown not found');
        }
        
        // Pre-load all HTML files for instant transitions
        preloadAllHtmlFiles(htmlCache).catch(err => {
            console.warn('⚠️ Some HTML files failed to preload:', err);
        });
        
        // Load shared actions into footer
        loadSharedActions();
        
        // Set up slide change event listener
        setupSlideChangeListener((eventArgs) => onSlideChanged(eventArgs, htmlCache));
        
        // Initialize WebSocket connection with event handlers
        initializeWebSocket({
            onConnect: async (socket) => {
                const hashId = await getGameHashId();
                if (hashId) {
                    console.log('🔑 Registering with hash ID:', hashId);
                    socket.emit('register_room', { hashId: hashId });
                    window.currentHashId = hashId;
                } else {
                    console.log('⚠️ No hash ID available - running without room registration');
                }
            },
            onDisconnect: () => {
                timerActive = false;
            },
            onUserUpdate: (data) => {
                window.currentUsers = data.users || data.total || 0;
                
                const userCountElement = document.getElementById('userCount');
                if (userCountElement) {
                    userCountElement.textContent = window.currentUsers;
                }
            },
            onParticipantUpdate: (data, participantsList) => {
                // Update live participants in slide
                updateLiveParticipantsInSlide(participantsList).catch(err => {
                    console.error('Failed to update participants in slide:', err);
                });
            },
            onGamePinRegistered: (data) => {
                const gamePin = data.gamePin;
                
                console.log('📌 Updating Game PIN to:', gamePin);
                
                // Store game PIN globally
                window.gamePIN = gamePin;
                
                // Format PIN as XXX-XXX for display
                const formattedPin = gamePin.slice(0, 3) + '-' + gamePin.slice(3);
                
                // Update game ID display in UI
                const gameIdElements = document.querySelectorAll('[id^="gameId"]');
                gameIdElements.forEach(el => {
                    el.textContent = formattedPin;
                });
                
                // Update kahoot-game-id tags in PowerPoint slides
                updateGameIdInSlides(gamePin).catch(err => {
                    console.error('❌ updateGameIdInSlides error:', err);
                });
                
                // Update QR Code in slides
                if (window.currentHashId && gamePin) {
                    updateQrCodeInSlides(window.currentHashId, gamePin).catch(err => {
                        console.error('❌ updateQrCodeInSlides error:', err);
                    });
                }
                
                showStatus(`🎮 משחק פעיל - Game PIN: ${formattedPin}`, 'success');
            },
            onStatusUpdate: (data) => {
                window.currentUsers = data.users || 0;
                
                const userCountElement = document.getElementById('userCount');
                if (userCountElement) {
                    userCountElement.textContent = window.currentUsers;
                }
                
                if (data.status === 'running') {
                    timerActive = true;
                } else {
                    timerActive = false;
                }
            },
            onSlideNavigation: (data) => {
                if (data.action === 'go_to_next_slide') {
                    console.log('📄 Executing next slide navigation...');
                    goToNextSlideInPowerPoint();
                    showStatus('מעבר לשקף הבא...', 'info');
                } else if (data.action === 'go_to_first_slide') {
                    console.log('📍 Resetting to first slide...');
                    goToFirstSlideInPowerPoint();
                    showStatus('חזרה לשקף הראשון...', 'info');
                }
            },
            onClickNavigation: (data) => {
                if (data.action === 'simulate_click') {
                    console.log('⌨️ Executing spacebar simulation...');
                    simulateClickInPowerPoint();
                    showStatus('מדמה לחיצה על רווח...', 'info');
                }
            },
            onAnimationReset: (data) => {
                if (data.action === 'reset_animations') {
                    console.log('🔄 Executing animation reset...');
                    resetAnimationState();
                }
            },
            onSlideChange: (data) => {
                if (data.slide) {
                    window.currentSlideNumber = data.slide;
                    
                    const slideElement = document.getElementById('currentSlide');
                    if (slideElement) {
                        slideElement.textContent = window.currentSlideNumber;
                    }
                    
                    console.log(`📄 Slide updated to: ${window.currentSlideNumber}`);
                }
                
                if (data.users !== undefined) {
                    window.currentUsers = data.users;
                    
                    const userCountElement = document.getElementById('userCount');
                    if (userCountElement) {
                        userCountElement.textContent = window.currentUsers;
                    }
                }
                
                loadSlideType(htmlCache);
                showStatus(`עבר לשקף ${data.slide || 'הבא'}`, 'info');
            },
            onError: (message) => {
                showError(message);
            }
        });
        
        // Get initial slide number and load slide type
        setTimeout(async () => {
            console.log('🔄 Starting initial slide detection...');
            try {
                await getCurrentSlideNumber();
                
                console.log('📍 Current slide detected:', window.currentSlideNumber, 'ID:', window.currentSlideId);
                
                try {
                    await loadPresentationData();
                } catch (error) {
                    console.log('No existing presentation data found:', error);
                }
                
                loadSlideType(htmlCache);
                console.log('🎯 Loaded slide type for current slide:', window.currentSlideNumber);
                
                console.log('✅ Initial setup completed - current slide:', window.currentSlideNumber);
            } catch (error) {
                console.error('Error in initial setup:', error);
            }
        }, 0); // Wait for PowerPoint to be fully ready
        
        console.log('🎯 Kahoot Quiz Manager Add-in initialized - VERSION 5.0.0 (Refactored)');
        console.log('📦 Using modular architecture');
    } else {
        console.log('❌ Not in PowerPoint - host:', info.host);
    }
});

// Slide type management functions
// handleSlideTypeChange, saveSlideType, loadSlideType moved to slide-manager.js

// Auto-save mechanism moved to presentation-state.js

// Initialize markUnsavedChanges
window.markUnsavedChanges = triggerAutoSave;

// Load shared actions into footer
// All helper functions moved to respective modules:
// - loadSharedActions → ui-manager.js
// - initializeStartScreen → ui-manager.js
// - Game actions → game-actions.js

// Make functions globally available for HTML onclick handlers and modules
window.initializeQuiz = initializeQuiz;
window.startPresentationMode = () => startPresentationMode(htmlCache);
window.openSettings = () => openSettings(htmlCache);
window.closeSettings = () => closeSettings(htmlCache);
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.goToFirstSlideInPowerPoint = goToFirstSlideInPowerPoint;
window.goToNextSlideInPowerPoint = goToNextSlideInPowerPoint;
window.simulateClickInPowerPoint = simulateClickInPowerPoint;
window.resetAnimationState = resetAnimationState;
window.insertLiveParticipantsArea = insertLiveParticipantsArea;
window.savePresentationData = () => savePresentationData(false);
window.loadPresentationData = loadPresentationData;
window.triggerAutoSave = triggerAutoSave; // Exposed for ui-manager.js

// PowerPoint insertion functions
window.insertGameIdButton = insertGameIdButton;
window.insertParticipantsNumButton = insertParticipantsNumButton;
window.insertQrCodeButton = insertQrCodeButton;
window.addQuestionTime = addQuestionTime;
window.addRespondentsCount = addRespondentsCount;
window.addStatisticsImage = addStatisticsImage;
window.showLeaderboard = showLeaderboard;
window.insertLeaderboardTable = insertLeaderboardTable;
window.showFinalResults = showFinalResults;
window.insertFinalLeaderboard = insertFinalLeaderboard;
window.endGame = endGame;
window.showStatistics = showStatistics;
window.insertAnswerStats = insertAnswerStats;

