/**
 * Event Handlers Module
 * Handles Office events like slide changes
 */

/* global Office */

import { getCurrentSlideNumber } from './navigation.js';
import { loadSlideType } from './slide-manager.js';
import { startTimer, stopTimer } from './game-actions.js';

// Debounce timer for slide changes
let slideChangeDebounceTimer = null;

// Flag to prevent duplicate processing when navigation is triggered by WebSocket
let isNavigatingViaWebSocket = false;

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
export async function onSlideChanged(eventArgs, htmlCache) {
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
        await processSlideChange(htmlCache, false); // fromWebSocket = false (manual change)
    }, 300);
}

/**
 * Process slide change
 * @param {Map} htmlCache - Cache for HTML files
 * @param {boolean} fromWebSocket - Whether this was triggered by WebSocket navigation
 */
export async function processSlideChange(htmlCache, fromWebSocket = false) {
    try {
        console.log('🔄 Processing slide change...');
        console.log(`   Source: ${fromWebSocket ? 'WebSocket' : 'Manual/Event'}`);
        
        // For WebSocket navigation: window.currentSlideNumber and window.currentSlideId 
        // are already set by navigateToSlideByIndex
        // For manual navigation: get current slide info
        if (!fromWebSocket) {
            await getCurrentSlideNumber();
        }
        
        console.log(`📍 Detected slide: ${window.currentSlideNumber} (ID: ${window.currentSlideId})`);
        
        // Update UI for new slide
        const currentSlideEl = document.getElementById('currentSlide');
        if (currentSlideEl) {
            currentSlideEl.textContent = window.currentSlideNumber;
        }
        
        // Get slide type BEFORE loading new UI
        const slideId = window.currentSlideId;
        let slideType = null;
        
        if (window.slideTypeData && window.slideTypeData[slideId]) {
            const slideTypeValue = window.slideTypeData[slideId];
            if (typeof slideTypeValue === 'object' && slideTypeValue.type) {
                slideType = slideTypeValue.type;
            } else {
                slideType = slideTypeValue;
            }
        }
        
        console.log(`📄 Slide type: ${slideType}`);
        
        // Load slide type UI
        loadSlideType(htmlCache);
        
        // Auto-start timer ONLY if:
        // 1. This is from WebSocket navigation (not manual editing)
        // 2. Slide is a question
        if (fromWebSocket && slideType === 'question') {
            console.log('🎯 Question slide detected via WebSocket - auto-starting timer...');
            
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

