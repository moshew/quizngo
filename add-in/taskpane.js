/* global Office, PowerPoint */

console.log('📄 taskpane.js loaded (Tabbed Version)!');

// Import modules
import { API_BASE, registerRoom } from './modules/api.js';
import { initializeWebSocket } from './modules/websocket.js';
import { 
    handleSlideTypeChange, 
    saveSlideType, 
    loadHiddenSlideState,
    setupHideSlideListener 
} from './modules/slide-manager.js';
import { 
    setupSlideChangeListener, 
    onSlideChanged 
} from './modules/event-handlers.js';
import { 
    startPresentationMode
} from './modules/game-actions.js';
import {
    goToFirstSlideInPowerPoint,
    goToNextSlideInPowerPoint,
    simulateClickInPowerPoint,
    resetAnimationState
} from './modules/navigation.js';
import {
    resetParticipantAcceptanceState
} from './modules/event-handlers.js';
import {
    resetParticipantsList
} from './modules/websocket.js';
import {
    updateAllQuestionTimeElements,
    updateAllRespondentsCountElements
} from './modules/elements/question_timer.js';
import {
    resetParticipantsNumInSlides,
    updateParticipantsListInSlides,
    updateParticipantsNumInSlides
} from './modules/elements/participants_management.js';
import {
    resetAnswersDistribution,
    resetLeaderboard
} from './modules/elements/answers_analysis.js';
import {
    updateGameIdInSlides,
    updateQrCodeInSlides
} from './modules/elements/game_management.js';
import {
    addQuestionTime,
    addRespondentsCount
} from './modules/elements/question_timer.js';
import {
    showStatus,
    showError
} from './modules/ui-manager.js';
import { 
    getSlideType, 
    loadPresentationData,
    triggerAutoSave 
} from './modules/presentation-state.js';
import {
    insertGameIdButton,
    insertQrCodeButton
} from './modules/elements/game_management.js';
import {
    insertParticipantsListButton,
    insertParticipantsNumButton
} from './modules/elements/participants_management.js';
import { 
    addAnswersDistribution, 
    addLeaderboardElements 
} from './modules/elements/answers_analysis.js';

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
        
        // Create shared HTML cache
        const htmlCache = new Map();

        // Initialize Tabs and Lists
        renderActionsTab();
        setupSettingsListeners();
        loadSettingsToTab();
        
        // Attach persistent button listeners
        document.getElementById('btnStartGame').onclick = () => startPresentationMode(htmlCache);
        
        const slideContentArea = document.getElementById('slideContentArea');
    const mainContent = document.getElementById('mainContent');
    const tabs = document.querySelector('.tabs');
    
    // Toggle visibility: If slideContentArea has content and is active, hide tabs and main content
    // Check if we are in "Game Mode" (Start Presentation Mode)
    // Actually, game-actions.js startPresentationMode calls updateUIForSlideType('start')
    // ui-manager.js updateUIForSlideType sets slideContentArea.innerHTML
    
    // We need to listen or expose a way to switch modes.
    // Ideally, updateUIForSlideType should handle the switching if it detects 'start' type or if we explicitly ask for it.
    
    // For now, let's modify startPresentationMode in game-actions.js to handle the UI switching
    // OR expose a function here.
    
    // Load data then refresh list
    loadPresentationData().then(async () => {
            refreshSlideList(); // Initial load after data is ready
            
            // Ensure we are registered to the room if hashId is available
            // This covers the case where hashId wasn't in URL but was loaded from presentation tags
            if (window.socket && window.socket.connected && window.currentHashId) {
                console.log('🔗 Late registration for hash:', window.currentHashId);
                await registerRoom(window.socket.id, window.currentHashId);
            }
        });

        // Set up slide change event listener
        // We pass the htmlCache for potential future use or if we re-enable slide content swapping
        setupSlideChangeListener((eventArgs) => onSlideChanged(eventArgs, htmlCache));
        
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
                
                // Status bar removed
            },
            onDisconnect: () => {
                console.log('❌ Disconnected');
                // Status bar removed
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
                    // Update kahoot-game-id tags in PowerPoint slides
                    if (gamePin) {
                        await updateGameIdInSlides(gamePin);
                    }
                    
                    // Update QR Code in slides with game PIN (for players)
                    if (window.currentHashId && gamePin) {
                        await updateQrCodeInSlides(window.currentHashId, gamePin);
                    } else {
                        console.warn('⚠️ No hash ID or game PIN available for QR code update');
                    }
                } catch (updateError) {
                    console.error('❌ Error updating Game ID/QR Code:', updateError);
                }
                
                // === RESET ALL GAME STATE ===
                
                // 1. Reset participant acceptance state
                resetParticipantAcceptanceState();
                
                // 2. Reset participants list (clears all participant data)
                resetParticipantsList();
                
                // 3. Reset animation state
                resetAnimationState();
                
                try {
                    // 4. Reset question time elements to initial value
                    const initialTime = window.presentationSettings?.questionWaitTime || 30;
                    await updateAllQuestionTimeElements(initialTime);
                    
                    // 5. Reset respondents count to 0
                    await updateAllRespondentsCountElements(0);
                    
                    // 6. Reset participants number in slides to 0
                    await resetParticipantsNumInSlides();
                    
                    // 7. Reset participants list display in slides
                    await updateParticipantsListInSlides();
                    
                    // 8. Reset answers distribution chart
                    await resetAnswersDistribution();
                    
                    // 9. Reset leaderboard
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
                        case 'next_slide': // Support both formats
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
                
                // The websocket module already handles the data storage
                
                // Update participant count globally
                window.currentUsers = participantIds.length;
                
                // Update participants number in all slides (kahoot-participants-num tags)
                try {
                    await updateParticipantsNumInSlides(participantIds.length);
                    console.log('✅ Updated participant count in slides to:', participantIds.length);
                } catch (error) {
                    console.error('❌ Error updating participant count in slides:', error);
                }
                
                // Update participants list in all slides (kahoot-participants-list tags)
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
                // The websocket module already handles the answer storage
            }
        });
        window.socket = socket;
        
        // Global refresh function for other modules
        window.refreshSlideList = refreshSlideList;

    } else {
        console.log('❌ Not in PowerPoint');
    }
});

// --- Tab 1: Slides List ---

async function refreshSlideList() {
    try {
        const slideListEl = document.getElementById('slideList');
        
        // Don't show loading spinner on every refresh to avoid flicker
        if (slideListEl.children.length === 0) {
             document.getElementById('slides-loading').style.display = 'block';
             slideListEl.style.display = 'none';
        }

        await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            slides.load("items/id, items/tags");
            await context.sync();
            
            // Status bar removed, no need to update slideCount
            // document.getElementById('slideCount').textContent = `${slides.items.length} שקפים`;

            // Build HTML string for better performance and less flicker
            let listHtml = '';

            // Sort slides by index (they come in order usually)
            slides.items.forEach((slide, index) => {
                const slideNumber = index + 1;
                const slideId = slide.id;
                
                // Get type from our local state (loaded from file or memory)
                // If not in memory, we might need to rely on what we have or default to 'transition'
                let type = getSlideType(slideId) || 'transition';
                let typeLabel = getTypeLabel(type);
                
                // Check if it's a question and has an answer
                let extraInfo = '';
                if (type === 'question') {
                    const slideData = window.slideTypeData[slideId];
                    const answer = slideData?.correctAnswer || '1';
                    extraInfo = ` [${answer}]`;
                }

                const isSelected = window.currentSlideId === slideId ? ' selected' : '';
                
                // Use data attributes for click handling instead of inline onclick
                listHtml += `
                    <li id="slide-item-${slideId}" class="slide-item${isSelected}" data-index="${slideNumber}" data-id="${slideId}">
                        <div class="slide-info">
                            <span class="slide-title">שקף ${slideNumber} - ${typeLabel}${extraInfo}</span>
                        </div>
                        <button class="more-btn" title="אפשרויות" data-id="${slideId}" data-type="${type}">
                            <i class="ms-Icon ms-Icon--MoreVertical"></i>
                        </button>
                    </li>
                `;
            });

            slideListEl.innerHTML = listHtml;

            // Re-attach event listeners
            slideListEl.querySelectorAll('.slide-item').forEach(li => {
                li.addEventListener('click', (e) => {
                    // Ignore if clicked on the more button
                    if (e.target.closest('.more-btn')) return;
                    // Ignore if clicked on inline edit controls
                    if (e.target.closest('.inline-edit-container')) return;
                    
                    // Visual update first
                    slideListEl.querySelectorAll('.slide-item').forEach(item => item.classList.remove('selected'));
                    li.classList.add('selected');

                    const index = parseInt(li.getAttribute('data-index'));
                    const slideId = li.getAttribute('data-id');
                    
                    // Update global state immediately
                    window.currentSlideId = slideId;
                    window.currentSlideNumber = index;

                    navigateToSlide(index);
                });
            });

            slideListEl.querySelectorAll('.more-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = btn.getAttribute('data-id');
                    const type = btn.getAttribute('data-type');
                    showContextMenu(e, id, type);
                });
            });

            document.getElementById('slides-loading').style.display = 'none';
            slideListEl.style.display = 'block';
        });
    } catch (error) {
        console.error('Error refreshing slide list:', error);
        showError('שגיאה בטעינת רשימת השקפים');
    }
}

function getTypeLabel(type) {
    const map = {
        'opening': 'פתיחה',
        'transition': 'מעבר',
        'question': 'שאלה',
        'statistics': 'סטטיסטיקת מענה',
        'leaderboard': 'מובילים',
        'summary': 'סיכום',
        'start': 'מסך פתיחה'
    };
    return map[type] || type;
}

async function navigateToSlide(index) {
    return new Promise((resolve, reject) => {
        Office.context.document.goToByIdAsync(
            index,
            Office.GoToType.Index,
            (asyncResult) => {
                if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                    console.error('Navigation failed:', asyncResult.error.message);
                    reject(asyncResult.error);
                } else {
                    resolve();
                }
            }
        );
    });
}

// Context Menu Logic
window.showContextMenu = function(event, slideId, currentType) {
    event.stopPropagation();
    window.contextMenuTargetSlideId = slideId;
    window.contextMenuTargetType = currentType;
    
    const menu = document.getElementById('slideContextMenu');
    menu.style.display = 'block';
    
    // Position menu near the button
    const rect = event.target.closest('button').getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    // Fix positioning: Align left edge to button left edge (or adjust as needed for RTL)
    menu.style.left = `${rect.left}px`; 
    menu.style.right = 'auto';
    
    // Close menu when clicking outside
    const closeMenu = () => {
        menu.style.display = 'none';
        document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
    
    // Show/Hide "Set Answer" based on type
    const setAnswerItem = document.getElementById('menuSetAnswer');
    setAnswerItem.style.display = (currentType === 'question') ? 'block' : 'none';
};

window.openSlideTypeDialog = function() {
    document.getElementById('slideContextMenu').style.display = 'none';
    const slideId = window.contextMenuTargetSlideId;
    const currentType = window.contextMenuTargetType;
    
    const li = document.getElementById(`slide-item-${slideId}`);
    if (!li) return;

    // Prevent clicking the li from navigating while editing
    li.onclick = null;

    li.innerHTML = `
        <div class="inline-edit-container" onclick="event.stopPropagation()">
            <select id="inlineSlideTypeSelect" class="inline-select">
                <option value="opening" ${currentType === 'opening' ? 'selected' : ''}>פתיחה</option>
                <option value="transition" ${currentType === 'transition' ? 'selected' : ''}>מעבר</option>
                <option value="question" ${currentType === 'question' ? 'selected' : ''}>שאלה</option>
                <option value="statistics" ${currentType === 'statistics' ? 'selected' : ''}>סטטיסטיקת מענה</option>
                <option value="leaderboard" ${currentType === 'leaderboard' ? 'selected' : ''}>מובילים</option>
                <option value="summary" ${currentType === 'summary' ? 'selected' : ''}>סיכום</option>
            </select>
            <div class="inline-actions">
                <button class="inline-btn confirm" onclick="confirmInlineSlideTypeChange(event, '${slideId}')" title="שמור">
                    <i class="ms-Icon ms-Icon--CheckMark"></i>
                </button>
                <button class="inline-btn cancel" onclick="cancelInlineEdit(event)" title="ביטול">
                    <i class="ms-Icon ms-Icon--Cancel"></i>
                </button>
            </div>
        </div>
    `;
};

window.cancelInlineEdit = function(event) {
    if (event) event.stopPropagation();
    refreshSlideList();
};

window.confirmInlineSlideTypeChange = function(event, slideId) {
    if (event) event.stopPropagation();
    const newType = document.getElementById('inlineSlideTypeSelect').value;
    
    if (slideId) {
        if (!window.slideTypeData[slideId]) window.slideTypeData[slideId] = {};
        
        // Handle legacy string format if exists
        if (typeof window.slideTypeData[slideId] === 'string') {
            window.slideTypeData[slideId] = { type: newType };
        } else {
            window.slideTypeData[slideId].type = newType;
        }
        
        // If changing to question, set default answer if missing
        if (newType === 'question' && !window.slideTypeData[slideId].correctAnswer) {
            window.slideTypeData[slideId].correctAnswer = '1';
        }
        
        if (window.triggerAutoSave) window.triggerAutoSave();
        refreshSlideList();
    }
};

window.openSetAnswerDialog = function() {
    document.getElementById('slideContextMenu').style.display = 'none';
    const dialog = document.getElementById('dialogSetAnswer');
    
    // Get current answer from state
    const slideId = window.contextMenuTargetSlideId;
    const slideData = window.slideTypeData[slideId];
    const currentAnswer = slideData?.correctAnswer || '1';
    
    document.getElementById('correctAnswerSelect').value = currentAnswer;
    
    dialog.style.display = 'flex';
};

window.confirmSlideTypeChange = function() {
    const newType = document.getElementById('slideTypeSelect').value;
    const slideId = window.contextMenuTargetSlideId;
    
    if (slideId) {
        if (!window.slideTypeData[slideId]) window.slideTypeData[slideId] = {};
        if (typeof window.slideTypeData[slideId] === 'string') {
            window.slideTypeData[slideId] = { type: newType };
        } else {
            window.slideTypeData[slideId].type = newType;
        }
        
        if (newType === 'question' && !window.slideTypeData[slideId].correctAnswer) {
            window.slideTypeData[slideId].correctAnswer = '1';
        }
        
        if (window.triggerAutoSave) window.triggerAutoSave();
        
        console.log(`Updated slide ${slideId} to ${newType}`);
        
        refreshSlideList();
    }
    window.closeDialogs();
};

window.confirmSetAnswer = function() {
    const answer = document.getElementById('correctAnswerSelect').value;
    const slideId = window.contextMenuTargetSlideId;
    
    if (slideId) {
        if (!window.slideTypeData[slideId]) window.slideTypeData[slideId] = { type: 'question' };
        if (typeof window.slideTypeData[slideId] === 'string') {
             window.slideTypeData[slideId] = { type: window.slideTypeData[slideId] };
        }
        
        window.slideTypeData[slideId].correctAnswer = answer;
        
        if (window.triggerAutoSave) window.triggerAutoSave();
        refreshSlideList();
    }
    window.closeDialogs();
};


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
        
        // Analysis Elements (Restored)
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
