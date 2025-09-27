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

// Simple hash function for creating unique IDs from filename
function createHashFromString(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString();
}

// Get PowerPoint presentation filename
async function getPresentationFilename() {
    try {
        return await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            presentation.load('title');
            await context.sync();
            
            // Get title, fallback to default name if empty
            let filename = presentation.title || 'Untitled';
            
            // Remove .pptx extension if present and add it back for consistency
            filename = filename.replace(/\.pptx?$/i, '') + '.pptx';
            
            return filename;
        });
    } catch (error) {
        console.error('Error getting presentation filename:', error);
        // Fallback to timestamp-based filename
        return `presentation_${Date.now()}.pptx`;
    }
}

// Save presentation data from toolbar
async function savePresentationFromToolbar() {
    try {
        console.log('Saving presentation from toolbar...');
        
        // Get presentation filename and create hash ID
        const filename = await getPresentationFilename();
        const fileId = createHashFromString(filename);
        
        // Try to get current state from taskpane if available
        let gameState = {};
        if (typeof window !== 'undefined') {
            gameState = {
                initialized: window.isInitialized || false,
                currentUsers: window.currentUsers || 0,
                currentTime: window.currentTime || '0',
                currentSlideNumber: window.currentSlideNumber || 1,
                timerActive: window.timerActive || false,
                localTimerRemaining: window.localTimerRemaining || 0
            };
        }
        
        // Collect all current game data
        const gameData = {
            filename: filename,
            fileId: fileId,
            savedAt: new Date().toISOString(),
            gameState: gameState
        };
        
        console.log('Saving presentation data:', gameData);
        
        // Send to server
        const response = await fetch(API_BASE + 'save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: fileId,
                data: gameData
            }),
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        console.log('Save response:', result);
        alert(`מצגת נשמרה בהצלחה!\nID: ${fileId}\nקובץ: ${filename}`);
        
    } catch (error) {
        console.error('Save error:', error);
        alert('שגיאה בשמירת המצגת: ' + error.message);
    }
}

// Load presentation data from toolbar
async function loadPresentationFromToolbar() {
    try {
        console.log('Loading presentation from toolbar...');
        
        // Get presentation filename and create hash ID
        const filename = await getPresentationFilename();
        const fileId = createHashFromString(filename);
        
        console.log('Loading presentation data for ID:', fileId);
        
        // Request from server
        const response = await fetch(API_BASE + 'load', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: fileId
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
        
        console.log('Loaded presentation data:', gameData);
        
        // Try to update taskpane state if available
        if (typeof window !== 'undefined' && gameData.gameState) {
            const state = gameData.gameState;
            
            // Update window variables if they exist
            if ('isInitialized' in window) window.isInitialized = state.initialized || false;
            if ('currentUsers' in window) window.currentUsers = state.currentUsers || 0;
            if ('currentTime' in window) window.currentTime = state.currentTime || '0';
            if ('currentSlideNumber' in window) window.currentSlideNumber = state.currentSlideNumber || 1;
            if ('timerActive' in window) window.timerActive = state.timerActive || false;
            if ('localTimerRemaining' in window) window.localTimerRemaining = state.localTimerRemaining || 0;
            
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
            } catch (uiError) {
                console.log('UI update not available:', uiError.message);
            }
        }
        
        alert(`מצגת נטענה בהצלחה!\nקובץ: ${filename}\nנשמרה ב: ${new Date(gameData.savedAt).toLocaleString('he-IL')}`);
        
    } catch (error) {
        console.error('Load error:', error);
        alert('שגיאה בטעינת המצגת: ' + error.message);
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
