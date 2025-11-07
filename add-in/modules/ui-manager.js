/**
 * UI Manager Module
 * Handles all UI updates and interactions for slide types
 */

import { API_BASE } from './api.js';
import { getGameHashId } from './presentation-state.js';

/**
 * Show status message (only for warnings and errors)
 */
export function showStatus(message, type = 'info') {
    console.log(`Status (${type}): ${message}`);
    
    // Only show in UI for warnings and errors
    if (type === 'warning' || type === 'error') {
        const detectedInfo = document.getElementById('detectedInfo');
        if (detectedInfo) {
            const color = type === 'warning' ? '#856404' : '#721c24';
            const background = type === 'warning' ? '#fff3cd' : '#f8d7da';
            
            detectedInfo.innerHTML = `⚠️ ${message}`;
            detectedInfo.style.display = 'block';
            detectedInfo.style.background = background;
            detectedInfo.style.color = color;
            
            // Hide after 5 seconds
            setTimeout(() => {
                if (detectedInfo.innerHTML.includes('⚠️')) {
                    detectedInfo.style.display = 'none';
                }
            }, 5000);
        }
    }
}

/**
 * Show error message
 */
export function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
    
    console.error('Error:', message);
}

/**
 * Update displayed values in the current UI
 */
export function updateDisplayedValues() {
    // Update Game ID
    const gameIdElements = document.querySelectorAll('[id^="gameId"]');
    gameIdElements.forEach(el => {
        if (window.gameId) el.textContent = window.gameId;
    });
    
    // Update user count
    const userCountEl = document.getElementById('userCount');
    if (userCountEl && window.currentUsers !== undefined) {
        userCountEl.textContent = window.currentUsers;
    }
    
    // Update time remaining
    const timeRemainingEl = document.getElementById('timeRemaining');
    if (timeRemainingEl && window.currentTime) {
        timeRemainingEl.textContent = window.currentTime + 's';
    }
    
    // Update current slide
    const currentSlideEl = document.getElementById('currentSlide');
    if (currentSlideEl && window.currentSlideNumber) {
        currentSlideEl.textContent = window.currentSlideNumber;
    }
}

/**
 * Update auto-save status indicator
 */
export function updateAutoSaveStatus(status) {
    const statusElement = document.getElementById('autoSaveStatus');
    if (!statusElement) return;
    
    switch (status) {
        case 'pending':
            statusElement.textContent = '⏱️ שינויים ממתינים לשמירה...';
            statusElement.style.color = '#ffc107';
            statusElement.style.display = 'block';
            break;
        case 'waiting':
            statusElement.textContent = '⏳ ממתין לשמירת הקובץ (Save As)...';
            statusElement.style.color = '#ff9800';
            statusElement.style.display = 'block';
            break;
        case 'saving':
            statusElement.textContent = '💾 שומר...';
            statusElement.style.color = '#0078d4';
            statusElement.style.display = 'block';
            break;
        case 'saved':
            statusElement.textContent = '✅ נשמר אוטומטית';
            statusElement.style.color = '#28a745';
            statusElement.style.display = 'block';
            break;
        case 'error':
            statusElement.textContent = '❌ שגיאה בשמירה';
            statusElement.style.color = '#dc3545';
            statusElement.style.display = 'block';
            break;
        case 'idle':
        default:
            statusElement.style.display = 'none';
            break;
    }
}

/**
 * Preload all HTML files on initialization for instant slide transitions
 */
export async function preloadAllHtmlFiles(htmlCache) {
    console.log('🚀 Pre-loading all HTML files...');
    
    const filesToPreload = [
        'slide-types/opening.html',
        'slide-types/question.html',
        'slide-types/statistics.html',
        'slide-types/leaderboard.html',
        'slide-types/summary.html',
        'slide-types/settings.html',
        'slide-types/shared-actions.html'
    ];
    
    const loadPromises = filesToPreload.map(async (filePath) => {
        try {
            console.log(`📥 Pre-loading: ${filePath}`);
            const response = await fetch(filePath);
            if (response.ok) {
                const html = await response.text();
                htmlCache.set(filePath, html);
                console.log(`✅ Cached: ${filePath} (${html.length} bytes)`);
            } else {
                console.warn(`⚠️ Failed to preload: ${filePath} (${response.status})`);
            }
        } catch (error) {
            console.warn(`⚠️ Error preloading ${filePath}:`, error.message);
        }
    });
    
    // Load all files in parallel
    await Promise.all(loadPromises);
    console.log('✅ All HTML files pre-loaded! Slide transitions will now be instant.');
}

/**
 * Update UI for slide type
 */
export async function updateUIForSlideType(slideType, htmlCache) {
    try {
        console.log(`🎨 Loading UI for slide type: ${slideType}`);
        
        const slideContentArea = document.getElementById('slideContentArea');
        if (!slideContentArea) {
            console.error('❌ slideContentArea not found');
            return;
        }
        
        // Map slide types to HTML files
        const slideTypeFiles = {
            'opening': 'slide-types/opening.html',
            'question': 'slide-types/question.html',
            'transition': 'slide-types/transition.html',
            'start': 'slide-types/start.html',
            'statistics': 'slide-types/statistics.html',
            'leaderboard': 'slide-types/leaderboard.html',
            'summary': 'slide-types/summary.html',
            'settings': 'slide-types/settings.html'
        };
        
        const fileName = slideTypeFiles[slideType];
        
        if (!fileName) {
            console.warn(`⚠️ Unknown slide type: ${slideType}, using default`);
            slideContentArea.innerHTML = `
                <div style="padding: 20px; text-align: center; direction: rtl;">
                    <p>בחר סוג שקף מהרשימה למעלה</p>
                </div>
            `;
            return;
        }
        
        // Try cache first
        let htmlContent = htmlCache.get(fileName);
        
        if (!htmlContent) {
            console.log(`📥 Loading from server: ${fileName}`);
            const response = await fetch(fileName);
            
            if (!response.ok) {
                throw new Error(`Failed to load: ${response.status}`);
            }
            
            htmlContent = await response.text();
            htmlCache.set(fileName, htmlContent);
        } else {
            console.log(`⚡ Using cached content for: ${fileName}`);
        }
        
        // For question slides, pre-set the correct answer in HTML before inserting to DOM
        if (slideType === 'question' && window.currentSlideId && window.slideTypeData) {
            const slideData = window.slideTypeData[window.currentSlideId];
            if (slideData && slideData.correctAnswer) {
                console.log('🔧 Pre-setting correct answer in HTML:', slideData.correctAnswer);
                // Replace the default selected option with the saved one
                const correctAnswer = slideData.correctAnswer;
                htmlContent = htmlContent.replace(
                    /<option value="1">🔴 תשובה 1<\/option>/,
                    `<option value="1"${correctAnswer === '1' ? ' selected' : ''}>🔴 תשובה 1</option>`
                );
                htmlContent = htmlContent.replace(
                    /<option value="2">🔵 תשובה 2<\/option>/,
                    `<option value="2"${correctAnswer === '2' ? ' selected' : ''}>🔵 תשובה 2</option>`
                );
                htmlContent = htmlContent.replace(
                    /<option value="3">🟡 תשובה 3<\/option>/,
                    `<option value="3"${correctAnswer === '3' ? ' selected' : ''}>🟡 תשובה 3</option>`
                );
                htmlContent = htmlContent.replace(
                    /<option value="4">🟢 תשובה 4<\/option>/,
                    `<option value="4"${correctAnswer === '4' ? ' selected' : ''}>🟢 תשובה 4</option>`
                );
                console.log('✅ HTML pre-processed with correct answer');
            }
        }
        
        slideContentArea.innerHTML = htmlContent;
        
        console.log('✅ UI loaded successfully for type:', slideType);
        
    } catch (error) {
        console.error('❌ Error loading slide type UI:', error);
        
        const slideContentArea = document.getElementById('slideContentArea');
        if (slideContentArea) {
            slideContentArea.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #dc3545; direction: rtl;">
                    <h3>❌ שגיאה בטעינת ממשק</h3>
                    <p>לא ניתן לטעון את הממשק עבור סוג שקף: <strong>${slideType}</strong></p>
                </div>
            `;
        }
    }
}

/**
 * Initialize start screen with QR code
 * Called when loading a slide of type 'start'
 */
export async function initializeStartScreen() {
    console.log('🎮 Initializing start screen...');
    
    try {
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const hashId = await getGameHashId();
        
        if (!hashId) {
            document.getElementById('qrCodeArea').innerHTML = 
                '<div style="color: #d13438;">⚠️ לא נמצא מזהה משחק. אנא שמור את המצגת תחילה.</div>';
            document.getElementById('adminUrl').textContent = 'שגיאה: לא נמצא מזהה משחק';
            return;
        }
        
        console.log('✅ Hash ID for start screen:', hashId);
        
        // Build the admin URL
        const adminUrl = `http://192.168.31.22:3002/${hashId}`;
        
        // Display the URL
        const adminUrlElement = document.getElementById('adminUrl');
        if (adminUrlElement) {
            adminUrlElement.textContent = adminUrl;
        }
        
        // Use server's QR code endpoint (works with Office Add-in CSP)
        const qrCodeUrl = `${API_BASE}qr-code/${hashId}`;
        
        console.log('📸 QR Code URL (from server):', qrCodeUrl);
        
        // Display QR code as image
        const qrCodeArea = document.getElementById('qrCodeArea');
        if (qrCodeArea) {
            qrCodeArea.innerHTML = `
                <img src="${qrCodeUrl}" 
                     alt="QR Code למשחק" 
                     style="width: 220px; height: 220px; border: 3px solid #0078d4; border-radius: 8px; background: white; padding: 10px;"
                     onload="console.log('✅ QR code image loaded successfully')"
                     onerror="console.error('❌ QR code failed to load from:', '${qrCodeUrl}'); this.style.display='none'; this.parentElement.innerHTML = '<div style=color:#d13438>⚠️ שגיאה בטעינת QR code</div>';" />
            `;
        }
        
        console.log('✅ Start screen initialized with QR code');
        console.log('📍 Admin URL:', adminUrl);
        
    } catch (error) {
        console.error('❌ Error initializing start screen:', error);
        const qrCodeArea = document.getElementById('qrCodeArea');
        if (qrCodeArea) {
            qrCodeArea.innerHTML = 
                `<div style="color: #d13438;">⚠️ שגיאה ביצירת קוד QR<br><small>${error.message}</small></div>`;
        }
        const adminUrlElement = document.getElementById('adminUrl');
        if (adminUrlElement) {
            adminUrlElement.textContent = 'שגיאה: ' + error.message;
        }
    }
}

/**
 * Load settings from window.presentationSettings into UI
 * Called when opening settings screen
 */
export function loadSettingsIntoUI() {
    console.log('🔄 Loading settings into UI...');
    console.log('📊 presentationSettings:', window.presentationSettings);
    
    if (!window.presentationSettings) {
        window.presentationSettings = {
            questionWaitTime: 30,
            clockActivationDelay: 5,
            afterQuestionStatistics: true,
            afterQuestionLeaderboard: false
        };
        console.log('📋 Initialized default settings');
    }
    
    // Apply to UI
    const questionWaitTime = document.getElementById('questionWaitTime');
    const clockActivationDelay = document.getElementById('clockActivationDelay');
    const afterQuestionStatistics = document.getElementById('afterQuestionStatistics');
    const afterQuestionLeaderboard = document.getElementById('afterQuestionLeaderboard');
    
    console.log('🔍 Elements found:', {
        questionWaitTime: !!questionWaitTime,
        clockActivationDelay: !!clockActivationDelay,
        afterQuestionStatistics: !!afterQuestionStatistics,
        afterQuestionLeaderboard: !!afterQuestionLeaderboard
    });
    
    if (questionWaitTime) {
        questionWaitTime.value = window.presentationSettings.questionWaitTime !== undefined 
            ? window.presentationSettings.questionWaitTime 
            : 30;
        console.log('⏱️ Set questionWaitTime to:', questionWaitTime.value);
    }
    
    if (clockActivationDelay) {
        clockActivationDelay.value = window.presentationSettings.clockActivationDelay !== undefined 
            ? window.presentationSettings.clockActivationDelay 
            : 5;
        console.log('⏱️ Set clockActivationDelay to:', clockActivationDelay.value);
    }
    
    if (afterQuestionStatistics) {
        afterQuestionStatistics.checked = window.presentationSettings.afterQuestionStatistics !== false;
        console.log('✅ Set afterQuestionStatistics to:', afterQuestionStatistics.checked);
    }
    
    if (afterQuestionLeaderboard) {
        afterQuestionLeaderboard.checked = window.presentationSettings.afterQuestionLeaderboard === true;
        console.log('✅ Set afterQuestionLeaderboard to:', afterQuestionLeaderboard.checked);
    }
    
    console.log('✅ Settings UI updated');
}

/**
 * Attach event listeners to settings UI elements
 * Called after settings HTML is loaded
 */
export function attachSettingsEventListeners() {
    console.log('🔗 Attaching settings event listeners...');
    
    const questionWaitTime = document.getElementById('questionWaitTime');
    const clockActivationDelay = document.getElementById('clockActivationDelay');
    const afterQuestionStatistics = document.getElementById('afterQuestionStatistics');
    const afterQuestionLeaderboard = document.getElementById('afterQuestionLeaderboard');
    
    const saveSettings = () => {
        const questionWaitValue = parseInt(questionWaitTime?.value);
        const clockDelayValue = parseInt(clockActivationDelay?.value);
        
        window.presentationSettings = {
            questionWaitTime: !isNaN(questionWaitValue) ? questionWaitValue : 30,
            clockActivationDelay: !isNaN(clockDelayValue) ? clockDelayValue : 5,
            afterQuestionStatistics: afterQuestionStatistics?.checked !== false,
            afterQuestionLeaderboard: afterQuestionLeaderboard?.checked === true
        };
        
        console.log('💾 Settings saved:', window.presentationSettings);
        
        // Call triggerAutoSave from window object (exposed by taskpane.js)
        if (window.triggerAutoSave) {
            window.triggerAutoSave();
        }
    };
    
    if (questionWaitTime) {
        questionWaitTime.addEventListener('change', saveSettings);
        questionWaitTime.addEventListener('input', saveSettings);
    }
    
    if (clockActivationDelay) {
        clockActivationDelay.addEventListener('change', saveSettings);
        clockActivationDelay.addEventListener('input', saveSettings);
    }
    
    if (afterQuestionStatistics) {
        afterQuestionStatistics.addEventListener('change', saveSettings);
    }
    
    if (afterQuestionLeaderboard) {
        afterQuestionLeaderboard.addEventListener('change', saveSettings);
    }
    
    console.log('✅ Event listeners attached');
}

/**
 * Attach event listener to question slide's correct answer dropdown
 * Called when loading a slide of type 'question'
 */
export function attachQuestionAnswerListener() {
    setTimeout(() => {
        const correctAnswerSelect = document.getElementById('correctAnswer');
        
        if (!correctAnswerSelect) {
            console.error('❌ correctAnswer select element NOT FOUND!');
            return;
        }
        
        console.log('✅ Attaching listener to correctAnswer dropdown');
        
        correctAnswerSelect.addEventListener('change', function() {
            if (!window.currentSlideId) {
                console.error('❌ אין currentSlideId!');
                return;
            }
            
            const answerValue = correctAnswerSelect.value;
            const slideId = window.currentSlideId;
            
            console.log('💾 Saving correct answer:', answerValue);
            
            // שמירה ב-slideTypeData
            if (!window.slideTypeData[slideId]) {
                window.slideTypeData[slideId] = {
                    type: 'question',
                    correctAnswer: answerValue
                };
            } else if (typeof window.slideTypeData[slideId] === 'string') {
                const slideType = window.slideTypeData[slideId];
                window.slideTypeData[slideId] = {
                    type: slideType,
                    correctAnswer: answerValue
                };
            } else {
                window.slideTypeData[slideId].correctAnswer = answerValue;
                if (!window.slideTypeData[slideId].type) {
                    window.slideTypeData[slideId].type = 'question';
                }
            }
            
            console.log('✅ תשובה נכונה נשמרה:', answerValue);
            
            // Call triggerAutoSave from window object (exposed by taskpane.js)
            if (window.triggerAutoSave) {
                window.triggerAutoSave();
            }
        });
    }, 0);
}

/**
 * Load shared actions HTML into footer
 */
export async function loadSharedActions() {
    try {
        console.log('🔧 Loading shared actions...');
        const container = document.getElementById('sharedActionsContainer');
        if (!container) {
            console.warn('⚠️ sharedActionsContainer not found');
            return;
        }
        
        const response = await fetch('slide-types/shared-actions.html');
        if (response.ok) {
            const html = await response.text();
            container.innerHTML = html;
            console.log('✅ Shared actions loaded successfully');
        } else {
            console.error('❌ Failed to load shared actions:', response.status);
        }
    } catch (error) {
        console.error('❌ Error loading shared actions:', error);
    }
}
