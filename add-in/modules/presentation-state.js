/**
 * Presentation State Manager Module
 * Handles presentation data saving, loading, file management, and auto-save
 */

/* global Office, PowerPoint */

import { API_BASE } from './api.js';
import { updateAutoSaveStatus } from './ui-manager.js';

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

// Auto-save mechanism variables
let autoSaveTimer = null;
let hasUnsavedChanges = false;
const AUTO_SAVE_DELAY = 0; // Immediate save

// Hidden participants tracking (for row overflow management)
// Once a row is "hidden" due to overflow, participants in it are permanently hidden until reset
let hiddenParticipantIds = new Set(); // Set of userId that are hidden and won't be displayed
let hiddenRowsCount = 0; // Number of rows that have been hidden

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
 * Create hash from path (client-side implementation)
 */
export function createHashFromPath(path) {
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
        
        // Simple hash implementation
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

/**
 * Get the game hash ID
 */
export async function getGameHashId() {
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
 * Save presentation data to server
 */
export async function savePresentationData() {
    try {
        console.log('🚀 Starting save process...');
        
        // CRITICAL: Check if presentation is saved first
        const isSaved = await isPresentationSaved();
        
        if (!isSaved) {
            console.error('❌ Cannot save - presentation is not saved to disk');
            return;
        }
        
        // Get file info (full path + display name)
        const fileInfo = await getPresentationFileInfo();
        
        if (!fileInfo || !fileInfo.fullPath) {
            console.log('🚫 Could not get file info');
            return;
        }
        
        console.log('✅ Presentation is saved');
        console.log('📄 Display name:', fileInfo.displayName);
        console.log('📁 Full path:', fileInfo.fullPath);
        
        // Generate hash ID client-side
        const hashId = createHashFromPath(fileInfo.fullPath);
        
        if (!hashId) {
            console.error('❌ Failed to generate hash ID');
            return;
        }
        
        console.log('🔑 Hash ID:', hashId);
        
        // Prepare game state to save
        const gameState = {
            slideTypeData: window.slideTypeData || {},
            presentationSettings: window.presentationSettings || {}
        };
        
        console.log('📦 Saving game state:', JSON.stringify(gameState, null, 2));
        
        // Send to server
        const response = await fetch(API_BASE + 'save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hashId: hashId,
                data: gameState  // Server expects 'data' not 'gameState'
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Server response:', result);
        
        if (result.status === 'success') {
            console.log('✅ Data saved successfully');
            return true;
        } else {
            throw new Error(result.message || 'Unknown error');
        }
        
    } catch (error) {
        console.error('❌ Save failed:', error);
        throw error;
    }
}

/**
 * Load presentation data from server
 */
export async function loadPresentationData() {
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
            console.log('📦 Server response:', JSON.stringify(result, null, 2));
            
            // Server returns data directly (not wrapped in gameState)
            if (result.status === 'success' && result.data) {
                const gameState = result.data;
                
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
                    console.log('⚠️ No saved settings, using defaults');
                }
                
                return gameState;
            } else {
                console.log('ℹ️ No saved data found');
                console.log('   result.status:', result?.status);
                console.log('   result.data:', result?.data);
                return null;
            }
        } else {
            const errorText = await response.text();
            console.log('❌ Server returned error:', response.status, errorText);
            return null;
        }
    } catch (error) {
        console.log('⚠️ Loading error:', error.message);
        return null;
    }
}

/**
 * Helper functions for slide type data (supports both string and object format)
 */
export function getSlideType(slideId) {
    const data = window.slideTypeData[slideId];
    if (!data) return null;
    
    // If it's a string, return it directly (old format)
    if (typeof data === 'string') return data;
    
    // If it's an object, return the type property (new format)
    return data.type || null;
}

export function setSlideType(slideId, slideType) {
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

export function getSlideData(slideId) {
    const data = window.slideTypeData[slideId];
    if (!data) return null;
    
    // If it's a string, convert to object format
    if (typeof data === 'string') {
        return { type: data };
    }
    
    // Return the object as-is
    return data;
}

/**
 * Trigger auto-save (debounced)
 */
export function triggerAutoSave() {
    console.log('⏰ triggerAutoSave called');
    
    if (autoSaveTimer) {
        console.log('🔄 Clearing existing auto-save timer');
        clearTimeout(autoSaveTimer);
    }
    
    hasUnsavedChanges = true;
    updateAutoSaveStatus('pending');
    console.log('📝 Unsaved changes marked, scheduling auto-save...');
    
    autoSaveTimer = setTimeout(async () => {
        await performAutoSave();
    }, AUTO_SAVE_DELAY);
}

/**
 * Perform auto-save
 */
async function performAutoSave() {
    if (!hasUnsavedChanges) {
        console.log('ℹ️ No unsaved changes, skipping auto-save');
        return;
    }
    
    console.log('💾 Performing auto-save...');
    
    const isSaved = await isPresentationSaved();
    
    if (!isSaved) {
        console.log('⚠️ Presentation not saved, auto-save will wait');
        updateAutoSaveStatus('waiting');
        
        autoSaveTimer = setTimeout(async () => {
            await performAutoSave();
        }, 5000);
        return;
    }
    
    try {
        updateAutoSaveStatus('saving');
        
        await savePresentationData();
        
        hasUnsavedChanges = false;
        autoSaveTimer = null;
        
        updateAutoSaveStatus('saved');
        console.log('✅ Auto-save completed successfully');
        
        setTimeout(() => {
            updateAutoSaveStatus('idle');
        }, 2000);
        
    } catch (error) {
        console.error('❌ Auto-save failed:', error);
        updateAutoSaveStatus('error');
        
        setTimeout(() => {
            updateAutoSaveStatus('idle');
        }, 5000);
    }
}

