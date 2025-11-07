/**
 * Event Handlers Module
 * Handles Office events like slide changes
 */

/* global Office */

import { getCurrentSlideNumber } from './navigation.js';
import { loadSlideType } from './slide-manager.js';

// Debounce timer for slide changes
let slideChangeDebounceTimer = null;

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
    console.log('📄 Slide selection changed event fired');
    
    // Debounce: Wait 300ms before processing
    if (slideChangeDebounceTimer) {
        clearTimeout(slideChangeDebounceTimer);
    }
    
    slideChangeDebounceTimer = setTimeout(async () => {
        await processSlideChange(htmlCache);
    }, 300);
}

/**
 * Process slide change
 */
export async function processSlideChange(htmlCache) {
    try {
        console.log('🔄 Processing slide change...');
        
        // Get current slide number and ID
        await getCurrentSlideNumber();
        
        console.log(`📍 Detected slide: ${window.currentSlideNumber} (ID: ${window.currentSlideId})`);
        
        // Update UI for new slide
        const currentSlideEl = document.getElementById('currentSlide');
        if (currentSlideEl) {
            currentSlideEl.textContent = window.currentSlideNumber;
        }
        
        // Load slide type for the new slide
        loadSlideType(htmlCache);
        
        console.log('✅ Slide change processed successfully');
        
    } catch (error) {
        console.error('❌ Error processing slide change:', error);
    }
}

