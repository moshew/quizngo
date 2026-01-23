/**
 * Slide Type Editor Module
 * Handles inline editing of slide types in the slides list
 */

// Get type label in Hebrew
export function getTypeLabel(type) {
    const map = {
        'opening': 'פתיחה',
        'transition': 'מעבר',
        'question': 'שאלה',
        'statistics': 'סטטיסטיקת מענה',
        'leaderboard': 'מובילים',
        'summary': 'סיכום',
        'start': 'מסך פתיחה'
    };
    return map[type] || type;
}

/**
 * Initialize the slide type editor
 * Attaches global functions to window for HTML onclick handlers
 * @param {Function} refreshCallback - Function to refresh the slides list after changes
 */
export function initializeSlideTypeEditor(refreshCallback) {
    // Store the refresh callback
    window._slideEditorRefreshCallback = refreshCallback;
    
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
 * Show context menu for a slide
 */
export function showContextMenu(event, slideId, currentType) {
    event.stopPropagation();
    window.contextMenuTargetSlideId = slideId;
    window.contextMenuTargetType = currentType;
    
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
    const refreshCallback = window._slideEditorRefreshCallback || window.refreshSlideList;
    
    // Close any existing edit first (without full refresh)
    if (window.currentEditingSlideId && window.currentEditingSlideId !== slideId) {
        // Clear state and refresh to close previous edit
        window.selectedType = null;
        window.selectedAnswer = null;
        window.currentEditingSlideId = null;
        
        // Do a refresh then continue
        if (refreshCallback) {
            refreshCallback().then(() => {
                actualOpenInlineEdit(slideId, currentType);
            });
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
    window.currentEditingSlideId = slideId;

    // Store for later use
    window.contextMenuTargetSlideId = slideId;
    window.contextMenuTargetType = currentType;

    // Get current answer for question type
    const slideData = window.slideTypeData ? window.slideTypeData[slideId] : null;
    const currentAnswer = slideData?.correctAnswer || '1';
    
    // Store the initial selection
    window.selectedType = currentType;
    window.selectedAnswer = currentAnswer;

    // Prevent clicking the li from navigating while editing
    li.onclick = null;

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
                    <div class="custom-dropdown-item ${currentType === 'opening' ? 'selected' : ''}" onclick="selectDropdownItem(event, 'opening')">פתיחה</div>
                    <div class="custom-dropdown-item ${currentType === 'transition' ? 'selected' : ''}" onclick="selectDropdownItem(event, 'transition')">מעבר</div>
                    <div class="custom-dropdown-item ${currentType === 'question' ? 'selected' : ''}" onclick="selectDropdownItem(event, 'question')">שאלה</div>
                    <div class="custom-dropdown-item ${currentType === 'statistics' ? 'selected' : ''}" onclick="selectDropdownItem(event, 'statistics')">סטטיסטיקת מענה</div>
                    <div class="custom-dropdown-item ${currentType === 'leaderboard' ? 'selected' : ''}" onclick="selectDropdownItem(event, 'leaderboard')">מובילים</div>
                    <div class="custom-dropdown-item ${currentType === 'summary' ? 'selected' : ''}" onclick="selectDropdownItem(event, 'summary')">סיכום</div>
                </div>
            </div>
            <div class="inline-actions">
                <button class="inline-btn confirm" onclick="confirmInlineSlideTypeChange(event, '${slideId}')" title="שמור">
                    <i class="ms-Icon ms-Icon--CheckMark"></i>
                </button>
                <button class="inline-btn cancel" onclick="cancelInlineEdit(event)" title="ביטול">
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
    
    window.selectedType = type;
    
    // Update label
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
    
    window.selectedAnswer = answer;
    
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
    
    const slideId = window.contextMenuTargetSlideId;
    const currentType = window.contextMenuTargetType;
    openInlineEdit(slideId, currentType);
}

/**
 * Cancel inline edit
 */
export function cancelInlineEdit(event) {
    if (event) event.stopPropagation();
    
    // Clear temporary selections
    window.selectedType = null;
    window.selectedAnswer = null;
    window.currentEditingSlideId = null;
    
    const refreshCallback = window._slideEditorRefreshCallback || window.refreshSlideList;
    if (refreshCallback) {
        refreshCallback();
    }
}

/**
 * Confirm inline slide type change
 */
export function confirmInlineSlideTypeChange(event, slideId) {
    if (event) event.stopPropagation();
    
    const newType = window.selectedType || 'transition';
    
    if (slideId) {
        if (!window.slideTypeData) window.slideTypeData = {};
        if (!window.slideTypeData[slideId]) window.slideTypeData[slideId] = {};
        
        // Handle legacy string format if exists
        if (typeof window.slideTypeData[slideId] === 'string') {
            window.slideTypeData[slideId] = { type: newType };
        } else {
            window.slideTypeData[slideId].type = newType;
        }
        
        // Save the selected answer if type is question
        if (newType === 'question') {
            const answer = window.selectedAnswer || '1';
            window.slideTypeData[slideId].correctAnswer = answer;
        }
        
        // Clear temporary selections
        window.selectedType = null;
        window.selectedAnswer = null;
        window.currentEditingSlideId = null;
        
        // Trigger auto-save
        if (window.triggerAutoSave) window.triggerAutoSave();
        
        // Refresh the list
        const refreshCallback = window._slideEditorRefreshCallback || window.refreshSlideList;
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
    const slideId = window.contextMenuTargetSlideId;
    const slideData = window.slideTypeData ? window.slideTypeData[slideId] : null;
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
    const slideId = window.contextMenuTargetSlideId;
    
    if (slideId) {
        if (!window.slideTypeData) window.slideTypeData = {};
        if (!window.slideTypeData[slideId]) window.slideTypeData[slideId] = {};
        
        if (typeof window.slideTypeData[slideId] === 'string') {
            window.slideTypeData[slideId] = { type: newType };
        } else {
            window.slideTypeData[slideId].type = newType;
        }
        
        if (newType === 'question' && !window.slideTypeData[slideId].correctAnswer) {
            window.slideTypeData[slideId].correctAnswer = '1';
        }
        
        if (window.triggerAutoSave) window.triggerAutoSave();
        
        console.log(`Updated slide ${slideId} to ${newType}`);
        
        const refreshCallback = window._slideEditorRefreshCallback || window.refreshSlideList;
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
    const slideId = window.contextMenuTargetSlideId;
    
    if (slideId) {
        if (!window.slideTypeData) window.slideTypeData = {};
        if (!window.slideTypeData[slideId]) window.slideTypeData[slideId] = { type: 'question' };
        
        if (typeof window.slideTypeData[slideId] === 'string') {
            window.slideTypeData[slideId] = { type: window.slideTypeData[slideId] };
        }
        
        window.slideTypeData[slideId].correctAnswer = answer;
        
        if (window.triggerAutoSave) window.triggerAutoSave();
        
        const refreshCallback = window._slideEditorRefreshCallback || window.refreshSlideList;
        if (refreshCallback) {
            refreshCallback();
        }
    }
    
    if (window.closeDialogs) window.closeDialogs();
}
