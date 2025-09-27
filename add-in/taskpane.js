/* global Office */

console.log('📄 taskpane.js loaded!');

let isInitialized = false;
let autoUpdateInterval = null;
let slideCheckInterval = null;
let currentUsers = 0;
let currentTime = '';
let currentSlideNumber = 1;
let slideTypeData = {}; // Store slide type for each slide number

// Make variables globally accessible for commands
window.currentUsers = currentUsers;
window.currentTime = currentTime;
window.currentSlideNumber = currentSlideNumber;
let socket = null;
let timerActive = false;
let localTimerInterval = null;
let localTimerRemaining = 0;

// Clear any cached data
localStorage.clear();
sessionStorage.clear();

// Initialize the add-in when Office is ready
Office.onReady((info) => {
    console.log('🚀 Office.onReady called!', info);
    if (info.host === Office.HostType.PowerPoint) {
        console.log('✅ PowerPoint detected - initializing add-in...');
        document.getElementById('initButton').onclick = initializeQuiz;
        document.getElementById('startTimerButton').onclick = startTimer;
        document.getElementById('stopTimerButton').onclick = stopTimer;
        document.getElementById('saveButton').onclick = savePresentationData;
        
        
        // Set up slide type selection event handler
        document.getElementById('slideType').onchange = handleSlideTypeChange;
        
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
        
        console.log('🎯 Kahoot Quiz Manager Add-in initialized - VERSION 3.0 (FORCE RELOAD!)');
        console.log('🔗 All event handlers attached');
        console.log('📡 Starting slide monitoring and event listeners...');
        
         // Version loaded - logged to console only
         console.log('🔄 Add-in loaded - VERSION 3.0');
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
        
        // Display game ID
        document.getElementById('gameId').textContent = response.game_id;
        
         console.log('המשחק אותחל בהצלחה!');
        isInitialized = true;
        
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
async function getCurrentSlideNumber() {
    try {
        await PowerPoint.run(async (context) => {
            console.log('🔍 Getting current slide...');
            
            // Get selected slide (simple approach)
            const selectedSlides = context.presentation.getSelectedSlides();
            selectedSlides.load('items');
            await context.sync();
            
            console.log('🔍 Selected slides count:', selectedSlides.items?.length || 0);
            
            if (selectedSlides.items && selectedSlides.items.length > 0) {
                // Get all slides to find the index
                const allSlides = context.presentation.slides;
                allSlides.load('items');
                const selectedSlide = selectedSlides.items[0];
                selectedSlide.load('id');
                await context.sync();
                
                console.log('🔍 Total slides:', allSlides.items.length);
                console.log('🔍 Selected slide ID:', selectedSlide.id);
                
                // Load IDs for all slides
                for (let i = 0; i < allSlides.items.length; i++) {
                    allSlides.items[i].load('id');
                }
                await context.sync();
                
                // Find matching slide
                for (let i = 0; i < allSlides.items.length; i++) {
                    if (allSlides.items[i].id === selectedSlide.id) {
                        currentSlideNumber = i + 1;
                        console.log(`✅ Found slide at position ${i + 1}`);
                        break;
                    }
                }
            } else {
                console.log('⚠️ No selected slides found, using fallback');
                currentSlideNumber = 1; // Fallback
            }
            
            // Update UI
            window.currentSlideNumber = currentSlideNumber;
            const slideElement = document.getElementById('currentSlide');
            if (slideElement) {
                slideElement.textContent = currentSlideNumber;
            }
            
            console.log(`📄 Final current slide number: ${currentSlideNumber}`);
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
async function onSlideChanged(eventArgs) {
    console.log('🔄 EVENT TRIGGERED: שקף השתנה!', eventArgs);
    console.log('🔍 Current slide before check:', currentSlideNumber);
    
    try {
        // קבל את השקף הנוכחי
        await PowerPoint.run(async (context) => {
            const selectedSlides = context.presentation.getSelectedSlides();
            selectedSlides.load('items');
            await context.sync();
            
            if (selectedSlides.items && selectedSlides.items.length > 0) {
                const currentSlide = selectedSlides.items[0];
                currentSlide.load('id');
                await context.sync();
                
                // Get all slides to find the index
                const allSlides = context.presentation.slides;
                allSlides.load('items');
                await context.sync();
                
                // Load IDs for all slides
                for (let i = 0; i < allSlides.items.length; i++) {
                    allSlides.items[i].load('id');
                }
                await context.sync();
                
                // Find the slide number
                let newSlideNumber = 1;
                for (let i = 0; i < allSlides.items.length; i++) {
                    if (allSlides.items[i].id === currentSlide.id) {
                        newSlideNumber = i + 1;
                        break;
                    }
                }
                
                console.log(`🔍 Detected slide number: ${newSlideNumber}, Current: ${currentSlideNumber}`);
                
                // Only update if slide actually changed
                if (newSlideNumber !== currentSlideNumber) {
                    const oldSlideNumber = currentSlideNumber;
                    currentSlideNumber = newSlideNumber;
                    window.currentSlideNumber = currentSlideNumber;
                    
                    // Update UI
                    const slideElement = document.getElementById('currentSlide');
                    if (slideElement) {
                        slideElement.textContent = currentSlideNumber;
                    }
                    
                     console.log(`✅ SLIDE CHANGED: ${oldSlideNumber} → ${currentSlideNumber}`);
                    
                    // Load slide type for new slide
                    loadSlideType();
                    
                    // No auto-save - only save when user changes slide type manually
                } else {
                    console.log('🔍 No slide change detected');
                }
            }
        });
    } catch (error) {
        console.error('Error handling slide change:', error);
        // Fallback to simple detection
        await getCurrentSlideNumber();
    }
}


function initializeWebSocket() { console.log('initializeWebSocket called'); }

// Load presentation data function
async function loadPresentationData() {
    try {
        // Get document URL using getFilePropertiesAsync
        const url = await new Promise((resolve, reject) => {
            Office.context.document.getFilePropertiesAsync((result) => {
                if (result.status === Office.AsyncResultStatus.Succeeded) {
                    resolve(result.value.url);
                } else {
                    resolve(null);
                }
            });
        });
        
        // If no URL or temporary file - skip loading
        if (!url || url.includes('\\Temp\\') || url.includes('/Temp/') || url.includes('AppData\\Local\\Temp')) {
            console.log('📋 No valid URL for loading - skipping');
            return;
        }
        
        console.log('📂 Loading data for:', url);
        
        // Generate file ID and load
        const fileId = generateFileId(url);
        
        const response = await fetch(API_BASE + 'load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: fileId })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.status === 'success' && result.data.gameState) {
                const gameState = result.data.gameState;
                
                // Restore slide type data
                if (gameState.slideTypeData) {
                    slideTypeData = gameState.slideTypeData;
                    console.log('✅ Data loaded - slides:', Object.keys(slideTypeData).length);
                }
            } else {
                console.log('ℹ️ No saved data found');
            }
        } else {
            console.log('ℹ️ No saved data found');
        }
    } catch (error) {
        console.log('Loading error:', error.message);
    }
}

// Log document info to console only
function logDocumentInfo() {
    try {
        let url = Office.context.document.url;
        console.log('Document URL status:', url ? 'Available' : 'Not available');
        
        if (url) {
            const urlParts = url.split(/[/\\]/);
            const filename = urlParts[urlParts.length - 1].split('?')[0] || 'presentation.pptx';
            const fileId = generateFileId(url);
            
            console.log('📄 Document info - File:', filename, 'ID:', fileId);
        } else {
            console.log('📄 Document info - No URL available (unsaved presentation)');
        }
    } catch (error) {
        console.log('Could not get document info:', error.message);
    }
}


// Slide type management functions
function handleSlideTypeChange() {
    const slideType = document.getElementById('slideType').value;
    console.log(`🔄 Slide type changed to: ${slideType} for slide ${currentSlideNumber}`);
    saveSlideType(slideType);
}

function saveSlideType(slideType) {
    slideTypeData[currentSlideNumber] = slideType;
    console.log('💾 Slide type set:', slideType, 'for slide:', currentSlideNumber);
    console.log('📋 Current slideTypeData:', slideTypeData);
     // Note: Data is stored in memory. Use "💾 שמור נתונים" button to save to server
     console.log(`סוג שקף עודכן: ${slideType}`);
}

function loadSlideType() {
    // Load slide type for current slide
    const slideType = slideTypeData[currentSlideNumber] || 'מעבר'; // Default to מעבר
    document.getElementById('slideType').value = slideType;
    console.log(`Loaded slide type: ${slideType} for slide ${currentSlideNumber}`);
}


// Generate a consistent hash-based file ID from URL
function generateFileId(url) {
    console.log('Generating hash for URL:', url);
    
    // Simple but consistent hash function
    let hash = 0;
    const str = url.toLowerCase();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    const fileId = Math.abs(hash).toString();
    console.log('Generated file ID:', fileId);
    return fileId;
}

// Save presentation data function
async function savePresentationData() {
    try {
        console.log('🚀 Starting save process - checking document URL...');
        
        await PowerPoint.run(async (context) => {
            // Function to get fresh URL using getFilePropertiesAsync
            const getFreshUrl = async () => {
                console.log('🔄 Trying getFilePropertiesAsync method...');
                
                // Method 1: Try getFilePropertiesAsync
                try {
                    const freshUrl = await new Promise((resolve, reject) => {
                        Office.context.document.getFilePropertiesAsync((result) => {
                            if (result.status === Office.AsyncResultStatus.Succeeded) {
                                const url = result.value.url;
                                console.log('✅ Fresh URL from getFilePropertiesAsync:', url);
                                resolve(url);
                            } else {
                                console.log('❌ getFilePropertiesAsync failed:', result.error);
                                reject(result.error);
                            }
                        });
                    });
                    
                    if (freshUrl) {
                        console.log('🎯 Using fresh URL from properties:', freshUrl);
                        return freshUrl;
                    }
                } catch (e) {
                    console.log('getFilePropertiesAsync method failed:', e.message);
                }
                
                // Method 2: Fallback to standard Office URL
                const fallbackUrl = Office.context.document.url;
                console.log('📋 Fallback to standard URL:', fallbackUrl);
                
                // Method 3: Try with fresh PowerPoint context as last resort
                try {
                    await PowerPoint.run(async (freshContext) => {
                        console.log('🆕 Trying fresh PowerPoint context...');
                        
                        const freshProperties = freshContext.document.properties;
                        freshProperties.load(['title']);
                        await freshContext.sync();
                        
                        console.log('Fresh context title:', freshProperties.title);
                    });
                } catch (e) {
                    console.log('Fresh PowerPoint context failed:', e.message);
                }
                
                return fallbackUrl;
            };
            
            // Function to check if URL is valid (not empty and not temporary)
            const isValidUrl = (url) => {
                if (!url || url.trim() === '') {
                    return false;
                }
                if (url.includes('\\Temp\\') || url.includes('/Temp/') || url.includes('AppData\\Local\\Temp') || url.includes('synthetic') || url.includes('unsaved')) {
                    return false;
                }
                return true;
            };
            
            // Single URL check
            const url = await getFreshUrl();
            console.log(`📋 Current URL: ${url}`);
            
            if (!isValidUrl(url)) {
                console.log('🚫 Document has not been saved to disk or URL is temporary');
                showError('יש לשמור את המצגת לדיסק תחילה לפני שמירת נתוני JSON');
                return;
            }
            
            console.log('✅ URL is valid - proceeding with save');
            
            // Generate file ID from URL hash
            const fileId = generateFileId(url);
            
            // Extract filename from URL for display
            const urlParts = url.split(/[/\\]/);
            const filename = urlParts[urlParts.length - 1].split('?')[0] || 'presentation.pptx';
            console.log('📄 Extracted filename:', filename);
            
            const gameState = {
                initialized: isInitialized,
                currentUsers: currentUsers,
                currentTime: currentTime,
                timerActive: timerActive,
                localTimerRemaining: localTimerRemaining,
                slideTypeData: slideTypeData
            };
            
            const dataToSave = {
                id: fileId,
                data: {
                    filename: decodeURIComponent(filename),
                    url: url,
                    fileId: fileId,
                    savedAt: new Date().toISOString(),
                    gameState: gameState
                }
            };
            
            const response = await fetch(API_BASE + 'save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSave)
            });
            
             if (response.ok) {
                 console.log('✅ Presentation data saved successfully');
            } else {
                console.error('Failed to save presentation data');
                showError('שגיאה בשמירת נתונים');
            }
        });
    } catch (error) {
        console.error('Error saving presentation data:', error);
        showError('שגיאה בשמירת נתונים: ' + error.message);
    }
}

