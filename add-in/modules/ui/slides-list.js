/* global Office, PowerPoint */
/**
 * Slides List Module
 * Handles the slides list UI, navigation, and slide selection
 */

import { 
    getSlideType, 
    getSlideData,
    getCurrentSlideId, setCurrentSlideId,
    getCurrentSlideNumber, setCurrentSlideNumber,
    setRefreshSlideListCallback
} from '../core/state.js';
import { showError } from './manager.js';
import { 
    initializeSlideTypeEditor, 
    getTypeLabel,
    openInlineEdit 
} from './slide-type-editor.js';

// Cache for slide index lookup (slideId -> 1-based index)
const slideIndexCache = new Map();

// Helper function to get translations
function t(key, fallback = '') {
    if (window.t) {
        const translated = window.t(key);
        return translated !== key ? translated : fallback;
    }
    return fallback;
}

// Inject CSS to force cursor during Office API operations
(function injectCursorOverride() {
    const style = document.createElement('style');
    style.textContent = `
        body.force-pointer,
        body.force-pointer * {
            cursor: pointer !important;
        }
    `;
    document.head.appendChild(style);
})();

/**
 * Initialize the slides list
 */
export async function initializeSlidesList() {
    // Initialize the slide type editor with our refresh callback
    initializeSlideTypeEditor(refreshSlideList);
    
    // Register refresh callback in state module
    setRefreshSlideListCallback(refreshSlideList);
    
    // Expose functions globally for HTML access (backward compatibility)
    window.refreshSlideList = refreshSlideList;
    window.goToSlide = goToSlide;
    window.updateListSelection = updateListSelection;

    // Global click to close context menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.edit-btn') && !e.target.closest('.context-menu') && !e.target.closest('.inline-edit-container')) {
            const menu = document.getElementById('slideContextMenu');
            if (menu) menu.style.display = 'none';
        }
    });

    // Listen for slide added/deleted events
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            // Check if event handlers are available (not supported in all PowerPoint versions)
            if (slides.onAdded && slides.onDeleted) {
                slides.onAdded.add(onSlidesChanged);
                slides.onDeleted.add(onSlidesChanged);
                await context.sync();
            }
        });
    } catch (error) {
        // Slide change listeners are optional - polling will handle updates
    }

    // Load initial list
    await refreshSlideList();
}

/**
 * Handler for slide added/deleted events
 */
async function onSlidesChanged(eventArgs) {
    console.log('📊 Slides changed event:', eventArgs);
    await refreshSlideList();
}

/**
 * Refresh the slides list UI
 */
export async function refreshSlideList() {
    try {
        const slideListEl = document.getElementById('slideList');
        if (!slideListEl) return;
        
        // Don't show loading spinner on every refresh to avoid flicker
        const loadingEl = document.getElementById('slides-loading');
        if (slideListEl.children.length === 0 && loadingEl) {
            loadingEl.style.display = 'block';
            slideListEl.style.display = 'none';
        }

        await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            slides.load("items/id");
            await context.sync();

            // Clear and rebuild index cache
            slideIndexCache.clear();

            // Build HTML string for better performance and less flicker
            let listHtml = '';

            // Get translated "Slide" text
            const slideText = t('slides.slide', 'שקף');
            const editTitle = t('tooltips.edit', 'עריכה');

            const currentSlideId = getCurrentSlideId();
            
            slides.items.forEach((slide, index) => {
                const slideNumber = index + 1;
                const slideId = slide.id;
                
                // Cache the index for quick lookup
                slideIndexCache.set(slideId, slideNumber);
                
                // Get type from our local state (loaded from file or memory)
                let type = getSlideType(slideId) || 'transition';
                let typeLabel = getTypeLabel(type);
                
                // Check if it's a question and has an answer
                let extraInfo = '';
                if (type === 'question') {
                    const slideData = getSlideData(slideId);
                    const answer = slideData?.correctAnswer || '1';
                    extraInfo = ` [${answer}]`;
                }

                const isSelected = currentSlideId === slideId ? ' selected' : '';
                
                // Use data attributes for click handling instead of inline onclick
                listHtml += `
                    <li id="slide-item-${slideId}" class="slide-item${isSelected}" data-index="${slideNumber}" data-id="${slideId}">
                        <div class="slide-info">
                            <span class="slide-title">${slideText} ${slideNumber} - ${typeLabel}${extraInfo}</span>
                        </div>
                        <button class="edit-btn" title="${editTitle}" data-id="${slideId}" data-type="${type}">✎</button>
                    </li>
                `;
            });

            slideListEl.innerHTML = listHtml;

            // Re-attach event listeners
            slideListEl.querySelectorAll('.slide-item').forEach(li => {
                li.addEventListener('click', (e) => {
                    // Ignore if clicked on the edit button
                    if (e.target.closest('.edit-btn')) return;
                    // Ignore if clicked on inline edit controls
                    if (e.target.closest('.inline-edit-container')) return;
                    
                    // Visual update first
                    slideListEl.querySelectorAll('.slide-item').forEach(item => item.classList.remove('selected'));
                    li.classList.add('selected');

                    const index = parseInt(li.getAttribute('data-index'));
                    const slideId = li.getAttribute('data-id');
                    
                    // Update state immediately
                    setCurrentSlideId(slideId);
                    setCurrentSlideNumber(index);

                    navigateToSlide(slideId);
                });
            });

            slideListEl.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.getAttribute('data-id');
                    const type = btn.getAttribute('data-type');
                    openInlineEdit(id, type);
                });
            });

            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
            slideListEl.style.display = 'block';
            
            // Re-highlight current if known
            const currentId = getCurrentSlideId();
            if (currentId) {
                updateListSelection(currentId);
            }
        });
    } catch (error) {
        console.error('Error refreshing slide list:', error);
        showError(t('slides.errorLoading', 'שגיאה בטעינת רשימת השקפים'));
    }
}

/**
 * Force browser to recalculate cursor by toggling pointer-events
 */
function refreshCursor() {
    document.body.style.pointerEvents = 'none';
    requestAnimationFrame(() => {
        document.body.style.pointerEvents = '';
    });
}

/**
 * Navigate to a slide by ID
 */
function navigateToSlide(slideId) {
    const slideNumber = slideIndexCache.get(slideId);
    
    if (!slideNumber) {
        console.error('❌ Slide not found in cache:', slideId);
        return;
    }
    
    // Force pointer cursor during API call
    document.body.classList.add('force-pointer');
    
    console.log(`Navigating to slide ${slideNumber}...`);
    Office.context.document.goToByIdAsync(slideNumber, Office.GoToType.Index, (asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Failed) {
            console.error('❌ Navigation failed:', asyncResult.error.message);
        } else {
            console.log(`✅ Navigation succeeded to slide ${slideNumber}`);
        }
        
        // Remove forced cursor and refresh
        setTimeout(() => {
            document.body.classList.remove('force-pointer');
            refreshCursor();
        }, 50);
    });
}

/**
 * Navigate to a slide by index (1-based)
 */
export async function navigateToSlideByIndex(index) {
    return new Promise((resolve, reject) => {
        Office.context.document.goToByIdAsync(
            index,
            Office.GoToType.Index,
            (asyncResult) => {
                if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                    console.error('Navigation failed:', asyncResult.error.message);
                    reject(asyncResult.error);
                } else {
                    resolve();
                }
            }
        );
    });
}

/**
 * Go to a slide by ID (for external calls)
 */
function goToSlide(slideId) {
    updateListSelection(slideId);
    navigateToSlide(slideId);
}

/**
 * Update the visual selection in the slides list
 */
export function updateListSelection(slideId) {
    if (!slideId) return;
    
    document.querySelectorAll('.slide-item').forEach(el => el.classList.remove('selected'));
    const item = document.getElementById(`slide-item-${slideId}`);
    if (item) {
        item.classList.add('selected');
        // Scroll into view if needed
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Get the slide index from cache
 */
export function getSlideIndex(slideId) {
    return slideIndexCache.get(slideId);
}
