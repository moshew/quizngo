/* global Office, PowerPoint */
import { getSlideData, updateSlideData, triggerAutoSave } from './presentation-state.js';

let contextMenuTargetSlideId = null;

// Cache for slide index lookup (slideId -> 1-based index)
const slideIndexCache = new Map();

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

export async function initializeSlidesList() {
    // Expose context menu functions globally
    window.openSlideTypeSelector = openSlideTypeSelector;
    window.openCorrectAnswerSelector = openCorrectAnswerSelector;
    window.confirmSlideTypeChange = confirmSlideTypeChange;
    window.confirmCorrectAnswerChange = confirmCorrectAnswerChange;
    window.openContextMenu = openContextMenu;
    window.goToSlide = goToSlide;
    window.refreshSlidesList = refreshSlidesList;

    // Global click to close context menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.slide-menu-btn') && !e.target.closest('.context-menu')) {
            const menu = document.getElementById('contextMenu');
            if (menu) menu.style.display = 'none';
        }
    });

    // Listen for slide added/deleted events
    try {
        await PowerPoint.run(async (context) => {
            context.presentation.slides.onAdded.add(onSlidesChanged);
            context.presentation.slides.onDeleted.add(onSlidesChanged);
            await context.sync();
            console.log('✅ Registered slide add/delete listeners');
        });
    } catch (error) {
        console.warn('⚠️ Could not register slide change listeners:', error);
    }

    // Load initial list
    await refreshSlidesList();
}

// Handler for slide added/deleted events
async function onSlidesChanged(eventArgs) {
    console.log('📊 Slides changed event:', eventArgs);
    await refreshSlidesList();
}

export async function refreshSlidesList() {
    try {
        console.log('🔄 Refreshing slides list...');
        await PowerPoint.run(async (context) => {
            // Load items and their IDs
            const slides = context.presentation.slides.load("items");
            // Also need to load IDs, but "items" usually loads properties. 
            // Better to specify "items/id" if needed, but "items" often works for simple props.
            // Let's be explicit:
            context.load(slides, "items/id");
            
            await context.sync();
            
            const list = document.getElementById('slidesList');
            if (!list) return;
            
            list.innerHTML = ''; // Clear
            
            // Hide loading
            const loadingMsg = document.getElementById('loadingSlides');
            if (loadingMsg) loadingMsg.style.display = 'none';

            // Clear and rebuild index cache
            slideIndexCache.clear();
            
            slides.items.forEach((slide, index) => {
                const slideId = slide.id;
                const slideNumber = index + 1; // 1-based index for Office API
                
                // Cache the index for quick lookup
                slideIndexCache.set(slideId, slideNumber);
                
                const slideData = getSlideData(slideId);
                const slideType = slideData ? slideData.type : 'לא מוגדר';
                
                let correctAnswer = '';
                if (slideType === 'question' && slideData && slideData.correctAnswer) {
                    correctAnswer = ` [${slideData.correctAnswer}]`;
                }
                
                const li = document.createElement('li');
                li.className = 'slide-item';
                li.id = `slide-item-${slideId}`;
                li.dataset.slideId = slideId;
                li.dataset.slideNumber = slideNumber;
                
                const hebrewType = getHebrewSlideType(slideType);
                
                // Content - click handler on entire li, menu button stops propagation
                const content = `
                    <button class="slide-menu-btn" onclick="event.stopPropagation(); openContextMenu(event, '${slideId}')" title="אפשרויות">⋮</button>
                    <div class="slide-info">
                        <span class="slide-number">שקף ${slideNumber}</span>
                        - ${hebrewType}${correctAnswer}
                    </div>
                `;
                li.innerHTML = content;
                
                // Click updates UI and schedules navigation asynchronously
                li.addEventListener('click', (e) => {
                    if (!e.target.closest('.slide-menu-btn')) {
                        updateListSelection(slideId);
                        scheduleNavigation(slideId);
                    }
                });
                
                list.appendChild(li);
            });
            
            // Re-highlight current if known
            if (window.currentSlideId) {
                updateListSelection(window.currentSlideId);
            }
        });
    } catch (error) {
        console.error("❌ Error loading slides list:", error);
    }
}

function getHebrewSlideType(type) {
    const map = {
        'opening': 'פתיחה',
        'question': 'שאלה',
        'leaderboard': 'מובילים',
        'statistics': 'סטטיסטיקת מענה',
        'summary': 'סיכום',
        'transition': 'מעבר'
    };
    return map[type] || 'לא מוגדר'; // "Not defined"
}

// Schedule navigation using MessageChannel for complete decoupling from click event
function scheduleNavigation(slideId) {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
        navigateToSlide(slideId);
    };
    channel.port2.postMessage(null);
}

// Force browser to recalculate cursor by toggling pointer-events
function refreshCursor() {
    document.body.style.pointerEvents = 'none';
    requestAnimationFrame(() => {
        document.body.style.pointerEvents = '';
    });
}

// Actual navigation - called only from message channel
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

// Legacy function for external calls
function goToSlide(slideId) {
    updateListSelection(slideId);
    scheduleNavigation(slideId);
}

function openContextMenu(event, slideId) {
    event.stopPropagation();
    contextMenuTargetSlideId = slideId;
    const menu = document.getElementById('contextMenu');
    
    // Position
    // Use event.clientX/Y relative to viewport
    menu.style.top = `${event.clientY}px`;
    menu.style.left = `${event.clientX}px`; // RTL might behave interestingly, check visual
    menu.style.display = 'block';
    
    // Show/Hide Correct Answer option
    const slideData = getSlideData(slideId);
    const isQuestion = slideData && slideData.type === 'question';
    const answerOption = document.getElementById('correctAnswerOption');
    if (answerOption) {
        answerOption.style.display = isQuestion ? 'block' : 'none';
    }
}

function openSlideTypeSelector() {
    const dialog = document.getElementById('selectionDialog');
    const content = document.getElementById('dialogContent');
    const title = document.getElementById('dialogTitle');
    
    if (!dialog || !content) return;
    
    title.textContent = 'בחר סוג שקף';
    
    content.innerHTML = `
        <select id="slideTypeSelect" style="width: 100%; padding: 8px; font-size: 16px;">
            <option value="opening">פתיחה</option>
            <option value="question">שאלה</option>
            <option value="leaderboard">מובילים</option>
            <option value="statistics">סטטיסטיקת מענה</option>
            <option value="summary">סיכום</option>
            <option value="transition">מעבר</option>
        </select>
        <div style="margin-top: 15px; display: flex; gap: 10px;">
            <button class="button" onclick="confirmSlideTypeChange()">שמור</button>
        </div>
    `;
    
    document.getElementById('contextMenu').style.display = 'none';
    dialog.showModal();
}

function confirmSlideTypeChange() {
    const select = document.getElementById('slideTypeSelect');
    if (!select) return;
    
    const type = select.value;
    console.log(`🏷️ Changing slide ${contextMenuTargetSlideId} to ${type}`);
    
    updateSlideData(contextMenuTargetSlideId, { type: type });
    triggerAutoSave();
    
    refreshSlidesList();
    document.getElementById('selectionDialog').close();
}

function openCorrectAnswerSelector() {
    const dialog = document.getElementById('selectionDialog');
    const content = document.getElementById('dialogContent');
    const title = document.getElementById('dialogTitle');
    
    if (!dialog || !content) return;
    
    title.textContent = 'בחר תשובה נכונה';
    
    content.innerHTML = `
        <select id="correctAnswerSelect" style="width: 100%; padding: 8px; font-size: 16px;">
            <option value="1">1 (אדום)</option>
            <option value="2">2 (כחול)</option>
            <option value="3">3 (צהוב)</option>
            <option value="4">4 (ירוק)</option>
        </select>
        <div style="margin-top: 15px; display: flex; gap: 10px;">
            <button class="button" onclick="confirmCorrectAnswerChange()">שמור</button>
        </div>
    `;
    
    document.getElementById('contextMenu').style.display = 'none';
    dialog.showModal();
}

function confirmCorrectAnswerChange() {
    const select = document.getElementById('correctAnswerSelect');
    if (!select) return;
    
    const answer = parseInt(select.value);
    console.log(`✅ Setting correct answer for slide ${contextMenuTargetSlideId} to ${answer}`);
    
    updateSlideData(contextMenuTargetSlideId, { correctAnswer: answer });
    triggerAutoSave();
    
    refreshSlidesList();
    document.getElementById('selectionDialog').close();
}

export function updateListSelection(slideId) {
    if (!slideId) return;
    
    document.querySelectorAll('.slide-item').forEach(el => el.classList.remove('selected'));
    const item = document.getElementById(`slide-item-${slideId}`);
    if(item) {
        item.classList.add('selected');
        // Scroll into view if needed
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}
