/* global Office, PowerPoint */

console.log('📄 taskpane.js loaded (Tabbed Version with i18n)!');

// Import modules - Core
import { API_BASE, registerRoom } from './modules/core/api.js';
import { initializeWebSocket, resetParticipantsList } from './modules/core/websocket.js';
import { 
    getSlideType, 
    loadGameData,
    saveGameData,
    getGameHashId,
    // Centralized state management
    getHashId, setHashId,
    getGamePIN, setGamePIN,
    getCurrentUsers, setCurrentUsers,
    getSocket, setSocket,
    getCurrentSlideNumber, setCurrentSlideNumber,
    getCurrentSlideId, setCurrentSlideId,
    getPresentationSettings, setPresentationSettings, updatePresentationSettings,
    setRefreshSlideListCallback, triggerRefreshSlideList
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

// Import i18n module
import { 
    initI18n, 
    setLanguage, 
    getLanguage, 
    t, 
    updateDOM,
    getAvailableLanguages,
    LANGUAGES,
    isRTL
} from './modules/i18n/index.js';

// --- i18n Functions ---

/**
 * Initialize language selector dropdown
 */
function initLanguageSelector() {
    const select = document.getElementById('settingLanguage');
    if (!select) return;
    
    const languages = getAvailableLanguages();
    const currentLang = getLanguage();
    
    select.innerHTML = languages.map(lang => 
        `<option value="${lang.code}" ${lang.code === currentLang ? 'selected' : ''}>${lang.flag} ${lang.nativeName}</option>`
    ).join('');
    
    select.addEventListener('change', async (e) => {
        await changeLanguage(e.target.value);
    });
}

/**
 * Change the interface language
 */
window.changeLanguage = async function(langCode) {
    console.log(`🌐 Changing language to: ${langCode}`);
    
    await setLanguage(langCode);
    
    // Update all UI
    updateAllUI();
    
    // Save language in presentation settings
    updatePresentationSettings({ language: langCode });
    
    // Save to presentation
    saveGameData();
    
    console.log(`✅ Language changed to: ${langCode}`);
};

/**
 * Update all UI elements with translations
 */
function updateAllUI() {
    // Update DOM elements with data-i18n attributes
    updateDOM();
    
    // Update tab labels
    const tabSlides = document.getElementById('tabSlides');
    const tabActions = document.getElementById('tabActions');
    const tabSettings = document.getElementById('tabSettings');
    
    if (tabSlides) tabSlides.textContent = t('tabs.slides');
    if (tabActions) tabActions.textContent = t('tabs.actions');
    if (tabSettings) tabSettings.textContent = t('tabs.settings');
    
    // Update loading text
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.textContent = t('slides.loading');
    
    // Update dialogs
    updateDialogOptions();
    
    // Re-render actions tab
    renderActionsTab();
    
    // Refresh slide list to update labels
    triggerRefreshSlideList();
}

/**
 * Update dialog select options with translations
 */
function updateDialogOptions() {
    // Slide type select
    const slideTypeSelect = document.getElementById('slideTypeSelect');
    if (slideTypeSelect) {
        slideTypeSelect.innerHTML = `
            <option value="opening">${t('slideTypes.opening')}</option>
            <option value="transition">${t('slideTypes.transition')}</option>
            <option value="question">${t('slideTypes.question')}</option>
            <option value="statistics">${t('slideTypes.statistics')}</option>
            <option value="leaderboard">${t('slideTypes.leaderboard')}</option>
            <option value="summary">${t('slideTypes.summary')}</option>
        `;
    }
    
    // Correct answer select
    const correctAnswerSelect = document.getElementById('correctAnswerSelect');
    if (correctAnswerSelect) {
        correctAnswerSelect.innerHTML = `
            <option value="1">${t('dialogs.answer')} 1 (${t('dialogs.red')})</option>
            <option value="2">${t('dialogs.answer')} 2 (${t('dialogs.blue')})</option>
            <option value="3">${t('dialogs.answer')} 3 (${t('dialogs.yellow')})</option>
            <option value="4">${t('dialogs.answer')} 4 (${t('dialogs.green')})</option>
        `;
    }
}

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

// Setup tab click handlers
function setupTabHandlers() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            if (tabName) {
                window.switchTab(tabName);
            }
        });
    });
}

window.closeDialogs = function() {
    document.querySelectorAll('.overlay').forEach(el => el.style.display = 'none');
};

// Load settings into the settings tab
function loadSettingsToTab() {
    const settings = getPresentationSettings();
    
    document.getElementById('settingTimeTab').value = settings.questionWaitTime;
    document.getElementById('settingDelayTab').value = settings.clockActivationDelay;
    document.getElementById('settingAfterStatsTab').checked = settings.afterQuestionStatistics !== false;
    document.getElementById('settingAfterLeaderboardTab').checked = settings.afterQuestionLeaderboard === true;
    
    // Update language selector
    const langSelect = document.getElementById('settingLanguage');
    if (langSelect && settings.language) {
        langSelect.value = settings.language;
    }
}

// Save settings when any setting changes
function autoSaveSettings() {
    const timeValue = parseInt(document.getElementById('settingTimeTab').value);
    const time = isNaN(timeValue) ? 30 : timeValue;
    const delayValue = parseInt(document.getElementById('settingDelayTab').value);
    const delay = isNaN(delayValue) ? 5 : delayValue;
    const stats = document.getElementById('settingAfterStatsTab').checked;
    const board = document.getElementById('settingAfterLeaderboardTab').checked;
    const lang = getLanguage();
    
    setPresentationSettings({
        questionWaitTime: time,
        clockActivationDelay: delay,
        afterQuestionStatistics: stats,
        afterQuestionLeaderboard: board,
        language: lang
    });
    
    // Save to presentation
    saveGameData();
    
    console.log('Settings saved:', getPresentationSettings());
}

// Setup settings auto-save listeners
function setupSettingsListeners() {
    document.getElementById('settingTimeTab').addEventListener('change', autoSaveSettings);
    document.getElementById('settingDelayTab').addEventListener('change', autoSaveSettings);
    document.getElementById('settingAfterStatsTab').addEventListener('change', autoSaveSettings);
    document.getElementById('settingAfterLeaderboardTab').addEventListener('change', autoSaveSettings);
}


// Note: State variables are now managed in state.js
// No need to initialize window.* variables here

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
                setCurrentSlideId(selectedSlide.id);
                
                // Find the slide index
                const slideIndex = slides.items.findIndex(s => s.id === selectedSlide.id);
                setCurrentSlideNumber(slideIndex + 1);
                
                console.log('📍 Current slide on load:', getCurrentSlideNumber(), getCurrentSlideId());
            } else if (slides.items.length > 0) {
                // No slide selected, go to first slide
                const firstSlide = slides.items[0];
                setCurrentSlideId(firstSlide.id);
                setCurrentSlideNumber(1);
                
                // Navigate to first slide
                await navigateToSlideByIndex(1);
                console.log('📍 Navigated to first slide:', getCurrentSlideId());
            }
        });
    } catch (error) {
        console.error('Error selecting current slide on load:', error);
        // Fallback: try to go to first slide
        setCurrentSlideNumber(1);
        try {
            await navigateToSlideByIndex(1);
        } catch (e) {
            console.error('Error navigating to first slide:', e);
        }
    }
}

// Initialize the add-in when Office is ready
Office.onReady(async (info) => {
    console.log('🚀 Office.onReady called!', info);
    if (info.host === Office.HostType.PowerPoint) {
        console.log('✅ PowerPoint detected - initializing add-in...');
        
        // Initialize i18n first with default language
        await initI18n('he');
        
        // Check for URL parameters (e.g. from deep link or manual launch)
        const urlParams = new URLSearchParams(window.location.search);
        const urlHashId = urlParams.get('hash_id');
        
        if (urlHashId) {
            console.log('🔗 Found hash_id in URL:', urlHashId);
            setHashId(urlHashId);
        }
        
        // Get/create the presentation's unique Kahoot ID from PowerPoint tags
        // This MUST happen before WebSocket connects so we can register to the correct room
        if (!getHashId()) {
            try {
                const hashId = await getGameHashId();
                if (hashId) {
                    console.log('🔑 Got Kahoot ID from presentation:', hashId);
                    // Note: getGameHashId already calls setHashId internally
                } else {
                    console.warn('⚠️ Could not get Kahoot ID from presentation');
                }
            } catch (error) {
                console.error('❌ Error getting Kahoot ID:', error);
            }
        }
        
        // Initialize Tabs and Lists
        setupTabHandlers();
        initLanguageSelector();
        renderActionsTab();
        setupSettingsListeners();
        loadSettingsToTab();
        updateAllUI();
        
        // Attach persistent button listeners
        document.getElementById('btnStartGame').onclick = () => startPresentationMode();
        
        const slideContentArea = document.getElementById('slideContentArea');
        const mainContent = document.getElementById('mainContent');
        const tabs = document.querySelector('.tabs');
    
        // Load data then initialize slides list
        loadGameData().then(async () => {
            // Check if there's a saved language preference
            const settings = getPresentationSettings();
            if (settings?.language) {
                const savedLang = settings.language;
                if (savedLang !== getLanguage()) {
                    await setLanguage(savedLang);
                    updateAllUI();
                }
            }
            
            // Get current slide and select it
            await selectCurrentSlideOnLoad();
            
            // Initialize the slides list module (handles refresh, navigation, inline editing)
            await initializeSlidesList();
            
            // Ensure we are registered to the room if hashId is available
            const socket = getSocket();
            const hashId = getHashId();
            if (socket && socket.connected && hashId) {
                console.log('🔗 Late registration for hash:', hashId);
                await registerRoom(socket.id, hashId);
            }
        });

        // Set up slide change event listener
        setupSlideChangeListener((eventArgs) => onSlideChanged(eventArgs));
        
        // Initialize WebSocket
        const socketInstance = initializeWebSocket({
            onConnect: async (socket) => {
                console.log('✅ Connected to WebSocket');
                
                // Register room if we have a hash ID
                const hashId = getHashId();
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
                
                // Store the hash ID and game PIN
                if (data.hashId) {
                    setHashId(data.hashId);
                }
                if (gamePin) {
                    setGamePIN(gamePin);
                }
                
                // === UPDATE GAME ID & QR CODE IN SLIDES ===
                try {
                    if (gamePin) {
                        await updateGameIdInSlides(gamePin);
                    }
                    
                    const currentHashId = getHashId();
                    if (currentHashId && gamePin) {
                        await updateQrCodeInSlides(currentHashId, gamePin);
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
                    const settings = getPresentationSettings();
                    const initialTime = settings?.questionWaitTime || 30;
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
                showStatus(`🎮 ${t('status.gameActive')} ${formattedPin}`, 'success');
            },
            
            // Handle slide navigation commands
            onSlideNavigation: async (data) => {
                console.log('🎯 Handling slide navigation:', data.action);
                
                try {
                    switch (data.action) {
                        case 'go_to_first_slide':
                            console.log('📍 Resetting to first slide...');
                            await goToFirstSlideInPowerPoint();
                            showStatus(t('status.backToFirstSlide'), 'info');
                            break;
                        case 'go_to_next_slide':
                        case 'next_slide':
                            console.log('📄 Executing next slide navigation...');
                            await goToNextSlideInPowerPoint();
                            showStatus(t('status.nextSlide'), 'info');
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
                        showStatus(t('status.simulatingClick'), 'info');
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
                
                setCurrentUsers(participantIds.length);
                
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
                triggerRefreshSlideList();
            },
            
            // Handle player answers
            onPlayerAnswer: (data, answersMap) => {
                console.log('📝 Player answer handled, total answers:', answersMap.size);
            }
        });
        setSocket(socketInstance);

    } else {
        console.log('❌ Not in PowerPoint');
    }
});


// --- Tab 2: Actions ---

function renderActionsTab() {
    const grid = document.getElementById('actionsGrid');
    if (!grid) return;
    
    // Global Actions with translations
    const actions = [
        // Slide Elements
        { label: t('actions.gameId'), icon: 'Game', onclick: insertGameIdButton },
        { label: t('actions.participantsCount'), icon: 'PeopleAdd', onclick: insertParticipantsNumButton },
        { label: t('actions.participantsList'), icon: 'ContactList', onclick: insertParticipantsListButton },
        { label: t('actions.qrCode'), icon: 'QRCode', onclick: insertQrCodeButton },

        // Game Control
        { label: t('actions.questionTime'), icon: 'Clock', onclick: addQuestionTime },
        { label: t('actions.respondersCount'), icon: 'People', onclick: addRespondentsCount },
        
        // Analysis Elements
        { label: t('actions.answersDistribution'), icon: 'BarChart4', onclick: addAnswersDistribution },
        { label: t('actions.leaderboard'), icon: 'Trophy', onclick: addLeaderboardElements }
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

// Expose t function globally for other modules
window.t = t;
window.getLanguage = getLanguage;
window.isRTL = isRTL;
