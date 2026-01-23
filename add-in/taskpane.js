/* global Office, PowerPoint */

console.log('📄 taskpane.js loaded (Tabbed Version)!');

// Import modules - Core
import { API_BASE, registerRoom } from './modules/core/api.js';
import { initializeWebSocket, resetParticipantsList } from './modules/core/websocket.js';
import { 
    getSlideType, 
    loadPresentationData,
    triggerAutoSave 
} from './modules/core/state.js';

// Import modules - UI
import { showStatus, showError } from './modules/ui/manager.js';
import { 
    initializeSlidesList,
    refreshSlideList,
    navigateToSlideByIndex,
    updateListSelection
} from './modules/ui/slides-list.js';

// Import modules - Game
import { 
    handleSlideTypeChange, 
    saveSlideType, 
    loadHiddenSlideState,
    setupHideSlideListener 
} from './modules/game/slides.js';
import { 
    setupSlideChangeListener, 
    onSlideChanged,
    resetParticipantAcceptanceState 
} from './modules/game/events.js';
import { startPresentationMode } from './modules/game/actions.js';
import {
    goToFirstSlideInPowerPoint,
    goToNextSlideInPowerPoint,
    simulateClickInPowerPoint,
    resetAnimationState
} from './modules/game/navigation.js';

// Import modules - Elements
import {
    updateAllQuestionTimeElements,
    updateAllRespondentsCountElements,
    addQuestionTime,
    addRespondentsCount
} from './modules/elements/question_timer.js';
import {
    resetParticipantsNumInSlides,
    updateParticipantsListInSlides,
    updateParticipantsNumInSlides,
    insertParticipantsListButton,
    insertParticipantsNumButton
} from './modules/elements/participants_management.js';
import {
    resetAnswersDistribution,
    resetLeaderboard,
    addAnswersDistribution, 
    addLeaderboardElements
} from './modules/elements/answers_analysis.js';
import {
    updateGameIdInSlides,
    updateQrCodeInSlides,
    insertGameIdButton,
    insertQrCodeButton
} from './modules/elements/game_management.js';

// Expose triggerAutoSave globally for modules that need it
window.triggerAutoSave = triggerAutoSave;

// --- Global Functions (Attached to window for HTML access) ---

window.switchTab = function(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    
    // Show selected
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Highlight tab button
    const tabs = document.querySelectorAll('.tab');
    if (tabName === 'slides') tabs[0].classList.add('active');
    if (tabName === 'actions') tabs[1].classList.add('active');
    if (tabName === 'settings') {
        tabs[2].classList.add('active');
        // Load current settings into the tab
        loadSettingsToTab();
    }
};

window.closeDialogs = function() {
    document.querySelectorAll('.overlay').forEach(el => el.style.display = 'none');
};

// Load settings into the settings tab
function loadSettingsToTab() {
    const settings = window.presentationSettings || {
        questionWaitTime: 30,
        clockActivationDelay: 5,
        afterQuestionStatistics: true,
        afterQuestionLeaderboard: false
    };
    
    document.getElementById('settingTimeTab').value = settings.questionWaitTime;
    document.getElementById('settingDelayTab').value = settings.clockActivationDelay;
    document.getElementById('settingAfterStatsTab').checked = settings.afterQuestionStatistics !== false;
    document.getElementById('settingAfterLeaderboardTab').checked = settings.afterQuestionLeaderboard === true;
}

// Auto-save settings when any setting changes
function autoSaveSettings() {
    const time = parseInt(document.getElementById('settingTimeTab').value) || 30;
    const delay = parseInt(document.getElementById('settingDelayTab').value) || 5;
    const stats = document.getElementById('settingAfterStatsTab').checked;
    const board = document.getElementById('settingAfterLeaderboardTab').checked;
    
    window.presentationSettings = {
        questionWaitTime: time,
        clockActivationDelay: delay,
        afterQuestionStatistics: stats,
        afterQuestionLeaderboard: board
    };
    
    // Trigger auto-save if available
    if (window.triggerAutoSave) window.triggerAutoSave();
    
    console.log('Settings auto-saved:', window.presentationSettings);
}

// Setup settings auto-save listeners
function setupSettingsListeners() {
    document.getElementById('settingTimeTab').addEventListener('change', autoSaveSettings);
    document.getElementById('settingDelayTab').addEventListener('change', autoSaveSettings);
    document.getElementById('settingAfterStatsTab').addEventListener('change', autoSaveSettings);
    document.getElementById('settingAfterLeaderboardTab').addEventListener('change', autoSaveSettings);
}


// State variables
window.currentSlideNumber = 1;
window.currentSlideId = null;
window.slideTypeData = {};
window.presentationSettings = {
    questionWaitTime: 30,
    clockActivationDelay: 5
};
window.contextMenuTargetSlideId = null;

// Select current slide on load or navigate to first slide
async function selectCurrentSlideOnLoad() {
    try {
        await PowerPoint.run(async (context) => {
            const selection = context.presentation.getSelectedSlides();
            selection.load("items/id");
            
            const slides = context.presentation.slides;
            slides.load("items/id");
            
            await context.sync();
            
            if (selection.items.length > 0) {
                // A slide is selected, use it
                const selectedSlide = selection.items[0];
                window.currentSlideId = selectedSlide.id;
                
                // Find the slide index
                const slideIndex = slides.items.findIndex(s => s.id === selectedSlide.id);
                window.currentSlideNumber = slideIndex + 1;
                
                console.log('📍 Current slide on load:', window.currentSlideNumber, window.currentSlideId);
            } else if (slides.items.length > 0) {
                // No slide selected, go to first slide
                const firstSlide = slides.items[0];
                window.currentSlideId = firstSlide.id;
                window.currentSlideNumber = 1;
                
                // Navigate to first slide
                await navigateToSlideByIndex(1);
                console.log('📍 Navigated to first slide:', window.currentSlideId);
            }
        });
    } catch (error) {
        console.error('Error selecting current slide on load:', error);
        // Fallback: try to go to first slide
        window.currentSlideNumber = 1;
        try {
            await navigateToSlideByIndex(1);
        } catch (e) {
            console.error('Error navigating to first slide:', e);
        }
    }
}

// Initialize the add-in when Office is ready
Office.onReady((info) => {
    console.log('🚀 Office.onReady called!', info);
    if (info.host === Office.HostType.PowerPoint) {
        console.log('✅ PowerPoint detected - initializing add-in...');
        
        // Check for URL parameters (e.g. from deep link or manual launch)
        const urlParams = new URLSearchParams(window.location.search);
        const urlHashId = urlParams.get('hash_id');
        
        if (urlHashId) {
            console.log('🔗 Found hash_id in URL:', urlHashId);
            window.currentHashId = urlHashId;
        }
        
        // Initialize Tabs and Lists
        renderActionsTab();
        setupSettingsListeners();
        loadSettingsToTab();
        
        // Attach persistent button listeners
        document.getElementById('btnStartGame').onclick = () => startPresentationMode();
        
        const slideContentArea = document.getElementById('slideContentArea');
        const mainContent = document.getElementById('mainContent');
        const tabs = document.querySelector('.tabs');
    
        // Load data then initialize slides list
        loadPresentationData().then(async () => {
            // Get current slide and select it
            await selectCurrentSlideOnLoad();
            
            // Initialize the slides list module (handles refresh, navigation, inline editing)
            await initializeSlidesList();
            
            // Ensure we are registered to the room if hashId is available
            if (window.socket && window.socket.connected && window.currentHashId) {
                console.log('🔗 Late registration for hash:', window.currentHashId);
                await registerRoom(window.socket.id, window.currentHashId);
            }
        });

        // Set up slide change event listener
        setupSlideChangeListener((eventArgs) => onSlideChanged(eventArgs));
        
        // Initialize WebSocket
        const socket = initializeWebSocket({
            onConnect: async (socket) => {
                console.log('✅ Connected to WebSocket');
                
                // Register room if we have a hash ID
                const hashId = window.currentHashId;
                if (hashId) {
                    console.log('🔗 Registering room for hash:', hashId);
                    await registerRoom(socket.id, hashId);
                }
            },
            onDisconnect: () => {
                console.log('❌ Disconnected');
            },
            onError: (msg) => showError(msg),
            
            // Handle game PIN registration from Admin
            onGamePinRegistered: async (data) => {
                const gamePin = data.gamePin;
                
                // Store the hash ID and game PIN globally
                if (data.hashId) {
                    window.currentHashId = data.hashId;
                }
                if (gamePin) {
                    window.gamePIN = gamePin;
                }
                
                // === UPDATE GAME ID & QR CODE IN SLIDES ===
                try {
                    if (gamePin) {
                        await updateGameIdInSlides(gamePin);
                    }
                    
                    if (window.currentHashId && gamePin) {
                        await updateQrCodeInSlides(window.currentHashId, gamePin);
                    } else {
                        console.warn('⚠️ No hash ID or game PIN available for QR code update');
                    }
                } catch (updateError) {
                    console.error('❌ Error updating Game ID/QR Code:', updateError);
                }
                
                // === RESET ALL GAME STATE ===
                resetParticipantAcceptanceState();
                resetParticipantsList();
                resetAnimationState();
                
                try {
                    const initialTime = window.presentationSettings?.questionWaitTime || 30;
                    await updateAllQuestionTimeElements(initialTime);
                    await updateAllRespondentsCountElements(0);
                    await resetParticipantsNumInSlides();
                    await updateParticipantsListInSlides();
                    await resetAnswersDistribution();
                    await resetLeaderboard();
                } catch (resetError) {
                    console.error('❌ Error during resets:', resetError);
                }
                
                // Navigate to first slide when game starts
                try {
                    await goToFirstSlideInPowerPoint();
                } catch (error) {
                    console.error('❌ Error navigating to first slide:', error);
                }
                
                // Format PIN as XXX-XXX for display
                const formattedPin = gamePin ? gamePin.slice(0, 3) + '-' + gamePin.slice(3) : 'N/A';
                showStatus(`🎮 משחק פעיל - Game PIN: ${formattedPin}`, 'success');
            },
            
            // Handle slide navigation commands
            onSlideNavigation: async (data) => {
                console.log('🎯 Handling slide navigation:', data.action);
                
                try {
                    switch (data.action) {
                        case 'go_to_first_slide':
                            console.log('📍 Resetting to first slide...');
                            await goToFirstSlideInPowerPoint();
                            showStatus('חזרה לשקף הראשון...', 'info');
                            break;
                        case 'go_to_next_slide':
                        case 'next_slide':
                            console.log('📄 Executing next slide navigation...');
                            await goToNextSlideInPowerPoint();
                            showStatus('מעבר לשקף הבא...', 'info');
                            break;
                        default:
                            console.warn('⚠️ Unknown slide navigation action:', data.action);
                    }
                } catch (error) {
                    console.error('❌ Error handling slide navigation:', error);
                }
            },
            
            // Handle click navigation (spacebar simulation)
            onClickNavigation: async (data) => {
                console.log('⌨️ Handling click navigation (spacebar)...', data);
                
                if (data.action === 'simulate_click') {
                    console.log('⌨️ Executing spacebar simulation...');
                    try {
                        await simulateClickInPowerPoint();
                        showStatus('מדמה לחיצה על רווח...', 'info');
                    } catch (error) {
                        console.error('❌ Error handling click navigation:', error);
                    }
                }
            },
            
            // Handle animation reset
            onAnimationReset: async (data) => {
                console.log('🔄 Handling animation reset...', data);
                
                if (data.action === 'reset_animations') {
                    console.log('🔄 Executing animation reset...');
                    resetAnimationState();
                }
            },
            
            // Handle participant updates
            onParticipantUpdate: async (data, participantIds) => {
                console.log('👥 Participant update received:', data);
                console.log('👥 Total participants:', participantIds.length);
                
                window.currentUsers = participantIds.length;
                
                try {
                    await updateParticipantsNumInSlides(participantIds.length);
                    console.log('✅ Updated participant count in slides to:', participantIds.length);
                } catch (error) {
                    console.error('❌ Error updating participant count in slides:', error);
                }
                
                try {
                    await updateParticipantsListInSlides();
                    console.log('✅ Updated participant list in slides');
                } catch (error) {
                    console.error('❌ Error updating participant list in slides:', error);
                }
                
                // Trigger UI refresh if needed
                if (window.refreshSlideList) {
                    window.refreshSlideList();
                }
            },
            
            // Handle player answers
            onPlayerAnswer: (data, answersMap) => {
                console.log('📝 Player answer handled, total answers:', answersMap.size);
            }
        });
        window.socket = socket;

    } else {
        console.log('❌ Not in PowerPoint');
    }
});


// --- Tab 2: Actions ---

function renderActionsTab() {
    const grid = document.getElementById('actionsGrid');
    
    // Global Actions
    const actions = [
        // Slide Elements
        { label: 'מזהה משחק', icon: 'Game', onclick: insertGameIdButton },
        { label: 'מספר משתתפים', icon: 'PeopleAdd', onclick: insertParticipantsNumButton },
        { label: 'רשימת משתתפים', icon: 'ContactList', onclick: insertParticipantsListButton },
        { label: 'QR Code', icon: 'QRCode', onclick: insertQrCodeButton },

        // Game Control
        { label: 'זמן שאלה', icon: 'Clock', onclick: addQuestionTime },
        { label: 'מספר עונים', icon: 'People', onclick: addRespondentsCount },
        
        // Analysis Elements
        { label: 'פילוג תשובות', icon: 'BarChart4', onclick: addAnswersDistribution },
        { label: 'טבלת מובילים', icon: 'Trophy', onclick: addLeaderboardElements }
    ];
    
    grid.innerHTML = '';
    actions.forEach(action => {
        const btn = document.createElement('div');
        btn.className = 'action-card';
        btn.innerHTML = `<i class="ms-Icon ms-Icon--${action.icon}"></i><span>${action.label}</span>`;
        btn.onclick = action.onclick;
        grid.appendChild(btn);
    });
}
