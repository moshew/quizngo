/* global Office */

let isInitialized = false;
let autoUpdateInterval = null;
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
    if (info.host === Office.HostType.PowerPoint) {
        document.getElementById('initButton').onclick = initializeQuiz;
        document.getElementById('nextButton').onclick = nextSlide;
        document.getElementById('refreshButton').onclick = refreshData;
        document.getElementById('startTimerButton').onclick = startTimer;
        document.getElementById('stopTimerButton').onclick = stopTimer;
        
        // Set up slide type selection event handler
        document.getElementById('slideType').onchange = handleSlideTypeChange;
        
        // Set up slide change event listener
        setupSlideChangeListener();
        
        // Initialize WebSocket connection
        initializeWebSocket();
        
        // Get initial slide number and load slide type
        getCurrentSlideNumber().then(async () => {
            loadSlideType();
            
            // Auto-detect and display filename
            setTimeout(() => {
                detectAndDisplayFilename();
            }, 2000); // Wait 2 seconds for everything to load
            
            // Try to load existing presentation data
            try {
                await PowerPoint.run(async (context) => {
                    const presentation = context.presentation;
                    const properties = context.document.properties;
                    properties.load(['title']);
                    await context.sync();
                    
                    // Try to get filename using the same logic as save function
                    let filename = 'unknown_presentation.pptx';
                    
                    // Method 1: Try URL
                    try {
                        if (Office.context && Office.context.document && Office.context.document.url) {
                            const url = Office.context.document.url;
                            const urlParts = url.split('/');
                            const lastPart = urlParts[urlParts.length - 1];
                            const cleanPart = lastPart.split('?')[0];
                            if (cleanPart && (cleanPart.includes('.pptx') || cleanPart.includes('.ppt'))) {
                                filename = decodeURIComponent(cleanPart);
                            }
                        }
                    } catch (urlError) {
                        console.log('Could not get filename from URL:', urlError);
                    }
                    
                    // Method 2: Try properties
                    if (filename === 'unknown_presentation.pptx') {
                        try {
                            properties.load(['title', 'subject', 'author', 'keywords']);
                            await context.sync();
                            
                            if (properties.subject && properties.subject.includes('.pptx')) {
                                filename = properties.subject;
                            } else if (properties.keywords && properties.keywords.includes('.pptx')) {
                                filename = properties.keywords;
                            } else if (properties.title && !properties.title.includes('Title property')) {
                                filename = properties.title + '.pptx';
                            }
                        } catch (propError) {
                            console.log('Could not get filename from properties:', propError);
                        }
                    }
                    
                    // Method 3: Check manual filename input
                    const manualFilename = document.getElementById('filenameOverride')?.value?.trim();
                    if (manualFilename) {
                        filename = manualFilename;
                        if (!filename.endsWith('.pptx')) {
                            filename += '.pptx';
                        }
                        console.log('Using manual filename for loading:', filename);
                    }
                    
                    // Method 4: Check localStorage for last known filename
                    else if (filename === 'unknown_presentation.pptx' || filename.includes('Title property')) {
                        const lastFilename = localStorage.getItem('kahoot_last_filename');
                        if (lastFilename) {
                            filename = lastFilename;
                            console.log('Using last known filename:', filename);
                            
                            // Populate the manual input field
                            const filenameInput = document.getElementById('filenameOverride');
                            if (filenameInput && !filenameInput.value) {
                                filenameInput.value = filename;
                            }
                        }
                    }
                    
                    // Generate the same file ID we would use for saving
                    const fileId = await generateFileId(filename);
                    await loadPresentationData(fileId);
                });
            } catch (error) {
                console.log('No existing presentation data found or error loading:', error);
            }
        });
        
        console.log('🎯 Kahoot Quiz Manager Add-in initialized - VERSION 3.0 (FORCE RELOAD!)');
        
        // Force show version
        alert('🔄 Add-in loaded - VERSION 3.0');
    }
});

// API Base URL - Update this to your server URL
// For local Python testing: 'http://localhost:5000/'
// For remote server: 'https://din-online.co.il/kahoot/'
const API_BASE = 'http://localhost:5000/';
const WEBSOCKET_URL = 'http://localhost:5000';

// Try HTTPS first, fallback to HTTP
const WEBSOCKET_URL_SECURE = 'https://localhost:5001';

// Utility function to make API calls
async function makeApiCall(endpoint, method = 'GET') {
    try {
        const response = await fetch(API_BASE + endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            // Add CORS headers if needed
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
        
        showStatus('המשחק אותחל בהצלחה!', 'success');
        
    } catch (error) {
        showError('שגיאה באתחול המשחק: ' + error.message);
    }
}

// Move to next slide and notify server
async function nextSlide() {
    if (!isInitialized) {
        showError('יש לאתחל את המשחק תחילה');
        return;
    }
    
    try {
        // First move to next slide in PowerPoint
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            presentation.load('slides');
            await context.sync();
            
            // Try to go to next slide
            const currentSlideIndex = presentation.getSelectedSlideIndex();
            await context.sync();
            
            if (currentSlideIndex < presentation.slides.items.length - 1) {
                presentation.goToSlide(currentSlideIndex + 1);
                await context.sync();
                
                // Update our slide number immediately
                currentSlideNumber = currentSlideIndex + 2; // +2 because we moved to next slide and convert to 1-based
                window.currentSlideNumber = currentSlideNumber;
                document.getElementById('currentSlide').textContent = currentSlideNumber;
            }
        });
        
        // Then notify the server
        await makeApiCall('?next_page');
        
        // Refresh data after moving to next slide
        await refreshData();
        await updatePresentationPlaceholders();
        
        showStatus('עבר לעמוד הבא', 'success');
        
    } catch (error) {
        // Fallback: just notify server without changing slides
        try {
            await makeApiCall('?next_page');
            await refreshData();
            await replaceUsersPlaceholder();
            await updatePresentationPlaceholders();
            showStatus('עודכן שרת (מעבר שקף ידני)', 'success');
        } catch (apiError) {
            showError('שגיאה במעבר לעמוד הבא: ' + error.message);
        }
    }
}

// Get current slide number
async function getCurrentSlideNumber() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            
            // Try to get the selected slides collection first
            const selection = context.presentation.getSelectedSlides();
            selection.load('items');
            await context.sync();
            
            if (selection.items.length > 0) {
                // Get the first selected slide
                const selectedSlide = selection.items[0];
                selectedSlide.load('id');
                await context.sync();
                
                // Now find the index of this slide in the presentation
                const allSlides = presentation.slides;
                allSlides.load('items');
                await context.sync();
                
                for (let i = 0; i < allSlides.items.length; i++) {
                    allSlides.items[i].load('id');
                }
                await context.sync();
                
                // Find the matching slide
                for (let i = 0; i < allSlides.items.length; i++) {
                    if (allSlides.items[i].id === selectedSlide.id) {
                        currentSlideNumber = i + 1; // Convert to 1-based
                        break;
                    }
                }
            } else {
                // Fallback: assume slide 1 if no selection
                currentSlideNumber = 1;
            }
            
            window.currentSlideNumber = currentSlideNumber;
            document.getElementById('currentSlide').textContent = currentSlideNumber;
            console.log('Current slide number updated to:', currentSlideNumber);
            
            // Load slide type for the current slide
            loadSlideType();
            
            // Auto-save when switching slides (with delay to ensure loadSlideType completes)
            setTimeout(() => {
                if (Object.keys(slideTypeData).length > 0) {
                    console.log('🔄 Auto-saving on slide change');
                    saveSlideTypeToPresentation();
                }
            }, 500);
        });
    } catch (error) {
        console.error('Error getting current slide number:', error);
        // Try alternative method with slide view
        try {
            await PowerPoint.run(async (context) => {
                const view = context.presentation.view;
                view.load('type');
                await context.sync();
                
                if (view.type === PowerPoint.ViewType.slideShow) {
                    // In slideshow mode, try to get current slide differently
                    const slides = context.presentation.slides;
                    slides.load('items');
                    await context.sync();
                    
                    // Default to slide 1 in slideshow if we can't determine
                    currentSlideNumber = 1;
                } else {
                    // In edit mode, keep current number or default to 1
                    currentSlideNumber = Math.max(1, currentSlideNumber);
                }
                
                window.currentSlideNumber = currentSlideNumber;
                document.getElementById('currentSlide').textContent = currentSlideNumber;
                
                // Load slide type for the current slide
                loadSlideType();
            });
        } catch (fallbackError) {
            console.error('Fallback slide detection also failed:', fallbackError);
            // Ultimate fallback
            currentSlideNumber = Math.max(1, currentSlideNumber);
            window.currentSlideNumber = currentSlideNumber;
            document.getElementById('currentSlide').textContent = currentSlideNumber;
            
            // Load slide type for the current slide
            loadSlideType();
        }
    }
}

// Refresh data from server
async function refreshData() {
    if (!isInitialized) return;
    
    try {
        // Get users count
        const usersData = await makeApiCall('?get_users');
        const usersCount = parseInt(usersData) || 0;
        currentUsers = usersCount;
        window.currentUsers = currentUsers;
        document.getElementById('userCount').textContent = usersCount;
        
        // Get time remaining
        const timeData = await makeApiCall('?get_time');
        currentTime = timeData || '0';
        window.currentTime = currentTime;
        document.getElementById('timeRemaining').textContent = currentTime;
        
        // Get current slide number
        await getCurrentSlideNumber();
        console.log('Refreshed data - current slide number:', currentSlideNumber);
        
        // Update placeholders in presentation
        await updatePresentationPlaceholders();
        
    } catch (error) {
        console.error('Error refreshing data:', error);
    }
}

// Update both placeholders efficiently
async function updatePresentationPlaceholders() {
    await Promise.all([
        replaceUsersPlaceholder(),
        replaceTimePlaceholder()
    ]);
}

// Replace !#users! placeholder in presentation
async function replaceUsersPlaceholder() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            slides.load('items');
            await context.sync();
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load('items');
                await context.sync();
                
                // First pass: look for tagged shapes (already processed)
                let foundTaggedShape = false;
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    try {
                        // Load shape properties
                        shape.load(['name', 'title', 'textFrame']);
                        await context.sync();
                        
                        // Check if this shape is tagged as users placeholder
                        if (shape.name === 'kahoot_users_placeholder' || shape.title === 'kahoot_users_placeholder') {
                            foundTaggedShape = true;
                            if (shape.textFrame) {
                                const textFrame = shape.textFrame;
                                textFrame.load('textRange');
                                await context.sync();
                                
                                // Replace the entire text with current users count
                                // Keep the original template format if needed
                                const originalText = textFrame.textRange.text;
                                let newText;
                                
                                // Try to preserve format like "Users: X" or just replace number
                                if (originalText.match(/\d+/)) {
                                    newText = originalText.replace(/\d+/, currentUsers.toString());
                                } else {
                                    newText = currentUsers.toString();
                                }
                                
                                textFrame.textRange.text = newText;
                            }
                        }
                    } catch (shapeError) {
                        continue;
                    }
                }
                
                // Second pass: if no tagged shapes found, look for placeholder text and tag them
                if (!foundTaggedShape) {
                    for (let j = 0; j < shapes.items.length; j++) {
                        const shape = shapes.items[j];
                        try {
                            if (shape.textFrame) {
                                const textFrame = shape.textFrame;
                                textFrame.load('textRange');
                                await context.sync();
                                
                                const text = textFrame.textRange.text;
                                if (text && text.includes('!#users!')) {
                                    // Replace placeholder and tag the shape
                                    const newText = text.replace(/!#users!/g, currentUsers.toString());
                                    textFrame.textRange.text = newText;
                                    
                                    // Tag the shape for future updates
                                    shape.name = 'kahoot_users_placeholder';
                                    shape.title = 'kahoot_users_placeholder';
                                    
                                    console.log('Tagged shape for users placeholder');
                                    showStatus('מחובר לטקסט משתמשים בשקף', 'success');
                                }
                            }
                        } catch (shapeError) {
                            continue;
                        }
                    }
                }
            }
            await context.sync();
        });
    } catch (error) {
        console.error('Error replacing users placeholder:', error);
    }
}

// Replace !time! placeholder in presentation
async function replaceTimePlaceholder() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            slides.load('items');
            await context.sync();
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load('items');
                await context.sync();
                
                // First pass: look for tagged shapes (already processed)
                let foundTaggedShape = false;
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    try {
                        // Load shape properties
                        shape.load(['name', 'title', 'textFrame']);
                        await context.sync();
                        
                        // Check if this shape is tagged as time placeholder
                        if (shape.name === 'kahoot_time_placeholder' || shape.title === 'kahoot_time_placeholder') {
                            foundTaggedShape = true;
                            if (shape.textFrame) {
                                const textFrame = shape.textFrame;
                                textFrame.load('textRange');
                                await context.sync();
                                
                                // Replace the entire text with current time
                                // Keep the original template format if needed
                                const originalText = textFrame.textRange.text;
                                let newText;
                                
                                // Try to preserve format like "Time: X" or just replace number/time
                                if (originalText.match(/\d+/)) {
                                    newText = originalText.replace(/\d+/, currentTime);
                                } else {
                                    newText = currentTime;
                                }
                                
                                textFrame.textRange.text = newText;
                            }
                        }
                    } catch (shapeError) {
                        continue;
                    }
                }
                
                // Second pass: if no tagged shapes found, look for placeholder text and tag them
                if (!foundTaggedShape) {
                    for (let j = 0; j < shapes.items.length; j++) {
                        const shape = shapes.items[j];
                        try {
                            if (shape.textFrame) {
                                const textFrame = shape.textFrame;
                                textFrame.load('textRange');
                                await context.sync();
                                
                                const text = textFrame.textRange.text;
                                if (text && text.includes('!time!')) {
                                    // Replace placeholder and tag the shape
                                    const newText = text.replace(/!time!/g, currentTime);
                                    textFrame.textRange.text = newText;
                                    
                                    // Tag the shape for future updates
                                    shape.name = 'kahoot_time_placeholder';
                                    shape.title = 'kahoot_time_placeholder';
                                    
                                    console.log('Tagged shape for time placeholder');
                                    showStatus('מחובר לטקסט זמן בשקף', 'success');
                                }
                            }
                        } catch (shapeError) {
                            continue;
                        }
                    }
                }
            }
            await context.sync();
        });
    } catch (error) {
        console.error('Error replacing time placeholder:', error);
    }
}

// Set up slide change listener
function setupSlideChangeListener() {
    try {
        Office.context.document.addHandlerAsync(
            Office.EventType.DocumentSelectionChanged,
            async function(eventArgs) {
                console.log('Selection changed event triggered');
                // Always update slide number first
                await getCurrentSlideNumber();
                
                if (isInitialized) {
                    // When slide changes, notify server and refresh data
                    await makeApiCall('?next_page');
                    await refreshData();
                }
            }
        );
        
        // Also set up a periodic check for slide changes
        setInterval(async () => {
            try {
                await getCurrentSlideNumber();
                // Note: loadSlideType() is already called in getCurrentSlideNumber()
            } catch (error) {
                console.error('Periodic slide check failed:', error);
            }
        }, 3000); // Check every 3 seconds
        
    } catch (error) {
        console.error('Error setting up slide change listener:', error);
    }
}



// Show status message
function showStatus(message, type = 'info') {
    console.log(`Status (${type}): ${message}`);
    // Could add a status bar or notification system here
}

// Show error message
function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
    
    console.error('Error:', message);
}

// WebSocket functions
function initializeWebSocket() {
    try {
        console.log('Attempting to connect to WebSocket:', WEBSOCKET_URL);
        socket = io(WEBSOCKET_URL, {
            transports: ['websocket', 'polling'],
            forceNew: true,
            timeout: 5000
        });
        
        socket.on('connect', () => {
            console.log('WebSocket connected');
        });
        
        socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            timerActive = false;
            stopLocalTimer();
            updateTimerButtons();
        });
        
        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            showError('שגיאה בחיבור WebSocket: ' + error.message);
        });
        
        socket.on('error', (error) => {
            console.error('WebSocket error:', error);
            showError('שגיאת WebSocket: ' + error.message);
        });
        
        socket.on('user_update', (data) => {
            console.log('User update received:', data);
            currentUsers = data.users;
            window.currentUsers = currentUsers;
            
            // Update UI
            document.getElementById('userCount').textContent = data.users;
            
            // Update placeholders in presentation
            updatePresentationPlaceholders();
        });
        
        socket.on('timer_finished', (data) => {
            console.log('Timer finished:', data);
            timerActive = false;
            stopLocalTimer();
            updateTimerButtons();
            
            // Update users if provided
            if (data.users !== undefined) {
                currentUsers = data.users;
            window.currentUsers = currentUsers;
                document.getElementById('userCount').textContent = data.users;
                replaceUsersPlaceholder();
            }
            
            // Timer finished - set time to 0
            currentTime = '0';
            window.currentTime = currentTime;
            document.getElementById('timeRemaining').textContent = '0s';
            updatePresentationPlaceholders();
            
            showError('הטיימר הסתיים! ' + data.users + ' משתתפים במשחק');
        });
        
        socket.on('timer_stopped', (data) => {
            console.log('Timer stopped:', data);
            timerActive = false;
            stopLocalTimer();
            updateTimerButtons();
            
            // Update users if provided
            if (data.users !== undefined) {
                currentUsers = data.users;
            window.currentUsers = currentUsers;
                document.getElementById('userCount').textContent = data.users;
                replaceUsersPlaceholder();
            }
            
            // Reset time to 0
            currentTime = '0';
            window.currentTime = currentTime;
            document.getElementById('timeRemaining').textContent = '0s';
            updatePresentationPlaceholders();
            
            showError('הטיימר נעצר ידנית');
        });

        // Timer update handler removed - server no longer sends time updates
        
        socket.on('status_update', (data) => {
            console.log('Status update:', data);
            currentUsers = data.users;
            window.currentUsers = currentUsers;
            
            // Update UI
            document.getElementById('userCount').textContent = data.users;
            
            // Update placeholders in presentation
            updatePresentationPlaceholders();
            
            if (data.status === 'running') {
                timerActive = true;
            } else {
                timerActive = false;
                stopLocalTimer();
            }
            updateTimerButtons();
        });
        
    } catch (error) {
        console.error('WebSocket initialization failed:', error);
        showError('שגיאה בחיבור WebSocket: ' + error.message);
        
        // Fallback to polling without WebSocket
        console.log('Falling back to HTTP polling only');
        startHttpPolling();
    }
}

// Fallback HTTP polling if WebSocket fails
function startHttpPolling() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
    }
    
    console.log('Starting HTTP polling as WebSocket fallback');
    autoUpdateInterval = setInterval(async () => {
        try {
            await refreshData();
        } catch (error) {
            console.error('HTTP polling error:', error);
        }
    }, 2000); // Poll every 2 seconds
    
    showError('משתמש בעדכון HTTP במקום WebSocket');
}

// Timer functions
async function startTimer() {
    try {
        const duration = document.getElementById('timerDuration').value;
        const response = await makeApiCall(`?start&time=${duration}`);
        
        if (response.includes('started')) {
            timerActive = true;
            // Start local timer
            startLocalTimer(parseInt(duration));
            updateTimerButtons();
            showError(`טיימר התחיל ל-${duration} שניות!`);
        }
    } catch (error) {
        showError('שגיאה בהפעלת הטיימר: ' + error.message);
    }
}

async function stopTimer() {
    try {
        const response = await makeApiCall('?stop');
        
        if (response.includes('stopped')) {
            timerActive = false;
            stopLocalTimer();
            updateTimerButtons();
            showError('הטיימר נעצר!');
        }
    } catch (error) {
        showError('שגיאה בעצירת הטיימר: ' + error.message);
    }
}

function updateTimerButtons() {
    const startButton = document.getElementById('startTimerButton');
    const stopButton = document.getElementById('stopTimerButton');
    
    if (timerActive) {
        startButton.disabled = true;
        stopButton.disabled = false;
        startButton.textContent = '⏱️ טיימר פעיל';
        stopButton.textContent = '⏹️ עצור טיימר';
    } else {
        startButton.disabled = false;
        stopButton.disabled = true;
        startButton.textContent = '⏱️ התחל טיימר';
        stopButton.textContent = '⏹️ עצור טיימר';
    }
}

// Local timer functions
function startLocalTimer(duration) {
    // Stop any existing timer first
    stopLocalTimer();
    
    localTimerRemaining = duration;
    updateTimerDisplay();
    
    localTimerInterval = setInterval(() => {
        localTimerRemaining--;
        updateTimerDisplay();
        
        // Update time placeholder in presentation
        updatePresentationPlaceholders();
        
        if (localTimerRemaining <= 0) {
            stopLocalTimer();
        }
    }, 1000); // Update every second
    
    console.log(`Local timer started for ${duration} seconds`);
}

function stopLocalTimer() {
    if (localTimerInterval) {
        clearInterval(localTimerInterval);
        localTimerInterval = null;
        console.log('Local timer stopped');
    }
    // Don't reset localTimerRemaining to 0 - keep the last value
    // localTimerRemaining = 0; // Removed this line
    updateTimerDisplay();
}

function updateTimerDisplay() {
    currentTime = localTimerRemaining.toString();
    window.currentTime = currentTime;
    document.getElementById('timeRemaining').textContent = localTimerRemaining + 's';
}

// Slide type management functions
function handleSlideTypeChange() {
    const slideType = document.getElementById('slideType').value;
    console.log(`🔄 Slide type changed to: ${slideType} for slide ${currentSlideNumber}`);
    saveSlideType(slideType);
}

function saveSlideType(slideType) {
    slideTypeData[currentSlideNumber] = slideType;
    console.log('💾 Saving slide type:', slideType, 'for slide:', currentSlideNumber);
    console.log('📋 Current slideTypeData:', slideTypeData);
    // Save to presentation properties for persistence
    saveSlideTypeToPresentation();
}

function loadSlideType() {
    // Load slide type for current slide
    const slideType = slideTypeData[currentSlideNumber] || 'מעבר'; // Default to מעבר
    document.getElementById('slideType').value = slideType;
    console.log(`Loaded slide type: ${slideType} for slide ${currentSlideNumber}`);
}

async function saveSlideTypeToPresentation() {
    console.log('=== Starting saveSlideTypeToPresentation ===');
    try {
        // Simple approach - use detected filename
        let filename = localStorage.getItem('kahoot_detected_filename') || 'זליגה.pptx';
        
        console.log('💾 Using filename for save:', filename);
        console.log('📋 Slide type data to save:', slideTypeData);
        
        // Generate file ID and save
        const fileId = await generateFileId(filename);
        await savePresentationData(fileId, filename);
        
        console.log('✅ Slide type data saved successfully!');
        
    } catch (error) {
        console.error('❌ Error saving slide type:', error);
        console.log('📝 Data stored in memory only:', slideTypeData);
    }
}

// Generate a consistent hash-based file ID from full file path
async function generateFileId(fullPath) {
    console.log('Generating hash for full path:', fullPath);
    
    // Use full path for consistent hashing - same file should always get same ID
    const baseString = fullPath.toLowerCase();
    
    // Simple but consistent hash function
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
        const char = baseString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Add some randomness but make it predictable for the same session
    const sessionSeed = sessionStorage.getItem('kahoot_session_seed') || Math.floor(Math.random() * 1000000).toString();
    sessionStorage.setItem('kahoot_session_seed', sessionSeed);
    
    let sessionHash = 0;
    for (let i = 0; i < sessionSeed.length; i++) {
        const char = sessionSeed.charCodeAt(i);
        sessionHash = ((sessionHash << 5) - sessionHash) + char;
        sessionHash = sessionHash & sessionHash;
    }
    
    const finalHash = Math.abs(hash + sessionHash);
    console.log('Generated hash ID:', finalHash);
    return finalHash.toString();
}

// Save presentation data function
async function savePresentationData(fileId, fullPath) {
    try {
        // Extract just the filename from the full path for display
        const filename = fullPath.split(/[/\\]/).pop();
        
        const gameState = {
            initialized: isInitialized,
            currentUsers: currentUsers,
            currentTime: currentTime,
            currentSlideNumber: currentSlideNumber,
            timerActive: timerActive,
            localTimerRemaining: localTimerRemaining,
            slideTypeData: slideTypeData // Include slide type data
        };
        
        const dataToSave = {
            id: fileId,
            data: {
                filename: filename,           // Just the filename for display
                fullPath: fullPath,          // Full path for uniqueness
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
            console.log('Presentation data saved successfully');
            localStorage.setItem('kahoot_last_file_id', fileId);
            localStorage.setItem('kahoot_last_filename', filename);
            localStorage.setItem('kahoot_last_fullpath', fullPath);
        } else {
            console.error('Failed to save presentation data');
        }
    } catch (error) {
        console.error('Error saving presentation data:', error);
    }
}
                    } else if (properties.title && !properties.title.includes('Title property')) {
                        filename = properties.title + '.pptx';
                        console.log('Filename from title:', filename);
                    }
                } catch (propError) {
                    console.log('Could not get filename from properties:', propError);
                }
            }
            
            // Method 3: Check manual filename input
            const manualFilename = document.getElementById('filenameOverride')?.value?.trim();
            if (manualFilename) {
                filename = manualFilename;
                if (!filename.endsWith('.pptx')) {
                    filename += '.pptx';
                }
                console.log('Filename from manual input:', filename);
            }
            
            // Method 4: Ask user for filename if all else fails
            else if (filename === 'unknown_presentation.pptx' || filename.includes('Title property')) {
                // Prompt user for the correct filename
                const userFilename = prompt('לא הצלחנו לזהות את שם הקובץ.\nאנא הזן את שם הקובץ (כולל .pptx):', 'שאלון 1.pptx');
                if (userFilename && userFilename.trim()) {
                    filename = userFilename.trim();
                    if (!filename.endsWith('.pptx')) {
                        filename += '.pptx';
                    }
                    console.log('Filename from user prompt:', filename);
                    
                    // Save to manual input field for future use
                    const filenameInput = document.getElementById('filenameOverride');
                    if (filenameInput) {
                        filenameInput.value = filename;
                    }
                }
            }
            
            // Generate hash-based file ID from full path
            fileId = await generateFileId(filename);
            
            // Save slide type data to server (pass full path)
            await savePresentationData(fileId, filename);
            
            console.log('=== Slide type data saved with ID:', fileId, 'filename:', filename, '===');
        });
    } catch (error) {
        console.error('Error saving slide type to presentation:', error);
        // Fallback: just store in memory
        console.log('Slide type data stored in memory only:', slideTypeData);
    }
}

// Generate a consistent hash-based file ID from full file path
async function generateFileId(fullPath) {
    console.log('Generating hash for full path:', fullPath);
    
    // Use full path for consistent hashing - same file should always get same ID
    const baseString = fullPath.toLowerCase();
    
    // Simple but consistent hash function
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
        const char = baseString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Add some randomness but make it predictable for the same session
    const sessionSeed = sessionStorage.getItem('kahoot_session_seed') || Math.floor(Math.random() * 1000000).toString();
    sessionStorage.setItem('kahoot_session_seed', sessionSeed);
    
    let sessionHash = 0;
    for (let i = 0; i < sessionSeed.length; i++) {
        const char = sessionSeed.charCodeAt(i);
        sessionHash = ((sessionHash << 5) - sessionHash) + char;
        sessionHash = sessionHash & sessionHash;
    }
    
    const finalHash = Math.abs(hash + sessionHash);
    console.log('Generated hash ID:', finalHash);
    return finalHash.toString();
}

async function savePresentationData(fileId, fullPath) {
    try {
        // Extract just the filename from the full path for display
        const filename = fullPath.split(/[/\\]/).pop();
        
        const gameState = {
            initialized: isInitialized,
            currentUsers: currentUsers,
            currentTime: currentTime,
            currentSlideNumber: currentSlideNumber,
            timerActive: timerActive,
            localTimerRemaining: localTimerRemaining,
            slideTypeData: slideTypeData // Include slide type data
        };
        
        const dataToSave = {
            id: fileId,
            data: {
                filename: filename,           // Just the filename for display
                fullPath: fullPath,          // Full path for uniqueness
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
            console.log('Presentation data saved successfully');
            // Store the file ID for future loading
            localStorage.setItem('kahoot_last_file_id', fileId);
            localStorage.setItem('kahoot_last_filename', filename);
            localStorage.setItem('kahoot_last_fullpath', fullPath);
        } else {
            console.error('Failed to save presentation data');
        }
    } catch (error) {
        console.error('Error saving presentation data:', error);
    }
}

async function loadPresentationData(presentationId) {
    try {
        const response = await fetch(API_BASE + 'load', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: presentationId })
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.status === 'success' && result.data.gameState) {
                const gameState = result.data.gameState;
                
                // Restore slide type data
                if (gameState.slideTypeData) {
                    slideTypeData = gameState.slideTypeData;
                    loadSlideType(); // Update UI
                    console.log('Slide type data loaded:', slideTypeData);
                }
                
                // Restore other game state
                currentUsers = gameState.currentUsers || 0;
                currentTime = gameState.currentTime || '0';
                currentSlideNumber = gameState.currentSlideNumber || 1;
                timerActive = gameState.timerActive || false;
                localTimerRemaining = gameState.localTimerRemaining || 0;
                
                // Update UI
                document.getElementById('userCount').textContent = currentUsers;
                document.getElementById('timeRemaining').textContent = currentTime;
                document.getElementById('currentSlide').textContent = currentSlideNumber;
                
                console.log('Presentation data loaded successfully');
            }
        }
    } catch (error) {
        console.error('Error loading presentation data:', error);
    }
}

// Manual save function for testing
async function manualSave() {
    console.log('=== Manual save triggered ===');
    await saveSlideTypeToPresentation();
    console.log('=== Manual save completed ===');
}

// Debug function to check slide types
function debugSlideTypes() {
    console.log('🐛 DEBUG INFO:');
    console.log('Current slide:', currentSlideNumber);
    console.log('Slide type data:', slideTypeData);
    console.log('Selected slide type:', document.getElementById('slideType').value);
    
    const detectedInfo = document.getElementById('detectedInfo');
    if (detectedInfo) {
        detectedInfo.innerHTML = `
            🐛 Debug Info:<br>
            שקף נוכחי: ${currentSlideNumber}<br>
            סוג שקף נבחר: ${document.getElementById('slideType').value}<br>
            נתוני שקפים: ${JSON.stringify(slideTypeData)}
        `;
        detectedInfo.style.display = 'block';
        detectedInfo.style.background = '#fff3cd';
        detectedInfo.style.color = '#856404';
    }
}

// Function to detect and display filename
async function detectAndDisplayFilename() {
    console.log('=== Detecting filename ===');
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            
            // Try to load properties safely
            let properties = null;
            try {
                properties = context.document.properties;
                properties.load(['title', 'subject', 'author', 'keywords']);
                await context.sync();
            } catch (propError) {
                console.log('Could not load document properties:', propError);
                // Create a dummy properties object
                properties = {
                    title: 'Unknown',
                    subject: null,
                    author: null,
                    keywords: null
                };
            }
            
            console.log('Properties loaded - title:', properties.title);
            console.log('Properties loaded - subject:', properties.subject);
            console.log('Properties loaded - author:', properties.author);
            console.log('Properties loaded - keywords:', properties.keywords);
            
            // Try multiple methods to get the actual filename
            let filename = 'unknown_presentation.pptx';
            let source = 'default';
            
            // Method 1: Try to get filename from Office context URL
            try {
                if (Office.context && Office.context.document && Office.context.document.url) {
                    const url = Office.context.document.url;
                    console.log('Document URL:', url);
                    
                    // Handle both forward slashes and backslashes
                    const urlParts = url.split(/[/\\]/);
                    const lastPart = urlParts[urlParts.length - 1];
                    const cleanPart = lastPart.split('?')[0];
                    if (cleanPart && (cleanPart.includes('.pptx') || cleanPart.includes('.ppt'))) {
                        filename = decodeURIComponent(cleanPart);
                        source = 'URL';
                        console.log('Filename from URL:', filename);
                    }
                }
            } catch (urlError) {
                console.log('Could not get filename from URL:', urlError);
            }
            
            // Method 1.5: Try Office.context.document.displayName
            if (filename === 'unknown_presentation.pptx') {
                try {
                    if (Office.context && Office.context.document && Office.context.document.displayName) {
                        filename = Office.context.document.displayName;
                        if (!filename.endsWith('.pptx')) {
                            filename += '.pptx';
                        }
                        source = 'displayName';
                        console.log('Filename from displayName:', filename);
                    }
                } catch (displayError) {
                    console.log('Could not get displayName:', displayError);
                }
            }
            
            // Method 2: Try document properties
            if (filename === 'unknown_presentation.pptx') {
                if (properties && properties.subject && properties.subject.includes('.pptx')) {
                    filename = properties.subject;
                    source = 'subject';
                    console.log('Filename from subject:', filename);
                } else if (properties && properties.keywords && properties.keywords.includes('.pptx')) {
                    filename = properties.keywords;
                    source = 'keywords';
                    console.log('Filename from keywords:', filename);
                } else if (properties && properties.title && !properties.title.includes('Title property')) {
                    filename = properties.title + '.pptx';
                    source = 'title';
                    console.log('Filename from title:', filename);
                }
            }
            
            // Update the filename field in the panel
            const filenameInput = document.getElementById('filenameOverride');
            if (filenameInput) {
                if (!filenameInput.value.trim()) { // Only update if field is empty
                    filenameInput.value = filename;
                    console.log('Updated filename field with:', filename);
                }
            }
            
            // Show detection info in panel
            const detectedInfo = document.getElementById('detectedInfo');
            if (detectedInfo) {
                detectedInfo.innerHTML = `זוהה: ${filename}<br>מקור: ${source}`;
                detectedInfo.style.display = 'block';
                detectedInfo.style.background = '#f0f8ff';
                detectedInfo.style.color = '#0078d4';
            }
            
            console.log('Final detected filename:', filename);
            
            // Store the detected filename for future use
            localStorage.setItem('kahoot_detected_filename', filename);
            
            // Show the detected filename info in the panel instead of alert
            try {
                // Try to show alert only if supported
                if (typeof alert !== 'undefined') {
                    alert(`שם הקובץ שזוהה: ${filename}\n\nURL: ${Office.context?.document?.url || 'לא זמין'}\nTitle: ${properties.title || 'לא זמין'}\nSubject: ${properties.subject || 'לא זמין'}\nKeywords: ${properties.keywords || 'לא זמין'}`);
                }
            } catch (alertError) {
                console.log('Alert not supported, showing in panel only');
            }
        });
    } catch (error) {
        console.error('Error detecting filename:', error);
        
        // Show error in panel instead of alert
        const detectedInfo = document.getElementById('detectedInfo');
        if (detectedInfo) {
            detectedInfo.innerHTML = `שגיאה: ${error.message}`;
            detectedInfo.style.display = 'block';
            detectedInfo.style.background = '#ffe6e6';
            detectedInfo.style.color = '#d00';
        }
    }
}

