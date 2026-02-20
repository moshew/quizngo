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

function normalizeHost(host) {
    return String(host || '').trim().replace(/\/+$/, '');
}

async function resolveAdminUrl(gamePin) {
    // Prefer explicit config if provided.
    if (typeof window !== 'undefined' && window.QUIZNGO_ADMIN_HOST) {
        return `${normalizeHost(window.QUIZNGO_ADMIN_HOST)}/${gamePin}`;
    }

    // Otherwise ask the game server for its admin URL (typically includes LAN IP).
    try {
        const response = await fetch(`${getApiBase()}game-info/${gamePin}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.status === 'success' && typeof data.adminUrl === 'string' && data.adminUrl.trim()) {
                return data.adminUrl.trim();
            }
        }
    } catch (error) {
        console.warn('Could not resolve admin URL from server:', error);
    }

    // Last fallback for local-only development.
    return `http://localhost:3002/${gamePin}`;
}

/**
 * Show status message (only for warnings and errors)
 */
export function showStatus(message, type = 'info') {
    console.log(`Status (${type}): ${message}`);

    if (!['warning', 'error', 'success'].includes(type)) return;

    const typeConfig = {
        warning: { color: '#856404', background: '#fff3cd', prefix: '⚠️' },
        error:   { color: '#721c24', background: '#f8d7da', prefix: '❌' },
        success: { color: '#155724', background: '#d4edda', prefix: '✅' }
    };
    const { color, background, prefix } = typeConfig[type];

    // Prefer detectedInfo if it exists; fall back to errorMessage
    const target = document.getElementById('detectedInfo') || document.getElementById('errorMessage');
    if (!target) return;

    target.textContent = `${prefix} ${message}`;
    target.style.display = 'block';
    target.style.background = background;
    target.style.color = color;

    setTimeout(() => {
        if (target.style.display === 'block') {
            target.style.display = 'none';
            // Restore errorMessage default style if it was used as fallback
            target.style.background = '';
            target.style.color = '';
        }
    }, 5000);
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

    // Resolve admin URL (configurable, otherwise fetched from server).
    const adminUrl = await resolveAdminUrl(gamePin);
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
