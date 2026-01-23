/**
 * Slide Manager Module
 * Handles slide type changes, loading, and saving
 */

import { 
    triggerAutoSave,
    getSlideType,
    setSlideType
} from '../core/state.js';

/**
 * Handle slide type change from dropdown (deprecated)
 * Note: This is now handled by confirmSlideTypeChange in slide-type-editor.js
 */
export function handleSlideTypeChange() {
    console.log('handleSlideTypeChange called - deprecated, use slide-type-editor.js');
}

/**
 * Save slide type to slideTypeData
 */
export function saveSlideType(slideType) {
    if (!window.currentSlideId) {
        console.warn('⚠️ No slide ID available, cannot save slide type');
        return;
    }
    
    const slideId = window.currentSlideId;
    const previousType = getSlideType(slideId);
    
    // Special handling for "question" type
    if (slideType === 'question') {
        const existingData = window.slideTypeData[slideId];
        
        if (!existingData || typeof existingData === 'string') {
            window.slideTypeData[slideId] = {
                type: slideType,
                correctAnswer: '1'
            };
        } else {
            existingData.type = slideType;
        }
    } else {
        setSlideType(slideId, slideType);
    }
    
    console.log(`💾 Slide type SAVED: ${slideType} for slide ${slideId}`);
    
    // Trigger auto-save
    triggerAutoSave();
    
    // Refresh list if function exists
    if (window.refreshSlideList) {
        window.refreshSlideList();
    }
}

/**
 * Load slide type for current slide
 * Now just logs and ensures state is consistent. No UI loading in tab-based architecture.
 */
export function loadSlideType() {
    if (!window.currentSlideId) {
        return;
    }
    
    const slideId = window.currentSlideId;
    let slideType = getSlideType(slideId);
    
    // Default to "transition" for new slides
    if (!slideType) {
        slideType = 'transition';
    }
    
    console.log(`🔍 Slide ${window.currentSlideNumber} (ID: ${slideId}) is type: ${slideType}`);
    
    // We don't load HTML anymore. The List in Tab 1 updates via refreshSlideList.
    // However, we might want to ensure the list highlights the correct item.
    if (window.refreshSlideList) {
        // We can just highlight the row without full refresh if optimized, 
        // but for now refreshSlideList handles selection class.
        // But refreshSlideList is async and reads from PPT.
        // We can optimize by just updating the DOM class if we know the ID.
        
        const rows = document.querySelectorAll('.slide-item');
        rows.forEach(row => row.classList.remove('selected'));
        
        // Find row by some attribute? We didn't add ID to LI.
        // Let's rely on refreshSlideList called by onSlideChanged.
    }
    
    // Load hidden state
    loadHiddenSlideState();
}

/**
 * Load hidden slide state from slideTypeData
 */
export function loadHiddenSlideState() {
    // Hidden slide feature might need UI element in the new layout if desired.
    // Currently no UI for it in the new tabs, so ignoring or logging.
    // const slideId = window.currentSlideId;
    // const isHidden = slideData && slideData.isHidden === true;
}

/**
 * Setup hide slide checkbox event listener
 */
export function setupHideSlideListener() {
    // No longer relevant in new UI unless we add the checkbox back
}
