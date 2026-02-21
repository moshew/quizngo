/**
 * Navigation Module
 * Handles all PowerPoint navigation logic
 */

/* global PowerPoint, Office */

import { processSlideChange, setWebSocketNavigationFlag } from './events.js';
import { 
    getSlideTypeData, 
    getPresentationSettings,
    getCurrentSlideNumber as getStateSlideNumber,
    getCurrentSlideId as getStateSlideId,
    setCurrentSlideNumber,
    setCurrentSlideId
} from '../core/state.js';

function getLastQuestionSlideIndex() {
    const value = window.lastQuestionSlideIndex;
    return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * Navigate to first slide in PowerPoint
 */
export async function goToFirstSlideInPowerPoint() {
    try {
        console.log('📍 Resetting to first slide...');

        // Use navigateToSlideByIndex to ensure consistent behavior in both edit and presentation modes
        const success = await navigateToSlideByIndex(0); // Index 0 = first slide

        if (success) {
            console.log('✅ Successfully navigated to first slide');
            return true;
        } else {
            console.error('❌ Failed to navigate to first slide');
            return false;
        }

    } catch (error) {
        console.error('❌ Error in goToFirstSlideInPowerPoint:', error);
        throw error;
    }
}

/**
 * Navigate to the first slide with type "opening"
 * Falls back to first slide if no opening slide is found
 */
export async function goToOpeningSlide() {
    try {
        console.log('📍 Looking for opening slide...');

        return await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            slides.load('items');
            await context.sync();

            // Load all slide IDs
            for (let i = 0; i < slides.items.length; i++) {
                slides.items[i].load('id');
            }
            await context.sync();

            const slideTypeData = getSlideTypeData();

            // Find the first slide with type "opening"
            for (let i = 0; i < slides.items.length; i++) {
                const slideId = slides.items[i].id;
                const slideTypeValue = slideTypeData[slideId];
                let slideType = null;

                if (slideTypeValue) {
                    if (typeof slideTypeValue === 'object' && slideTypeValue.type) {
                        slideType = slideTypeValue.type;
                    } else {
                        slideType = slideTypeValue;
                    }
                }

                if (slideType === 'opening') {
                    console.log(`✅ Found opening slide at index ${i} (ID: ${slideId})`);
                    const success = await navigateToSlideByIndex(i, slideId);
                    return success;
                }
            }

            // No opening slide found - fall back to first slide
            console.log('⚠️ No opening slide found, navigating to first slide');
            const success = await navigateToSlideByIndex(0);
            return success;
        });

    } catch (error) {
        console.error('❌ Error in goToOpeningSlide:', error);
        // Fallback to first slide
        return await goToFirstSlideInPowerPoint();
    }
}

/**
 * Get all slide IDs in order
 */
export async function getAllSlideIds() {
    try {
        return await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            slides.load('items');
            await context.sync();
            
            const slideIds = [];
            for (let i = 0; i < slides.items.length; i++) {
                slides.items[i].load('id');
            }
            await context.sync();
            
            for (let i = 0; i < slides.items.length; i++) {
                slideIds.push(slides.items[i].id);
            }
            
            return slideIds;
        });
    } catch (error) {
        console.error('Error getting slide IDs:', error);
        return [];
    }
}

/**
 * Calculate next slide locally based on game logic
 */
export function calculateNextSlideLocally(currentIndex, currentSlideType, slideIds, slideTypeData, settings, totalSlides) {
    const lastQuestionSlideIndex = getLastQuestionSlideIndex();

    console.log('🧮 Calculating next slide locally...');
    console.log(`   Current: index=${currentIndex}, type=${currentSlideType}`);
    console.log(`   Total slides: ${totalSlides}`);
    console.log(`   Settings:`, settings);
    console.log(`   💭 lastQuestionSlideIndex at start: ${lastQuestionSlideIndex}`);
    
    // Validate inputs
    if (currentIndex === undefined || currentIndex === null || totalSlides === 0) {
        return { nextIndex: currentIndex, reason: 'Invalid slide data' };
    }
    
    // Build slide types by index
    const slideTypesByIndex = {};
    for (let i = 0; i < slideIds.length; i++) {
        const slideId = slideIds[i];
        if (slideTypeData[slideId]) {
            const slideTypeValue = slideTypeData[slideId];
            // Handle both string and object formats
            if (typeof slideTypeValue === 'object' && slideTypeValue.type) {
                slideTypesByIndex[i] = slideTypeValue.type;
            } else {
                slideTypesByIndex[i] = slideTypeValue;
            }
            console.log(`      [${i}] ${slideId} → ${slideTypesByIndex[i]}`);
        } else {
            console.log(`      [${i}] ${slideId} → (no type defined)`);
        }
    }
    
    console.log('   ✅ Slide types by index:', slideTypesByIndex);
    
    // LOGIC IMPLEMENTATION
    
    // Special handling for statistics and leaderboard slides
    if (currentSlideType === 'statistics') {
        const showLeaderboard = settings.afterQuestionLeaderboard || false;
        console.log(`   📊 On statistics slide, showLeaderboard=${showLeaderboard}`);
        console.log(`   📍 Returning point: ${lastQuestionSlideIndex}`);
        
        if (showLeaderboard) {
            // Look for ANY leaderboard slide in the presentation
            for (let i = 0; i < totalSlides; i++) {
                if (slideTypesByIndex[i] === 'leaderboard') {
                    console.log(`   🏆 Found leaderboard at index ${i}`);
                    return { nextIndex: i, reason: 'Going to leaderboard after statistics' };
                }
            }
            console.log(`   ⚠️ No leaderboard found, returning to original position`);
        }
        
        // No leaderboard or not showing - return to position after the original question
        if (lastQuestionSlideIndex !== null) {
            let nextIndex = lastQuestionSlideIndex + 1;
            
            // Skip any statistics/leaderboard slides
            while (nextIndex < totalSlides) {
                const nextType = slideTypesByIndex[nextIndex];
                if (nextType === 'statistics' || nextType === 'leaderboard') {
                    nextIndex++;
                } else {
                    break;
                }
            }
            
            if (nextIndex >= totalSlides) {
                nextIndex = totalSlides - 1;
            }
            
            console.log(`   🔙 Returning to index ${nextIndex} (after question at ${lastQuestionSlideIndex})`);
            window.lastQuestionSlideIndex = null; // Reset
            return { nextIndex: nextIndex, reason: 'Returning to position after original question' };
        } else {
            // Fallback: just go to next slide
            let nextIndex = currentIndex + 1;
            while (nextIndex < totalSlides) {
                const nextType = slideTypesByIndex[nextIndex];
                if (nextType === 'statistics' || nextType === 'leaderboard') {
                    nextIndex++;
                } else {
                    break;
                }
            }
            if (nextIndex >= totalSlides) {
                nextIndex = totalSlides - 1;
            }
            return { nextIndex: nextIndex, reason: 'No return point saved, going to next slide' };
        }
    }
    
    if (currentSlideType === 'leaderboard') {
        // After leaderboard, return to position after the original question
        console.log(`   🏆 On leaderboard slide`);
        console.log(`   📍 Returning point: ${lastQuestionSlideIndex}`);
        
        if (lastQuestionSlideIndex !== null) {
            let nextIndex = lastQuestionSlideIndex + 1;
            
            // Skip any statistics/leaderboard slides
            while (nextIndex < totalSlides) {
                const nextType = slideTypesByIndex[nextIndex];
                if (nextType === 'statistics' || nextType === 'leaderboard') {
                    nextIndex++;
                } else {
                    break;
                }
            }
            
            if (nextIndex >= totalSlides) {
                nextIndex = totalSlides - 1;
            }
            
            console.log(`   🔙 Returning to index ${nextIndex} (after question at ${lastQuestionSlideIndex})`);
            window.lastQuestionSlideIndex = null; // Reset
            return { nextIndex: nextIndex, reason: 'Returning to position after original question' };
        } else {
            // Fallback: just go to next slide
            let nextIndex = currentIndex + 1;
            while (nextIndex < totalSlides) {
                const nextType = slideTypesByIndex[nextIndex];
                if (nextType === 'statistics' || nextType === 'leaderboard') {
                    nextIndex++;
                } else {
                    break;
                }
            }
            if (nextIndex >= totalSlides) {
                nextIndex = totalSlides - 1;
            }
            return { nextIndex: nextIndex, reason: 'No return point saved, going to next slide' };
        }
    }
    
    // For question slides, remember the position for return after statistics/leaderboard
    if (currentSlideType === 'question') {
        console.log(`   ❓ On question slide - saving position ${currentIndex}`);
        
        const showStatistics = settings.afterQuestionStatistics || false;
        const showLeaderboard = settings.afterQuestionLeaderboard || false;
        console.log(`   📊 showStatistics=${showStatistics}, showLeaderboard=${showLeaderboard}`);
        
        // Only save position if we're going to show statistics or leaderboard
        if (showStatistics || showLeaderboard) {
            window.lastQuestionSlideIndex = currentIndex;
        }
        
        if (showStatistics) {
            // Look for ANY statistics slide in the presentation
            for (let i = 0; i < totalSlides; i++) {
                if (slideTypesByIndex[i] === 'statistics') {
                    console.log(`   📊 Found statistics slide at index ${i}`);
                    return { nextIndex: i, reason: 'Going to statistics after question' };
                }
            }
            console.log(`   ⚠️ No statistics slide found, continuing normally`);
        } else if (showLeaderboard) {
            // No statistics, but show leaderboard - jump directly to leaderboard
            for (let i = 0; i < totalSlides; i++) {
                if (slideTypesByIndex[i] === 'leaderboard') {
                    console.log(`   🏆 Found leaderboard slide at index ${i}`);
                    return { nextIndex: i, reason: 'Going to leaderboard after question (no statistics)' };
                }
            }
            console.log(`   ⚠️ No leaderboard slide found, continuing normally`);
        }
        
        // No statistics or leaderboard to show - just go to next slide normally and skip them
        let nextIndex = currentIndex + 1;
        while (nextIndex < totalSlides) {
            const nextType = slideTypesByIndex[nextIndex];
            if (nextType === 'statistics' || nextType === 'leaderboard') {
                nextIndex++;
            } else {
                break;
            }
        }
        if (nextIndex >= totalSlides) {
            nextIndex = totalSlides - 1;
        }
        return { nextIndex: nextIndex, reason: 'Normal flow from question (no statistics/leaderboard)' };
    }
    
    // Default: go to next slide
    let nextIndex = currentIndex + 1;
    if (nextIndex >= totalSlides) {
        nextIndex = totalSlides - 1; // Stay on last slide
    }
    console.log(`   ➡️ Default: going to slide ${nextIndex}`);
    return { nextIndex: nextIndex, reason: 'Default next slide' };
}

/**
 * Navigate to slide by index
 */
export async function navigateToSlideByIndex(slideIndex, newSlideId = null) {
    console.log('═'.repeat(80));
    console.log(`🎯 navigateToSlideByIndex CALLED`);
    console.log(`   Input slideIndex (0-based): ${slideIndex}`);
    console.log(`   Input newSlideId: ${newSlideId}`);
    
    let targetSlideId = newSlideId;
    
    // Get the target slide ID if not provided
    if (!targetSlideId) {
        try {
            await PowerPoint.run(async (context) => {
                const slides = context.presentation.slides;
                const targetSlide = slides.getItemAt(slideIndex);
                targetSlide.load("id");
                await context.sync();
                targetSlideId = targetSlide.id;
            });
        } catch (error) {
            console.error('❌ Error getting slide ID:', error);
        }
    }
    
    console.log(`   Target slide ID: ${targetSlideId}`);
    
    // *** UPDATE TRACKING IMMEDIATELY BEFORE NAVIGATION ***
    // This ensures the tracking is updated synchronously, preventing race conditions
    // when rapid navigation commands are issued (e.g., go_to_first + next_slide)
    setCurrentSlideNumber(slideIndex + 1);
    setCurrentSlideId(targetSlideId);
    console.log(`   Pre-navigation tracking update: slideNumber=${slideIndex + 1}, slideId=${targetSlideId}`);
    
    // Navigate using goToByIdAsync (works in both edit and presentation modes)
    const navigationSucceeded = await new Promise((resolve) => {
        // goToByIdAsync uses 1-based index!
        const slideNumber = slideIndex + 1; // Convert from 0-based to 1-based
        
        Office.context.document.goToByIdAsync(
            slideNumber,
            Office.GoToType.Index,
            (asyncResult) => {
                if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                    console.error(`❌ Navigation failed: ${asyncResult.error.message}`);
                    resolve(false);
                } else {
                    console.log(`✅ Successfully navigated to slide ${slideNumber}`);
                    resolve(true);
                }
            }
        );
    });
    
    // Tracking was already updated before navigation (see above)
    // This ensures immediate availability for subsequent navigation calls
    console.log(`   Post-navigation verification: slideNumber=${getStateSlideNumber()}, slideId=${getStateSlideId()}`);
    
    // Trigger slide change processing (timer, UI updates, etc.)
    if (navigationSucceeded) {
        console.log('🔄 Triggering processSlideChange after WebSocket navigation...');
        
        // Set flag to prevent duplicate processing from DocumentSelectionChanged event
        setWebSocketNavigationFlag(true);
        
        // Small delay to ensure PowerPoint navigation completes and to prevent race conditions
        // with the DocumentSelectionChanged event (50ms is sufficient after testing)
        setTimeout(async () => {
            try {
                await processSlideChange(true); // fromWebSocket = true
                console.log('✅ processSlideChange completed');
            } catch (error) {
                console.error('❌ Error in processSlideChange:', error);
            } finally {
                // Clear flag after processing (with extra delay to ensure event is ignored)
                setTimeout(() => {
                    setWebSocketNavigationFlag(false);
                }, 100);
            }
        }, 50); // Reduced from 300ms - tracking is now updated immediately before navigation
    }
    
    console.log('═'.repeat(80));
    
    return navigationSucceeded;
}

/**
 * Go to next slide in PowerPoint
 */
export async function goToNextSlideInPowerPoint() {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 goToNextSlideInPowerPoint called');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            const totalSlides = slides.items.length;
            console.log(`📊 Total slides: ${totalSlides}`);
            
            // Load all slide IDs
            for (let i = 0; i < slides.items.length; i++) {
                slides.items[i].load('id');
            }
            await context.sync();
            
            // Get current slide index from state (works in both edit and presentation modes)
            let currentIndex = -1;
            let currentSlideId = getStateSlideId() || null;
            
            // Use tracked slide number (1-based) and convert to 0-based index
            const trackedSlideNumber = getStateSlideNumber();
            if (trackedSlideNumber && trackedSlideNumber > 0) {
                currentIndex = trackedSlideNumber - 1;
                console.log(`📍 Using tracked slide number: ${trackedSlideNumber} (index: ${currentIndex})`);
            }
            
            // Fallback: try to detect current slide from PowerPoint (works only in edit mode)
            if (currentIndex === -1 || !currentSlideId) {
                try {
                    const selectedSlides = presentation.getSelectedSlides();
                    selectedSlides.load('items');
                    await context.sync();
                    
                    if (selectedSlides.items.length > 0) {
                        const currentSlide = selectedSlides.items[0];
                        currentSlide.load('id');
                        await context.sync();
                        currentSlideId = currentSlide.id;
                        
                        // Find the index
                        for (let i = 0; i < slides.items.length; i++) {
                            if (slides.items[i].id === currentSlideId) {
                                currentIndex = i;
                                break;
                            }
                        }
                        console.log(`📍 Detected from PowerPoint: index=${currentIndex}, id=${currentSlideId}`);
                    }
                } catch (error) {
                    console.log('⚠️ Could not detect current slide from PowerPoint (might be in presentation mode)');
                }
            }
            
            // Final fallback
            if (currentIndex === -1) {
                console.log('⚠️ No current slide detected, starting from first slide');
                currentIndex = 0;
            }
            
            console.log(`📍 Current slide: index=${currentIndex}, id=${currentSlideId}`);
            
            // Get current slide type
            const slideIds = slides.items.map(s => s.id);
            
            // If we don't have currentSlideId yet, get it from the slides array
            if (!currentSlideId && currentIndex >= 0 && currentIndex < slideIds.length) {
                currentSlideId = slideIds[currentIndex];
                setCurrentSlideId(currentSlideId);
                console.log(`🔍 Retrieved slide ID from index: ${currentSlideId}`);
            }
            
            const slideTypeData = getSlideTypeData();
            const slideTypeValue = slideTypeData[currentSlideId];
            let currentSlideType = null;
            
            // Handle both string and object formats
            if (slideTypeValue) {
                if (typeof slideTypeValue === 'object' && slideTypeValue.type) {
                    currentSlideType = slideTypeValue.type;
                } else {
                    currentSlideType = slideTypeValue;
                }
            }
            
            console.log(`🏷️ Current slide type: ${currentSlideType}`);
            
            // Calculate next slide based on game logic
            const result = calculateNextSlideLocally(
                currentIndex,
                currentSlideType,
                slideIds,
                slideTypeData || {},
                getPresentationSettings() || {},
                totalSlides
            );
            
            const nextIndex = result.nextIndex;
            const reason = result.reason;
            
            console.log(`🎯 Next slide: index=${nextIndex}, reason="${reason}"`);
            console.log(`📊 Checking if last slide: nextIndex=${nextIndex}, totalSlides=${totalSlides}, isLast=${nextIndex >= totalSlides - 1}`);
            
            // Check if the calculated next slide is beyond or at the last slide
            const isLastSlide = nextIndex >= totalSlides - 1;
            
            if (nextIndex !== currentIndex) {
                const nextSlideId = slideIds[nextIndex];
                console.log(`📄 Navigating to: index=${nextIndex}, id=${nextSlideId}`);
                
                const success = await navigateToSlideByIndex(nextIndex, nextSlideId);
                
                if (success) {
                    console.log('✅ Navigation successful');
                    
                    // Check if we reached or passed the last slide
                    if (isLastSlide) {
                        console.log('🏁 Reached last slide (or beyond) - notifying server to close game');
                        await notifyGameComplete();
                    }
                    
                    return true;
                } else {
                    console.error('❌ Navigation failed');
                    return false;
                }
            } else {
                console.log('📍 Already on target slide, no navigation needed');
                
                // Check if we're already on or past the last slide
                if (isLastSlide) {
                    console.log('🏁 Already on last slide (or beyond) - notifying server to close game');
                    await notifyGameComplete();
                }
                
                return true;
            }
        });
        
    } catch (error) {
        console.error('❌ Error in goToNextSlideInPowerPoint:', error);
        throw error;
    }
}

/**
 * Notify server that game is complete (reached last slide)
 * Uses gamePin as the primary identifier
 */
async function notifyGameComplete() {
    try {
        // Get gamePin from state (gamePin is now the primary identifier)
        const { getGamePIN } = await import('../core/state.js');
        const gamePin = getGamePIN();
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🏁 notifyGameComplete called');
        console.log(`   Game PIN: ${gamePin}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (!gamePin) {
            console.warn('⚠️ Cannot notify game complete - no game PIN available');
            return;
        }
        
        console.log(`📤 Notifying server: game complete for PIN ${gamePin}`);
        
        const { getApiUrl } = await import('../core/api.js');
        const url = getApiUrl(`?close_game&game_pin=${gamePin}`);
        
        console.log(`📡 Sending request to: ${url}`);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('📥 Server response:', data);
        
        if (data.status === 'success') {
            console.log('✅ Server notified successfully - game closed');
        } else {
            console.error('❌ Failed to notify server:', data.message);
        }
    } catch (error) {
        console.error('❌ Error notifying game complete:', error);
        console.error('   Error details:', error.message);
    }
}

/**
 * Simulate click in PowerPoint (spacebar press)
 */
export async function simulateClickInPowerPoint() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🖱️ simulateClickInPowerPoint called');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        // Try Office.js method first
        const success = await simulateSpacebarWithOfficeAPI();
        
        if (success) {
            console.log('✅ Successfully advanced animation/slide using Office.js');
            return;
        } else {
            console.log('⚠️ Office.js method did not work, trying fallback...');
            // Fallback to simpler method
            await simulateSpacebarFallback();
        }
        
    } catch (error) {
        console.error('❌ Error in simulateClickInPowerPoint:', error);
        // Try fallback as last resort
        try {
            await simulateSpacebarFallback();
        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError);
        }
    }
}

/**
 * Simulate spacebar with Office API
 */
async function simulateSpacebarWithOfficeAPI() {
    console.log('🔧 Trying simulateSpacebarWithOfficeAPI...');
    
    try {
        return await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            // Get current slide
            const selectedSlides = presentation.getSelectedSlides();
            selectedSlides.load('items');
            await context.sync();
            
            if (selectedSlides.items.length === 0) {
                console.log('⚠️ No slide selected');
                return false;
            }
            
            const currentSlide = selectedSlides.items[0];
            currentSlide.load('id');
            await context.sync();
            
            const currentSlideId = currentSlide.id;
            
            // Find current index
            let currentIndex = -1;
            for (let i = 0; i < slides.items.length; i++) {
                slides.items[i].load('id');
            }
            await context.sync();
            
            for (let i = 0; i < slides.items.length; i++) {
                if (slides.items[i].id === currentSlideId) {
                    currentIndex = i;
                    break;
                }
            }
            
            if (currentIndex === -1) {
                console.log('⚠️ Could not find current slide index');
                return false;
            }
            
            console.log(`📍 Current slide: index=${currentIndex}, id=${currentSlideId}`);
            
            // Try to advance animation on current slide
            const advancedAnimation = await simulateAnimationAdvancement(context, currentSlide);
            
            if (advancedAnimation) {
                console.log('✅ Advanced animation');
                return true;
            } else {
                console.log('⚠️ No animation to advance, will move to next slide');
                // Move to next slide
                await advanceToNextSlide(context);
                return true;
            }
        });
        
    } catch (error) {
        console.error('❌ Error in simulateSpacebarWithOfficeAPI:', error);
        return false;
    }
}

/**
 * Simulate animation advancement
 */
async function simulateAnimationAdvancement(context, currentSlide) {
    console.log('🎬 Trying to advance animation...');
    
    try {
        // Load slide shapes to check for animations
        const shapes = currentSlide.shapes;
        shapes.load('items');
        await context.sync();
        
        console.log(`📊 Slide has ${shapes.items.length} shapes`);
        
        // Initialize animation state tracking if not exists
        if (!window.slideAnimationState) {
            window.slideAnimationState = {};
        }
        
        currentSlide.load('id');
        await context.sync();
        const slideId = currentSlide.id;
        
        // Track which shape animation we're on
        if (!window.slideAnimationState[slideId]) {
            window.slideAnimationState[slideId] = 0;
        }
        
        const currentAnimationIndex = window.slideAnimationState[slideId];
        console.log(`🎬 Current animation index for slide ${slideId}: ${currentAnimationIndex}`);
        
        // For simplicity, we'll assume up to 10 animation steps per slide
        // (In reality, we'd need to query the actual number of animations)
        const MAX_ANIMATIONS = 10;
        
        if (currentAnimationIndex < MAX_ANIMATIONS) {
            // Simulate advancing one animation step
            console.log(`✅ Advancing animation step ${currentAnimationIndex + 1}`);
            window.slideAnimationState[slideId]++;
            return true;
        } else {
            // No more animations
            console.log('⚠️ No more animations to advance');
            window.slideAnimationState[slideId] = 0; // Reset for next time
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error checking animations:', error);
        return false;
    }
}

/**
 * Advance to next slide
 */
async function advanceToNextSlide(context) {
    console.log('⏭️ Advancing to next slide...');
    
    try {
        const presentation = context.presentation;
        const slides = presentation.slides;
        slides.load('items');
        await context.sync();
        
        const totalSlides = slides.items.length;
        
        // Get current slide
        const selectedSlides = presentation.getSelectedSlides();
        selectedSlides.load('items');
        await context.sync();
        
        if (selectedSlides.items.length === 0) {
            console.log('⚠️ No slide selected');
            return false;
        }
        
        const currentSlide = selectedSlides.items[0];
        currentSlide.load('id');
        await context.sync();
        
        const currentSlideId = currentSlide.id;
        
        // Find current index
        let currentIndex = -1;
        for (let i = 0; i < slides.items.length; i++) {
            slides.items[i].load('id');
        }
        await context.sync();
        
        for (let i = 0; i < slides.items.length; i++) {
            if (slides.items[i].id === currentSlideId) {
                currentIndex = i;
                break;
            }
        }
        
        if (currentIndex === -1 || currentIndex >= totalSlides - 1) {
            console.log('📍 Already on last slide');
            return false;
        }
        
        const nextIndex = currentIndex + 1;
        console.log(`➡️ Moving to slide ${nextIndex + 1}`);
        
        const nextSlide = slides.items[nextIndex];
        // nextSlide.setSelectedSlides(); // REPLACED due to error: setSelected/setSelectedSlides not on Slide object
        
        // Use goToByIdAsync for navigation
        await new Promise((resolve) => {
             Office.context.document.goToByIdAsync(
                nextIndex + 1, // 1-based index
                Office.GoToType.Index,
                (asyncResult) => {
                    if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                        console.error('Navigation failed in advanceToNextSlide:', asyncResult.error.message);
                    }
                    resolve();
                }
            );
        });

        await context.sync();
        
        // Reset animation state for new slide
        nextSlide.load('id');
        await context.sync();
        if (window.slideAnimationState) {
            window.slideAnimationState[nextSlide.id] = 0;
        }
        
        console.log('✅ Moved to next slide');
        return true;
        
    } catch (error) {
        console.error('❌ Error advancing to next slide:', error);
        return false;
    }
}

/**
 * Simulate spacebar fallback
 */
async function simulateSpacebarFallback() {
    console.log('🔧 Using simulateSpacebarFallback...');
    
    try {
        // This is a simplified fallback - just advance to next slide
        await PowerPoint.run(async (context) => {
            await advanceToNextSlide(context);
        });
        
        console.log('✅ Fallback completed');
        
    } catch (error) {
        console.error('❌ Error in simulateSpacebarFallback:', error);
        throw error;
    }
}

/**
 * Reset animation state for testing
 */
export function resetAnimationState() {
    console.log('🔄 Resetting animation and navigation transient state');
    window.slideAnimationState = {};
    window.lastQuestionSlideIndex = null;
}

/**
 * Get current slide number
 */
export async function getCurrentSlideNumber() {
    try {
        return await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            
            try {
                const selectedSlides = presentation.getSelectedSlides();
                selectedSlides.load('items');
                slides.load('items');
                await context.sync();
                
                if (selectedSlides.items.length > 0) {
                    const currentSlide = selectedSlides.items[0];
                    currentSlide.load('id');
                    await context.sync();
                    
                    const currentSlideId = currentSlide.id;
                    
                    // Find the index
                    for (let i = 0; i < slides.items.length; i++) {
                        slides.items[i].load('id');
                    }
                    await context.sync();
                    
                    for (let i = 0; i < slides.items.length; i++) {
                        if (slides.items[i].id === currentSlideId) {
                            const slideNumber = i + 1;
                            
                            // Update state
                            setCurrentSlideNumber(slideNumber);
                            setCurrentSlideId(currentSlideId);
                            
                            console.log(`📍 Current slide: ${slideNumber} (ID: ${currentSlideId})`);
                            return slideNumber;
                        }
                    }
                    
                    // Fallback: return 1 if not found
                    console.log('⚠️ Could not determine slide position, defaulting to 1');
                    setCurrentSlideNumber(1);
                    return 1;
                    
                } else {
                    console.log('⚠️ No selected slides, defaulting to slide 1');
                    setCurrentSlideNumber(1);
                    return 1;
                }
                
            } catch (error) {
                console.error('Error getting selected slides:', error);
                setCurrentSlideNumber(1);
                return 1;
            }
        });
        
    } catch (error) {
        console.error('Error in getCurrentSlideNumber:', error);
        return 1;
    }
}
