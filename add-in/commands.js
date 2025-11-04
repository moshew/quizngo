/* global Office */

Office.onReady(() => {
    // This file is used for ribbon commands
    console.log('Commands initialized');
});

// Function that could be called from ribbon buttons
function showTaskpane() {
    Office.addin.showAsTaskpane();
}

// Insert a users placeholder text box
async function insertUsersPlaceholder() {
    try {
        await PowerPoint.run(async (context) => {
            // Get current slide or use the first slide if none selected
            let slide;
            try {
                slide = context.presentation.getSelectedSlides().getItemAt(0);
            } catch {
                // Fallback to current slide or first slide
                slide = context.presentation.slides.getItemAt(0);
            }
            
            // Create a text box with the users placeholder
            const shape = slide.shapes.addTextBox("Participants: 0", {
                left: 50,
                top: 50,
                width: 200,
                height: 50
            });
            
            // Tag the shape immediately
            shape.name = "kahoot_users_placeholder";
            shape.title = "kahoot_users_placeholder";
            
            // Load and sync to ensure the shape is created
            shape.load(['name', 'title']);
            await context.sync();
            
            console.log('Users placeholder inserted and tagged');
            
            // Try to update the placeholder with current data if available
            if (typeof window.currentUsers !== 'undefined' && window.currentUsers > 0) {
                // Update the text with current user count
                const textFrame = shape.textFrame;
                textFrame.load('textRange');
                await context.sync();
                textFrame.textRange.text = `Participants: ${window.currentUsers}`;
                await context.sync();
            }
            
            // Show success message if available
            if (typeof showStatus === 'function') {
                showStatus('Users counter added to slide!', 'success');
            }
            
            return context.sync();
        });
    } catch (error) {
        console.error('Error inserting users placeholder:', error);
        
        // Fallback: try to show error if function is available
        if (typeof showError === 'function') {
            showError('Failed to insert users counter: ' + error.message);
        } else {
            alert('Failed to insert users counter: ' + error.message);
        }
    }
}

// Insert a time placeholder text box
async function insertTimePlaceholder() {
    try {
        await PowerPoint.run(async (context) => {
            // Get current slide or use the first slide if none selected
            let slide;
            try {
                slide = context.presentation.getSelectedSlides().getItemAt(0);
            } catch {
                // Fallback to current slide or first slide
                slide = context.presentation.slides.getItemAt(0);
            }
            
            // Create a text box with the time placeholder
            const shape = slide.shapes.addTextBox("Time: 0s", {
                left: 50,
                top: 120,
                width: 150,
                height: 50
            });
            
            // Tag the shape immediately
            shape.name = "kahoot_time_placeholder";
            shape.title = "kahoot_time_placeholder";
            
            // Load and sync to ensure the shape is created
            shape.load(['name', 'title']);
            await context.sync();
            
            console.log('Time placeholder inserted and tagged');
            
            // Try to update the placeholder with current data if available
            if (typeof window.currentTime !== 'undefined' && window.currentTime !== '') {
                // Update the text with current time
                const textFrame = shape.textFrame;
                textFrame.load('textRange');
                await context.sync();
                textFrame.textRange.text = `Time: ${window.currentTime}s`;
                await context.sync();
            }
            
            // Show success message if available
            if (typeof showStatus === 'function') {
                showStatus('Timer display added to slide!', 'success');
            }
            
            return context.sync();
        });
    } catch (error) {
        console.error('Error inserting time placeholder:', error);
        
        // Fallback: try to show error if function is available
        if (typeof showError === 'function') {
            showError('Failed to insert timer display: ' + error.message);
        } else {
            alert('Failed to insert timer display: ' + error.message);
        }
    }
}

// API Base URL - should match taskpane.js
const API_BASE = 'http://localhost:5000/';

// Create hash from path (client-side implementation)
function createHashFromPath(path) {
    try {
        console.log('🔑 [Toolbar] Creating hash from path:', path);
        
        // VALIDATION: Check if path exists and is not empty/whitespace
        if (!path || typeof path !== 'string' || path.trim() === '') {
            console.warn('⚠️ [Toolbar] Invalid path: empty or not a string');
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
            console.warn('⚠️ [Toolbar] Invalid path format:', path);
            return null;
        }
        
        // VALIDATION: Check path length
        if (path.length < 3 || path.length > 1000) {
            console.warn('⚠️ [Toolbar] Path length out of range:', path.length);
            return null;
        }
        
        // Normalize the path (lowercase for consistency)
        let normalizedPath = path.toLowerCase();
        
        // Replace backslashes with forward slashes for consistency
        normalizedPath = normalizedPath.replace(/\\/g, '/');
        
        // Simple hash implementation
        let hash = 0;
        for (let i = 0; i < normalizedPath.length; i++) {
            const char = normalizedPath.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Convert to hex and take first 12 characters
        const hashHex = Math.abs(hash).toString(16).padStart(12, '0').substring(0, 12);
        
        console.log('✅ [Toolbar] Generated hash ID:', hashHex);
        return hashHex;
        
    } catch (error) {
        console.error('❌ [Toolbar] Error creating hash:', error);
        return null;
    }
}

// Get PowerPoint presentation file info
async function getPresentationFileInfo() {
    try {
        console.log('🔍 [Toolbar] Getting presentation file info...');
        
        // METHOD 1: Try to get the file URL
        if (Office.context.document && Office.context.document.url) {
            const url = Office.context.document.url;
            console.log('📄 [Toolbar] Full document URL:', url);
            
            // VALIDATION: Check if URL is not empty and contains a valid file path
            if (!url || url.trim() === '') {
                console.log('⚠️ [Toolbar] URL is empty or whitespace only');
                // Continue to fallback method below
            } else {
                // Decode the URL
                const decodedUrl = decodeURIComponent(url);
                console.log('📄 [Toolbar] Decoded URL:', decodedUrl);
                
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
                        console.log('✅ [Toolbar] Method 1 (URL): Success');
                        console.log('📄 [Toolbar] Display name:', displayName);
                        console.log('📁 [Toolbar] Full path will be sent to server:', decodedUrl);
                        console.log('🔑 [Toolbar] Server will generate hash ID from path');
                        
                        return {
                            fullPath: decodedUrl,     // The full path (server will create hash)
                            displayName: displayName  // Just the filename (for display)
                        };
                    } else {
                        console.log('⚠️ [Toolbar] Display name is empty after processing');
                    }
                } else {
                    console.log('⚠️ [Toolbar] URL does not contain a valid file path:', decodedUrl);
                }
            }
        }
        
        console.log('⚠️ [Toolbar] Method 1 (URL) failed, trying Method 2 (getFilePropertiesAsync)...');
        
        // METHOD 2: Try getFilePropertiesAsync as fallback
        // This works in some scenarios where URL is not available
        return await new Promise((resolve, reject) => {
            Office.context.document.getFilePropertiesAsync((result) => {
                if (result.status === Office.AsyncResultStatus.Succeeded) {
                    const fileUrl = result.value.url;
                    console.log('📄 [Toolbar] getFilePropertiesAsync URL:', fileUrl);
                    
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
                            console.log('✅ [Toolbar] Method 2 (getFilePropertiesAsync): Success');
                            console.log('📄 [Toolbar] Display name:', displayName);
                            console.log('📁 [Toolbar] Full path will be sent to server:', decodedUrl);
                            
                            resolve({
                                fullPath: decodedUrl,
                                displayName: displayName
                            });
                            return;
                        }
                    }
                }
                
                console.log('⚠️ [Toolbar] Method 2 failed or returned invalid data');
                console.log('⚠️ [Toolbar] File may not be saved yet or is in OneDrive/SharePoint');
                console.log('💡 [Toolbar] Tip: Try saving the file to your local disk (C:\\ drive)');
                resolve(null);
            });
        });
        
    } catch (error) {
        console.error('❌ [Toolbar] Error getting file info:', error);
        return null;
    }
}

// Get presentation filename (wrapper for backwards compatibility)
async function getPresentationFilename() {
    const info = await getPresentationFileInfo();
    return info ? info.fullPath : null;
}

// Save presentation data from toolbar
async function savePresentationFromToolbar() {
    try {
        console.log('💾 [Toolbar] Starting save process...');
        
        // Get file info (full path + display name)
        const fileInfo = await getPresentationFileInfo();
        
        if (!fileInfo || !fileInfo.fullPath) {
            alert('⚠️ שמור תחילה את המצגת (File → Save As) לפני שמירת הנתונים!');
            console.error('❌ [Toolbar] No file info - presentation not saved');
            return;
        }
        
        console.log('✅ [Toolbar] File info obtained');
        console.log('📄 [Toolbar] Display name:', fileInfo.displayName);
        console.log('📁 [Toolbar] Full path:', fileInfo.fullPath);
        
        // Generate hash ID client-side
        const hashId = createHashFromPath(fileInfo.fullPath);
        
        if (!hashId) {
            console.error('❌ [Toolbar] Failed to generate hash ID');
            alert('⚠️ שגיאה ביצירת מזהה ייחודי למצגת');
            return;
        }
        
        console.log('🔑 [Toolbar] Generated hash ID:', hashId);
        
        // Try to get current state from taskpane if available
        let gameState = {};
        if (typeof window !== 'undefined') {
            gameState = {
                initialized: window.isInitialized || false,
                currentUsers: window.currentUsers || 0,
                currentTime: window.currentTime || '0',
                currentSlideNumber: window.currentSlideNumber || 1,
                currentSlideId: window.currentSlideId || null,
                timerActive: window.timerActive || false,
                localTimerRemaining: window.localTimerRemaining || 0,
                slideTypeData: window.slideTypeData || {}  // Important for slide types!
            };
        }
        
        // Collect all current game data
        const gameData = {
            presentationPath: fileInfo.fullPath,  // Full path of PPTX (for reference)
            presentationName: fileInfo.displayName,  // Display name
            savedAt: new Date().toISOString(),
            gameState: gameState
        };
        
        console.log('📋 [Toolbar] Saving presentation data');
        console.log('📁 [Toolbar] Path:', fileInfo.fullPath);
        console.log('🔑 [Toolbar] Hash ID:', hashId);
        
        // Send to server with hash ID
        const response = await fetch(API_BASE + 'save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                hashId: hashId,  // Send hash directly
                data: gameData
            }),
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        console.log('✅ [Toolbar] Save response:', result);
        console.log('🔑 [Toolbar] Server generated hash ID:', result.hashId);
        console.log('📄 [Toolbar] Saved to file:', result.file);
        alert(`✅ מצגת נשמרה בהצלחה בשרת!\nשם המצגת: ${fileInfo.displayName}\nHash ID: ${result.hashId}`);
        
    } catch (error) {
        console.error('❌ [Toolbar] Save error:', error);
        alert('❌ שגיאה בשמירת המצגת: ' + error.message);
    }
}

// Load presentation data from toolbar
async function loadPresentationFromToolbar() {
    try {
        console.log('📂 [Toolbar] Starting load process...');
        
        // Get file info (full path + display name)
        const fileInfo = await getPresentationFileInfo();
        
        if (!fileInfo || !fileInfo.fullPath) {
            alert('ℹ️ המצגת עדיין לא נשמרה - אין נתונים לטעון');
            console.log('ℹ️ [Toolbar] No file info - presentation not saved yet');
            return;
        }
        
        console.log('✅ [Toolbar] Loading data');
        console.log('📄 [Toolbar] Display name:', fileInfo.displayName);
        console.log('📁 [Toolbar] Full path:', fileInfo.fullPath);
        
        // Generate hash ID client-side
        const hashId = createHashFromPath(fileInfo.fullPath);
        
        if (!hashId) {
            console.error('❌ [Toolbar] Failed to generate hash ID');
            alert('⚠️ שגיאה ביצירת מזהה ייחודי למצגת');
            return;
        }
        
        console.log('🔑 [Toolbar] Generated hash ID:', hashId);
        
        // Request from server with hash ID
        const response = await fetch(API_BASE + 'load', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                hashId: hashId  // Send hash directly
            }),
            mode: 'cors'
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('לא נמצאו נתונים שמורים למצגת זו');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        const gameData = result.data;
        
        console.log('✅ [Toolbar] Loaded presentation data:', gameData);
        console.log('📄 [Toolbar] Loaded from file:', result.file);
        
        // Try to update taskpane state if available
        if (typeof window !== 'undefined' && gameData.gameState) {
            const state = gameData.gameState;
            
            // Update window variables if they exist
            if ('isInitialized' in window) window.isInitialized = state.initialized || false;
            if ('currentUsers' in window) window.currentUsers = state.currentUsers || 0;
            if ('currentTime' in window) window.currentTime = state.currentTime || '0';
            if ('currentSlideNumber' in window) window.currentSlideNumber = state.currentSlideNumber || 1;
            if ('currentSlideId' in window) window.currentSlideId = state.currentSlideId || null;
            if ('timerActive' in window) window.timerActive = state.timerActive || false;
            if ('localTimerRemaining' in window) window.localTimerRemaining = state.localTimerRemaining || 0;
            if ('slideTypeData' in window) window.slideTypeData = state.slideTypeData || {};  // Important for slide types!
            
            // Try to update UI if elements exist
            try {
                const userCountEl = document.getElementById('userCount');
                if (userCountEl) userCountEl.textContent = state.currentUsers || 0;
                
                const timeRemainingEl = document.getElementById('timeRemaining');
                if (timeRemainingEl) timeRemainingEl.textContent = (state.currentTime || '0') + 's';
                
                const currentSlideEl = document.getElementById('currentSlide');
                if (currentSlideEl) currentSlideEl.textContent = state.currentSlideNumber || 1;
                
                // Try to call update functions if they exist
                if (typeof updateTimerButtons === 'function') updateTimerButtons();
                if (typeof updatePresentationPlaceholders === 'function') updatePresentationPlaceholders();
                
                // Update slide info before loading slide type
                if (typeof updateCurrentSlideInfo === 'function') {
                    updateCurrentSlideInfo().then(() => {
                        if (typeof loadSlideType === 'function') loadSlideType();  // Reload current slide type
                    });
                } else if (typeof loadSlideType === 'function') {
                    loadSlideType();  // Reload current slide type
                }
            } catch (uiError) {
                console.log('ℹ️ [Toolbar] UI update not available:', uiError.message);
            }
        }
        
        const loadedName = gameData.presentationName || fileInfo.displayName;
        alert(`✅ מצגת נטענה בהצלחה מהשרת!\nשם המצגת: ${loadedName}\nHash ID: ${result.hashId}\nנשמרה ב: ${new Date(gameData.savedAt).toLocaleString('he-IL')}`);
        
    } catch (error) {
        console.error('❌ [Toolbar] Load error:', error);
        alert('❌ שגיאה בטעינת המצגת: ' + error.message);
    }
}

// Make functions available globally
if (typeof window !== 'undefined') {
    window.showTaskpane = showTaskpane;
    window.insertUsersPlaceholder = insertUsersPlaceholder;
    window.insertTimePlaceholder = insertTimePlaceholder;
    window.savePresentationFromToolbar = savePresentationFromToolbar;
    window.loadPresentationFromToolbar = loadPresentationFromToolbar;
}
