/**
 * UI Manager Module
 * Handles all UI updates and interactions for slide types
 */

import { API_BASE } from '../core/api.js';
import { getGameHashId } from '../core/state.js';

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
    // Update Game ID
    const gameIdElements = document.querySelectorAll('[id^="gameId"]');
    gameIdElements.forEach(el => {
        if (window.gameId) el.textContent = window.gameId;
    });
    
    // Update user count
    const userCountEl = document.getElementById('userCount');
    if (userCountEl && typeof window.getParticipantsCount === 'function') {
        userCountEl.textContent = window.getParticipantsCount();
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

/**
 * Update auto-save status indicator
 */
export function updateAutoSaveStatus(status) {
    const statusElement = document.getElementById('autoSaveStatus');
    if (!statusElement) return;
    
    switch (status) {
        case 'pending':
            statusElement.textContent = '⏱️ שינויים ממתינים לשמירה...';
            statusElement.style.color = '#ffc107';
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
            <div class="game-title">🎮 התחל משחק</div>
            <div class="qr-section">
                <h3 style="margin: 0 0 15px 0; color: #0078d4;">סרוק קוד QR לכניסה למשחק</h3>
                <div class="qr-code-container" id="qrCodeArea">
                    <div class="loading">טוען קוד QR...</div>
                </div>
                <div class="instructions">סרוק את הקוד עם מכשיר נייד או היכנס לכתובת:</div>
                <div class="url-display" id="adminUrl">טוען כתובת...</div>
            </div>
            <div style="margin-top: 20px; font-size: 12px; color: #999;">💡 המשתתפים יכולים להיכנס דרך הקוד או הכתובת</div>
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
            document.getElementById('qrCodeArea').innerHTML = 
                '<div style="color: #d13438;">⚠️ לא נמצא מזהה משחק. אנא שמור את המצגת תחילה.</div>';
            document.getElementById('adminUrl').textContent = 'שגיאה: לא נמצא מזהה משחק';
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
        
        // Display QR code as image
        const qrCodeArea = document.getElementById('qrCodeArea');
        if (qrCodeArea) {
            qrCodeArea.innerHTML = `
                <img src="${qrCodeUrl}" 
                     alt="QR Code למשחק" 
                     style="width: 220px; height: 220px; border: 3px solid #0078d4; border-radius: 8px; background: white; padding: 10px;"
                     onload="console.log('✅ QR code image loaded successfully')"
                     onerror="console.error('❌ QR code failed to load from:', '${qrCodeUrl}'); this.style.display='none'; this.parentElement.innerHTML = '<div style=color:#d13438>⚠️ שגיאה בטעינת QR code</div>';" />
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
