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
                    
                    // Try to get filename like in save function
                    let filename = 'unknown_presentation.pptx';
                    
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

// API Base URL
const API_BASE = 'http://localhost:5000/';
const WEBSOCKET_URL = 'http://localhost:5000';

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
        // Get filename from localStorage (set by detectAndDisplayFilename)
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
