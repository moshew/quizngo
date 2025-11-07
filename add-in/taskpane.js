/* global Office */

/*
 * Kahoot Quiz Manager - Add-in Client
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

console.log('📄 taskpane.js loaded!');

let isInitialized = false;
let autoUpdateInterval = null;
let slideCheckInterval = null;
let currentUsers = 0;
let currentTime = '';
let currentSlideNumber = 1;
let currentSlideId = null; // Store the unique UUID of current slide

// IMPORTANT: slideTypeData is defined ONLY on window object to ensure consistency
// All access must be through window.slideTypeData
window.slideTypeData = {}; // Store slide type for each slide UUID (NOT slide number!)

// Track the question slide we came from (for returning after statistics/leaderboard)
window.lastQuestionSlideIndex = null;

// Presentation settings (shared across all slides)
window.presentationSettings = {
    questionWaitTime: 30,              // seconds
    clockActivationDelay: 5,           // seconds
    afterQuestionStatistics: true,     // show statistics after question
    afterQuestionLeaderboard: false    // show leaderboard after question
};

// Auto-save mechanism variables
let autoSaveTimer = null;
let hasUnsavedChanges = false;
const AUTO_SAVE_DELAY = 0; // 0 seconds - immediate save for debugging (was 10000)

// Make variables globally accessible for commands and slide-type HTML files
window.currentUsers = currentUsers;
window.currentTime = currentTime;
window.currentSlideNumber = currentSlideNumber;
window.currentSlideId = currentSlideId;
// window.slideTypeData already defined above
window.markUnsavedChanges = null;  // Will be initialized after triggerAutoSave is defined
let socket = null;
let timerActive = false;
let localTimerInterval = null;
let localTimerRemaining = 0;

// Clear any cached data
localStorage.clear();
sessionStorage.clear();

// HTML files cache - prevents re-fetching same files multiple times
// NOTE: To see updated HTML files during development, reload the add-in (close and reopen task pane)
const htmlCache = new Map();

// Preload all HTML files on initialization for instant slide transitions
async function preloadAllHtmlFiles() {
    console.log('🚀 Pre-loading all HTML files...');
    
    const filesToPreload = [
        'slide-types/opening.html',
        'slide-types/question.html',
        'slide-types/statistics.html',
        'slide-types/leaderboard.html',
        'slide-types/summary.html',
        'slide-types/settings.html',
        'slide-types/shared-actions.html'
    ];
    
    const loadPromises = filesToPreload.map(async (filePath) => {
        try {
            console.log(`📥 Pre-loading: ${filePath}`);
            const response = await fetch(filePath);
            if (response.ok) {
                const html = await response.text();
                htmlCache.set(filePath, html);
                console.log(`✅ Cached: ${filePath} (${html.length} bytes)`);
            } else {
                console.warn(`⚠️ Failed to preload: ${filePath} (${response.status})`);
            }
        } catch (error) {
            console.warn(`⚠️ Error preloading ${filePath}:`, error.message);
        }
    });
    
    // Load all files in parallel
    await Promise.all(loadPromises);
    console.log('✅ All HTML files pre-loaded! Slide transitions will now be instant.');
}

// Initialize the add-in when Office is ready
Office.onReady((info) => {
    console.log('🚀 Office.onReady called!', info);
    if (info.host === Office.HostType.PowerPoint) {
        console.log('✅ PowerPoint detected - initializing add-in...');
        
        // Note: Button event handlers (initButton, startTimerButton, etc.) are now
        // handled via inline onclick in the HTML files (both main and modular).
        // This prevents "Cannot set properties of null" errors when buttons
        // are loaded dynamically from slide-types/*.html files.
        
        // Set up slide type selection event handler (this element is in main HTML)
        const slideTypeElement = document.getElementById('slideType');
        if (slideTypeElement) {
            slideTypeElement.onchange = handleSlideTypeChange;
            console.log('✅ slideType dropdown event handler attached');
        } else {
            console.warn('⚠️ slideType dropdown not found');
        }
        
        // Pre-load all HTML files for instant transitions
        preloadAllHtmlFiles().catch(err => {
            console.warn('⚠️ Some HTML files failed to preload:', err);
            // Continue anyway - files will load on-demand if needed
        });
        
        // Set up slide change event listener
        setupSlideChangeListener();
        
        // Initialize WebSocket connection
        initializeWebSocket();
        
        // Note: Slide monitoring removed - relying only on event listener
        
        // Get initial slide number and load slide type - with proper initialization
        setTimeout(async () => {
            console.log('🔄 Starting initial slide detection...');
            try {
                // Step 1: Get the actual current slide position
                await getCurrentSlideNumber();
                console.log('📍 Current slide detected:', currentSlideNumber);
                
                
                // Step 3: Load saved presentation data (slide types only)
                try {
                    await loadPresentationData();
                } catch (error) {
                    console.log('No existing presentation data found or error loading:', error);
                }
                
                // Step 4: Load slide type for current slide (after data is loaded)
                loadSlideType();
                console.log('🎯 Loaded slide type for current slide:', currentSlideNumber);
                
                console.log('✅ Initial setup completed - current slide:', currentSlideNumber);
            } catch (error) {
                console.error('Error in initial setup:', error);
            }
        }, 1000); // Wait 1 second for PowerPoint to be fully ready
        
        console.log('🎯 Kahoot Quiz Manager Add-in initialized - VERSION 4.5.2');
        console.log('🔗 Event handlers attached for main HTML elements only');
        console.log('📡 Starting slide monitoring and event listeners...');
        console.log('⚡ Performance optimizations: Preloaded HTML cache, optimized sync calls, debounced slide changes');
        console.log('🎨 UX improvements: 3-layer layout, empty transition slides, sticky bottom actions');
        
         // Version loaded - logged to console only
         console.log('🔄 Add-in loaded - VERSION 4.5.2');
    } else {
        console.log('❌ Not in PowerPoint - host:', info.host);
    }
});

// API Base URL
const API_BASE = 'http://localhost:5000/';
const WEBSOCKET_URL = 'http://localhost:5000';

// Utility function to make API calls
async function makeApiCall(endpoint, method = 'GET') {
    try {
        const response = await fetch(API_BASE + endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.text();
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        showError(`שגיאה בקריאה ל-API: ${error.message}`);
        throw error;
    }
}

// Utility function to make JSON API calls
async function makeJsonApiCall(endpoint, method = 'GET') {
    try {
        const response = await fetch(API_BASE + endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('JSON API call failed:', error);
        showError(`שגיאה בקריאה ל-API: ${error.message}`);
        throw error;
    }
}

// Initialize the quiz
async function initializeQuiz() {
    try {
        showStatus('מאתחל משחק...', 'connecting');
        
        const response = await makeJsonApiCall('?init');
        
        // Display temporary game ID (will be replaced when admin registers)
        const tempGameId = response.game_id || 'מחכה...';
        document.getElementById('gameId').textContent = tempGameId;
        
        console.log('המשחק אותחל בהצלחה!');
        isInitialized = true;
        
        // Note: Game PIN will be updated when admin registers via WebSocket
        
    } catch (error) {
        showError('שגיאה באתחול המשחק: ' + error.message);
    }
}

// Show status message (only for warnings and errors)
function showStatus(message, type = 'info') {
    console.log(`Status (${type}): ${message}`);
    
    // Only show in UI for warnings and errors
    if (type === 'warning' || type === 'error') {
        const detectedInfo = document.getElementById('detectedInfo');
        if (detectedInfo) {
            const color = type === 'warning' ? '#856404' : '#721c24';
            const background = type === 'warning' ? '#fff3cd' : '#f8d7da';
            
            detectedInfo.innerHTML = `⚠️ ${message}`;
            detectedInfo.style.display = 'block';
            detectedInfo.style.background = background;
            detectedInfo.style.color = color;
            
            // Hide after 5 seconds
            setTimeout(() => {
                if (detectedInfo.innerHTML.includes('⚠️')) {
                    detectedInfo.style.display = 'none';
                }
            }, 5000);
        }
    }
}

// Show error message
function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
    
    console.error('Error:', message);
}

// Basic functions to prevent errors
async function startTimer() { console.log('startTimer called'); }
async function stopTimer() { console.log('stopTimer called'); }

// Reset animation state for testing
function resetAnimationState() {
    if (window.slideAnimationState) {
        console.log('🔄 Resetting animation state for all slides');
        window.slideAnimationState = {};
        showStatus('מצב אנימציות אופס', 'info');
    }
}

// Navigate to next slide in PowerPoint using Office.js API
// Navigate to first slide in PowerPoint
async function goToFirstSlideInPowerPoint() {
    try {
        console.log('📍 Resetting to first slide...');
        showStatus('חזרה לשקף הראשון...', 'info');
        
        // Use navigateToSlideByIndex to ensure consistent behavior in both edit and presentation modes
        const success = await navigateToSlideByIndex(0); // Index 0 = first slide
        
        if (success) {
            console.log('✅ Successfully navigated to first slide');
            showStatus('✅ חזרה לשקף הראשון', 'success');
        } else {
            console.error('❌ Failed to navigate to first slide');
            showStatus('❌ שגיאה בחזרה לשקף הראשון', 'error');
        }
        
    } catch (error) {
        console.error('❌ Error in goToFirstSlideInPowerPoint:', error);
        showStatus('❌ שגיאה בחזרה לשקף הראשון: ' + error.message, 'error');
    }
}

// Helper function: Get all slide IDs in order
async function getAllSlideIds() {
    try {
        return await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            slides.load('items');
            await context.sync();
            
            const slideIds = [];
            for (let i = 0; i < slides.items.length; i++) {
                slides.items[i].load('id');
            }
            await context.sync();
            
            for (let i = 0; i < slides.items.length; i++) {
                slideIds.push(slides.items[i].id);
            }
            
            return slideIds;
        });
    } catch (error) {
        console.error('Error getting slide IDs:', error);
        return [];
    }
}

// Calculate next slide locally based on game logic
function calculateNextSlideLocally(currentIndex, currentSlideType, slideIds, slideTypeData, settings, totalSlides) {
    console.log('🧮 Calculating next slide locally...');
    console.log(`   Current: index=${currentIndex}, type=${currentSlideType}`);
    console.log(`   Total slides: ${totalSlides}`);
    console.log(`   Settings:`, settings);
    console.log(`   💭 lastQuestionSlideIndex at start: ${window.lastQuestionSlideIndex}`);
    
    // Validate inputs
    if (currentIndex === undefined || currentIndex === null || totalSlides === 0) {
        return { nextIndex: currentIndex, reason: 'Invalid slide data' };
    }
    
    // Build slide types by index
    const slideTypesByIndex = {};
    for (let i = 0; i < slideIds.length; i++) {
        const slideId = slideIds[i];
        if (slideTypeData[slideId]) {
            const slideTypeValue = slideTypeData[slideId];
            // Handle both string and object formats
            if (typeof slideTypeValue === 'object' && slideTypeValue.type) {
                slideTypesByIndex[i] = slideTypeValue.type;
            } else {
                slideTypesByIndex[i] = slideTypeValue;
            }
            console.log(`      [${i}] ${slideId} → ${slideTypesByIndex[i]}`);
        } else {
            console.log(`      [${i}] ${slideId} → (no type defined)`);
        }
    }
    
    console.log('   ✅ Slide types by index:', slideTypesByIndex);
    
    // LOGIC IMPLEMENTATION
    
    // Special handling for statistics and leaderboard slides
    if (currentSlideType === 'statistics') {
        const showLeaderboard = settings.afterQuestionLeaderboard || false;
        console.log(`   📊 On statistics slide, showLeaderboard=${showLeaderboard}`);
        console.log(`   📍 Returning point: ${window.lastQuestionSlideIndex}`);
        
        if (showLeaderboard) {
            // Look for ANY leaderboard slide in the presentation
            for (let i = 0; i < totalSlides; i++) {
                if (slideTypesByIndex[i] === 'leaderboard') {
                    console.log(`   🏆 Found leaderboard at index ${i}`);
                    return { nextIndex: i, reason: 'Going to leaderboard after statistics' };
                }
            }
            console.log(`   ⚠️ No leaderboard found, returning to original position`);
        }
        
        // No leaderboard or not showing - return to position after the original question
        if (window.lastQuestionSlideIndex !== null) {
            let nextIndex = window.lastQuestionSlideIndex + 1;
            
            // Skip any statistics/leaderboard slides
            while (nextIndex < totalSlides) {
                const nextType = slideTypesByIndex[nextIndex];
                if (nextType === 'statistics' || nextType === 'leaderboard') {
                    nextIndex++;
                } else {
                    break;
                }
            }
            
            if (nextIndex >= totalSlides) {
                nextIndex = totalSlides - 1;
            }
            
            console.log(`   🔙 Returning to index ${nextIndex} (after question at ${window.lastQuestionSlideIndex})`);
            window.lastQuestionSlideIndex = null; // Reset
            return { nextIndex: nextIndex, reason: 'Returning to position after original question' };
        } else {
            // Fallback: just go to next slide
            let nextIndex = currentIndex + 1;
            while (nextIndex < totalSlides) {
                const nextType = slideTypesByIndex[nextIndex];
                if (nextType === 'statistics' || nextType === 'leaderboard') {
                    nextIndex++;
                } else {
                    break;
                }
            }
            if (nextIndex >= totalSlides) {
                nextIndex = totalSlides - 1;
            }
            return { nextIndex: nextIndex, reason: 'No return point saved, going to next slide' };
        }
    }
    
    if (currentSlideType === 'leaderboard') {
        // After leaderboard, return to position after the original question
        console.log(`   🏆 On leaderboard slide`);
        console.log(`   📍 Returning point: ${window.lastQuestionSlideIndex}`);
        
        if (window.lastQuestionSlideIndex !== null) {
            let nextIndex = window.lastQuestionSlideIndex + 1;
            
            // Skip any statistics/leaderboard slides
            while (nextIndex < totalSlides) {
                const nextType = slideTypesByIndex[nextIndex];
                if (nextType === 'statistics' || nextType === 'leaderboard') {
                    nextIndex++;
                } else {
                    break;
                }
            }
            
            if (nextIndex >= totalSlides) {
                nextIndex = totalSlides - 1;
            }
            
            console.log(`   🔙 Returning to index ${nextIndex} (after question at ${window.lastQuestionSlideIndex})`);
            window.lastQuestionSlideIndex = null; // Reset
            return { nextIndex: nextIndex, reason: 'Returning to position after original question' };
        } else {
            // Fallback: just go to next slide
            let nextIndex = currentIndex + 1;
            while (nextIndex < totalSlides) {
                const nextType = slideTypesByIndex[nextIndex];
                if (nextType === 'statistics' || nextType === 'leaderboard') {
                    nextIndex++;
                } else {
                    break;
                }
            }
            if (nextIndex >= totalSlides) {
                nextIndex = totalSlides - 1;
            }
            return { nextIndex: nextIndex, reason: 'No return point saved, going to next slide' };
        }
    }
    
    if (currentSlideType !== 'question') {
        // For non-question slides: go to next slide, but skip statistics and leaderboard
        let nextIndex = currentIndex + 1;
        console.log(`   🔍 Non-question slide: starting at nextIndex=${nextIndex}`);
        
        // Skip statistics and leaderboard slides
        while (nextIndex < totalSlides) {
            const nextType = slideTypesByIndex[nextIndex];
            console.log(`      Checking index ${nextIndex}: type=${nextType}`);
            if (nextType === 'statistics' || nextType === 'leaderboard') {
                console.log(`      ⏭️ Skipping ${nextType} slide at index ${nextIndex}`);
                nextIndex++;
            } else {
                console.log(`      ✅ Found non-statistics/leaderboard slide at index ${nextIndex}`);
                break;
            }
        }
        
        if (nextIndex >= totalSlides) {
            nextIndex = totalSlides - 1;
            return { nextIndex: nextIndex, reason: 'Reached end of presentation' };
        } else {
            return { nextIndex: nextIndex, reason: 'Moving to next non-statistics/leaderboard slide' };
        }
    } else {
        // For question slides: save current position and jump to statistics/leaderboard
        const showStatistics = settings.afterQuestionStatistics || false;
        const showLeaderboard = settings.afterQuestionLeaderboard || false;
        
        console.log(`   📊 Question slide: statistics=${showStatistics}, leaderboard=${showLeaderboard}`);
        
        // Check if there are any slides after this question (excluding statistics/leaderboard)
        let hasNextSlide = false;
        for (let i = currentIndex + 1; i < totalSlides; i++) {
            const slideType = slideTypesByIndex[i];
            if (slideType !== 'statistics' && slideType !== 'leaderboard') {
                hasNextSlide = true;
                break;
            }
        }
        
        // If no slides after this question, don't jump to statistics/leaderboard (prevents infinite loop)
        if (!hasNextSlide && (showStatistics || showLeaderboard)) {
            console.log(`   ⚠️ No slides after this question - skipping statistics/leaderboard to prevent loop`);
            return { nextIndex: currentIndex, reason: 'Last question - no more slides' };
        }
        
        // Save current question position for returning later
        window.lastQuestionSlideIndex = currentIndex;
        console.log(`   💾 Saved question position: ${currentIndex}`);
        
        // Find FIRST statistics slide in the entire presentation (not just after current)
        let statisticsIndex = null;
        if (showStatistics) {
            for (let i = 0; i < totalSlides; i++) {
                if (slideTypesByIndex[i] === 'statistics') {
                    statisticsIndex = i;
                    console.log(`   📊 Found statistics at index ${i}`);
                    break;
                }
            }
        }
        
        // Find FIRST leaderboard slide in the entire presentation
        let leaderboardIndex = null;
        if (showLeaderboard) {
            for (let i = 0; i < totalSlides; i++) {
                if (slideTypesByIndex[i] === 'leaderboard') {
                    leaderboardIndex = i;
                    console.log(`   🏆 Found leaderboard at index ${i}`);
                    break;
                }
            }
        }
        
        // Determine navigation flow
        if (showStatistics && statisticsIndex !== null) {
            // Go to statistics first
            return { nextIndex: statisticsIndex, reason: 'Going to statistics after question' };
        } else if (showLeaderboard && leaderboardIndex !== null) {
            // No statistics, go directly to leaderboard
            return { nextIndex: leaderboardIndex, reason: 'Going to leaderboard after question' };
        } else {
            // No statistics or leaderboard, go to next regular slide
            window.lastQuestionSlideIndex = null; // Reset since we're not jumping
            let nextIndex = currentIndex + 1;
            // Skip any statistics/leaderboard slides
            while (nextIndex < totalSlides) {
                const nextType = slideTypesByIndex[nextIndex];
                if (nextType === 'statistics' || nextType === 'leaderboard') {
                    nextIndex++;
                } else {
                    break;
                }
            }
            
            if (nextIndex >= totalSlides) {
                nextIndex = totalSlides - 1;
            }
            
            return { nextIndex: nextIndex, reason: 'Going to next regular slide after question' };
        }
    }
}

// Helper function: Navigate to slide by index (0-based index)
// Works in both edit mode and presentation mode
async function navigateToSlideByIndex(slideIndex, newSlideId = null) {
    console.log('═'.repeat(80));
    console.log(`🎯 navigateToSlideByIndex CALLED`);
    console.log(`   Input slideIndex (0-based): ${slideIndex}`);
    console.log(`   Input newSlideId: ${newSlideId}`);
    
    let targetSlideId = newSlideId;
    
    // Get the target slide ID if not provided
    if (!targetSlideId) {
        try {
            await PowerPoint.run(async (context) => {
                const slides = context.presentation.slides;
                const targetSlide = slides.getItemAt(slideIndex);
                targetSlide.load("id");
                await context.sync();
                targetSlideId = targetSlide.id;
            });
        } catch (error) {
            console.error('❌ Error getting slide ID:', error);
        }
    }
    
    console.log(`   Target slide ID: ${targetSlideId}`);
    
    // Navigate using goToByIdAsync (works in both edit and presentation modes)
    const navigationSucceeded = await new Promise((resolve) => {
        // goToByIdAsync uses 1-based index!
        const slideNumber = slideIndex + 1; // Convert from 0-based to 1-based
        
        Office.context.document.goToByIdAsync(
            slideNumber,
            Office.GoToType.Index,
            (asyncResult) => {
                if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                    console.error(`❌ Navigation failed: ${asyncResult.error.message}`);
                    resolve(false);
                } else {
                    console.log(`✅ Successfully navigated to slide ${slideNumber}`);
                    resolve(true);
                }
            }
        );
    });
    
    // Update internal tracking
    currentSlideNumber = slideIndex + 1;
    window.currentSlideNumber = currentSlideNumber;
    currentSlideId = targetSlideId;
    window.currentSlideId = currentSlideId;
    
    console.log(`   📝 Updated tracking: slideNumber=${currentSlideNumber}, slideId=${currentSlideId}`);
    
    // Update UI
    const slideElement = document.getElementById('currentSlide');
    if (slideElement) {
        slideElement.textContent = currentSlideNumber;
    }
    const slideDisplayElement = document.getElementById('currentSlideDisplay');
    if (slideDisplayElement) {
        slideDisplayElement.textContent = currentSlideNumber;
    }
    
    // Load slide type for new slide
    loadSlideType();
    
    console.log('═'.repeat(80));
    
    return navigationSucceeded;
}

async function goToNextSlideInPowerPoint() {
    try {
        console.log('🎯 Starting smart navigation to next slide...');
        
        // Get current slide context using PowerPoint.run
        const slideContext = await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            slides.load('items');
            await context.sync();
            
            // Try to get selected slides (works in edit mode only)
            let currentSlide = null;
            let currentIndex = -1;
            
            try {
                const selectedSlides = context.presentation.getSelectedSlides();
                selectedSlides.load('items');
                await context.sync();
                
                if (selectedSlides.items && selectedSlides.items.length > 0) {
                    currentSlide = selectedSlides.items[0];
                    currentSlide.load('id');
                    await context.sync();
                    console.log('✅ Got selected slide from PowerPoint (edit mode)');
                }
            } catch (selectionError) {
                console.log('⚠️ getSelectedSlides failed (probably in presentation mode)');
                // Will use internal tracking instead
            }
            
            // Load all slide IDs
            const slideIds = [];
            for (let i = 0; i < slides.items.length; i++) {
                slides.items[i].load('id');
            }
            await context.sync();
            
            for (let i = 0; i < slides.items.length; i++) {
                slideIds.push(slides.items[i].id);
            }
            
            // Find current slide index
            if (currentSlide) {
                // Found selected slide (edit mode)
                for (let i = 0; i < slideIds.length; i++) {
                    if (slideIds[i] === currentSlide.id) {
                        currentIndex = i;
                        break;
                    }
                }
            } else if (currentSlideId) {
                // Use internal tracking (presentation mode or fallback)
                for (let i = 0; i < slideIds.length; i++) {
                    if (slideIds[i] === currentSlideId) {
                        currentIndex = i;
                        break;
                    }
                }
                console.log('✅ Using internal tracking (presentation mode)');
                console.log(`   Tracked slide ID: ${currentSlideId}, Index: ${currentIndex}`);
            } else {
                // Last resort: use currentSlideNumber - 1
                currentIndex = (currentSlideNumber || 1) - 1;
                console.log('⚠️ Using currentSlideNumber as fallback:', currentSlideNumber);
            }
            
            if (currentIndex < 0) {
                currentIndex = 0;
            }
            
            const finalSlideId = currentSlide ? currentSlide.id : currentSlideId;
            
            return {
                currentIndex: currentIndex,
                currentSlideId: finalSlideId,
                slideIds: slideIds,
                totalSlides: slides.items.length
            };
        });
        
        console.log('📊 Slide context:', slideContext);
        
        // Get current slide type
        const currentSlideType = getSlideType(slideContext.currentSlideId);
        
        // Get slide type as string (handle both object and string formats)
        let currentSlideTypeStr = currentSlideType;
        if (currentSlideType && typeof currentSlideType === 'object') {
            currentSlideTypeStr = currentSlideType.type;
        }
        
        console.log(`📝 Current slide type: ${currentSlideTypeStr}`);
        console.log('⚙️ Settings:', window.presentationSettings);
        
        // Calculate next slide LOCALLY
        const result = calculateNextSlideLocally(
            slideContext.currentIndex,
            currentSlideTypeStr || 'unknown',
            slideContext.slideIds,
            window.slideTypeData || {},
            window.presentationSettings || {
                afterQuestionStatistics: true,
                afterQuestionLeaderboard: false
            },
            slideContext.totalSlides
        );
        
        console.log('✅ Calculated result:', result);
        
        if (result.nextIndex !== slideContext.currentIndex) {
            const targetSlideNumber = result.nextIndex + 1;  // Convert to 1-based for display
            console.log(`📄 Moving to slide ${targetSlideNumber} (index ${result.nextIndex}) - ${result.reason}`);
            
            // Get the slide ID for the target slide
            const targetSlideId = slideContext.slideIds[result.nextIndex];
            console.log(`🔑 Target slide ID: ${targetSlideId}`);
            
            // Navigate to the calculated slide with its ID (function expects 0-based index)
            const success = await navigateToSlideByIndex(result.nextIndex, targetSlideId);
            
            if (success) {
                showStatus(`✅ עבר לשקף ${targetSlideNumber}`, 'success');
            } else {
                showStatus(`⚠️ לא הצליח לעבור לשקף ${targetSlideNumber} - נסה שוב`, 'error');
            }
        } else {
            // Already at last slide or similar
            console.log('ℹ️', result.reason);
            showStatus(result.reason || 'כבר בשקף האחרון', 'info');
        }
        
    } catch (error) {
        console.error('❌ Error in smart navigation:', error);
        showStatus('שגיאה במעבר לשקף הבא: ' + error.message, 'error');
    }
}

// Simulate spacebar press in PowerPoint (advance animation or go to next slide)
async function simulateClickInPowerPoint() {
    try {
        console.log('⌨️ Starting spacebar simulation in PowerPoint...');
        
        // Method 1: Try to simulate spacebar press using keyboard events
        try {
            // Create and dispatch a spacebar keydown event
            const spaceKeyEvent = new KeyboardEvent('keydown', {
                key: ' ',
                code: 'Space',
                keyCode: 32,
                which: 32,
                bubbles: true,
                cancelable: true
            });
            
            // Try to dispatch the event to the document or active element
            const activeElement = document.activeElement || document.body;
            const dispatched = activeElement.dispatchEvent(spaceKeyEvent);
            
            if (dispatched) {
                console.log('✅ Spacebar event dispatched successfully');
                
                // Also try keyup event for completeness
                const spaceKeyUpEvent = new KeyboardEvent('keyup', {
                    key: ' ',
                    code: 'Space',
                    keyCode: 32,
                    which: 32,
                    bubbles: true,
                    cancelable: true
                });
                activeElement.dispatchEvent(spaceKeyUpEvent);
                
                showStatus('מקש רווח נלחץ (אנימציה/שקף הבא)', 'info');
                
                // Wait a bit and then try Office API as backup
                setTimeout(() => {
                    simulateSpacebarWithOfficeAPI();
                }, 100);
                
            } else {
                console.log('⚠️ Spacebar event dispatch failed, trying Office API');
                simulateSpacebarWithOfficeAPI();
            }
            
        } catch (keyboardError) {
            console.log('⚠️ Keyboard event simulation failed:', keyboardError);
            simulateSpacebarWithOfficeAPI();
        }
        
    } catch (error) {
        console.error('Error in spacebar simulation:', error);
        showStatus('שגיאה בסימולציית מקש רווח: ' + error.message, 'error');
        simulateSpacebarWithOfficeAPI();
    }
}

// Try to simulate spacebar using Office.js API with animation logic
async function simulateSpacebarWithOfficeAPI() {
    try {
        console.log('🔄 Trying Office.js API for spacebar simulation with animation logic...');
        
        // First, try to check if there are animations on the current slide
        await PowerPoint.run(async (context) => {
            const selectedSlides = context.presentation.getSelectedSlides();
            selectedSlides.load('items');
            await context.sync();
            
            if (selectedSlides.items && selectedSlides.items.length > 0) {
                const currentSlide = selectedSlides.items[0];
                currentSlide.load(['shapes', 'id']);
                await context.sync();
                
                console.log('🎬 Checking for animations on current slide...');
                
                // Check if slide has shapes that might have animations
                let hasAnimations = false;
                let animationAdvanced = false;
                
                if (currentSlide.shapes && currentSlide.shapes.items.length > 0) {
                    // Load shape properties to check for animations
                    currentSlide.shapes.load('items');
                    await context.sync();
                    
                    console.log(`📊 Found ${currentSlide.shapes.items.length} shapes on slide`);
                    
                    // Simulate animation advancement logic
                    // In a real scenario, we'd check animation timeline and advance to next step
                    
                    // For simulation, we'll assume there might be animations and try to advance them
                    try {
                        // Method 1: Try to simulate animation advancement by staying on same slide
                        // but triggering a "refresh" or "advance" action
                        
                        console.log('🎬 Attempting to advance animations...');
                        
                        // Simulate a small delay as if an animation is playing
                        await new Promise(resolve => setTimeout(resolve, 300));
                        
                        // Check if we can detect animation state changes
                        // (In a real implementation, this would check animation timeline)
                        
                        const animationCheckResult = await simulateAnimationAdvancement(context, currentSlide);
                        
                        if (animationCheckResult.hasMoreAnimations) {
                            console.log('✅ Animation advanced successfully');
                            showStatus('אנימציה התקדמה בשקף הנוכחי', 'info');
                            animationAdvanced = true;
                        } else {
                            console.log('📄 No more animations, will try to go to next slide');
                            hasAnimations = false;
                        }
                        
                    } catch (animError) {
                        console.log('⚠️ Animation advancement failed, trying next slide:', animError);
                        hasAnimations = false;
                    }
                }
                
                // If no animations advanced, try to go to next slide
                if (!animationAdvanced) {
                    console.log('➡️ No animations to advance, going to next slide...');
                    await advanceToNextSlide(context);
                }
                
            } else {
                console.log('❌ No slide selected for spacebar simulation');
                simulateSpacebarFallback();
            }
        });
        
    } catch (error) {
        console.error('Error in Office.js spacebar simulation:', error);
        simulateSpacebarFallback();
    }
}

// Simulate animation advancement on current slide
async function simulateAnimationAdvancement(context, currentSlide) {
    try {
        console.log('🎬 Simulating animation advancement...');
        
        // In a real implementation, this would:
        // 1. Check the animation timeline
        // 2. Find the next animation step
        // 3. Advance to that step
        // 4. Return whether there are more animations
        
        // For simulation purposes, we'll create a simple logic:
        // - Assume there might be animations
        // - Simulate advancing them
        // - Return a result
        
        // Get current time to simulate animation state
        const currentTime = Date.now();
        
        // Store animation state in a simple way (using slide ID as key)
        if (!window.slideAnimationState) {
            window.slideAnimationState = {};
        }
        
        const slideId = currentSlide.id;
        if (!window.slideAnimationState[slideId]) {
            window.slideAnimationState[slideId] = {
                animationStep: 0,
                maxAnimations: Math.floor(Math.random() * 3) + 1, // Simulate 1-3 animations
                lastAdvanced: currentTime
            };
        }
        
        const animState = window.slideAnimationState[slideId];
        
        // Advance animation step
        animState.animationStep++;
        animState.lastAdvanced = currentTime;
        
        console.log(`🎬 Animation step: ${animState.animationStep}/${animState.maxAnimations}`);
        
        // Check if there are more animations
        const hasMoreAnimations = animState.animationStep < animState.maxAnimations;
        
        if (hasMoreAnimations) {
            // Simulate animation effect by briefly changing slide content or showing feedback
            showStatus(`🎬 אנימציה ${animState.animationStep}/${animState.maxAnimations} - נותרו עוד ${animState.maxAnimations - animState.animationStep}`, 'info');
            
            // In a real scenario, this might:
            // - Make shapes visible/invisible
            // - Change shape properties
            // - Trigger entrance/exit effects
            
            console.log(`🎬 Animation playing: step ${animState.animationStep}, ${animState.maxAnimations - animState.animationStep} more to go`);
            
            return { hasMoreAnimations: true, step: animState.animationStep };
        } else {
            // All animations completed, reset for next time
            console.log(`🎬 All animations completed on slide, ready for next slide`);
            showStatus('🎬 כל האנימציות הושלמו - מעבר לשקף הבא', 'info');
            delete window.slideAnimationState[slideId];
            return { hasMoreAnimations: false, step: animState.animationStep };
        }
        
    } catch (error) {
        console.error('Error in animation advancement simulation:', error);
        return { hasMoreAnimations: false, step: 0 };
    }
}

// Advance to next slide
async function advanceToNextSlide(context) {
    try {
        console.log('➡️ Advancing to next slide...');
        
        // Get all slides to find next slide
        const slides = context.presentation.slides;
        slides.load('items');
        await context.sync();
        
        const selectedSlides = context.presentation.getSelectedSlides();
        selectedSlides.load('items');
        await context.sync();
        
        if (selectedSlides.items && selectedSlides.items.length > 0) {
            const currentSlide = selectedSlides.items[0];
            currentSlide.load('id');
            await context.sync();
            
            // Find current slide index
            let currentIndex = -1;
            for (let i = 0; i < slides.items.length; i++) {
                slides.items[i].load('id');
            }
            await context.sync();
            
            for (let i = 0; i < slides.items.length; i++) {
                if (slides.items[i].id === currentSlide.id) {
                    currentIndex = i;
                    break;
                }
            }
            
            if (currentIndex >= 0 && currentIndex < slides.items.length - 1) {
                // Try to go to next slide using Office.js
                const nextSlideIndex = currentIndex + 1;
                
                console.log(`➡️ Moving from slide ${currentIndex + 1} to slide ${nextSlideIndex + 1}`);
                
                // Use Office.context.document.goToByIdAsync if available
                if (typeof Office.context.document.goToByIdAsync === 'function') {
                    Office.context.document.goToByIdAsync(nextSlideIndex, Office.GoToType.Index, function (asyncResult) {
                        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
                            console.log('✅ Successfully moved to next slide');
                            showStatus(`עבר לשקף ${nextSlideIndex + 1}`, 'info');
                            
                            // Update our tracking
                            currentSlideNumber = nextSlideIndex + 1;
                            window.currentSlideNumber = currentSlideNumber;
                            
                            // Update UI
                            const slideElement = document.getElementById('currentSlide');
                            if (slideElement) {
                                slideElement.textContent = currentSlideNumber;
                            }
                            const slideDisplayElement = document.getElementById('currentSlideDisplay');
                            if (slideDisplayElement) {
                                slideDisplayElement.textContent = currentSlideNumber;
                            }
                            
                            loadSlideType();
                        } else {
                            console.error('❌ Failed to move to next slide:', asyncResult.error);
                            showStatus('לא ניתן לעבור לשקף הבא', 'error');
                        }
                    });
                } else {
                    console.log('⚠️ Office.js navigation not available');
                    showStatus('אנא עבור ידנית לשקף הבא', 'warning');
                }
            } else {
                console.log('📄 Already at last slide');
                showStatus('כבר בשקף האחרון', 'warning');
            }
        }
        
    } catch (error) {
        console.error('Error advancing to next slide:', error);
        showStatus('שגיאה במעבר לשקף הבא', 'error');
    }
}

// Fallback method for spacebar simulation
async function simulateSpacebarFallback() {
    try {
        console.log('🔄 Using fallback method for spacebar simulation...');
        
        await PowerPoint.run(async (context) => {
            // Get current slide information
            const selectedSlides = context.presentation.getSelectedSlides();
            selectedSlides.load('items');
            await context.sync();
            
            if (selectedSlides.items && selectedSlides.items.length > 0) {
                const currentSlide = selectedSlides.items[0];
                currentSlide.load(['shapes']);
                await context.sync();
                
                console.log('⌨️ Spacebar simulation - checking slide content...');
                
                // Since we can't directly simulate spacebar, we'll provide feedback
                // In PowerPoint, spacebar typically:
                // 1. Advances to next animation step in current slide
                // 2. If no more animations, goes to next slide
                
                showStatus('מקש רווח - התקדמות באנימציה או מעבר לשקף הבא', 'info');
                
                // Optional: You could add logic here to:
                // 1. Check for animations on the slide
                // 2. Advance to next animation step
                // 3. If no more animations, go to next slide
                
                console.log('✅ Spacebar simulation fallback completed');
                
            } else {
                console.log('❌ No slide selected for spacebar simulation');
                showStatus('אין שקף נבחר למקש רווח', 'error');
            }
        });
        
    } catch (error) {
        console.error('Error in spacebar simulation fallback:', error);
        showStatus('שגיאה בסימולציית מקש רווח (גיבוי)', 'error');
    }
}
// Generate a unique UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Get PowerPoint's built-in slide ID (stable and unique)
async function getSlideUniqueId(slide, context) {
    try {
        // Load the built-in ID property
        slide.load('id');
        await context.sync();
        
        console.log('✅ Got PowerPoint slide ID:', slide.id);
        return slide.id;
        
    } catch (error) {
        console.error('❌ Error getting slide ID:', error);
        console.error('Error details:', error.message);
        // Fallback to a unique ID based on timestamp
        const fallbackId = `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.warn('⚠️ Using fallback ID:', fallbackId);
        return fallbackId;
    }
}

async function getCurrentSlideNumber() {
    try {
        await PowerPoint.run(async (context) => {
            console.log('🔍 Getting current slide...');
            
            // OPTIMIZED: Load both selectedSlides and allSlides BEFORE first sync
            const selectedSlides = context.presentation.getSelectedSlides();
            const allSlides = context.presentation.slides;
            selectedSlides.load('items');
            allSlides.load('items');
            
            // OPTIMIZED: Single sync for both operations
            await context.sync();
            
            console.log('🔍 Selected slides count:', selectedSlides.items?.length || 0);
            
            if (selectedSlides.items && selectedSlides.items.length > 0) {
                const selectedSlide = selectedSlides.items[0];
                
                // OPTIMIZED: Load selected slide ID and all slides IDs in ONE batch
                selectedSlide.load('id');
                for (let i = 0; i < allSlides.items.length; i++) {
                    allSlides.items[i].load('id');
                }
                
                // OPTIMIZED: Single sync for all ID loads
                await context.sync();
                
                // Now we have everything - no more syncs needed!
                currentSlideId = selectedSlide.id;
                window.currentSlideId = currentSlideId;
                
                console.log('🔍 Total slides:', allSlides.items.length);
                console.log('🔍 Selected slide UUID:', currentSlideId);
                
                // Find matching slide position
                for (let i = 0; i < allSlides.items.length; i++) {
                    if (allSlides.items[i].id === selectedSlide.id) {
                        currentSlideNumber = i + 1;
                        console.log(`✅ Found slide at position ${i + 1} with UUID: ${currentSlideId}`);
                        break;
                    }
                }
            } else {
                console.log('⚠️ No selected slides found, using fallback');
                currentSlideNumber = 1; // Fallback
                currentSlideId = null;
            }
            
            // Update UI
            window.currentSlideNumber = currentSlideNumber;
            window.currentSlideId = currentSlideId;
            const slideElement = document.getElementById('currentSlide');
            if (slideElement) {
                slideElement.textContent = currentSlideNumber;
            }
            const slideDisplayElement = document.getElementById('currentSlideDisplay');
            if (slideDisplayElement) {
                slideDisplayElement.textContent = currentSlideNumber;
            }
            
            console.log(`📄 Final current slide number: ${currentSlideNumber}, UUID: ${currentSlideId}`);
        });
    } catch (error) {
        console.error('Error getting current slide number:', error);
        // Fallback
        if (currentSlideNumber === 0) {
            currentSlideNumber = 1;
        }
        window.currentSlideNumber = currentSlideNumber;
        const slideElement = document.getElementById('currentSlide');
        if (slideElement) {
            slideElement.textContent = currentSlideNumber;
        }
        const slideDisplayElement = document.getElementById('currentSlideDisplay');
        if (slideDisplayElement) {
            slideDisplayElement.textContent = currentSlideNumber;
        }
        console.log(`📄 Fallback current slide number: ${currentSlideNumber}`);
    }
    // Note: loadSlideType should be called separately, not here
}
function setupSlideChangeListener() {
    console.log('Setting up slide change listener...');
    try {
        
        // הוספת מאזין לאירוע שינוי בחירה במסמך
        Office.context.document.addHandlerAsync(
            Office.EventType.DocumentSelectionChanged,
            onSlideChanged,
            function(result) {
                if (result.status === Office.AsyncResultStatus.Succeeded) {
                    console.log('✅ Slide change listener added successfully');
                    console.log('🔍 Event type used:', Office.EventType.DocumentSelectionChanged);
                } else {
                    console.log('❌ Failed to add slide change listener:', result.error);
                }
            }
        );
        
        
    } catch (error) {
        console.error('Error setting up slide change listener:', error);
    }
}

// פונקציה לטיפול בשינוי שקף
// Debounce timer for slide changes
let slideChangeDebounceTimer = null;

async function onSlideChanged(eventArgs) {
    console.log('🔄 EVENT TRIGGERED: שקף השתנה!', eventArgs);
    
    // Clear previous debounce timer
    if (slideChangeDebounceTimer) {
        clearTimeout(slideChangeDebounceTimer);
    }
    
    // Debounce: wait 50ms before processing (prevents multiple rapid calls)
    slideChangeDebounceTimer = setTimeout(async () => {
        await processSlideChange();
    }, 50);
}

async function processSlideChange() {
    console.log('🔍 Current slide before check:', currentSlideNumber, 'UUID:', currentSlideId);
    
    try {
        // קבל את השקף הנוכחי - OPTIMIZED: all loads before first sync
        await PowerPoint.run(async (context) => {
            // Load everything in one batch BEFORE first sync
            const selectedSlides = context.presentation.getSelectedSlides();
            const allSlides = context.presentation.slides;
            selectedSlides.load('items');
            allSlides.load('items');
            
            // OPTIMIZED: Single sync for both operations
            await context.sync();
            
            if (selectedSlides.items && selectedSlides.items.length > 0) {
                const currentSlide = selectedSlides.items[0];
                
                // Load IDs for current slide AND all slides in ONE batch
                currentSlide.load('id');
                for (let i = 0; i < allSlides.items.length; i++) {
                    allSlides.items[i].load('id');
                }
                
                // OPTIMIZED: Single sync for all ID loads
                await context.sync();
                
                // Now we have everything we need - no more syncs!
                const newSlideId = currentSlide.id;
                
                // Find the slide number by comparing PowerPoint's internal ID
                let newSlideNumber = 1;
                for (let i = 0; i < allSlides.items.length; i++) {
                    if (allSlides.items[i].id === currentSlide.id) {
                        newSlideNumber = i + 1;
                        break;
                    }
                }
                
                console.log(`🔍 Detected slide number: ${newSlideNumber}, UUID: ${newSlideId}`);
                console.log(`🔍 Previous: slide ${currentSlideNumber}, UUID: ${currentSlideId}`);
                
                // Check if this UUID already has a saved type
                const savedType = getSlideType(newSlideId);
                if (savedType) {
                    console.log(`📝 This slide already has a saved type: ${savedType}`);
                } else {
                    console.log(`📝 This slide has no saved type yet`);
                }
                
                // Only update if slide actually changed (by UUID, not number!)
                if (newSlideId !== currentSlideId) {
                    const oldSlideNumber = currentSlideNumber;
                    const oldSlideId = currentSlideId;
                    currentSlideNumber = newSlideNumber;
                    currentSlideId = newSlideId;
                    window.currentSlideNumber = currentSlideNumber;
                    window.currentSlideId = currentSlideId;
                    
                    // Update UI
                    const slideElement = document.getElementById('currentSlide');
                    if (slideElement) {
                        slideElement.textContent = currentSlideNumber;
                    }
                    const slideDisplayElement = document.getElementById('currentSlideDisplay');
                    if (slideDisplayElement) {
                        slideDisplayElement.textContent = currentSlideNumber;
                    }
                    
                    console.log(`✅ SLIDE CHANGED: ${oldSlideNumber} (${oldSlideId}) → ${currentSlideNumber} (${currentSlideId})`);
                    
                    // Load slide type for new slide
                    loadSlideType();
                    
                    // No auto-save - only save when user changes slide type manually
                } else {
                    console.log('🔍 No slide change detected (same UUID)');
                }
            }
        });
    } catch (error) {
        console.error('Error handling slide change:', error);
        // Fallback to simple detection
        await getCurrentSlideNumber();
    }
}


// Participants management
let participantsList = [];
let participantsPositions = new Map(); // nickname -> position index

function initializeWebSocket() {
    try {
        console.log('🔌 Initializing WebSocket connection to:', WEBSOCKET_URL);
        
        if (typeof io === 'undefined') {
            console.error('Socket.io not loaded');
            showError('Socket.io לא נטען');
            return;
        }
        
        socket = io(WEBSOCKET_URL, {
            transports: ['websocket', 'polling'],
            forceNew: true,
            timeout: 5000
        });
        
        socket.on('connect', async () => {
            console.log('✅ WebSocket connected successfully');
            
            // Register with room (hash ID)
            try {
                const hashId = await getGameHashId();
                if (hashId) {
                    console.log('🔑 Registering with hash ID:', hashId);
                    socket.emit('register_room', { hashId: hashId });
                    window.currentHashId = hashId;
                } else {
                    console.log('⚠️ No hash ID available - running without room registration');
                }
            } catch (error) {
                console.error('❌ Failed to register room:', error);
            }
        });
        
        socket.on('room_registered', (data) => {
            if (data.status === 'success') {
                console.log('✅ Successfully registered to room:', data.hashId);
            } else {
                console.error('❌ Room registration failed:', data.message);
            }
        });
        
        socket.on('disconnect', () => {
            console.log('❌ WebSocket disconnected');
            timerActive = false;
        });
        
        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            showError('שגיאה בחיבור WebSocket: ' + error.message);
        });
        
        socket.on('error', (error) => {
            console.error('WebSocket error:', error);
            showError('שגיאת WebSocket: ' + error.message);
        });
        
        // Handle user updates
        socket.on('user_update', (data) => {
            console.log('👥 User update received:', data);
            currentUsers = data.users || data.total || 0;
            window.currentUsers = currentUsers;
            
            // Update UI
            const userCountElement = document.getElementById('userCount');
            if (userCountElement) {
                userCountElement.textContent = currentUsers;
            }
        });
        
        // Handle participant updates (new message type)
        socket.on('participant_update', (data) => {
            console.log('🆕 Participant update received:', data);
            handleParticipantUpdate(data);
        });
        
        // Handle game PIN registration from Admin
        socket.on('game_pin_registered', (data) => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎮 RECEIVED game_pin_registered EVENT!');
            console.log('📦 Data:', JSON.stringify(data, null, 2));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            const gamePin = data.gamePin;
            
            console.log('📌 Updating Game PIN to:', gamePin);
            
            // Store game PIN globally
            window.gamePIN = gamePin;
            
            // Format PIN as XXX-XXX for display
            const formattedPin = gamePin.slice(0, 3) + '-' + gamePin.slice(3);
            
            // Update game ID display in UI
            const gameIdElements = document.querySelectorAll('[id^="gameId"]');
            console.log('📋 Found game ID elements:', gameIdElements.length);
            gameIdElements.forEach(el => {
                el.textContent = formattedPin;
                console.log('✅ Updated element:', el.id);
            });
            
            // Update kahoot-game-id tags in PowerPoint slides
            console.log('📝 Calling updateGameIdInSlides with:', gamePin);
            updateGameIdInSlides(gamePin).then(() => {
                console.log('✅ updateGameIdInSlides completed');
            }).catch(err => {
                console.error('❌ updateGameIdInSlides error:', err);
            });
            
            // Update QR Code in slides with game PIN (for players)
            console.log('🔍 DEBUG - window.currentHashId:', window.currentHashId);
            console.log('🔍 DEBUG - gamePin:', gamePin);
            
            if (window.currentHashId && gamePin) {
                console.log('📱 Calling updateQrCodeInSlides with hash ID:', window.currentHashId, 'game PIN:', gamePin);
                updateQrCodeInSlides(window.currentHashId, gamePin).then(() => {
                    console.log('✅ updateQrCodeInSlides completed');
                }).catch(err => {
                    console.error('❌ updateQrCodeInSlides error:', err);
                    console.error('   Error stack:', err.stack);
                });
            } else {
                console.warn('⚠️ No hash ID or game PIN available for QR code update');
                console.warn('   window.currentHashId:', window.currentHashId);
                console.warn('   gamePin:', gamePin);
            }
            
            showStatus(`🎮 משחק פעיל - Game PIN: ${formattedPin}`, 'success');
        });
        
        // Handle status updates
        socket.on('status_update', (data) => {
            console.log('📊 Status update received:', data);
            currentUsers = data.users || 0;
            window.currentUsers = currentUsers;
            
            // Update UI
            const userCountElement = document.getElementById('userCount');
            if (userCountElement) {
                userCountElement.textContent = currentUsers;
            }
            
            if (data.status === 'running') {
                timerActive = true;
            } else {
                timerActive = false;
            }
        });

        // Handle slide navigation commands
        socket.on('slide_navigation', (data) => {
            console.log('🎯 Slide navigation command received:', data);
            
            if (data.action === 'go_to_next_slide') {
                console.log('📄 Executing next slide navigation...');
                goToNextSlideInPowerPoint();
                showStatus('מעבר לשקף הבא...', 'info');
            } else if (data.action === 'go_to_first_slide') {
                console.log('📍 Resetting to first slide...');
                goToFirstSlideInPowerPoint();
                showStatus('חזרה לשקף הראשון...', 'info');
            }
        });

        // Handle click navigation commands (spacebar simulation)
        socket.on('click_navigation', (data) => {
            console.log('⌨️ Spacebar navigation command received:', data);
            
            if (data.action === 'simulate_click') {
                console.log('⌨️ Executing spacebar simulation...');
                simulateClickInPowerPoint();
                showStatus('מדמה לחיצה על רווח...', 'info');
            }
        });

        // Handle animation reset commands
        socket.on('animation_reset', (data) => {
            console.log('🔄 Animation reset command received:', data);
            
            if (data.action === 'reset_animations') {
                console.log('🔄 Executing animation reset...');
                resetAnimationState();
            }
        });

        // Handle slide change messages (keep for backward compatibility)
        socket.on('slide_change', (data) => {
            console.log('🔄 Slide change message received:', data);
            
            // Update current slide number if provided
            if (data.slide) {
                currentSlideNumber = data.slide;
                window.currentSlideNumber = currentSlideNumber;
                
                // Update UI elements
                const slideElement = document.getElementById('currentSlide');
                if (slideElement) {
                    slideElement.textContent = currentSlideNumber;
                }
                const slideDisplayElement = document.getElementById('currentSlideDisplay');
                if (slideDisplayElement) {
                    slideDisplayElement.textContent = currentSlideNumber;
                }
                
                console.log(`📄 Slide updated to: ${currentSlideNumber}`);
            }
            
            // Update user count if provided
            if (data.users !== undefined) {
                currentUsers = data.users;
                window.currentUsers = currentUsers;
                
                const userCountElement = document.getElementById('userCount');
                if (userCountElement) {
                    userCountElement.textContent = currentUsers;
                }
            }
            
            // Load slide type for the new slide
            loadSlideType();
            
            // Show notification in the add-in
            showStatus(`עבר לשקף ${data.slide || 'הבא'}`, 'info');
        });
        
        console.log('🎯 WebSocket event handlers set up successfully');
        
    } catch (error) {
        console.error('WebSocket initialization failed:', error);
        showError('שגיאה בחיבור WebSocket: ' + error.message);
    }
}

// Handle participant updates from WebSocket
function handleParticipantUpdate(data) {
    // Expected data format:
    // { nick: "username", type: "add"/"remove", total: 5 }
    
    const { nick, type, total } = data;
    
    if (!nick || !type) {
        console.error('Invalid participant update data:', data);
        return;
    }
    
    console.log(`🔄 Processing ${type} for participant: ${nick}`);
    
    if (type === 'add') {
        addParticipant(nick);
    } else if (type === 'remove') {
        removeParticipant(nick);
    }
    
    // Update total count
    if (total !== undefined) {
        currentUsers = total;
        window.currentUsers = currentUsers;
        
        // Update total count display
        const totalCountElement = document.getElementById('totalParticipantsCount');
        if (totalCountElement) {
            totalCountElement.textContent = total;
        }
        
        // Update main user count
        const userCountElement = document.getElementById('userCount');
        if (userCountElement) {
            userCountElement.textContent = total;
        }
    }
    
    // Update any live participants areas in slides
    updateLiveParticipantsInSlide();
}

// Add participant with smart positioning
function addParticipant(nickname) {
    // Check if participant already exists
    if (participantsList.includes(nickname)) {
        console.log(`Participant ${nickname} already exists`);
        return;
    }
    
    console.log(`➕ Adding participant: ${nickname}`);
    
    // Add to participants list
    participantsList.push(nickname);
    
    // Calculate position using smart positioning logic
    const position = calculateNewParticipantPosition();
    participantsPositions.set(nickname, position);
    
    // Create and insert participant element
    createParticipantElement(nickname, position);
    
    // Hide "no participants" message if it's the first participant
    if (participantsList.length === 1) {
        const noParticipants = document.getElementById('noParticipants');
        if (noParticipants) {
            noParticipants.style.display = 'none';
        }
    }
    
    console.log(`✅ Participant ${nickname} added at position ${position}`);
    
    // Update live participants areas in slides
    updateLiveParticipantsInSlide();
}

// Remove participant and reposition others
function removeParticipant(nickname) {
    const index = participantsList.indexOf(nickname);
    if (index === -1) {
        console.log(`Participant ${nickname} not found`);
        return;
    }
    
    console.log(`➖ Removing participant: ${nickname}`);
    
    // Get the element and animate removal
    const participantElement = document.querySelector(`[data-participant="${nickname}"]`);
    if (participantElement) {
        participantElement.classList.add('removing');
        
        // Remove after animation
        setTimeout(() => {
            participantElement.remove();
            
            // Remove from data structures
            participantsList.splice(index, 1);
            participantsPositions.delete(nickname);
            
            // Reposition remaining participants
            repositionAllParticipants();
            
            // Show "no participants" message if list is empty
            if (participantsList.length === 0) {
                const noParticipants = document.getElementById('noParticipants');
                if (noParticipants) {
                    noParticipants.style.display = 'block';
                }
            }
            
            console.log(`✅ Participant ${nickname} removed`);
            
            // Update live participants areas in slides
            updateLiveParticipantsInSlide();
        }, 300); // Wait for animation
    }
}

// Calculate position for new participant
function calculateNewParticipantPosition() {
    const count = participantsList.length;
    
    if (count === 0) {
        return 0; // Center position
    }
    
    // Smart positioning: center first, then alternate left/right
    // Position 0 = center
    // Position 1 = right of center
    // Position 2 = left of center  
    // Position 3 = right of position 1
    // Position 4 = left of position 2
    // etc.
    
    return count;
}

// Create participant DOM element
function createParticipantElement(nickname, position) {
    const container = document.getElementById('participantsContainer');
    if (!container) return;
    
    const participantDiv = document.createElement('div');
    participantDiv.className = 'participant-item';
    participantDiv.setAttribute('data-participant', nickname);
    participantDiv.setAttribute('data-position', position);
    participantDiv.textContent = nickname;
    
    // Insert in the right position
    insertParticipantAtPosition(participantDiv, position);
}

// Insert participant at correct visual position
function insertParticipantAtPosition(element, position) {
    const container = document.getElementById('participantsContainer');
    if (!container) return;
    
    // Get all current participant elements (excluding noParticipants)
    const existingParticipants = Array.from(container.children).filter(
        child => child.classList.contains('participant-item')
    );
    
    // Simple append for now - visual positioning handled by CSS flexbox with center justify
    container.appendChild(element);
}

// Reposition all participants after removal
function repositionAllParticipants() {
    // Clear current positions
    participantsPositions.clear();
    
    // Recalculate positions for all remaining participants
    participantsList.forEach((nickname, index) => {
        participantsPositions.set(nickname, index);
        
        // Update data-position attribute
        const element = document.querySelector(`[data-participant="${nickname}"]`);
        if (element) {
            element.setAttribute('data-position', index);
        }
    });
    
    console.log('🔄 Repositioned all participants');
}

// Insert live participants area into slide (copy panel content directly)
async function insertLiveParticipantsArea() {
    await PowerPoint.run(async (context) => {
        // קבל את השקף הנוכחי
        const slides = context.presentation.getSelectedSlides();
        slides.load('items');
        await context.sync();
        
        if (slides.items.length === 0) {
            console.error('אין שקף נבחר');
            showError('אנא בחר שקף תחילה');
            return;
        }
        
        const currentSlide = slides.items[0];
        
        console.log('🔄 יוצר אזור משתתפים חי שמחקה את הפאנל...');
        
        // קבל את המשתתפים הנוכחיים מהפאנל
        const panelParticipants = Array.from(document.querySelectorAll('#participantsContainer .participant-item'))
            .map(item => item.textContent.trim());
        
        console.log('📋 משתתפים בפאנל:', panelParticipants);
        
        // צור את הקונטיינר הראשי שנראה כמו הפאנל
        const containerArea = currentSlide.shapes.addTextBox('', {
            left: 50,
            top: 300,
            width: 400,
            height: 250
        });
        
        containerArea.load(['tags', 'fill', 'line', 'textFrame']);
        await context.sync();
        
        // סטייל כמו הפאנל
        try {
            containerArea.fill.setSolidColor('#f3f2f1'); // רקע אפור בהיר כמו בפאנל
            containerArea.line.color = '#0078d4'; // גבול כחול כמו בפאנל
            containerArea.line.weight = 2;
        } catch (styleError) {
            console.log('לא הצלחתי לסטייל את הקונטיינר:', styleError);
        }
        
        // הוסף כותרת וטקסט
        const textRange = containerArea.textFrame.textRange;
        let content = '👥 משתתפים פעילים\n\n';
        
        if (panelParticipants.length === 0) {
            content += 'מחכים למשתתפים...';
        } else {
            content += `משתתפים:\n${panelParticipants.join(' • ')}\n\n`;
            content += `סה"כ: ${panelParticipants.length}`;
        }
        
        textRange.text = content;
        
        // סטייל הטקסט
        textRange.load(['font', 'paragraphFormat']);
        await context.sync();
        textRange.font.name = 'Segoe UI';
        textRange.font.size = 12;
        textRange.font.color = '#0078d4';
        textRange.font.bold = true;
        
        // הוסף תג לעדכונים דינמיים
        containerArea.tags.add('kahoot-participants-area', 'true');
        await context.sync();
        
        // עכשיו צור pills בודדים אם יש משתתפים
        if (panelParticipants.length > 0) {
            await createParticipantPillShapes(context, currentSlide, panelParticipants);
        }
        
        console.log('✅ אזור משתתפים חי נוצר בהצלחה!');
        showError('✅ אזור משתתפים חי נוסף לשקף! יתעדכן אוטומטית עם הפאנל.');
    });
}

// Create participant pills as shapes in the slide (like the panel)
async function createParticipantPillShapes(context, slide, participants) {
    try {
        console.log('🔵 יוצר pills כחולים למשתתפים...');
        
        const startX = 70;
        const startY = 400; // מתחת לקונטיינר הטקסט
        const pillWidth = 80;
        const pillHeight = 30;
        const gapX = 10;
        const gapY = 10;
        const pillsPerRow = 4;
        
        for (let i = 0; i < participants.length; i++) {
            const participant = participants[i];
            const row = Math.floor(i / pillsPerRow);
            const col = i % pillsPerRow;
            
            const x = startX + col * (pillWidth + gapX);
            const y = startY + row * (pillHeight + gapY);
            
            // צור רקע כחול (רקע מעוגל)
            const pillBg = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle, {
                left: x,
                top: y,
                width: pillWidth,
                height: pillHeight
            });
            
            pillBg.load(['fill', 'line', 'tags']);
            await context.sync();
            
            // סטייל הרקע כמו בפאנל
            try {
                pillBg.fill.setSolidColor('#0078d4'); // כחול כמו בפאנל
                pillBg.line.color = '#0078d4';
                pillBg.line.weight = 1;
            } catch (bgStyleError) {
                console.log('לא הצלחתי לסטייל רקע pill:', bgStyleError);
            }
            
            // תג לזיהוי
            pillBg.tags.add('kahoot-participant-pill', 'true');
            pillBg.tags.add('participant-name', participant);
            
            // צור טקסט לבן על הרקע
            const pillText = slide.shapes.addTextBox(participant, {
                left: x + 2,
                top: y + 2,
                width: pillWidth - 4,
                height: pillHeight - 4
            });
            
            pillText.load(['textFrame', 'tags']);
            await context.sync();
            
            // סטייל הטקסט
            const nameRange = pillText.textFrame.textRange;
            nameRange.load(['font', 'paragraphFormat']);
            await context.sync();
            
            nameRange.font.size = 10;
            nameRange.font.color = '#ffffff'; // לבן כמו בפאנל
            nameRange.font.bold = true;
            nameRange.font.name = 'Segoe UI';
            
            try {
                nameRange.paragraphFormat.alignment = PowerPoint.ParagraphAlignment.center;
            } catch (alignError) {
                console.log('לא הצלחתי למרכז טקסט:', alignError);
            }
            
            // תג לטקסט
            pillText.tags.add('kahoot-participant-pill', 'true');
            pillText.tags.add('participant-name', participant);
            
            await context.sync();
            console.log(`✅ נוצר pill עבור: ${participant}`);
        }
        
        console.log('✅ כל ה-pills נוצרו בהצלחה!');
    } catch (error) {
        console.error('❌ שגיאה ביצירת pills:', error);
    }
}

// Update synchronized area content to mirror the panel
async function updateSyncAreaContent(context, syncArea) {
    try {
        syncArea.load(['textFrame']);
        await context.sync();
        
        const textRange = syncArea.textFrame.textRange;
        textRange.load(['text']);
        await context.sync();
        
        // Mirror the panel's current state exactly
        let content = '👥 משתתפים פעילים\n\n';
        
        if (participantsList.length === 0) {
            content += 'מחכים למשתתפים...';
        } else {
            // Display participants as pills-like text (since we can't do real pills in text box)
            const participantsText = participantsList.map(p => `[${p}]`).join(' ');
            content += participantsText + '\n\n';
            content += `סה"כ: ${participantsList.length} משתתפים`;
        }
        
        textRange.text = content;
        
        // Style the text to match panel
        textRange.load(['font', 'paragraphFormat']);
        await context.sync();
        textRange.font.name = 'Segoe UI';
        textRange.font.size = 12;
        textRange.font.color = '#0078d4';
        
        await context.sync();
    } catch (error) {
        console.error('Error updating sync area content:', error);
    }
}

// Update Game ID in all slides with the tag
async function updateGameIdInSlides(gamePin) {
    console.log(`🎮 Starting updateGameIdInSlides with PIN: ${gamePin}`);
    
    if (!gamePin) {
        console.error('❌ No game PIN provided to updateGameIdInSlides');
        return;
    }
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log(`🔍 Searching for kahoot-game-id tags in ${slides.items.length} slides...`);
            
            let foundElements = 0;
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                console.log(`📄 Checking slide ${i + 1} with ${shapes.items.length} shapes`);
                
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    let hasGameIdTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        console.log(`  🏷️ Tag: ${tag.key} = ${tag.value}`);
                        
                        // Case-insensitive comparison
                        if (tag.key.toLowerCase() === 'kahoot-game-id' && tag.value === 'true') {
                            hasGameIdTag = true;
                            console.log('  ✅ Found kahoot-game-id tag!');
                            break;
                        }
                    }
                    
                    if (hasGameIdTag) {
                        console.log(`📝 Updating shape in slide ${i + 1}`);
                        shape.load(['textFrame', 'name', 'type']);
                        await context.sync();
                        
                        console.log(`  Shape type: ${shape.type}, name: ${shape.name}`);
                        
                        try {
                            // Format PIN as XXX-XXX
                            const formattedPin = gamePin.slice(0, 3) + '-' + gamePin.slice(3);
                            
                            const textRange = shape.textFrame.textRange;
                            textRange.text = formattedPin;
                            await context.sync();
                            
                            foundElements++;
                            console.log(`✅ Updated game PIN to: ${formattedPin} in slide ${i + 1}`);
                        } catch (textError) {
                            console.error(`❌ Error updating text in slide ${i + 1}:`, textError);
                        }
                    }
                }
            }
            
            console.log(`✅ Total game ID elements updated: ${foundElements}`);
        });
    } catch (error) {
        console.error('❌ Error updating game ID in slides:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

// Update QR Code in slides with image from server
async function updateQrCodeInSlides(hashId, gamePin) {
    console.log(`📱 Starting updateQrCodeInSlides with hash ID: ${hashId}, game PIN: ${gamePin}`);
    
    if (!gamePin) {
        console.error('❌ No game PIN provided to updateQrCodeInSlides');
        return;
    }
    
    try {
        // Build QR code URL for PLAYERS (port 8080)
        // Remove any dashes from game PIN for URL
        const cleanPin = gamePin.replace(/-/g, '');
        const qrCodeUrl = `${API_BASE}qr-code-player/${cleanPin}`;
        console.log('📸 Player QR Code URL:', qrCodeUrl);
        
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log(`🔍 Searching for kahoot-qr-code tags in ${slides.items.length} slides...`);
            
            let foundElements = 0;
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                console.log(`📄 Checking slide ${i + 1} with ${shapes.items.length} shapes`);
                
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    let hasQrCodeTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        console.log(`  🏷️ Tag: ${tag.key} = ${tag.value}`);
                        
                        // Case-insensitive comparison (PowerPoint stores tags in uppercase)
                        if (tag.key.toLowerCase() === 'kahoot-qr-code' && tag.value === 'true') {
                            hasQrCodeTag = true;
                            console.log('  ✅ Found kahoot-qr-code tag!');
                            break;
                        }
                    }
                    
                    if (hasQrCodeTag) {
                        console.log(`📝 Updating QR code in slide ${i + 1}`);
                        
                        try {
                            // Format game PIN for display
                            const formattedPin = gamePin.includes('-') ? gamePin : `${gamePin.slice(0, 3)}-${gamePin.slice(3)}`;
                            
                            // Load placeholder properties
                            shape.load(['left', 'top', 'width', 'height', 'name', 'tags']);
                            await context.sync();
                            
                            const left = shape.left;
                            const top = shape.top;
                            const width = shape.width;
                            const height = shape.height;
                            
                            console.log(`   Placeholder position: ${left}, ${top}, Size: ${width}x${height}`);
                            
                            // Check if there's already a QR image from previous update
                            // Look for a shape with tag 'kahoot-qr-image'
                            const allShapes = slide.shapes;
                            allShapes.load(['items']);
                            await context.sync();
                            
                            for (let m = 0; m < allShapes.items.length; m++) {
                                const testShape = allShapes.items[m];
                                const testTags = testShape.tags;
                                testTags.load(['items']);
                                await context.sync();
                                
                                for (let n = 0; n < testTags.items.length; n++) {
                                    const testTag = testTags.items[n];
                                    testTag.load(['key', 'value']);
                                    await context.sync();
                                    
                                    if (testTag.key.toLowerCase() === 'kahoot-qr-image' && testTag.value === 'true') {
                                        console.log('🗑️ Deleting old QR image from previous update');
                                        testShape.delete();
                                        await context.sync();
                                        break;
                                    }
                                }
                            }
                            
                            // Update placeholder tags (keep it as anchor)
                            try {
                                shape.tags.add('kahoot-qr-url', qrCodeUrl);
                                shape.tags.add('kahoot-qr-gamepin', gamePin);
                                await context.sync();
                            } catch (tagError) {
                                console.log('⚠️ Tags may already exist');
                            }
                            
                            // Download QR code image
                            console.log('📥 Downloading QR code image from:', qrCodeUrl);
                            const imageResponse = await fetch(qrCodeUrl);
                            
                            if (!imageResponse.ok) {
                                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
                            }
                            
                            const imageBlob = await imageResponse.blob();
                            console.log(`📦 Image size: ${imageBlob.size} bytes`);
                            
                            // Convert to base64
                            const base64Image = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    let result = reader.result;
                                    if (result.includes(',')) {
                                        result = result.split(',')[1];
                                    }
                                    resolve(result);
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(imageBlob);
                            });
                            
                            console.log('🖼️ Inserting QR image on top of placeholder...');
                            
                            // Insert image at the same position as placeholder
                            await new Promise((resolve, reject) => {
                                Office.context.document.setSelectedDataAsync(
                                    base64Image,
                                    {
                                        coercionType: Office.CoercionType.Image,
                                        imageLeft: left,
                                        imageTop: top,
                                        imageWidth: width,
                                        imageHeight: height
                                    },
                                    function(asyncResult) {
                                        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
                                            console.log('✅ Image inserted successfully');
                                            resolve();
                                        } else {
                                            reject(new Error(asyncResult.error.message));
                                        }
                                    }
                                );
                            });
                            
                            // Now find the newly inserted image and tag it
                            console.log('🔍 Looking for the newly inserted image to tag it...');
                            await context.sync(); // Refresh
                            
                            const shapesAfter = slide.shapes;
                            shapesAfter.load(['items']);
                            await context.sync();
                            
                            // The new image should be the last one added or the one without tags
                            for (let m = shapesAfter.items.length - 1; m >= 0; m--) {
                                const potentialImage = shapesAfter.items[m];
                                potentialImage.load(['type', 'left', 'top', 'tags']);
                                await context.sync();
                                
                                // Check if it's at the same position as our QR
                                if (Math.abs(potentialImage.left - left) < 1 && 
                                    Math.abs(potentialImage.top - top) < 1) {
                                    
                                    // Check if it doesn't have the placeholder tag
                                    const imgTags = potentialImage.tags;
                                    imgTags.load(['items']);
                                    await context.sync();
                                    
                                    let isPlaceholder = false;
                                    for (let n = 0; n < imgTags.items.length; n++) {
                                        const imgTag = imgTags.items[n];
                                        imgTag.load(['key', 'value']);
                                        await context.sync();
                                        
                                        if (imgTag.key.toLowerCase() === 'kahoot-qr-code' && imgTag.value === 'true') {
                                            isPlaceholder = true;
                                            break;
                                        }
                                    }
                                    
                                    if (!isPlaceholder) {
                                        // This is the new image! Tag it
                                        console.log('🏷️ Found new image, adding tag...');
                                        potentialImage.tags.add('kahoot-qr-image', 'true');
                                        potentialImage.tags.add('kahoot-qr-gamepin', gamePin);
                                        await context.sync();
                                        console.log('✅ Image tagged successfully');
                                        break;
                                    }
                                }
                            }
                            
                            foundElements++;
                            console.log(`✅ QR Code image inserted in slide ${i + 1}`);
                            console.log(`   Game PIN: ${formattedPin}`);
                            console.log(`   💡 Placeholder kept as anchor with tags`);
                            
                        } catch (updateError) {
                            console.error(`❌ Error updating QR code in slide ${i + 1}:`, updateError);
                            console.error('   Details:', updateError.message);
                        }
                    }
                }
            }
            
            console.log(`✅ Total QR Code elements updated: ${foundElements}`);
        });
    } catch (error) {
        console.error('❌ Error updating QR code in slides:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

// Update live participants area in slide (called from WebSocket updates)
async function updateLiveParticipantsInSlide() {
    console.log('🔍 Starting updateLiveParticipantsInSlide with participants:', participantsList);
    
    try {
        await PowerPoint.run(async (context) => {
            // Find slides with participants area
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log(`📊 Found ${slides.items.length} slides to check`);
            
            let foundAreas = 0;
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load('items');
                await context.sync();
                
                console.log(`📄 Slide ${i + 1} has ${shapes.items.length} shapes`);
                
                // Look for shapes with participants area tag
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    shape.load(['tags']);
                    await context.sync();
                    
                    // Check if this shape has the participants area tag
                    const tags = shape.tags;
                    tags.load('items');
                    await context.sync();
                    
                    console.log(`🏷️ Shape ${j + 1} has ${tags.items.length} tags`);
                    
                    let isParticipantsArea = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        console.log(`   Tag: ${tag.key} = ${tag.value}`);
                        
                        if (tag.key === 'kahoot-participants-area' && tag.value === 'true') {
                            isParticipantsArea = true;
                            console.log('✅ Found participants area!');
                            break;
                        } else if (tag.key === 'KAHOOT-PARTICIPANTS-AREA' && tag.value === 'true') {
                            // PowerPoint might uppercase the tag key
                            isParticipantsArea = true;
                            console.log('✅ Found participants area (uppercase)!');
                            break;
                        } else if (tag.key === 'kahoot-participants-web-area' && tag.value === 'true') {
                            isParticipantsArea = true;
                            console.log('✅ Found participants web area!');
                            break;
                        } else if (tag.key === 'KAHOOT-PARTICIPANTS-WEB-AREA' && tag.value === 'true') {
                            // PowerPoint might uppercase the tag key
                            isParticipantsArea = true;
                            console.log('✅ Found participants web area (uppercase)!');
                            break;
                        } else if (tag.key === 'kahoot-participants-sync-area' && tag.value === 'true') {
                            isParticipantsArea = true;
                            console.log('✅ Found participants sync area!');
                            break;
                        } else if (tag.key === 'KAHOOT-PARTICIPANTS-SYNC-AREA' && tag.value === 'true') {
                            // PowerPoint might uppercase the tag key
                            isParticipantsArea = true;
                            console.log('✅ Found participants sync area (uppercase)!');
                            break;
                        }
                    }
                    
                    if (isParticipantsArea) {
                        foundAreas++;
                        console.log('🔄 Updating participants area content...');
                        try {
                            // Update this participants area
                            await updateParticipantsAreaContent(context, slide, shape);
                            console.log('✅ Successfully updated participants area');
                        } catch (updateError) {
                            console.error('❌ Error updating participants area:', updateError);
                        }
                    }
                    
                    // Also check for participants count text boxes
                    let isParticipantsCount = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        if ((tag.key === 'kahoot-participants-count' || tag.key === 'KAHOOT-PARTICIPANTS-COUNT') && tag.value === 'true') {
                            isParticipantsCount = true;
                            console.log('✅ Found participants count text box!');
                            break;
                        }
                    }
                    
                    if (isParticipantsCount) {
                        console.log('🔄 Updating participants count text...');
                        try {
                            // Update the participants count text
                            shape.load(['textFrame']);
                            await context.sync();
                            
                            const countTextRange = shape.textFrame.textRange;
                            countTextRange.load(['text']);
                            await context.sync();
                            
                            const newCountText = `משתתפים: ${participantsList.length}`;
                            countTextRange.text = newCountText;
                            
                            await context.sync();
                            console.log(`✅ Updated participants count to: ${participantsList.length}`);
                        } catch (countError) {
                            console.error('❌ Error updating participants count:', countError);
                        }
                    }
                    
                    // Check for game ID text boxes
                    let isGameId = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        if ((tag.key === 'kahoot-game-id' || tag.key === 'KAHOOT-GAME-ID') && tag.value === 'true') {
                            isGameId = true;
                            console.log('✅ Found game ID text box!');
                            break;
                        }
                    }
                    
                    if (isGameId) {
                        console.log('🔄 Updating game ID text...');
                        try {
                            // Update the game ID text
                            shape.load(['textFrame']);
                            await context.sync();
                            
                            const gameIdTextRange = shape.textFrame.textRange;
                            gameIdTextRange.load(['text']);
                            await context.sync();
                            
                            const gameId = document.getElementById('gameId')?.textContent || '123-456';
                            gameIdTextRange.text = gameId;
                            
                            await context.sync();
                            console.log(`✅ Updated game ID to: ${gameId}`);
                        } catch (gameIdError) {
                            console.error('❌ Error updating game ID:', gameIdError);
                        }
                    }
                    
                    // Check for participants number text boxes
                    let isParticipantsNum = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        if ((tag.key === 'kahoot-participants-num' || tag.key === 'KAHOOT-PARTICIPANTS-NUM') && tag.value === 'true') {
                            isParticipantsNum = true;
                            console.log('✅ Found participants num text box!');
                            break;
                        }
                    }
                    
                    if (isParticipantsNum) {
                        console.log('🔄 Updating participants num text...');
                        try {
                            // Update the participants num text
                            shape.load(['textFrame']);
                            await context.sync();
                            
                            const numTextRange = shape.textFrame.textRange;
                            numTextRange.load(['text']);
                            await context.sync();
                            
                            const newNumText = participantsList.length.toString();
                            numTextRange.text = newNumText;
                            
                            await context.sync();
                            console.log(`✅ Updated participants num to: ${participantsList.length}`);
                        } catch (numError) {
                            console.error('❌ Error updating participants num:', numError);
                        }
                    }
                }
            }
            
            console.log(`📋 Total participants areas found and updated: ${foundAreas}`);
        });
    } catch (error) {
        console.error('Error updating live participants in slide:', error);
    }
}

// Update content of a specific participants area (web object or text fallback)
async function updateParticipantsAreaContent(context, slide, participantsArea) {
    try {
        console.log('🔄 Updating participants area with current list:', participantsList);
        
        // Check what type of area this is by looking at tags
        participantsArea.load(['tags']);
        await context.sync();
        
        const tags = participantsArea.tags;
        tags.load('items');
        await context.sync();
        
        let areaType = 'text'; // default
        for (let i = 0; i < tags.items.length; i++) {
            const tag = tags.items[i];
            tag.load(['key', 'value']);
            await context.sync();
            
            if ((tag.key === 'kahoot-participants-web-area' || tag.key === 'KAHOOT-PARTICIPANTS-WEB-AREA') && tag.value === 'true') {
                areaType = 'web';
                break;
            } else if ((tag.key === 'kahoot-participants-sync-area' || tag.key === 'KAHOOT-PARTICIPANTS-SYNC-AREA') && tag.value === 'true') {
                areaType = 'sync';
                break;
            }
        }
        
        if (areaType === 'web') {
            // For web objects, the HTML widget handles its own updates via WebSocket
            console.log('🌐 Web object found - content updates automatically via WebSocket');
            // No need to manually update - the widget HTML has its own Socket.IO connection
        } else if (areaType === 'sync') {
            // Update synchronized area to mirror the panel exactly
            console.log('🔗 Updating synchronized area to mirror panel...');
            await updateSyncAreaContent(context, participantsArea);
        } else {
            // Update text area (fallback)
            console.log('📝 Updating text area content...');
            participantsArea.load(['textFrame']);
            await context.sync();
            
            const textRange = participantsArea.textFrame.textRange;
            textRange.load(['text']);
            await context.sync();
            
            let content = '🔄 אזור משתתפים פעילים\n\n';
            
            if (participantsList.length === 0) {
                content += '👥 מחכים למשתתפים...';
            } else {
                content += `👥 משתתפים פעילים (${participantsList.length}):\n\n`;
                participantsList.forEach(participant => {
                    content += `• ${participant}\n`;
                });
            }
            
            textRange.text = content;
            await context.sync();
        }
        
        console.log('✅ Updated participants area content');
        
    } catch (error) {
        console.error('❌ Error updating participants area content:', error);
    }
}

// Load presentation data function
async function loadPresentationData() {
    try {
        console.log('📂 Starting load process...');
        
        // Check if presentation is saved (has a file name)
        const isSaved = await isPresentationSaved();
        
        if (!isSaved) {
            console.log('ℹ️ Presentation not saved yet - no data to load');
            console.log('ℹ️ Save the presentation first to enable data persistence');
            return;
        }
        
        // Get file info (full path)
        const fileInfo = await getPresentationFileInfo();
        
        if (!fileInfo || !fileInfo.fullPath) {
            console.log('📋 No valid file path for loading - skipping');
            return;
        }
        
        console.log('📂 Loading data for presentation:', fileInfo.displayName);
        console.log('📁 Full path:', fileInfo.fullPath);
        
        // Generate hash ID client-side
        const hashId = createHashFromPath(fileInfo.fullPath);
        
        if (!hashId) {
            console.error('❌ Failed to generate hash ID for loading');
            return;
        }
        
        console.log('🔑 Generated hash ID:', hashId);
        
        const response = await fetch(API_BASE + 'load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hashId: hashId })  // Send hash directly
        });

        if (response.ok) {
            const result = await response.json();
            if (result.status === 'success' && result.data.gameState) {
                const gameState = result.data.gameState;
                
                // Restore slide type data (by slide ID, NOT slide number)
                if (gameState.slideTypeData) {
                    window.slideTypeData = gameState.slideTypeData;
                    const slideIds = Object.keys(window.slideTypeData);
                    console.log('✅ Data loaded successfully');
                    console.log('📋 Slide types loaded:', slideIds.length);
                    console.log('🔑 Slide IDs:', slideIds);
                    console.log('📝 Slide type data:', JSON.stringify(window.slideTypeData, null, 2));
                }
                
                // Restore presentation settings
                if (gameState.presentationSettings) {
                    window.presentationSettings = gameState.presentationSettings;
                    console.log('⚙️ Settings loaded:', window.presentationSettings);
                } else {
                    console.log('⚙️ No saved settings, using defaults');
                }
                
                if (gameState.slideTypeData) {
                    
                    // Update UI for current slide
                    console.log('🔄 Updating UI for current slide...');
                    
                    // First, make sure we have the current slide info
                    await getCurrentSlideNumber();
                    
                    // Then update the UI
                    loadSlideType();
                    console.log('✅ UI updated');
                    
                    // Reset auto-save mechanism after successful load
                    hasUnsavedChanges = false;
                    if (autoSaveTimer) {
                        clearTimeout(autoSaveTimer);
                        autoSaveTimer = null;
                    }
                    updateAutoSaveStatus('idle');
                    console.log('🔄 Auto-save mechanism reset after load');
                } else {
                    console.log('ℹ️ No slide type data in saved file');
                }
            } else {
                console.log('ℹ️ No saved data found');
            }
        } else {
            console.log('ℹ️ No saved data found (server returned error)');
        }
    } catch (error) {
        console.log('⚠️ Loading error:', error.message);
    }
}

// Log window info to console only
async function logWindowInfo() {
    try {
        const windowId = await getWindowId();
        console.log('📄 Window ID:', windowId);
    } catch (error) {
        console.log('Could not get window info:', error.message);
    }
}


// Helper functions for slide type data (supports both string and object format)
function getSlideType(slideId) {
    const data = window.slideTypeData[slideId];
    if (!data) return null;
    
    // If it's a string, return it directly (old format)
    if (typeof data === 'string') return data;
    
    // If it's an object, return the type property (new format)
    return data.type || null;
}

function setSlideType(slideId, slideType) {
    const existingData = window.slideTypeData[slideId];
    
    // If there's existing data as an object, preserve other properties
    if (existingData && typeof existingData === 'object') {
        window.slideTypeData[slideId] = {
            ...existingData,
            type: slideType
        };
    } else {
        // Otherwise, just set the string (simple format)
        window.slideTypeData[slideId] = slideType;
    }
}

function getSlideData(slideId) {
    const data = window.slideTypeData[slideId];
    if (!data) return null;
    
    // If it's a string, convert to object format
    if (typeof data === 'string') {
        return { type: data };
    }
    
    // Return the object as-is
    return data;
}

// Slide type management functions
function handleSlideTypeChange() {
    const slideType = document.getElementById('slideType').value;
    console.log(`🔄 Slide type changed to: ${slideType} for slide ${currentSlideNumber} (ID: ${currentSlideId})`);
    saveSlideType(slideType);
    updateUIForSlideType(slideType).catch(err => {
        console.error('❌ Error in updateUIForSlideType:', err);
    });
}

function saveSlideType(slideType) {
    if (!currentSlideId) {
        console.warn('⚠️ No slide ID available, cannot save slide type');
        console.warn('⚠️ This slide does not have a UUID yet. Slide type will not be saved.');
        return;
    }
    
    // Check if this slide already has a type
    const previousType = getSlideType(currentSlideId);
    const isUpdate = previousType !== undefined && previousType !== null;
    
    // IMPORTANT: Save by SLIDE ID (UUID), NOT by slide number!
    // This ensures slide types persist even if slides are reordered or moved.
    
    // Special handling for "question" type - create object with default correctAnswer
    if (slideType === 'question') {
        const existingData = window.slideTypeData[currentSlideId];
        
        // If it's a string or doesn't exist, create object with default answer
        if (!existingData || typeof existingData === 'string') {
            window.slideTypeData[currentSlideId] = {
                type: slideType,
                correctAnswer: '1'  // Default: תשובה 1
            };
            console.log('💾 Slide type SAVED with default answer: 1');
        } else {
            // Already an object, just update the type
            existingData.type = slideType;
        }
    } else {
        // For other slide types, use normal logic
        setSlideType(currentSlideId, slideType);
    }
    
    if (isUpdate) {
        console.log('🔄 Slide type UPDATED:');
        console.log('  Previous:', previousType);
        console.log('  New:', slideType);
    } else {
        console.log('💾 Slide type SAVED (new):', slideType);
    }
    
    console.log('🔑 For slide ID:', currentSlideId);
    console.log('📍 At position:', currentSlideNumber);
    console.log('📋 Total slides with types:', Object.keys(window.slideTypeData).length);
    console.log('📝 All slide types:', JSON.stringify(window.slideTypeData, null, 2));
    console.log(`סוג שקף עודכן: ${slideType}`);
    
    // Trigger auto-save mechanism
    triggerAutoSave();
}

function loadSlideType() {
    console.log('📖 loadSlideType() called');
    console.log('   currentSlideId:', currentSlideId);
    console.log('   currentSlideNumber:', currentSlideNumber);
    console.log('   window.slideTypeData:', JSON.stringify(window.slideTypeData, null, 2));
    
    if (!currentSlideId) {
        console.warn('⚠️ No slide ID available, using default slide type');
        console.warn('⚠️ This slide does not have a UUID yet. Using default type.');
        const slideTypeDropdown = document.getElementById('slideType');
        if (slideTypeDropdown) {
            slideTypeDropdown.value = 'transition';
            console.log('✅ Set dropdown to transition');
        } else {
            console.error('❌ slideType dropdown not found!');
        }
        updateUIForSlideType('transition').catch(err => {
            console.error('❌ Error in updateUIForSlideType:', err);
        });
        return;
    }
    
    // IMPORTANT: Load slide type by SLIDE ID (UUID), NOT by slide number!
    // This ensures we get the correct type even if slides were reordered.
    const slideType = getSlideType(currentSlideId) || 'transition'; // Default to transition
    const slideTypeDropdown = document.getElementById('slideType');
    
    if (slideTypeDropdown) {
        slideTypeDropdown.value = slideType;
        console.log('✅ Set dropdown to:', slideType);
    } else {
        console.error('❌ slideType dropdown not found!');
    }
    
    console.log('📖 Loading slide type...');
    console.log('🔑 Slide ID:', currentSlideId);
    console.log('📍 Position:', currentSlideNumber);
    console.log('📝 Type:', slideType);
    
    if (getSlideType(currentSlideId)) {
        console.log('✅ Found saved type for this slide');
    } else {
        console.log('ℹ️ No saved type found, using default (transition)');
    }
    
    console.log('🎯 Calling updateUIForSlideType with:', slideType);
    updateUIForSlideType(slideType).catch(err => {
        console.error('❌ Error in updateUIForSlideType:', err);
    });
}

// Update UI based on slide type - Load dynamic content
async function updateUIForSlideType(slideType) {
    console.log('🎨 updateUIForSlideType called with:', slideType);
    console.log('📍 Current location:', window.location.href);
    
    const slideContentArea = document.getElementById('slideContentArea');
    
    if (!slideContentArea) {
        console.error('❌ slideContentArea not found in DOM!');
        console.log('Available elements:', document.body.innerHTML);
        return;
    }
    
    console.log('✅ slideContentArea found');
    
    // Special case: transition type shows nothing
    if (slideType === 'transition') {
        console.log('🔄 Transition slide - showing empty content');
        slideContentArea.innerHTML = '';
        
        // Load shared actions in footer
        const sharedActionsContainer = document.getElementById('sharedActionsContainer');
        if (sharedActionsContainer) {
            const sharedPath = 'slide-types/shared-actions.html';
            let sharedHtml = '';
            if (htmlCache.has(sharedPath)) {
                console.log('💾 Using cached shared actions');
                sharedHtml = htmlCache.get(sharedPath);
            } else {
                console.log('📂 Loading shared actions...');
                const sharedResponse = await fetch(sharedPath);
                if (sharedResponse.ok) {
                    sharedHtml = await sharedResponse.text();
                    htmlCache.set(sharedPath, sharedHtml);
                }
            }
            sharedActionsContainer.innerHTML = sharedHtml;
            sharedActionsContainer.style.display = 'block';
        }
        
        // Show slide type control for transition
        const slideTypeControl = document.getElementById('slideTypeControl');
        if (slideTypeControl) {
            slideTypeControl.style.display = 'block';
        }
        
        console.log('✅ Transition slide UI loaded (empty content)');
        return;
    }
    
    // Map slide types to HTML files
    const slideTypeFiles = {
        'opening': 'opening.html',
        'question': 'question.html',
        'statistics': 'statistics.html',
        'leaderboard': 'leaderboard.html',
        'summary': 'summary.html',
        'settings': 'settings.html'  // Settings screen
    };
    
    const fileName = slideTypeFiles[slideType];
    if (!fileName) {
        console.error('❌ No file mapping for slide type:', slideType);
        return;
    }
    
    const filePath = `slide-types/${fileName}`;
    const fullUrl = new URL(filePath, window.location.href).href;
    
    try {
        console.log('📂 Attempting to load file...');
        console.log('   File name:', fileName);
        console.log('   Relative path:', filePath);
        console.log('   Full URL:', fullUrl);
        
        // OPTIMIZED: Check cache first (instant if preloaded!)
        let html;
        if (htmlCache.has(filePath)) {
            console.log('💾 Using cached HTML (instant load):', filePath);
            html = htmlCache.get(filePath);
        } else {
            // Show loading indicator only if not cached
            slideContentArea.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #0078d4;">
                    <div style="font-size: 48px; margin-bottom: 15px;">⏳</div>
                    <p>טוען ${slideType}...</p>
                </div>
            `;
            
            // Fetch the HTML file
            console.log('🌐 Fetching (not in cache):', filePath);
            const response = await fetch(filePath);
            
            console.log('📥 Fetch response:', {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                url: response.url
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            html = await response.text();
            console.log('📄 HTML received, length:', html.length);
            
            // Store in cache
            htmlCache.set(filePath, html);
            console.log('💾 Cached HTML for future use');
        }
        
        // Load slide-specific content into slideContentArea
        slideContentArea.innerHTML = html;
        
        // Load shared actions HTML into footer (except for settings screen)
        const sharedActionsContainer = document.getElementById('sharedActionsContainer');
        if (sharedActionsContainer) {
            if (slideType !== 'settings') {
                const sharedPath = 'slide-types/shared-actions.html';
                
                // OPTIMIZED: Check cache for shared actions too
                let sharedHtml = '';
                if (htmlCache.has(sharedPath)) {
                    console.log('💾 Using cached shared actions');
                    sharedHtml = htmlCache.get(sharedPath);
                } else {
                    console.log('📂 Loading shared actions...');
                    const sharedResponse = await fetch(sharedPath);
                    if (!sharedResponse.ok) {
                        throw new Error(`Failed to load shared actions: ${sharedResponse.status}`);
                    }
                    sharedHtml = await sharedResponse.text();
                    console.log('📄 Shared actions HTML received');
                    
                    // Store in cache
                    htmlCache.set(sharedPath, sharedHtml);
                    console.log('💾 Cached shared actions for future use');
                }
                
                sharedActionsContainer.innerHTML = sharedHtml;
                sharedActionsContainer.style.display = 'block';
            } else {
                console.log('⚙️ Settings screen - hiding shared actions');
                sharedActionsContainer.innerHTML = '';
                sharedActionsContainer.style.display = 'none';
            }
        }
        
        // IMPORTANT: Execute scripts in the loaded HTML (both content and footer)
        // Scripts in innerHTML are not executed automatically for security reasons
        
        // Execute scripts from slide content
        const contentScripts = slideContentArea.querySelectorAll('script');
        console.log(`📜 Found ${contentScripts.length} script(s) in slide content, executing...`);
        contentScripts.forEach((oldScript) => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
        
        // Execute scripts from shared actions (if any)
        if (sharedActionsContainer && slideType !== 'settings') {
            const footerScripts = sharedActionsContainer.querySelectorAll('script');
            if (footerScripts.length > 0) {
                console.log(`📜 Found ${footerScripts.length} script(s) in footer, executing...`);
                footerScripts.forEach((oldScript) => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => {
                        newScript.setAttribute(attr.name, attr.value);
                    });
                    newScript.textContent = oldScript.textContent;
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
            }
        }
        
        // Hide/Show slide type control based on current view
        const slideTypeControl = document.getElementById('slideTypeControl');
        if (slideTypeControl) {
            if (slideType === 'settings') {
                slideTypeControl.style.display = 'none';
                console.log('🔒 Slide type control hidden (settings mode)');
            } else {
                slideTypeControl.style.display = 'block';
                console.log('👁️ Slide type control visible');
            }
        }
        
        console.log('✅ UI loaded successfully for type:', slideType);
        
        // Update displayed values after loading new content
        updateDisplayedValues();
        
    } catch (error) {
        console.error('❌ Error loading slide type UI:');
        console.error('   Error type:', error.constructor.name);
        console.error('   Error message:', error.message);
        console.error('   Full error:', error);
        
        // Fallback to default
        slideContentArea.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #dc3545; direction: rtl;">
                <h3>❌ שגיאה בטעינת ממשק</h3>
                <p>לא ניתן לטעון את הממשק עבור סוג שקף: <strong>${slideType}</strong></p>
                <details style="margin-top: 15px; text-align: right; direction: rtl;">
                    <summary style="cursor: pointer; color: #6c757d;">פרטי שגיאה</summary>
                    <pre style="text-align: left; background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px; direction: ltr; overflow-x: auto;">
File: ${fileName}
Path: ${filePath}
URL: ${fullUrl}
Error: ${error.message}
                    </pre>
                </details>
            </div>
        `;
    }
}

// Update displayed values in the current UI
function updateDisplayedValues() {
    // Update Game ID
    const gameIdElements = document.querySelectorAll('[id^="gameId"]');
    gameIdElements.forEach(el => {
        if (window.gameId) el.textContent = window.gameId;
    });
    
    // Update user count
    const userCountEl = document.getElementById('userCount');
    if (userCountEl && window.currentUsers !== undefined) {
        userCountEl.textContent = window.currentUsers;
    }
    
    // Update time remaining
    const timeRemainingEl = document.getElementById('timeRemaining');
    if (timeRemainingEl && window.currentTime) {
        timeRemainingEl.textContent = window.currentTime + 's';
    }
    
    // Update current slide
    const currentSlideEl = document.getElementById('currentSlide');
    if (currentSlideEl && window.currentSlideNumber) {
        currentSlideEl.textContent = window.currentSlideNumber;
    }
}

// Start presentation mode
// Open settings screen
async function openSettings() {
    console.log('⚙️ Opening settings...');
    await updateUIForSlideType('settings');
}

// Close settings screen and return to current slide type
async function closeSettings() {
    console.log('⚙️ Closing settings...');
    // Reload the current slide type
    loadSlideType();
}

async function startPresentationMode() {
    console.log('🎮 Start game button clicked - fetching game info from server');
    
    try {
        // Get hash ID
        const hashId = await getGameHashId();
        
        if (!hashId) {
            showError('⚠️ שמור תחילה את המצגת לפני הפעלת המשחק');
            return;
        }
        
        console.log('✅ Hash ID:', hashId);
        
        // Fetch game info from server (including QR code URL)
        const response = await fetch(`${API_BASE}game-info/${hashId}`, {
            method: 'GET',
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch game info: ${response.status}`);
        }
        
        const gameInfo = await response.json();
        
        if (gameInfo.status !== 'success') {
            throw new Error(gameInfo.message || 'Failed to get game info');
        }
        
        console.log('✅ Game info received:', gameInfo);
        
        const adminUrl = gameInfo.adminUrl;
        const qrCodeUrl = `${API_BASE}${gameInfo.qrCodeUrl.substring(1)}`; // Remove leading /
        
        console.log('📍 Admin URL:', adminUrl);
        console.log('📸 QR Code URL:', qrCodeUrl);
        
        // Create start screen HTML
        const startScreenHtml = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 24px; font-weight: bold; color: #333; margin-bottom: 20px;">
                    🎮 התחל משחק
                </div>
                
                <div style="background: white; border: 2px solid #0078d4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="margin: 0 0 15px 0; color: #0078d4;">סרוק קוד QR לכניסה למשחק</h3>
                    
                    <div style="display: flex; justify-content: center; align-items: center; margin: 20px 0; min-height: 220px;">
                        <img src="${qrCodeUrl}" 
                             alt="QR Code" 
                             style="width: 220px; height: 220px; border: 3px solid #0078d4; border-radius: 8px; background: white; padding: 10px;"
                             onload="console.log('✅ QR code loaded')"
                             onerror="console.error('❌ QR code failed to load'); this.style.display='none'; this.parentElement.innerHTML = '<div style=color:#d13438>שגיאה בטעינת QR</div>';" />
                    </div>
                    
                    <div style="font-size: 16px; color: #605e5c; margin: 15px 0; line-height: 1.6;">
                        סרוק את הקוד עם מכשיר נייד או היכנס לכתובת:
                    </div>
                    
                    <div style="background-color: #f3f2f1; padding: 12px; border-radius: 4px; margin: 15px 0; font-family: monospace; font-size: 14px; word-break: break-all; color: #0078d4;">
                        ${adminUrl}
                    </div>
                </div>
                
                <div style="margin-top: 20px; font-size: 12px; color: #999;">
                    💡 המשתתפים יכולים להיכנס דרך הקוד או הכתובת
                </div>
            </div>
        `;
        
        // Replace the content area with start screen
        const contentArea = document.getElementById('slideContentArea');
        if (contentArea) {
            contentArea.innerHTML = startScreenHtml;
            console.log('✅ Start screen with QR code created successfully');
        } else {
            throw new Error('Content area not found');
        }
        
    } catch (error) {
        console.error('❌ Error creating start screen:', error);
        showError('שגיאה ביצירת מסך ההתחלה: ' + error.message);
    }
}

// Show statistics for answers
async function showStatistics() {
    console.log('📈 Show statistics - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

// Insert answer statistics chart
async function insertAnswerStats() {
    console.log('📊 Insert answer stats - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

// Show leaderboard
async function showLeaderboard() {
    console.log('🏆 Show leaderboard - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

// Insert leaderboard table
async function insertLeaderboardTable() {
    console.log('📋 Insert leaderboard table - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

// Show final results (summary)
async function showFinalResults() {
    console.log('🎯 Show final results - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

// Insert final leaderboard (summary)
async function insertFinalLeaderboard() {
    console.log('🏅 Insert final leaderboard - to be implemented');
    showError('פונקציה זו תבוצע בהמשך');
}

// End game
async function endGame() {
    console.log('🔚 End game');
    const confirmed = confirm('האם אתה בטוח שברצונך לסיים את המשחק?');
    if (confirmed) {
        try {
            // Send end game signal to server
            const response = await fetch(`${API_BASE_URL}/end-game`, {
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

// Insert Game ID button (dynamic)
async function insertGameIdButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Default game ID
                const gameId = '123-456';
                
                // Add a text box with game ID and dynamic tag
                const textBox = slide.shapes.addTextBox(gameId, {
                    left: 100,
                    top: 50,
                    width: 300,
                    height: 80
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for dynamic updates
                textBox.tags.add('kahoot-game-id', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                
                textRange.font.size = 32;
                textRange.font.color = '#667eea';
                textRange.font.bold = true;
                
                await context.sync();
                console.log('✅ Dynamic game ID added to slide');
                showError('✅ מזהה משחק נוסף לשקף!');
            }
        });
    } catch (error) {
        console.error('Error adding game ID:', error);
        showError('שגיאה בהוספת מזהה משחק');
    }
}

// Insert Participants Number button (dynamic)
async function insertParticipantsNumButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Default participants number
                const participantsNum = '99';
                
                // Add a text box with participant count and dynamic tag
                const textBox = slide.shapes.addTextBox(participantsNum, {
                    left: 100,
                    top: 150,
                    width: 250,
                    height: 60
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for dynamic updates
                textBox.tags.add('kahoot-participants-num', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                
                textRange.font.size = 24;
                textRange.font.color = '#0078d4';
                textRange.font.bold = true;
                
                await context.sync();
                console.log('✅ Dynamic participants number added to slide');
                showError('✅ מספר משתתפים נוסף לשקף!');
            }
        });
    } catch (error) {
        console.error('Error adding participants number:', error);
        showError('שגיאה בהוספת מספר המשתתפים');
    }
}

// Insert QR Code placeholder (dynamic - updates from server)
async function insertQrCodeButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length === 0) {
                showError('אנא בחר שקף תחילה');
                return;
            }
            
            const slide = slides.items[0];
            
            // QR code dimensions - standard size
            const qrSize = 200; // 200x200 points
            const qrLeft = 500; // Right side of slide
            const qrTop = 100;  // Top area
            
            // Create a placeholder shape with QR code tag
            const placeholder = slide.shapes.addTextBox('📱 QR Code\n\nיתעדכן בזמן המשחק', {
                left: qrLeft,
                top: qrTop,
                width: qrSize,
                height: qrSize
            });
            
            placeholder.load(['textFrame', 'tags']);
            await context.sync();
            
            // Add tag for dynamic updates
            placeholder.tags.add('kahoot-qr-code', 'true');
            await context.sync();
            
            // Style the text
            const textRange = placeholder.textFrame.textRange;
            textRange.load(['font']);
            await context.sync();
            
            textRange.font.size = 20;
            textRange.font.color = '#9b59b6';
            textRange.font.bold = true;
            
            await context.sync();
            
            // Try to style the placeholder (border and fill) - optional
            try {
                placeholder.load(['fill', 'line']);
                await context.sync();
                
                placeholder.fill.setSolidColor('#f0e6ff'); // Light purple background
                placeholder.line.color = '#9b59b6'; // Purple border
                placeholder.line.weight = 3;
                
                await context.sync();
                console.log('✅ Border and fill applied');
            } catch (styleError) {
                console.log('⚠️ Could not apply border/fill (not critical):', styleError.message);
            }
            
            console.log('✅ QR Code placeholder added to slide');
            console.log(`   Position: ${qrLeft}, ${qrTop}`);
            console.log(`   Size: ${qrSize} x ${qrSize}`);
            showError('✅ QR Code נוסף לשקף!');
        });
    } catch (error) {
        console.error('Error adding QR code placeholder:', error);
        showError('שגיאה בהוספת QR Code');
    }
}

// Show participants count in slide (dynamic)
async function showParticipantsCount() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Add a text box with participant count and dynamic tag
                const textBox = slide.shapes.addTextBox(`משתתפים: ${currentUsers}`, {
                    left: 50,
                    top: 50,
                    width: 200,
                    height: 50
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for dynamic updates
                textBox.tags.add('kahoot-participants-count', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                
                textRange.font.size = 24;
                textRange.font.color = '#0078d4';
                textRange.font.bold = true;
                
                await context.sync();
                console.log('✅ Dynamic participants count added to slide');
            }
        });
    } catch (error) {
        console.error('Error adding participants count:', error);
        showError('שגיאה בהוספת מספר המשתתפים');
    }
}

// Add question time element (for question slides)
async function addQuestionTime() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Add a text box with default time value
                const textBox = slide.shapes.addTextBox('30', {
                    left: 600,
                    top: 50,
                    width: 100,
                    height: 60
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for identification
                textBox.tags.add('kahoot-question-time', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font', 'paragraphFormat']);
                await context.sync();
                
                textRange.font.size = 36;
                textRange.font.color = '#667eea';
                textRange.font.bold = true;
                textRange.paragraphFormat.alignment = PowerPoint.ParagraphHorizontalAlignment.center;
                
                await context.sync();
                console.log('✅ Question time added to slide');
            }
        });
    } catch (error) {
        console.error('Error adding question time:', error);
        showError('שגיאה בהוספת זמן שאלה');
    }
}

// Add respondents count element (for question slides)
async function addRespondentsCount() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Add a text box with default respondents value
                const textBox = slide.shapes.addTextBox('99', {
                    left: 600,
                    top: 130,
                    width: 100,
                    height: 60
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for identification
                textBox.tags.add('kahoot-respondents-count', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font', 'paragraphFormat']);
                await context.sync();
                
                textRange.font.size = 36;
                textRange.font.color = '#f5576c';
                textRange.font.bold = true;
                textRange.paragraphFormat.alignment = PowerPoint.ParagraphHorizontalAlignment.center;
                
                await context.sync();
                console.log('✅ Respondents count added to slide');
            }
        });
    } catch (error) {
        console.error('Error adding respondents count:', error);
        showError('שגיאה בהוספת מספר עונים');
    }
}

// Add Statistics Image (dynamic - updates from server)
async function addStatisticsImage() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length === 0) {
                showError('אנא בחר שקף תחילה');
                return;
            }
            
            const slide = slides.items[0];
            
            // Standard PowerPoint slide: 720x540 points (4:3 aspect ratio)
            // For 16:9: 960x540
            // We'll use relative positioning that works for both
            
            // Image dimensions: 70% of slide width, positioned in lower 2/3
            const slideWidth = 720;  // Standard width
            const slideHeight = 540; // Standard height
            
            const imageWidth = slideWidth * 0.7;  // 504 points
            const imageHeight = slideHeight * 0.6; // 324 points (2/3 of slide minus margin)
            
            // Position: centered horizontally, in lower 2/3 vertically
            const imageLeft = (slideWidth - imageWidth) / 2; // Centered: ~108
            const imageTop = slideHeight / 3; // Start at 1/3 down: 180
            
            // Create a placeholder shape with the statistics tag
            const placeholder = slide.shapes.addTextBox('📊 תמונת סטטיסטיקה\n\nתמונה זו תתעדכן אוטומטית\nעם נתונים מהשרת', {
                left: imageLeft,
                top: imageTop,
                width: imageWidth,
                height: imageHeight
            });
            
            placeholder.load(['textFrame', 'tags', 'fill', 'line']);
            await context.sync();
            
            // Add tag for dynamic updates
            placeholder.tags.add('kahoot-statistics-image', 'true');
            
            // Style the placeholder
            try {
                placeholder.fill.setSolidColor('#e8f4f8'); // Light blue background
                placeholder.line.color = '#0078d4'; // Blue border
                placeholder.line.weight = 2;
                placeholder.line.dashStyle = 'Dash'; // Dashed border to show it's a placeholder
            } catch (styleError) {
                console.log('Could not apply all styles:', styleError);
            }
            
            // Style the text
            const textRange = placeholder.textFrame.textRange;
            textRange.load(['font', 'paragraphFormat']);
            await context.sync();
            
            textRange.font.size = 24;
            textRange.font.color = '#0078d4';
            textRange.font.bold = true;
            textRange.paragraphFormat.alignment = PowerPoint.ParagraphAlignment.center;
            
            await context.sync();
            
            console.log('✅ Statistics image placeholder added to slide');
            console.log(`   Position: ${imageLeft}, ${imageTop}`);
            console.log(`   Size: ${imageWidth} x ${imageHeight}`);
            showError('✅ תמונת סטטיסטיקה נוספה לשקף!');
        });
    } catch (error) {
        console.error('Error adding statistics image:', error);
        showError('שגיאה בהוספת תמונת סטטיסטיקה');
    }
}

// Update Statistics Images (finds by tag and updates from server)
async function updateStatisticsImages() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log('🔍 Searching for statistics images to update...');
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    // Check if this is a statistics image
                    let isStatisticsImage = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        if (tag.key === 'kahoot-statistics-image' && tag.value === 'true') {
                            isStatisticsImage = true;
                            break;
                        }
                    }
                    
                    if (isStatisticsImage) {
                        console.log('📊 Found statistics image, updating...');
                        
                        // TODO: Fetch image from server
                        // For now, update the placeholder text to show it's "updating"
                        shape.load(['textFrame']);
                        await context.sync();
                        
                        const textRange = shape.textFrame.textRange;
                        textRange.text = `📊 תמונת סטטיסטיקה\n\n🔄 מתעדכן...\n\n${new Date().toLocaleTimeString('he-IL')}`;
                        
                        await context.sync();
                        console.log('✅ Statistics image updated');
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating statistics images:', error);
    }
}

// Insert participants display into slide
async function insertParticipantsDisplay() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Add Game PIN
                const gameId = document.getElementById('gameId').textContent || 
                              document.getElementById('gameIdOpening').textContent || 
                              '528 8478';
                
                const gamePinBox = slide.shapes.addTextBox(`Game PIN: ${gameId}`, {
                    left: 100,
                    top: 50,
                    width: 400,
                    height: 80
                });
                
                // Load text properties and sync before accessing
                gamePinBox.load(['textFrame']);
                await context.sync();
                
                const gamePinText = gamePinBox.textFrame.textRange;
                gamePinText.load(['font', 'paragraphFormat']);
                await context.sync();
                
                gamePinText.font.size = 32;
                gamePinText.font.bold = true;
                
                // Add participants title
                const titleBox = slide.shapes.addTextBox('משתתפים פעילים', {
                    left: 100,
                    top: 150,
                    width: 400,
                    height: 50
                });
                
                titleBox.load(['textFrame']);
                await context.sync();
                
                const titleText = titleBox.textFrame.textRange;
                titleText.load(['font', 'paragraphFormat']);
                await context.sync();
                
                titleText.font.size = 24;
                titleText.font.bold = true;
                
                // Add participant names in a grid-like layout
                const participants = ['Joe', 'Ttt', 'moshe', 'Sarah', 'David', 'Lisa', 'Alex'];
                const participantBoxes = [];
                
                for (let i = 0; i < participants.length; i++) {
                    const name = participants[i];
                    const row = Math.floor(i / 3);
                    const col = i % 3;
                    const x = 50 + (col * 200);
                    const y = 220 + (row * 80);
                    
                    const participantBox = slide.shapes.addTextBox(`👤 ${name}`, {
                        left: x,
                        top: y,
                        width: 180,
                        height: 60
                    });
                    
                    participantBoxes.push(participantBox);
                }
                
                // Load all participant boxes
                participantBoxes.forEach(box => {
                    box.load(['textFrame']);
                });
                await context.sync();
                
                // Set text formatting for all participant boxes
                participantBoxes.forEach(box => {
                    const textRange = box.textFrame.textRange;
                    textRange.load(['font']);
                    textRange.font.size = 18;
                });
                
                await context.sync();
                console.log('✅ Participants display added to slide');
            }
        });
    } catch (error) {
        console.error('Error inserting participants display:', error);
        showError('שגיאה בהכנסת תצוגת המשתתפים');
    }
}


// Note: Hash creation is now done by the server for security and consistency
// The client only sends the full path, and the server generates the hash ID

// Get presentation file path info
async function getPresentationFileInfo() {
    try {
        console.log('🔍 Attempting to get presentation file info...');
        console.log('🔍 Office.context.document exists?', !!Office.context.document);
        
        // METHOD 1: Try to get the file URL which contains the full path
        if (Office.context.document && Office.context.document.url) {
            const url = Office.context.document.url;
            console.log('📄 Full document URL:', url);
            
            // VALIDATION: Check if URL is not empty and contains a valid file path
            if (!url || url.trim() === '') {
                console.log('⚠️ URL is empty or whitespace only');
                // Continue to fallback method below
            } else {
                // Decode the URL
                const decodedUrl = decodeURIComponent(url);
                console.log('📄 Decoded URL:', decodedUrl);
                
                // VALIDATION: Check if this is a proper file path
                // For Windows: should contain drive letter (C:\) or UNC path (\\server\)
                // For macOS/Linux: should start with /
                // For URLs: should be a full file:/// or http(s):// URL
                const isValidPath = 
                    decodedUrl.match(/^[a-zA-Z]:[\\\/]/) ||  // Windows drive (C:\ or C:/)
                    decodedUrl.match(/^\\\\/) ||              // UNC path (\\server\share)
                    decodedUrl.match(/^\//) ||                // Unix path (/)
                    decodedUrl.match(/^file:\/\/\//) ||       // File URL (file:///)
                    decodedUrl.match(/^https?:\/\//);         // HTTP(S) URL
                
                if (isValidPath) {
                    // Extract just the filename for display purposes
                    let fileName = url;
                    
                    // Try forward slashes first
                    if (url.includes('/')) {
                        const parts = url.split('/');
                        fileName = parts[parts.length - 1];
                    }
                    
                    // If still contains backslashes, split by them
                    if (fileName.includes('\\')) {
                        const parts = fileName.split('\\');
                        fileName = parts[parts.length - 1];
                    }
                    
                    const decodedFileName = decodeURIComponent(fileName);
                    const displayName = decodedFileName.replace(/\.pptx?$/i, '');
                    
                    // VALIDATION: Check if display name is not empty or just whitespace
                    if (displayName && displayName.trim() !== '') {
                        console.log('✅ Method 1 (URL): Success');
                        console.log('📄 Display name:', displayName);
                        console.log('📁 Full path will be sent to server:', decodedUrl);
                        console.log('🔑 Server will generate hash ID from path');
                        
                        return {
                            fullPath: decodedUrl,     // The full path (server will create hash)
                            displayName: displayName  // Just the filename (for display)
                        };
                    } else {
                        console.log('⚠️ Display name is empty after processing');
                    }
                } else {
                    console.log('⚠️ URL does not contain a valid file path:', decodedUrl);
                }
            }
        }
        
        console.log('⚠️ Method 1 (URL) failed, trying Method 2 (getFilePropertiesAsync)...');
        
        // METHOD 2: Try getFilePropertiesAsync as fallback
        // This works in some scenarios where URL is not available
        return await new Promise((resolve, reject) => {
            Office.context.document.getFilePropertiesAsync((result) => {
                if (result.status === Office.AsyncResultStatus.Succeeded) {
                    const fileUrl = result.value.url;
                    console.log('📄 getFilePropertiesAsync URL:', fileUrl);
                    
                    if (fileUrl && fileUrl.trim() !== '') {
                        const decodedUrl = decodeURIComponent(fileUrl);
                        
                        // Extract filename
                        let fileName = fileUrl;
                        if (fileUrl.includes('/')) {
                            const parts = fileUrl.split('/');
                            fileName = parts[parts.length - 1];
                        }
                        if (fileName.includes('\\')) {
                            const parts = fileName.split('\\');
                            fileName = parts[parts.length - 1];
                        }
                        
                        const decodedFileName = decodeURIComponent(fileName);
                        const displayName = decodedFileName.replace(/\.pptx?$/i, '');
                        
                        if (displayName && displayName.trim() !== '') {
                            console.log('✅ Method 2 (getFilePropertiesAsync): Success');
                            console.log('📄 Display name:', displayName);
                            console.log('📁 Full path will be sent to server:', decodedUrl);
                            
                            resolve({
                                fullPath: decodedUrl,
                                displayName: displayName
                            });
                            return;
                        }
                    }
                }
                
                console.log('⚠️ Method 2 failed or returned invalid data');
                console.log('⚠️ File may not be saved yet or is in OneDrive/SharePoint');
                console.log('💡 Tip: Try saving the file to your local disk (C:\\ drive)');
                resolve(null);
            });
        });
        
    } catch (error) {
        console.error('❌ Error getting file info:', error);
        console.error('❌ Error stack:', error.stack);
        return null;
    }
}

// Check if presentation is saved (has a file path)
async function getPresentationFileName() {
    const info = await getPresentationFileInfo();
    return info ? info.fullPath : null;
}

// Create hash from path (client-side implementation)
function createHashFromPath(path) {
    try {
        console.log('🔑 Creating hash from path:', path);
        
        // VALIDATION: Check if path exists and is not empty/whitespace
        if (!path || typeof path !== 'string' || path.trim() === '') {
            console.warn('⚠️ Invalid path: empty or not a string');
            return null;
        }
        
        // VALIDATION: Check if this looks like a valid file path
        const isValidPath = 
            /^[a-zA-Z]:[\\\/]/.test(path) ||  // Windows drive (C:\ or C:/)
            /^\\\\/.test(path) ||              // UNC path (\\server\share)
            /^\//.test(path) ||                // Unix path (/)
            /^file:\/\/\//.test(path) ||       // File URL (file:///)
            /^https?:\/\//.test(path);         // HTTP(S) URL
        
        if (!isValidPath) {
            console.warn('⚠️ Invalid path format:', path);
            return null;
        }
        
        // VALIDATION: Check path length
        if (path.length < 3 || path.length > 1000) {
            console.warn('⚠️ Path length out of range:', path.length);
            return null;
        }
        
        // Normalize the path (lowercase for consistency)
        let normalizedPath = path.toLowerCase();
        
        // Replace backslashes with forward slashes for consistency
        normalizedPath = normalizedPath.replace(/\\/g, '/');
        
        // Create SHA-256 hash using Web Crypto API
        const encoder = new TextEncoder();
        const data = encoder.encode(normalizedPath);
        
        // Simple hash implementation (SHA-256 equivalent)
        // Using a synchronous hash for simplicity
        let hash = 0;
        for (let i = 0; i < normalizedPath.length; i++) {
            const char = normalizedPath.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Convert to hex and take first 12 characters
        const hashHex = Math.abs(hash).toString(16).padStart(12, '0').substring(0, 12);
        
        console.log('✅ Generated hash ID:', hashHex);
        return hashHex;
        
    } catch (error) {
        console.error('❌ Error creating hash:', error);
        return null;
    }
}

// Get the game hash ID (now generated client-side)
async function getGameHashId() {
    try {
        console.log('🔑 Getting game hash ID...');
        
        // Get presentation file info
        const fileInfo = await getPresentationFileInfo();
        
        if (!fileInfo || !fileInfo.fullPath) {
            console.log('⚠️ Presentation not saved yet - no hash ID available');
            return null;
        }
        
        console.log('📁 Full path:', fileInfo.fullPath);
        
        // Generate hash client-side
        const hashId = createHashFromPath(fileInfo.fullPath);
        
        if (hashId) {
            console.log('✅ Hash ID generated client-side:', hashId);
        } else {
            console.error('❌ Failed to generate hash ID');
        }
        
        return hashId;
        
    } catch (error) {
        console.error('❌ Error getting hash ID:', error);
        return null;
    }
}

// Check if presentation is saved (has a file name)
async function isPresentationSaved() {
    try {
        const fileName = await getPresentationFileName();
        // File is considered saved if we have a valid file name (any name is OK, including "Presentation1")
        const isSaved = fileName !== null && fileName !== '' && fileName.length > 0;
        console.log('💾 Is presentation saved?', isSaved, '(filename:', fileName, ')');
        return isSaved;
    } catch (error) {
        console.error('Error checking if presentation is saved:', error);
        return false;
    }
}

// Get Window ID (presentation file name for saved files)
async function getWindowId() {
    try {
        // First, try to get the file name (for saved presentations)
        const fileName = await getPresentationFileName();
        
        if (fileName && fileName !== '' && fileName.length > 0) {
            // File is saved, use file name as ID (any valid file name is OK)
            console.log('✅ Using saved file name as ID:', fileName);
            return fileName;
        }
        
        // File is not saved - return null to indicate this
        console.log('⚠️ File is not saved yet (no valid file name)');
        return null;
        
    } catch (error) {
        console.error('Error getting window ID:', error);
        return null;
    }
}

// Trigger auto-save mechanism
// HOW IT WORKS:
// - Each change triggers this function
// - If a timer is already running, it gets cleared and restarted
// - This creates a "debounce" effect - saves after delay of NO changes (currently: immediate for debug)
// - Example: Change 1 → timer starts (10s) → Change 2 at 5s → timer resets (10s) → etc.
function triggerAutoSave() {
    console.log('🔄 Change detected, triggering auto-save mechanism...');
    
    // Mark that we have unsaved changes
    hasUnsavedChanges = true;
    
    // Show auto-save indicator
    updateAutoSaveStatus('pending');
    
    // Clear existing timer if any (this creates the "accumulate changes" behavior)
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        console.log('⏱️ Existing auto-save timer cleared - resetting');
    }
    
    // Start new timer (delay before saving - currently 0 for debug)
    autoSaveTimer = setTimeout(async () => {
        console.log('⏰ Auto-save timer completed, saving now...');
        await performAutoSave();
    }, AUTO_SAVE_DELAY);
    
    if (AUTO_SAVE_DELAY === 0) {
        console.log(`⏱️ Auto-save: IMMEDIATE (debug mode)`);
    } else {
        console.log(`⏱️ Auto-save timer started/reset (${AUTO_SAVE_DELAY / 1000} seconds)`);
    }
}

// Make triggerAutoSave accessible globally for slide-type HTML files
window.markUnsavedChanges = function() {
    triggerAutoSave();
};

// Make these functions accessible globally for slide-type HTML files
window.getPresentationFileInfo = getPresentationFileInfo;
window.getGameHashId = getGameHashId;

// Perform the actual auto-save
async function performAutoSave() {
    if (!hasUnsavedChanges) {
        console.log('ℹ️ No unsaved changes, skipping auto-save');
        return;
    }
    
    console.log('💾 Performing auto-save...');
    
    // Check if presentation is saved (has a file name)
    const isSaved = await isPresentationSaved();
    
    if (!isSaved) {
        console.log('⏳ Presentation not saved yet - will retry when file has a name');
        updateAutoSaveStatus('waiting');
        
        // Keep checking until file is saved
        if (hasUnsavedChanges) {
            console.log(`🔄 Will check again in ${AUTO_SAVE_DELAY / 1000} seconds if file is saved...`);
            autoSaveTimer = setTimeout(async () => {
                await performAutoSave();
            }, AUTO_SAVE_DELAY);
        }
        return;
    }
    
    updateAutoSaveStatus('saving');
    
    try {
        // Use the existing save function
        await savePresentationData(true); // true = silent mode (no UI alerts)
        
        // Reset state
        hasUnsavedChanges = false;
        autoSaveTimer = null;
        
        updateAutoSaveStatus('saved');
        console.log('✅ Auto-save completed successfully');
        
        // Hide status after 3 seconds
        setTimeout(() => {
            updateAutoSaveStatus('idle');
        }, 3000);
        
    } catch (error) {
        console.error('❌ Auto-save failed:', error);
        updateAutoSaveStatus('error');
        
        // Reset timer to retry
        if (hasUnsavedChanges) {
            console.log(`🔄 Retrying auto-save in ${AUTO_SAVE_DELAY / 1000} seconds...`);
            autoSaveTimer = setTimeout(async () => {
                await performAutoSave();
            }, AUTO_SAVE_DELAY);
        }
    }
}

// Update auto-save status indicator
function updateAutoSaveStatus(status) {
    const statusElement = document.getElementById('autoSaveStatus');
    if (!statusElement) return;
    
    switch (status) {
        case 'pending':
            statusElement.textContent = '⏱️ שינויים ממתינים לשמירה...';
            statusElement.style.color = '#ffc107';
            statusElement.style.display = 'block';
            break;
        case 'waiting':
            statusElement.textContent = '⏳ ממתין לשמירת הקובץ (Save As)...';
            statusElement.style.color = '#ff9800';
            statusElement.style.display = 'block';
            break;
        case 'saving':
            statusElement.textContent = '💾 שומר...';
            statusElement.style.color = '#0078d4';
            statusElement.style.display = 'block';
            break;
        case 'saved':
            statusElement.textContent = '✅ נשמר אוטומטית';
            statusElement.style.color = '#28a745';
            statusElement.style.display = 'block';
            break;
        case 'error':
            statusElement.textContent = '❌ שגיאה בשמירה';
            statusElement.style.color = '#dc3545';
            statusElement.style.display = 'block';
            break;
        case 'idle':
        default:
            statusElement.style.display = 'none';
            break;
    }
}

// Save presentation data function
async function savePresentationData(silentMode = false) {
    try {
        console.log('🚀 Starting save process...');
        
        // CRITICAL: Check if presentation is saved first
        const isSaved = await isPresentationSaved();
        
        if (!isSaved) {
            console.error('❌ Cannot save - presentation is not saved to disk');
            if (!silentMode) {
                showError('⚠️ שמור תחילה את המצגת (Save As) לפני שמירת הנתונים!');
            }
            return;
        }
        
        // Get file info (full path + display name)
        const fileInfo = await getPresentationFileInfo();
        
        if (!fileInfo || !fileInfo.fullPath) {
            console.log('🚫 Could not get file info');
            if (!silentMode) {
                showError('⚠️ שמור תחילה את המצגת (Save As) לפני שמירת הנתונים!');
            }
            return;
        }
        
        console.log('✅ Presentation is saved');
        console.log('📄 Display name:', fileInfo.displayName);
        console.log('📁 Full path:', fileInfo.fullPath);
        
        // Generate hash ID client-side
        const hashId = createHashFromPath(fileInfo.fullPath);
        
        if (!hashId) {
            console.error('❌ Failed to generate hash ID');
            if (!silentMode) {
                showError('⚠️ שגיאה ביצירת מזהה ייחודי למצגת');
            }
            return;
        }
        
        console.log('🔑 Generated hash ID:', hashId);
        
        // NOTE: window.slideTypeData is stored by slide ID (UUID), NOT by slide number!
        // This ensures that slide types persist even if slides are reordered.
        const gameState = {
            initialized: isInitialized,
            currentUsers: currentUsers,
            currentTime: currentTime,
            timerActive: timerActive,
            localTimerRemaining: localTimerRemaining,
            slideTypeData: window.slideTypeData,  // Keyed by slide UUID
            presentationSettings: window.presentationSettings  // Presentation-wide settings
        };
        
        const dataToSave = {
            hashId: hashId,  // Send hash directly
            data: {
                presentationPath: fileInfo.fullPath,  // Full path of PPTX (for reference only)
                presentationName: fileInfo.displayName,  // Display name
                savedAt: new Date().toISOString(),
                gameState: gameState
            }
        };
        
        const slideIds = Object.keys(window.slideTypeData);
        console.log('💾 Saving data');
        console.log('📁 Presentation path:', fileInfo.fullPath);
        console.log('📄 Presentation name:', fileInfo.displayName);
        console.log('📋 Slide types to save:', slideIds.length);
        console.log('🔑 Slide IDs:', slideIds);
        console.log('📝 Slide type data:', JSON.stringify(window.slideTypeData, null, 2));
        
        const response = await fetch(API_BASE + 'save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSave)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Presentation data saved successfully to server');
            console.log('🔑 Server generated hash ID:', result.hashId);
            console.log('📄 Saved to file:', result.file);
            
            if (!silentMode) {
                showError(`✅ הנתונים נשמרו בהצלחה!\n🔑 Hash ID: ${result.hashId}`);
                setTimeout(() => {
                    const errorElement = document.getElementById('errorMessage');
                    if (errorElement) {
                        errorElement.style.display = 'none';
                    }
                }, 3000);
            }
        } else {
            console.error('❌ Failed to save presentation data');
            if (!silentMode) {
                showError('שגיאה בשמירת נתונים');
            }
            throw new Error('Failed to save presentation data');
        }
    } catch (error) {
        console.error('❌ Error saving presentation data:', error);
        if (!silentMode) {
            showError('שגיאה בשמירת נתונים: ' + error.message);
        }
        throw error; // Re-throw for auto-save retry mechanism
    }
}

