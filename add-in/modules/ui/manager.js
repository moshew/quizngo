/**
 * UI Manager Module
 * Handles all UI updates and interactions for slide types
 */

import { API_BASE } from '../core/api.js';
import { 
    getGameHashId,
    getGamePIN,
    getCurrentSlideNumber
} from '../core/state.js';
import { getParticipantsCount } from '../core/websocket.js';

// Helper function to get translations with fallback
function t(key, fallback = '') {
    if (window.t) {
        const translated = window.t(key);
        return translated !== key ? translated : fallback;
    }
    return fallback;
}

/**
 * Show status message (only for warnings and errors)
 */
export function showStatus(message, type = 'info') {
    console.log(`Status (${type}): ${message}`);
    
    const detectedInfo = document.getElementById('detectedInfo');
    if (detectedInfo) {
        let color = '#000';
        let background = '#f8f9fa';
        
        // Only show in UI for warnings, errors, and success
        if (type === 'warning') {
            color = '#856404';
            background = '#fff3cd';
        } else if (type === 'error') {
            color = '#721c24';
            background = '#f8d7da';
        } else if (type === 'success') {
            color = '#155724';
            background = '#d4edda';
        } else {
            // For plain info, don't show unless explicitly needed
            // return; 
            // Uncomment above if we want to hide info messages
        }

        // Show message if it's one of the special types
        if (['warning', 'error', 'success'].includes(type)) {
            detectedInfo.innerHTML = type === 'success' ? `✅ ${message}` : (type === 'error' ? `❌ ${message}` : `⚠️ ${message}`);
            detectedInfo.style.display = 'block';
            detectedInfo.style.background = background;
            detectedInfo.style.color = color;
            detectedInfo.style.padding = '10px';
            detectedInfo.style.borderRadius = '4px';
            detectedInfo.style.marginBottom = '10px';
            
            // Hide after 5 seconds
            setTimeout(() => {
                // Only hide if content hasn't changed significantly
                if (detectedInfo.style.display === 'block') {
                    detectedInfo.style.display = 'none';
                }
            }, 5000);
        }
    }
}

/**
 * Show error message
 */
export function showError(message, error = null) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
    
    if (error) {
        console.error('Error:', message, error);
    } else {
        console.error('Error:', message);
    }
}

/**
 * Update displayed values in the current UI
 */
export function updateDisplayedValues() {
    // Update Game ID (PIN)
    const gameIdElements = document.querySelectorAll('[id^="gameId"]');
    const gamePIN = getGamePIN();
    gameIdElements.forEach(el => {
        if (gamePIN) el.textContent = gamePIN;
    });
    
    // Update user count
    const userCountEl = document.getElementById('userCount');
    if (userCountEl) {
        userCountEl.textContent = getParticipantsCount();
    }
    
    // Update current slide
    const currentSlideEl = document.getElementById('currentSlide');
    const slideNum = getCurrentSlideNumber();
    if (currentSlideEl && slideNum) {
        currentSlideEl.textContent = slideNum;
    }
}

/**
 * Update auto-save status indicator (deprecated - no longer used)
 * Kept as no-op for backward compatibility
 */
export function updateAutoSaveStatus(status) {
    // No-op: Auto-save UI removed, data saves directly to PowerPoint tags
}

/**
 * Load start screen HTML into slideContentArea
 */
export function loadStartScreen() {
    console.log('🎮 Loading start screen...');
    
    const slideContentArea = document.getElementById('slideContentArea');
    if (!slideContentArea) {
        console.error('❌ slideContentArea not found');
        return;
    }
    
    const title = t('startScreen.title', 'התחל משחק');
    const scanQR = t('startScreen.scanQR', 'סרוק קוד QR לכניסה למשחק');
    const loadingQR = t('startScreen.loadingQR', 'טוען קוד QR...');
    const scanInstructions = t('startScreen.scanInstructions', 'סרוק את הקוד עם מכשיר נייד או היכנס לכתובת:');
    const loadingUrl = t('startScreen.loadingUrl', 'טוען כתובת...');
    const tip = t('startScreen.tip', 'המשתתפים יכולים להיכנס דרך הקוד או הכתובת');
    
    slideContentArea.innerHTML = `
        <style>
            .start-container { text-align: center; padding: 20px; }
            .game-title { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 20px; }
            .qr-section { background: white; border: 2px solid #0078d4; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .qr-code-container { display: flex; justify-content: center; align-items: center; margin: 20px 0; min-height: 200px; }
            #qrcode, #qrCanvas { display: inline-block; border: 2px solid #0078d4; border-radius: 8px; background: white; }
            .url-display { background-color: #f3f2f1; padding: 12px; border-radius: 4px; margin: 15px 0; font-family: monospace; font-size: 14px; word-break: break-all; color: #0078d4; }
            .instructions { font-size: 16px; color: #605e5c; margin: 15px 0; line-height: 1.6; }
            .loading { color: #666; font-style: italic; }
        </style>
        <div class="start-container">
            <div class="game-title">🎮 ${title}</div>
            <div class="qr-section">
                <h3 style="margin: 0 0 15px 0; color: #0078d4;">${scanQR}</h3>
                <div class="qr-code-container" id="qrCodeArea">
                    <div class="loading">${loadingQR}</div>
                </div>
                <div class="instructions">${scanInstructions}</div>
                <div class="url-display" id="adminUrl">${loadingUrl}</div>
            </div>
            <div style="margin-top: 20px; font-size: 12px; color: #999;">💡 ${tip}</div>
        </div>
    `;
    
    console.log('✅ Start screen loaded');
}

/**
 * Initialize start screen with QR code
 * Called when loading a slide of type 'start'
 */
export async function initializeStartScreen() {
    console.log('🎮 Initializing start screen...');
    
    try {
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const hashId = await getGameHashId();
        
        if (!hashId) {
            const errorNoGameId = t('startScreen.errorNoGameId', 'לא נמצא מזהה משחק. אנא שמור את המצגת תחילה.');
            document.getElementById('qrCodeArea').innerHTML = 
                `<div style="color: #d13438;">⚠️ ${errorNoGameId}</div>`;
            document.getElementById('adminUrl').textContent = errorNoGameId;
            return;
        }
        
        console.log('✅ Hash ID for start screen:', hashId);
        
        // Build the admin URL
        const adminUrl = `http://192.168.31.22:3002/${hashId}`;
        
        // Display the URL
        const adminUrlElement = document.getElementById('adminUrl');
        if (adminUrlElement) {
            adminUrlElement.textContent = adminUrl;
        }
        
        // Use server's QR code endpoint (works with Office Add-in CSP)
        const qrCodeUrl = `${API_BASE}qr-code/${hashId}`;
        
        console.log('📸 QR Code URL (from server):', qrCodeUrl);
        
        const errorLoadingQR = t('startScreen.errorLoadingQR', 'שגיאה בטעינת QR code');
        
        // Display QR code as image
        const qrCodeArea = document.getElementById('qrCodeArea');
        if (qrCodeArea) {
            qrCodeArea.innerHTML = `
                <img src="${qrCodeUrl}" 
                     alt="QR Code למשחק" 
                     style="width: 220px; height: 220px; border: 3px solid #0078d4; border-radius: 8px; background: white; padding: 10px;"
                     onload="console.log('✅ QR code image loaded successfully')"
                     onerror="console.error('❌ QR code failed to load from:', '${qrCodeUrl}'); this.style.display='none'; this.parentElement.innerHTML = '<div style=color:#d13438>⚠️ ${errorLoadingQR}</div>';" />
            `;
        }
        
        console.log('✅ Start screen initialized with QR code');
        console.log('📍 Admin URL:', adminUrl);
        
    } catch (error) {
        console.error('❌ Error initializing start screen:', error);
        const qrCodeArea = document.getElementById('qrCodeArea');
        if (qrCodeArea) {
            qrCodeArea.innerHTML = 
                `<div style="color: #d13438;">⚠️ שגיאה ביצירת קוד QR<br><small>${error.message}</small></div>`;
        }
        const adminUrlElement = document.getElementById('adminUrl');
        if (adminUrlElement) {
            adminUrlElement.textContent = 'שגיאה: ' + error.message;
        }
    }
}

// Note: Settings are now handled inline in Tab 3 of taskpane.html
// Note: Question answer selection is now handled in slide-type-editor.js
// Note: Shared actions are no longer used in the tab-based architecture
