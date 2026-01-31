/**
 * Slide Manager Module
 * Handles slide type changes, loading, and saving
 */

import { 
    saveGameData,
    getSlideType,
    setSlideType,
    getSlideTypeData,
    setSlideData,
    getCurrentSlideId,
    getCurrentSlideNumber,
    triggerRefreshSlideList
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
    const slideId = getCurrentSlideId();
    if (!slideId) {
        console.warn('⚠️ No slide ID available, cannot save slide type');
        return;
    }
    
    const previousType = getSlideType(slideId);
    
    // Special handling for "question" type
    if (slideType === 'question') {
        const slideTypeData = getSlideTypeData();
        const existingData = slideTypeData[slideId];
        
        if (!existingData || typeof existingData === 'string') {
            setSlideData(slideId, {
                type: slideType,
                correctAnswer: '1'
            });
        } else {
            existingData.type = slideType;
        }
    } else {
        setSlideType(slideId, slideType);
    }
    
    console.log(`💾 Slide type SAVED: ${slideType} for slide ${slideId}`);
    
    // Save to presentation
    saveGameData();
    
    // Refresh slide list
    triggerRefreshSlideList().catch(e => console.error('Error refreshing list:', e));
}

/**
 * Load slide type for current slide
 * Now just logs and ensures state is consistent. No UI loading in tab-based architecture.
 */
export function loadSlideType() {
    const slideId = getCurrentSlideId();
    if (!slideId) {
        return;
    }
    
    let slideType = getSlideType(slideId);
    
    // Default to "transition" for new slides
    if (!slideType) {
        slideType = 'transition';
    }
    
    console.log(`🔍 Slide ${getCurrentSlideNumber()} (ID: ${slideId}) is type: ${slideType}`);
    
    // We don't load HTML anymore. The List in Tab 1 updates via refreshSlideList.
    // However, we might want to ensure the list highlights the correct item.
    // triggerRefreshSlideList handles selection class.
    
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
