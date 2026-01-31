/**
 * Event Handlers Module
 * Handles Office events like slide changes
 */

/* global Office */

import { getCurrentSlideNumber } from './navigation.js';
import { loadSlideType } from './slides.js';
import { startTimer, stopTimer } from './actions.js';
import { startAcceptingParticipants, stopAcceptingParticipants } from '../core/api.js';
import { 
    getCurrentSlideNumber as getSlideNumber,
    getCurrentSlideId,
    getSlideData,
    getHashId,
    triggerRefreshSlideList
} from '../core/state.js';

// Debounce timer for slide changes
let slideChangeDebounceTimer = null;

// Flag to prevent duplicate processing when navigation is triggered by WebSocket
let isNavigatingViaWebSocket = false;

// Track current participant acceptance state to avoid redundant API calls
let isAcceptingParticipants = false;

/**
 * Setup slide change listener
 */
export function setupSlideChangeListener(onSlideChangedCallback) {
    try {
        console.log('🔧 Setting up slide change event listener...');
        
        Office.context.document.addHandlerAsync(
            Office.EventType.DocumentSelectionChanged,
            onSlideChangedCallback,
            function(result) {
                if (result.status === Office.AsyncResultStatus.Succeeded) {
                    console.log('✅ Slide change event listener registered successfully');
                } else {
                    console.error('❌ Failed to register slide change listener:', result.error.message);
                }
            }
        );
    } catch (error) {
        console.error('❌ Error setting up slide change listener:', error);
    }
}

/**
 * Slide change event handler (debounced)
 */
export async function onSlideChanged(eventArgs) {
    // Ignore manual slide changes if we're currently navigating via WebSocket
    if (isNavigatingViaWebSocket) {
        console.log('📄 Slide selection changed event fired - IGNORED (WebSocket navigation in progress)');
        return;
    }
    
    console.log('📄 Slide selection changed event fired');
    
    // Debounce: Wait 300ms before processing
    if (slideChangeDebounceTimer) {
        clearTimeout(slideChangeDebounceTimer);
    }
    
    slideChangeDebounceTimer = setTimeout(async () => {
        await processSlideChange(false); // fromWebSocket = false (manual change)
    }, 300);
}

/**
 * Process slide change
 * @param {boolean} fromWebSocket - Whether this was triggered by WebSocket navigation
 */
export async function processSlideChange(fromWebSocket = false) {
    try {
        console.log('🔄 Processing slide change...');
        console.log(`   Source: ${fromWebSocket ? 'WebSocket' : 'Manual/Event'}`);
        
        // For WebSocket navigation: state is already set by navigateToSlideByIndex
        // For manual navigation: get current slide info
        if (!fromWebSocket) {
            await getCurrentSlideNumber();
        }
        
        const currentSlideNumber = getSlideNumber();
        const currentSlideId = getCurrentSlideId();
        
        console.log(`📍 Detected slide: ${currentSlideNumber} (ID: ${currentSlideId})`);
        
        // Update UI for new slide
        const currentSlideEl = document.getElementById('currentSlide');
        if (currentSlideEl) {
            currentSlideEl.textContent = currentSlideNumber;
        }
        
        // Get slide type BEFORE loading new UI
        const slideId = currentSlideId;
        let slideType = null;
        
        const slideData = getSlideData(slideId);
        if (slideData) {
            if (typeof slideData === 'object' && slideData.type) {
                slideType = slideData.type;
            } else if (typeof slideData === 'string') {
                slideType = slideData;
            }
        }
        
        console.log(`📄 Slide type: ${slideType}`);
        
        // Load slide type state (no UI loading in tab-based architecture)
        loadSlideType();
        
        // Update Slide List in Tab 1
        console.log('🔄 Refreshing slide list...');
        triggerRefreshSlideList().catch(e => console.error('Error refreshing list:', e));
        
        // Control participant acceptance based on slide type
        const hashId = getHashId();
        
        if (slideType === 'opening') {
            // On "opening" slide - start accepting participants (only if not already accepting)
            if (hashId && !isAcceptingParticipants) {
                console.log('🟢 Opening slide detected - starting to accept participants...');
                const success = await startAcceptingParticipants(hashId);
                if (success) {
                    isAcceptingParticipants = true;
                }
            } else if (isAcceptingParticipants) {
                console.log('ℹ️ Already accepting participants - no action needed');
            } else {
                console.warn('⚠️ Cannot start accepting participants - hashId not available');
            }
        } else if (slideType !== 'opening') {
            // Not on "opening" slide - stop accepting participants (only if currently accepting)
            if (hashId && isAcceptingParticipants) {
                console.log('🔴 Left opening slide - stopping participant acceptance...');
                const success = await stopAcceptingParticipants(hashId);
                if (success) {
                    isAcceptingParticipants = false;
                }
            } else if (!isAcceptingParticipants) {
                console.log('ℹ️ Not accepting participants - no action needed');
            }
        }
        
        // Auto-start timer ONLY if:
        // 1. This is from WebSocket navigation (not manual editing)
        // 2. Slide is a question
        if (fromWebSocket && slideType === 'question') {
            console.log('🎯 Question slide detected via WebSocket - auto-starting timer...');
            
            // Reset answers for new question
            const { resetCurrentQuestionAnswers } = await import('../core/websocket.js');
            resetCurrentQuestionAnswers();
            
            // Stop any existing timer first
            await stopTimer();
            
            // Start new timer with delay
            await startTimer();
        } else if (slideType !== 'question') {
            // Stop timer when leaving question slide
            await stopTimer();
        }
        
        console.log('✅ Slide change processed successfully');
        
    } catch (error) {
        console.error('❌ Error processing slide change:', error);
    }
}

/**
 * Set WebSocket navigation flag
 * Called by navigation module to prevent duplicate event processing
 */
export function setWebSocketNavigationFlag(value) {
    isNavigatingViaWebSocket = value;
    if (value) {
        console.log('🚩 WebSocket navigation flag SET');
    } else {
        console.log('🚩 WebSocket navigation flag CLEARED');
    }
}

/**
 * Reset participant acceptance state
 * Called when a new game starts (game_pin_registered)
 */
export function resetParticipantAcceptanceState() {
    isAcceptingParticipants = false;
    console.log('🔄 Reset participant acceptance state to: false');
}
