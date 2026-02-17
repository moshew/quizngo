/**
 * UI Manager Module
 * Handles all UI updates and interactions for slide types
 * 
 * NEW ARCHITECTURE:
 * - gamePin is the PRIMARY identifier (6 digits, generated when game starts)
 * - Admin accesses via /:gamePin URL
 */

import { getApiBase } from '../core/api.js';
import { 
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
 * Show admin connection overlay with QR code and admin URL
 * @param {string} gamePin - The game PIN to display
 */
export async function showAdminConnectionScreen(gamePin) {
    console.log('🎮 Showing admin connection overlay...');

    const overlay = document.getElementById('adminConnectionOverlay');
    if (!overlay) {
        console.error('❌ adminConnectionOverlay not found');
        return;
    }

    // Ensure translations are applied before showing
    if (window.updateDOM) {
        window.updateDOM();
    }

    // Show the overlay
    overlay.style.display = 'flex';

    if (!gamePin) {
        console.warn('⚠️ No gamePin provided to admin connection screen');
        return;
    }

    // Format PIN as XXX-XXX
    const formattedPin = gamePin.slice(0, 3) + '-' + gamePin.slice(3);

    // Set PIN display
    const pinEl = document.getElementById('adminOverlayPin');
    if (pinEl) pinEl.textContent = formattedPin;

    // Set admin URL (configurable via window.QUIZNGO_ADMIN_HOST)
    const adminHost = (typeof window !== 'undefined' && window.QUIZNGO_ADMIN_HOST) || 'http://localhost:3002';
    const adminUrl = `${adminHost}/${gamePin}`;
    const urlEl = document.getElementById('adminOverlayUrl');
    if (urlEl) urlEl.value = adminUrl;

    // Copy URL button
    const copyBtn = document.getElementById('btnCopyAdminUrl');
    if (copyBtn) {
        copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(adminUrl);
                const icon = copyBtn.querySelector('i');
                if (icon) {
                    icon.className = 'ms-Icon ms-Icon--CheckMark';
                    copyBtn.style.color = '#107c10';
                    setTimeout(() => {
                        icon.className = 'ms-Icon ms-Icon--Copy';
                        copyBtn.style.color = '';
                    }, 1500);
                }
            } catch (e) {
                // Fallback
                if (urlEl) { urlEl.select(); document.execCommand('copy'); }
            }
        };
    }

    // Load QR code from server
    const qrCodeUrl = `${getApiBase()}qr-code/${gamePin}?type=admin`;
    const errorLoadingQR = t('startScreen.errorLoadingQR', 'שגיאה בטעינת QR code');

    const qrArea = document.getElementById('adminOverlayQrArea');
    if (qrArea) {
        qrArea.innerHTML = `
            <img src="${qrCodeUrl}"
                 alt="Admin QR Code"
                 onload="console.log('✅ Admin QR code loaded')"
                 onerror="this.style.display='none'; this.parentElement.innerHTML = '<div style=\\'color:#d13438;font-size:13px;\\'>${errorLoadingQR}</div>';" />
        `;
    }

    console.log('✅ Admin connection overlay shown for PIN:', formattedPin);
}

/**
 * Hide admin connection overlay
 */
export function hideAdminConnectionScreen() {
    const overlay = document.getElementById('adminConnectionOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        console.log('✅ Admin connection overlay hidden');
    }
}

/**
 * Check if admin connection overlay is currently open
 */
export function isAdminConnectionScreenOpen() {
    const overlay = document.getElementById('adminConnectionOverlay');
    return overlay && overlay.style.display !== 'none';
}

// Note: Settings are now handled inline in Tab 3 of taskpane.html
// Note: Question answer selection is now handled in slide-type-editor.js
// Note: Shared actions are no longer used in the tab-based architecture
