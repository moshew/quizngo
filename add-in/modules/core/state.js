/**
 * Presentation State Manager Module
 * Handles presentation data saving, loading, and file management
 * Data is stored directly in PowerPoint presentation tags
 * 
 * CENTRALIZED STATE MANAGEMENT - All state is managed here instead of window.*
 */

/* global Office, PowerPoint */

// ============================================================================
// CENTRALIZED STATE - All application state is stored here
// ============================================================================

// Game State
let _currentHashId = null;
let _gamePIN = null;
let _currentUsers = 0;
let _socket = null;

// Slide State
let _currentSlideNumber = 1;
let _currentSlideId = null;
let _slideTypeData = {};

// Presentation Settings
let _presentationSettings = {
    questionWaitTime: 30,
    clockActivationDelay: 5,
    afterQuestionStatistics: true,
    afterQuestionLeaderboard: false,
    language: 'he'
};

// UI State (for slide editor)
let _contextMenuTargetSlideId = null;
let _contextMenuTargetType = null;
let _currentEditingSlideId = null;
let _selectedType = null;
let _selectedAnswer = null;

// Callbacks
let _refreshSlideListCallback = null;

// ============================================================================
// GAME STATE - Getters & Setters
// ============================================================================

// Note: hashId is deprecated - gamePin is now the primary identifier
export function getHashId() { return _currentHashId; }
export function setHashId(value) { 
    _currentHashId = value;
    console.log('📝 State: hashId =', value);
}

export function getGamePIN() { return _gamePIN; }
export function setGamePIN(value) { 
    _gamePIN = value;
    console.log('📝 State: gamePIN =', value);
}

/**
 * Generate a 6-digit game PIN
 * This is now done in the Add-in (not Admin)
 * @returns {string} 6-digit PIN
 */
export function generateGamePin() {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('🎲 Generated new Game PIN:', pin);
    return pin;
}

export function getCurrentUsers() { return _currentUsers; }
export function setCurrentUsers(value) { 
    _currentUsers = value;
}

export function getSocket() { return _socket; }
export function setSocket(value) { 
    _socket = value;
    console.log('📝 State: socket connected =', value?.connected);
}

// ============================================================================
// SLIDE STATE - Getters & Setters
// ============================================================================

export function getCurrentSlideNumber() { return _currentSlideNumber; }
export function setCurrentSlideNumber(value) { 
    _currentSlideNumber = value;
}

export function getCurrentSlideId() { return _currentSlideId; }
export function setCurrentSlideId(value) { 
    _currentSlideId = value;
}

export function getSlideTypeData() { return _slideTypeData; }
export function setSlideTypeData(value) { 
    _slideTypeData = value || {};
}

// ============================================================================
// PRESENTATION SETTINGS - Getters & Setters
// ============================================================================

export function getPresentationSettings() { return _presentationSettings; }
export function setPresentationSettings(value) { 
    _presentationSettings = value || {
        questionWaitTime: 30,
        clockActivationDelay: 5,
        afterQuestionStatistics: true,
        afterQuestionLeaderboard: false,
        language: 'he'
    };
}

export function updatePresentationSettings(updates) {
    _presentationSettings = { ..._presentationSettings, ...updates };
}

// ============================================================================
// UI STATE - Getters & Setters (for slide editor)
// ============================================================================

export function getContextMenuTargetSlideId() { return _contextMenuTargetSlideId; }
export function setContextMenuTargetSlideId(value) { _contextMenuTargetSlideId = value; }

export function getContextMenuTargetType() { return _contextMenuTargetType; }
export function setContextMenuTargetType(value) { _contextMenuTargetType = value; }

export function getCurrentEditingSlideId() { return _currentEditingSlideId; }
export function setCurrentEditingSlideId(value) { _currentEditingSlideId = value; }

export function getSelectedType() { return _selectedType; }
export function setSelectedType(value) { _selectedType = value; }

export function getSelectedAnswer() { return _selectedAnswer; }
export function setSelectedAnswer(value) { _selectedAnswer = value; }

// ============================================================================
// CALLBACKS - For UI refresh
// ============================================================================

export function setRefreshSlideListCallback(callback) { 
    _refreshSlideListCallback = callback; 
}

export function triggerRefreshSlideList() {
    if (_refreshSlideListCallback) {
        return _refreshSlideListCallback();
    }
    return Promise.resolve();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate UUID v4
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Get or create unique ID for slide
 */
export async function getSlideUniqueId(slide, context) {
    slide.load('id');
    await context.sync();
    return slide.id;
}

// ============================================================================
// HIDDEN PARTICIPANTS TRACKING (for row overflow management)
// ============================================================================

let hiddenParticipantIds = new Set();
let hiddenRowsCount = 0;

/**
 * Get hidden participant IDs
 */
export function getHiddenParticipantIds() {
    return new Set(hiddenParticipantIds);
}

/**
 * Get hidden rows count
 */
export function getHiddenRowsCount() {
    return hiddenRowsCount;
}

/**
 * Mark participants as hidden (called when row overflows)
 * @param {string[]} participantIds - Array of participant IDs to hide
 */
export function hideParticipants(participantIds) {
    for (const id of participantIds) {
        hiddenParticipantIds.add(id);
    }
    hiddenRowsCount++;
    console.log(`👻 Hidden ${participantIds.length} participants (row ${hiddenRowsCount}). Total hidden: ${hiddenParticipantIds.size}`);
}

/**
 * Reset hidden participants state (call on new game/session)
 */
export function resetHiddenParticipants() {
    console.log(`🔄 Resetting hidden participants. Was: ${hiddenParticipantIds.size} hidden in ${hiddenRowsCount} rows`);
    hiddenParticipantIds.clear();
    hiddenRowsCount = 0;
}

/**
 * Check if a participant is hidden
 */
export function isParticipantHidden(userId) {
    return hiddenParticipantIds.has(userId);
}

/**
 * Remove a participant from hidden set (when they disconnect)
 * This allows them to reappear at the end if they reconnect
 */
export function unhideParticipant(userId) {
    if (hiddenParticipantIds.has(userId)) {
        hiddenParticipantIds.delete(userId);
        console.log(`👻 Unhidden participant ${userId}. Remaining hidden: ${hiddenParticipantIds.size}`);
        return true;
    }
    return false;
}

/**
 * Get presentation file info (path and display name)
 */
export async function getPresentationFileInfo() {
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

/**
 * Get presentation file name
 */
export async function getPresentationFileName() {
    const info = await getPresentationFileInfo();
    return info ? info.fullPath : null;
}

/**
 * Generate a unique ID for the presentation
 * Uses crypto.randomUUID() for a truly unique identifier
 */
function generateUniqueId() {
    // Use crypto.randomUUID() if available, otherwise fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, '').substring(0, 12);
    }
    // Fallback: generate a random hex string
    return Math.random().toString(16).substring(2, 14).padStart(12, '0');
}

/**
 * Get or create a persistent Kahoot ID stored in presentation tags
 * This ID is saved inside the .pptx file and persists across file moves/renames
 */
export async function getGameHashId() {
    try {
        console.log('🔑 Getting/creating Kahoot ID from presentation tags...');
        
        return await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            presentation.tags.load("items");
            await context.sync();
            
            // Check if kahoot_id already exists
            for (const tag of presentation.tags.items) {
                if (tag.key.toLowerCase() === 'kahoot_id') {
                    console.log('✅ Found existing Kahoot ID:', tag.value);
                    setHashId(tag.value);
                    return tag.value;
                }
            }
            
            // Create new unique ID
            const newId = generateUniqueId();
            console.log('🆕 Creating new Kahoot ID:', newId);
            
            presentation.tags.add('kahoot_id', newId);
            await context.sync();
            
            console.log('✅ Kahoot ID created and saved to presentation tags');
            console.log('💾 Remember to save the presentation to persist the ID!');
            
            setHashId(newId);
            return newId;
        });
        
    } catch (error) {
        console.error('❌ Error getting/creating Kahoot ID:', error);
        return null;
    }
}

/**
 * Check if presentation is saved (has a file name)
 */
export async function isPresentationSaved() {
    try {
        const fileName = await getPresentationFileName();
        // File is considered saved if we have a valid file name
        const isSaved = fileName !== null && fileName !== '' && fileName.length > 0;
        console.log('💾 Is presentation saved?', isSaved, '(filename:', fileName, ')');
        return isSaved;
    } catch (error) {
        console.error('Error checking if presentation is saved:', error);
        return false;
    }
}

/**
 * Get Window ID (presentation file name for saved files)
 */
export async function getWindowId() {
    try {
        // First, try to get the file name (for saved presentations)
        const fileName = await getPresentationFileName();
        
        if (fileName && fileName !== '' && fileName.length > 0) {
            // File is saved, use file name as ID
            console.log('📄 Using file name as window ID:', fileName);
            return fileName;
        }
        
        // If file not saved, generate a temporary ID
        const tempId = 'temp_' + Date.now();
        console.log('⚠️ File not saved, using temporary ID:', tempId);
        return tempId;
        
    } catch (error) {
        console.error('Error getting window ID:', error);
        return 'unknown_' + Date.now();
    }
}

/**
 * Save game data directly to PowerPoint presentation tags
 */
export async function saveGameData() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const gameState = {
                slideTypeData: _slideTypeData,
                presentationSettings: _presentationSettings
            };
            presentation.tags.add('kahoot_game_data', JSON.stringify(gameState));
            await context.sync();
        });
        console.log('✅ Game data saved to presentation');
    } catch (error) {
        console.error('❌ Failed to save game data:', error);
    }
}

/**
 * Load game data from PowerPoint presentation tags
 */
export async function loadGameData() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            presentation.tags.load("items");
            await context.sync();
            
            for (const tag of presentation.tags.items) {
                if (tag.key.toLowerCase() === 'kahoot_game_data') {
                    const gameState = JSON.parse(tag.value);
                    _slideTypeData = gameState.slideTypeData || {};
                    _presentationSettings = gameState.presentationSettings || {
                        questionWaitTime: 30,
                        clockActivationDelay: 5,
                        afterQuestionStatistics: true,
                        afterQuestionLeaderboard: false,
                        language: 'he'
                    };
                    console.log('✅ Game data loaded from presentation');
                    console.log('📋 Slide types loaded:', Object.keys(_slideTypeData).length);
                    console.log('⚙️ Settings loaded:', _presentationSettings);
                    return;
                }
            }
            console.log('ℹ️ No saved game data found (first time)');
        });
    } catch (error) {
        console.error('❌ Failed to load game data:', error);
    }
}

/**
 * Helper functions for slide type data (supports both string and object format)
 */
export function getSlideType(slideId) {
    const data = _slideTypeData[slideId];
    if (!data) return null;
    
    // If it's a string, return it directly (old format)
    if (typeof data === 'string') return data;
    
    // If it's an object, return the type property (new format)
    return data.type || null;
}

export function setSlideType(slideId, slideType) {
    const existingData = _slideTypeData[slideId];
    
    // If there's existing data as an object, preserve other properties
    if (existingData && typeof existingData === 'object') {
        _slideTypeData[slideId] = {
            ...existingData,
            type: slideType
        };
    } else {
        // Otherwise, just set the string (simple format)
        _slideTypeData[slideId] = slideType;
    }
}

export function getSlideData(slideId) {
    const data = _slideTypeData[slideId];
    if (!data) return null;
    
    // If it's a string, convert to object format
    if (typeof data === 'string') {
        return { type: data };
    }
    
    // Return the object as-is
    return data;
}

/**
 * Set slide data directly (for editor)
 */
export function setSlideData(slideId, data) {
    _slideTypeData[slideId] = data;
}

/**
 * Initialize slide data if not exists
 */
export function ensureSlideData(slideId) {
    if (!_slideTypeData[slideId]) {
        _slideTypeData[slideId] = {};
    }
    return _slideTypeData[slideId];
}

