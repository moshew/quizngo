/**
 * Slide Type Editor Module
 * Handles inline editing of slide types in the slides list
 */

import { 
    saveGameData,
    getSlideData,
    getSlideTypeData,
    setSlideData,
    ensureSlideData,
    getContextMenuTargetSlideId, setContextMenuTargetSlideId,
    getContextMenuTargetType, setContextMenuTargetType,
    getCurrentEditingSlideId, setCurrentEditingSlideId,
    getSelectedType, setSelectedType,
    getSelectedAnswer, setSelectedAnswer,
    triggerRefreshSlideList
} from '../core/state.js';

// Get type label using i18n (with fallback)
export function getTypeLabel(type) {
    // Try to use i18n if available
    if (window.t) {
        const key = `slideTypes.${type}`;
        const translated = window.t(key);
        // If translation found (not the key itself), use it
        if (translated !== key) {
            return translated;
        }
    }
    
    // Fallback to Hebrew if i18n not ready
    const fallbackMap = {
        'opening': 'פתיחה',
        'transition': 'מעבר',
        'question': 'שאלה',
        'statistics': 'סטטיסטיקת מענה',
        'leaderboard': 'מובילים',
        'summary': 'סיכום',
        'start': 'מסך פתיחה'
    };
    return fallbackMap[type] || type;
}

/**
 * Get all slide type options with translations
 */
function getSlideTypeOptions() {
    const types = ['opening', 'transition', 'question', 'statistics', 'leaderboard', 'summary'];
    return types.map(type => ({
        value: type,
        label: getTypeLabel(type)
    }));
}

// Module-level reference to refresh callback (for backward compatibility)
let _refreshCallback = null;

/**
 * Initialize the slide type editor
 * Attaches global functions to window for HTML onclick handlers
 * @param {Function} refreshCallback - Function to refresh the slides list after changes
 */
export function initializeSlideTypeEditor(refreshCallback) {
    // Store the refresh callback locally
    _refreshCallback = refreshCallback;
    
    // Attach functions to window for HTML onclick handlers
    window.showContextMenu = showContextMenu;
    window.openInlineEdit = openInlineEdit;
    window.toggleCustomDropdown = toggleCustomDropdown;
    window.selectDropdownItem = selectDropdownItem;
    window.selectAnswer = selectAnswer;
    window.openSlideTypeDialog = openSlideTypeDialog;
    window.cancelInlineEdit = cancelInlineEdit;
    window.confirmInlineSlideTypeChange = confirmInlineSlideTypeChange;
    window.openSetAnswerDialog = openSetAnswerDialog;
    window.confirmSlideTypeChange = confirmSlideTypeChange;
    window.confirmSetAnswer = confirmSetAnswer;
    
    console.log('✅ Slide type editor initialized');
}

/**
 * Get the refresh callback (local or from state)
 */
function getRefreshCallback() {
    return _refreshCallback || triggerRefreshSlideList;
}

/**
 * Show context menu for a slide
 */
export function showContextMenu(event, slideId, currentType) {
    event.stopPropagation();
    setContextMenuTargetSlideId(slideId);
    setContextMenuTargetType(currentType);
    
    const menu = document.getElementById('slideContextMenu');
    if (!menu) return;
    
    menu.style.display = 'block';
    
    // Position menu near the button
    const rect = event.target.closest('button').getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`; 
    menu.style.right = 'auto';
    
    // Close menu when clicking outside
    const closeMenu = () => {
        menu.style.display = 'none';
        document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
    
    // Show/Hide "Set Answer" based on type
    const setAnswerItem = document.getElementById('menuSetAnswer');
    if (setAnswerItem) {
        setAnswerItem.style.display = (currentType === 'question') ? 'block' : 'none';
    }
}

/**
 * Open inline edit for a slide
 */
export function openInlineEdit(slideId, currentType) {
    const refreshCallback = getRefreshCallback();
    
    // Close any existing edit first (without full refresh)
    const currentEditingId = getCurrentEditingSlideId();
    if (currentEditingId && currentEditingId !== slideId) {
        // Clear state and refresh to close previous edit
        setSelectedType(null);
        setSelectedAnswer(null);
        setCurrentEditingSlideId(null);
        
        // Do a refresh then continue
        if (refreshCallback) {
            const result = refreshCallback();
            if (result && result.then) {
                result.then(() => {
                    actualOpenInlineEdit(slideId, currentType);
                });
            } else {
                actualOpenInlineEdit(slideId, currentType);
            }
        }
        return;
    }
    
    actualOpenInlineEdit(slideId, currentType);
}

/**
 * Actually open the inline edit UI
 */
function actualOpenInlineEdit(slideId, currentType) {
    const li = document.getElementById(`slide-item-${slideId}`);
    if (!li) return;

    // Mark this slide as being edited
    setCurrentEditingSlideId(slideId);

    // Store for later use
    setContextMenuTargetSlideId(slideId);
    setContextMenuTargetType(currentType);

    // Get current answer for question type
    const slideData = getSlideData(slideId);
    const currentAnswer = slideData?.correctAnswer || '1';
    
    // Store the initial selection
    setSelectedType(currentType);
    setSelectedAnswer(currentAnswer);

    // Prevent clicking the li from navigating while editing
    li.onclick = null;

    // Get all slide type options with translations
    const slideTypeOptions = getSlideTypeOptions();

    // Build answer numbers HTML for question type (inside trigger)
    const buildAnswerNumsHtml = (selectedAnswer) => {
        return `
            <span class="answer-nums-trigger" id="answerNumsInTrigger">
                [<span class="answer-num-link ${selectedAnswer === '1' ? 'selected' : ''}" onclick="selectAnswer(event, '1')">1</span>
                <span class="answer-num-link ${selectedAnswer === '2' ? 'selected' : ''}" onclick="selectAnswer(event, '2')">2</span>
                <span class="answer-num-link ${selectedAnswer === '3' ? 'selected' : ''}" onclick="selectAnswer(event, '3')">3</span>
                <span class="answer-num-link ${selectedAnswer === '4' ? 'selected' : ''}" onclick="selectAnswer(event, '4')">4</span>]
            </span>
        `;
    };

    // Build dropdown items HTML
    const dropdownItemsHtml = slideTypeOptions.map(opt => 
        `<div class="custom-dropdown-item ${currentType === opt.value ? 'selected' : ''}" onclick="selectDropdownItem(event, '${opt.value}')">${opt.label}</div>`
    ).join('');

    // Get tooltip translations
    const saveTitle = window.t ? window.t('tooltips.save') : 'שמור';
    const cancelTitle = window.t ? window.t('tooltips.cancel') : 'ביטול';

    li.innerHTML = `
        <div class="inline-edit-container" onclick="event.stopPropagation()">
            <div class="custom-dropdown" id="customDropdown">
                <div class="custom-dropdown-trigger" onclick="toggleCustomDropdown(event)">
                    <span class="trigger-content">
                        <span id="dropdownLabel">${getTypeLabel(currentType)}</span>
                        <span id="answerNumsContainer" style="display: ${currentType === 'question' ? 'inline' : 'none'};">
                            ${buildAnswerNumsHtml(currentAnswer)}
                        </span>
                    </span>
                    <span class="arrow">▼</span>
                </div>
                <div class="custom-dropdown-menu" id="dropdownMenu">
                    ${dropdownItemsHtml}
                </div>
            </div>
            <div class="inline-actions">
                <button class="inline-btn confirm" onclick="confirmInlineSlideTypeChange(event, '${slideId}')" title="${saveTitle}">
                    <i class="ms-Icon ms-Icon--CheckMark"></i>
                </button>
                <button class="inline-btn cancel" onclick="cancelInlineEdit(event)" title="${cancelTitle}">
                    <i class="ms-Icon ms-Icon--Cancel"></i>
                </button>
            </div>
        </div>
    `;
}

/**
 * Toggle custom dropdown menu
 */
export function toggleCustomDropdown(event) {
    event.stopPropagation();
    
    // Don't toggle if clicking on answer numbers
    if (event.target.closest('.answer-num-link')) {
        return;
    }
    
    const menu = document.getElementById('dropdownMenu');
    if (!menu) return;
    
    menu.classList.toggle('open');
    
    // Close when clicking outside
    if (menu.classList.contains('open')) {
        const closeDropdown = (e) => {
            if (!e.target.closest('.custom-dropdown')) {
                menu.classList.remove('open');
                document.removeEventListener('click', closeDropdown);
            }
        };
        setTimeout(() => document.addEventListener('click', closeDropdown), 0);
    }
}

/**
 * Select a slide type from dropdown
 */
export function selectDropdownItem(event, type) {
    event.stopPropagation();
    
    setSelectedType(type);
    
    // Update label with translation
    const label = document.getElementById('dropdownLabel');
    if (label) {
        label.textContent = getTypeLabel(type);
    }
    
    // Update selected state
    document.querySelectorAll('.custom-dropdown-item').forEach(item => item.classList.remove('selected'));
    event.target.classList.add('selected');
    
    // Show/hide answer numbers based on type
    const answerNumsContainer = document.getElementById('answerNumsContainer');
    if (answerNumsContainer) {
        answerNumsContainer.style.display = type === 'question' ? 'inline' : 'none';
    }
    
    // Close dropdown
    const menu = document.getElementById('dropdownMenu');
    if (menu) {
        menu.classList.remove('open');
    }
}

/**
 * Select correct answer number
 */
export function selectAnswer(event, answer) {
    event.stopPropagation();
    
    setSelectedAnswer(answer);
    
    // Update visual selection
    document.querySelectorAll('.answer-num-link').forEach(link => {
        link.classList.remove('selected');
    });
    event.target.classList.add('selected');
}

/**
 * Open slide type dialog (legacy - redirects to inline edit)
 */
export function openSlideTypeDialog() {
    const contextMenu = document.getElementById('slideContextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    
    const slideId = getContextMenuTargetSlideId();
    const currentType = getContextMenuTargetType();
    openInlineEdit(slideId, currentType);
}

/**
 * Cancel inline edit
 */
export function cancelInlineEdit(event) {
    if (event) event.stopPropagation();
    
    // Clear temporary selections
    setSelectedType(null);
    setSelectedAnswer(null);
    setCurrentEditingSlideId(null);
    
    const refreshCallback = getRefreshCallback();
    if (refreshCallback) {
        refreshCallback();
    }
}

/**
 * Confirm inline slide type change
 */
export function confirmInlineSlideTypeChange(event, slideId) {
    if (event) event.stopPropagation();
    
    const newType = getSelectedType() || 'transition';
    
    if (slideId) {
        // Ensure slide data exists
        const currentData = getSlideData(slideId) || {};
        
        // Build new data
        const newData = { ...currentData, type: newType };
        
        // Save the selected answer if type is question
        if (newType === 'question') {
            const answer = getSelectedAnswer() || '1';
            newData.correctAnswer = answer;
        }
        
        // Save to state
        setSlideData(slideId, newData);
        
        // Clear temporary selections
        setSelectedType(null);
        setSelectedAnswer(null);
        setCurrentEditingSlideId(null);
        
        // Save to presentation
        saveGameData();
        
        // Refresh the list
        const refreshCallback = getRefreshCallback();
        if (refreshCallback) {
            refreshCallback();
        }
    }
}

/**
 * Open set answer dialog
 */
export function openSetAnswerDialog() {
    const contextMenu = document.getElementById('slideContextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    
    const dialog = document.getElementById('dialogSetAnswer');
    if (!dialog) return;
    
    // Get current answer from state
    const slideId = getContextMenuTargetSlideId();
    const slideData = getSlideData(slideId);
    const currentAnswer = slideData?.correctAnswer || '1';
    
    const select = document.getElementById('correctAnswerSelect');
    if (select) {
        select.value = currentAnswer;
    }
    
    dialog.style.display = 'flex';
}

/**
 * Confirm slide type change (from dialog)
 */
export function confirmSlideTypeChange() {
    const select = document.getElementById('slideTypeSelect');
    if (!select) return;
    
    const newType = select.value;
    const slideId = getContextMenuTargetSlideId();
    
    if (slideId) {
        // Ensure slide data exists
        const currentData = getSlideData(slideId) || {};
        
        // Build new data
        const newData = { ...currentData, type: newType };
        
        if (newType === 'question' && !newData.correctAnswer) {
            newData.correctAnswer = '1';
        }
        
        // Save to state
        setSlideData(slideId, newData);
        
        saveGameData();
        
        console.log(`Updated slide ${slideId} to ${newType}`);
        
        const refreshCallback = getRefreshCallback();
        if (refreshCallback) {
            refreshCallback();
        }
    }
    
    if (window.closeDialogs) window.closeDialogs();
}

/**
 * Confirm set answer (from dialog)
 */
export function confirmSetAnswer() {
    const select = document.getElementById('correctAnswerSelect');
    if (!select) return;
    
    const answer = select.value;
    const slideId = getContextMenuTargetSlideId();
    
    if (slideId) {
        // Ensure slide data exists
        const currentData = getSlideData(slideId) || { type: 'question' };
        
        // Build new data
        const newData = { ...currentData, correctAnswer: answer };
        
        // Save to state
        setSlideData(slideId, newData);
        
        saveGameData();
        
        const refreshCallback = getRefreshCallback();
        if (refreshCallback) {
            refreshCallback();
        }
    }
    
    if (window.closeDialogs) window.closeDialogs();
}
