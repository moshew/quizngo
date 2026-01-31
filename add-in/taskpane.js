/* global Office, PowerPoint */

console.log('📄 taskpane.js loaded (Tabbed Version with i18n)!');

// Import modules - Core
import { API_BASE } from './modules/core/api.js';
import { 
    getSlideType, 
    loadGameData,
    saveGameData,
    // Centralized state management - gamePin is the primary identifier
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
    onSlideChanged
} from './modules/game/events.js';
import { startPresentationMode } from './modules/game/actions.js';

// Import modules - Elements
import {
    addQuestionTime,
    addRespondentsCount
} from './modules/elements/question_timer.js';
import {
    insertParticipantsListButton,
    insertParticipantsNumButton
} from './modules/elements/participants_management.js';
import {
    addAnswersDistribution, 
    addLeaderboardElements
} from './modules/elements/answers_analysis.js';
import {
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
        
        // NEW ARCHITECTURE NOTE:
        // - gamePin is generated when game starts (in startPresentationMode)
        // - WebSocket connects only when game starts
        // - No pre-registration needed at startup
        console.log('ℹ️ WebSocket will connect when game starts');
        
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
        });

        // Set up slide change event listener
        setupSlideChangeListener((eventArgs) => onSlideChanged(eventArgs));
        
        // Note: WebSocket no longer initializes at startup
        // WebSocket connects only when game starts (via startPresentationMode)
        // This is done in actions.js -> startPresentationMode() -> connectWebSocketForGame()
        console.log('ℹ️ WebSocket will connect when game starts');

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
