/**
 * Slide Manager Module
 * Handles slide type changes, loading, and saving
 */

import { 
    updateUIForSlideType, 
    attachQuestionAnswerListener, 
    initializeStartScreen,
    loadSettingsIntoUI,
    attachSettingsEventListeners
} from './ui-manager.js';
import { 
    getSlideType, 
    setSlideType, 
    triggerAutoSave 
} from './presentation-state.js';

/**
 * Handle slide type change from dropdown
 */
export function handleSlideTypeChange(htmlCache) {
    const slideType = document.getElementById('slideType').value;
    console.log(`🔄 Slide type changed to: ${slideType} for slide ${window.currentSlideNumber} (ID: ${window.currentSlideId})`);
    saveSlideType(slideType);
    updateUIForSlideType(slideType, htmlCache).then(() => {
        // For question slides, attach event listener to correctAnswer dropdown
        if (slideType === 'question') {
            attachQuestionAnswerListener();
        }
        // For start slides, initialize QR code
        else if (slideType === 'start') {
            initializeStartScreen();
        }
    }).catch(err => {
        console.error('❌ Error in updateUIForSlideType:', err);
    });
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
    const isUpdate = previousType !== undefined && previousType !== null;
    
    // Special handling for "question" type
    if (slideType === 'question') {
        const existingData = window.slideTypeData[slideId];
        
        if (!existingData || typeof existingData === 'string') {
            window.slideTypeData[slideId] = {
                type: slideType,
                correctAnswer: '1'
            };
            console.log('💾 Slide type SAVED with default answer: 1');
        } else {
            existingData.type = slideType;
        }
    } else {
        setSlideType(slideId, slideType);
    }
    
    if (isUpdate) {
        console.log('🔄 Slide type UPDATED:', previousType, '→', slideType);
    } else {
        console.log('💾 Slide type SAVED (new):', slideType);
    }
    
    console.log('🗺️ Current slideTypeData:', window.slideTypeData);
    
    // Trigger auto-save
    triggerAutoSave();
}

/**
 * Load slide type for current slide and update UI
 */
export function loadSlideType(htmlCache) {
    if (!window.currentSlideId) {
        console.warn('⚠️ No current slide ID available');
        return;
    }
    
    const slideId = window.currentSlideId;
    let slideType = getSlideType(slideId);
    
    // Default to "transition" for new slides
    if (!slideType) {
        slideType = 'transition';
        console.log(`📋 No slide type found, defaulting to: ${slideType}`);
    }
    
    console.log(`🔍 Loading slide type for slide ${window.currentSlideNumber} (ID: ${slideId})`);
    console.log(`📋 Slide type: ${slideType}`);
    
    const slideTypeDropdown = document.getElementById('slideType');
    if (slideTypeDropdown) {
        slideTypeDropdown.value = slideType;
    }
    
    // Load hidden state
    loadHiddenSlideState();
    
    updateUIForSlideType(slideType, htmlCache).then(() => {
        // For question slides, attach event listener to correctAnswer dropdown
        if (slideType === 'question') {
            attachQuestionAnswerListener();
        }
        // For start slides, initialize QR code
        else if (slideType === 'start') {
            initializeStartScreen();
        }
    }).catch(err => {
        console.error('❌ Error in updateUIForSlideType:', err);
    });
}

/**
 * Load hidden slide state from slideTypeData
 */
export function loadHiddenSlideState() {
    const slideId = window.currentSlideId;
    if (!slideId) return;
    
    const hideSlideCheckbox = document.getElementById('hideSlide');
    if (!hideSlideCheckbox) return;
    
    const slideData = window.slideTypeData[slideId];
    const isHidden = slideData && slideData.isHidden === true;
    
    hideSlideCheckbox.checked = isHidden;
    console.log(`👁️ Slide ${window.currentSlideNumber} hidden state: ${isHidden}`);
}

/**
 * Save hidden slide state to slideTypeData
 */
export function saveHiddenSlideState(isHidden) {
    const slideId = window.currentSlideId;
    if (!slideId) {
        console.warn('⚠️ No slide ID available, cannot save hidden state');
        return;
    }
    
    // Ensure slideTypeData entry exists
    if (!window.slideTypeData[slideId]) {
        window.slideTypeData[slideId] = {
            type: 'transition'
        };
    } else if (typeof window.slideTypeData[slideId] === 'string') {
        // Convert from string to object
        window.slideTypeData[slideId] = {
            type: window.slideTypeData[slideId]
        };
    }
    
    window.slideTypeData[slideId].isHidden = isHidden;
    
    console.log(`🙈 Slide ${window.currentSlideNumber} hidden state saved: ${isHidden}`);
    console.log('🗺️ Current slideTypeData:', window.slideTypeData);
    
    // Trigger auto-save
    triggerAutoSave();
}

/**
 * Setup hide slide checkbox event listener
 */
export function setupHideSlideListener() {
    const hideSlideCheckbox = document.getElementById('hideSlide');
    if (!hideSlideCheckbox) {
        console.warn('⚠️ hideSlide checkbox not found');
        return;
    }
    
    hideSlideCheckbox.addEventListener('change', () => {
        saveHiddenSlideState(hideSlideCheckbox.checked);
    });
    
    console.log('✅ Hide slide listener attached');
}

/**
 * Open settings screen
 */
export async function openSettings(htmlCache) {
    console.log('⚙️ Opening settings...');
    console.log('📊 Current presentationSettings:', window.presentationSettings);
    
    await updateUIForSlideType('settings', htmlCache);
    
    // After HTML is loaded, load settings into UI
    setTimeout(() => {
        loadSettingsIntoUI();
        attachSettingsEventListeners();
    }, 0);
}

/**
 * Close settings and return to current slide
 */
export async function closeSettings(htmlCache) {
    console.log('⚙️ Closing settings...');
    loadSlideType(htmlCache);
}

