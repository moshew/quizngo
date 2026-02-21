/* global Office, PowerPoint */

console.log('ðŸ“„ taskpane.js loaded (Tabbed Version with i18n)!');

// Import modules - Core
import { 
    getSlideType, 
    loadGameData,
    saveGameData,
    // Centralized state management - gamePin is the primary identifier
    getGamePIN, setGamePIN,
    getCurrentUsers, setCurrentUsers,
    getSocket, setSocket,
    getCurrentSlideNumber, setCurrentSlideNumber,
    getCurrentSlideId, setCurrentSlideId,
    getSlideTypeData,
    getPresentationSettings, setPresentationSettings, updatePresentationSettings,
    setRefreshSlideListCallback, triggerRefreshSlideList
} from './modules/core/state.js';

// Import modules - UI
import { showStatus, showError, hideAdminConnectionScreen } from './modules/ui/manager.js';
import { 
    initializeSlidesList,
    refreshSlideList,
    navigateToSlideByIndex,
    updateListSelection
} from './modules/ui/slides-list.js';

// Import modules - Game
import { 
    handleSlideTypeChange, 
    saveSlideType, 
    loadHiddenSlideState,
    setupHideSlideListener 
} from './modules/game/slides.js';
import { 
    setupSlideChangeListener, 
    onSlideChanged
} from './modules/game/events.js';
import { startPresentationMode, endGame } from './modules/game/actions.js';

// Import modules - Elements
import {
    addQuestionTime,
    addRespondentsCount
} from './modules/elements/question_timer.js';
import {
    insertParticipantsListButton,
    insertParticipantsNumButton
} from './modules/elements/participants_management.js';
import {
    addAnswersDistribution, 
    addLeaderboardElements
} from './modules/elements/answers_analysis.js';
import {
    insertGameIdButton,
    insertQrCodeButton
} from './modules/elements/game_management.js';

// Import i18n module
import { 
    initI18n, 
    setLanguage, 
    getLanguage, 
    t, 
    updateDOM,
    getAvailableLanguages,
    LANGUAGES,
    isRTL
} from './modules/i18n/index.js';

const TEMPLATE_CONFIG = {
    classic_black: {
        binUrl: 'assets/templates/classic.black.bin'
    }
};

function markAppReady() {
    if (!document.body) return;
    document.body.classList.remove('app-booting');
    document.body.classList.remove('boot-main', 'boot-onboarding');
    document.body.classList.add('app-ready');
}

function setBootMode(mode) {
    if (!document.body) return;
    document.body.classList.remove('boot-main', 'boot-onboarding');
    if (mode === 'onboarding') {
        document.body.classList.add('boot-onboarding');
        return;
    }
    document.body.classList.add('boot-main');
}

// --- i18n Functions ---

/**
 * Initialize language selector dropdown
 */
function initLanguageSelector() {
    const select = document.getElementById('settingLanguage');
    if (!select) return;
    
    const languages = getAvailableLanguages();
    const currentLang = getLanguage();
    
    select.innerHTML = languages.map(lang => 
        `<option value="${lang.code}" ${lang.code === currentLang ? 'selected' : ''}>${lang.flag} ${lang.nativeName}</option>`
    ).join('');
    
    select.addEventListener('change', async (e) => {
        await changeLanguage(e.target.value);
    });
}

/**
 * Change the interface language
 */
window.changeLanguage = async function(langCode) {
    console.log(`ðŸŒ Changing language to: ${langCode}`);
    
    await setLanguage(langCode);
    
    // Update all UI
    updateAllUI();
    
    // Save language in presentation settings
    updatePresentationSettings({ language: langCode });
    
    // Save to presentation
    saveGameData();
    
    console.log(`âœ… Language changed to: ${langCode}`);
};

/**
 * Update all UI elements with translations
 */
function updateAllUI() {
    // Update DOM elements with data-i18n attributes
    updateDOM();
    
    // Update tab labels
    const tabSlides = document.getElementById('tabSlides');
    const tabActions = document.getElementById('tabActions');
    const tabSettings = document.getElementById('tabSettings');
    
    if (tabSlides) tabSlides.textContent = t('tabs.slides');
    if (tabActions) tabActions.textContent = t('tabs.actions');
    if (tabSettings) tabSettings.textContent = t('tabs.settings');
    
    // Update loading text
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.textContent = t('slides.loading');
    
    // Update dialogs
    updateDialogOptions();
    
    // Re-render actions tab
    renderActionsTab();

    // Update start/stop button label for current language and game state
    updateStartStopButton();

    // Refresh slide list to update labels
    triggerRefreshSlideList();
}

/**
 * Update dialog select options with translations
 */
function updateDialogOptions() {
    // Slide type select
    const slideTypeSelect = document.getElementById('slideTypeSelect');
    if (slideTypeSelect) {
        slideTypeSelect.innerHTML = `
            <option value="opening">${t('slideTypes.opening')}</option>
            <option value="transition">${t('slideTypes.transition')}</option>
            <option value="question">${t('slideTypes.question')}</option>
            <option value="statistics">${t('slideTypes.statistics')}</option>
            <option value="leaderboard">${t('slideTypes.leaderboard')}</option>
            <option value="summary">${t('slideTypes.summary')}</option>
        `;
    }
    
    // Correct answer select
    const correctAnswerSelect = document.getElementById('correctAnswerSelect');
    if (correctAnswerSelect) {
        correctAnswerSelect.innerHTML = `
            <option value="1">${t('dialogs.answer')} 1 (${t('dialogs.red')})</option>
            <option value="2">${t('dialogs.answer')} 2 (${t('dialogs.blue')})</option>
            <option value="3">${t('dialogs.answer')} 3 (${t('dialogs.yellow')})</option>
            <option value="4">${t('dialogs.answer')} 4 (${t('dialogs.green')})</option>
        `;
    }
}

// --- Global Functions (Attached to window for HTML access) ---

window.switchTab = function(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    
    // Show selected
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Highlight tab button
    const tabs = document.querySelectorAll('.tab');
    if (tabName === 'slides') tabs[0].classList.add('active');
    if (tabName === 'actions') tabs[1].classList.add('active');
    if (tabName === 'settings') {
        tabs[2].classList.add('active');
        // Load current settings into the tab
        loadSettingsToTab();
    }
};

// Setup tab click handlers
function setupTabHandlers() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            if (tabName) {
                window.switchTab(tabName);
            }
        });
    });
}

window.closeDialogs = function() {
    document.querySelectorAll('.overlay').forEach(el => el.style.display = 'none');
};

const SETTINGS_LIMITS = {
    questionWaitTime: { min: 5, max: 60, fallback: 30 },
    clockActivationDelay: { min: 0, max: 60, fallback: 5 }
};

function clampSettingValue(rawValue, limits) {
    const parsed = parseInt(rawValue, 10);
    const normalized = Number.isNaN(parsed) ? limits.fallback : parsed;
    return Math.min(limits.max, Math.max(limits.min, normalized));
}

// Load settings into the settings tab
function loadSettingsToTab() {
    const settings = getPresentationSettings();
    const questionWaitTime = clampSettingValue(settings.questionWaitTime, SETTINGS_LIMITS.questionWaitTime);
    const clockActivationDelay = clampSettingValue(settings.clockActivationDelay, SETTINGS_LIMITS.clockActivationDelay);
    
    document.getElementById('settingTimeTab').value = questionWaitTime;
    document.getElementById('settingDelayTab').value = clockActivationDelay;
    document.getElementById('settingAfterStatsTab').checked = settings.afterQuestionStatistics !== false;
    document.getElementById('settingAfterLeaderboardTab').checked = settings.afterQuestionLeaderboard === true;
    
    // Update language selector
    const langSelect = document.getElementById('settingLanguage');
    if (langSelect && settings.language) {
        langSelect.value = settings.language;
    }
}

// Save settings when any setting changes
function autoSaveSettings() {
    const timeInput = document.getElementById('settingTimeTab');
    const delayInput = document.getElementById('settingDelayTab');
    const time = clampSettingValue(timeInput.value, SETTINGS_LIMITS.questionWaitTime);
    const delay = clampSettingValue(delayInput.value, SETTINGS_LIMITS.clockActivationDelay);
    const stats = document.getElementById('settingAfterStatsTab').checked;
    const board = document.getElementById('settingAfterLeaderboardTab').checked;
    const lang = getLanguage();

    timeInput.value = time;
    delayInput.value = delay;
    
    setPresentationSettings({
        questionWaitTime: time,
        clockActivationDelay: delay,
        afterQuestionStatistics: stats,
        afterQuestionLeaderboard: board,
        language: lang
    });
    
    // Save to presentation
    saveGameData();
    
    console.log('Settings saved:', getPresentationSettings());
}

// Setup settings auto-save listeners
function setupSettingsListeners() {
    document.getElementById('settingTimeTab').addEventListener('change', autoSaveSettings);
    document.getElementById('settingDelayTab').addEventListener('change', autoSaveSettings);
    document.getElementById('settingAfterStatsTab').addEventListener('change', autoSaveSettings);
    document.getElementById('settingAfterLeaderboardTab').addEventListener('change', autoSaveSettings);
}


// Note: State variables are now managed in state.js
// No need to initialize window.* variables here

// ============================================================================
// ONBOARDING
// ============================================================================

async function fetchTemplateBase64(binUrl) {
    const response = await fetch(binUrl, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Template file not found: ${binUrl}`);
    }

    const buffer = await response.arrayBuffer();
    return new TextDecoder('utf-8').decode(buffer).trim();
}

function decodeXmlEntities(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
}

async function extractTemplateGameData(base64Content) {
    if (!window.JSZip) {
        throw new Error('JSZip failed to load');
    }

    const zip = await window.JSZip.loadAsync(base64Content, { base64: true });
    let templateSlideOrderIds = [];

    try {
        const presentationFile = zip.file('ppt/presentation.xml');
        if (presentationFile) {
            const presentationXml = await presentationFile.async('string');
            templateSlideOrderIds = [...presentationXml.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"[^>]*\br:id="[^"]+"[^>]*\/?>/gi)]
                .map(match => String(match[1]));
        }
    } catch (parseError) {
        console.warn('Could not extract template slide order from presentation.xml:', parseError);
    }

    const tagFiles = Object.keys(zip.files).filter(name => /^ppt\/tags\/tag\d+\.xml$/i.test(name));

    for (const fileName of tagFiles) {
        const file = zip.file(fileName);
        if (!file) continue;

        const xml = await file.async('string');
        const tagPattern = /<p:tag\b[^>]*\bname="([^"]+)"[^>]*\bval="([^"]*)"/gi;
        const tags = [...xml.matchAll(tagPattern)];

        for (const match of tags) {
            const tagName = String(match[1] || '').trim().toLowerCase();
            if (tagName !== 'quizngo_game_data') continue;

            const decodedValue = decodeXmlEntities(String(match[2] || ''));
            try {
                return {
                    gameData: JSON.parse(decodedValue),
                    templateSlideOrderIds
                };
            } catch (parseError) {
                console.warn(`Could not parse template game-data JSON from ${fileName}:`, parseError);
            }
        }
    }

    return {
        gameData: null,
        templateSlideOrderIds
    };
}

function isLikelyPlaceholderName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return false;

    return (
        /^title\s+\d+$/i.test(normalized) ||
        /^subtitle\s+\d+$/i.test(normalized) ||
        /^center title\s+\d+$/i.test(normalized) ||
        /^content placeholder\s+\d+$/i.test(normalized) ||
        /^text placeholder\s+\d+$/i.test(normalized)
    );
}

async function isSlideConsideredEmpty(slide, context) {
    const shapes = slide.shapes;
    shapes.load('items');
    await context.sync();

    if (shapes.items.length === 0) {
        return true;
    }

    // Heuristic for "empty": only text-capable shapes, no tags, and no visible text.
    // This treats default Title/Subtitle placeholders with no text as empty.
    const textRanges = [];
    let placeholderLikeCount = 0;

    for (const shape of shapes.items) {
        shape.load('name');
        shape.tags.load('items');
        try {
            shape.load('textFrame');
        } catch (e) {
            // If this shape isn't text-capable, treat the slide as non-empty.
            return false;
        }
    }
    await context.sync();

    for (const shape of shapes.items) {
        if (shape.tags.items.length > 0) {
            return false;
        }

        if (isLikelyPlaceholderName(shape.name)) {
            placeholderLikeCount++;
        }

        try {
            const range = shape.textFrame.textRange;
            range.load('text');
            textRanges.push(range);
        } catch (e) {
            // Non-text shape (or inaccessible text) => not an empty placeholder slide.
            return false;
        }
    }
    await context.sync();

    for (const range of textRanges) {
        if (String(range.text || '').trim().length > 0) {
            return false;
        }
    }

    // If all shapes are empty-text placeholders, mark as empty.
    if (placeholderLikeCount === shapes.items.length) {
        return true;
    }

    // Fallback: up to 3 empty, untagged text shapes is still considered empty.
    return shapes.items.length <= 3;
}

async function deleteEmptySlidesBeforeTemplateInsert() {
    return PowerPoint.run(async (context) => {
        const slides = context.presentation.slides;
        slides.load('items/id');
        await context.sync();

        const emptySlideIds = [];
        for (const slide of slides.items) {
            const isEmpty = await isSlideConsideredEmpty(slide, context);
            if (isEmpty) {
                emptySlideIds.push(slide.id);
            }
        }

        const allSlidesAreEmpty = slides.items.length > 0 && emptySlideIds.length === slides.items.length;
        const deferredDeleteIds = allSlidesAreEmpty ? [...emptySlideIds] : [];
        let deletedNow = 0;

        if (!allSlidesAreEmpty && emptySlideIds.length > 0) {
            const emptySet = new Set(emptySlideIds);
            for (const slide of slides.items) {
                if (emptySet.has(slide.id)) {
                    slide.delete();
                    deletedNow++;
                }
            }
            await context.sync();
        }

        slides.load('items/id');
        await context.sync();

        const slideIdsBeforeInsert = slides.items.map(s => s.id);
        const targetSlideId = slideIdsBeforeInsert.length > 0
            ? slideIdsBeforeInsert[slideIdsBeforeInsert.length - 1]
            : null;

        return {
            targetSlideId,
            slideIdsBeforeInsert,
            emptySlideIds,
            deferredDeleteIds,
            deletedNow,
            remainingSlides: slideIdsBeforeInsert.length
        };
    });
}

async function insertTemplateSlides(base64Content, targetSlideId) {
    return PowerPoint.run(async (context) => {
        const options = {
            formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting
        };
        if (targetSlideId) {
            options.targetSlideId = targetSlideId;
        }

        context.presentation.insertSlidesFromBase64(base64Content, options);
        await context.sync();
    });
}

async function deleteSlidesByIds(slideIds) {
    if (!Array.isArray(slideIds) || slideIds.length === 0) return;

    await PowerPoint.run(async (context) => {
        const slides = context.presentation.slides;
        slides.load('items/id');
        await context.sync();

        const deleteSet = new Set(slideIds);
        let deletedCount = 0;

        for (const slide of slides.items) {
            if (deleteSet.has(slide.id)) {
                slide.delete();
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            await context.sync();
        }
    });
}

async function getAllSlideIds() {
    return PowerPoint.run(async (context) => {
        const slides = context.presentation.slides;
        slides.load('items/id');
        await context.sync();
        return slides.items.map(s => s.id);
    });
}

function resolveInsertedSlideIds(currentSlideIds, beforeInsertSlideIds, expectedCount) {
    if (expectedCount <= 0) return [];

    const beforeSet = new Set(beforeInsertSlideIds || []);
    let inserted = currentSlideIds.filter(id => !beforeSet.has(id));

    if (inserted.length !== expectedCount) {
        inserted = currentSlideIds.slice(-expectedCount);
    }

    if (inserted.length > expectedCount) {
        inserted = inserted.slice(-expectedCount);
    }

    return inserted;
}

function getTemplateNumericPrefix(templateSlideTypeKey) {
    const match = String(templateSlideTypeKey || '').match(/^(\d+)#/);
    return match ? match[1] : null;
}

function mapTemplateEntriesToInsertedSlides(templateEntries, insertedSlideIds, templateSlideOrderIds = []) {
    const remapped = {};
    if (templateEntries.length === 0 || insertedSlideIds.length === 0) {
        return remapped;
    }

    const sourceByNumericId = new Map();
    const mappedSourceKeys = new Set();
    const usedInserted = new Set();

    for (const [sourceSlideId, sourceSlideData] of templateEntries) {
        const numericPrefix = getTemplateNumericPrefix(sourceSlideId);
        if (!numericPrefix) continue;
        if (!sourceByNumericId.has(numericPrefix)) {
            sourceByNumericId.set(numericPrefix, {
                sourceSlideId,
                sourceSlideData
            });
        }
    }

    // First pass: map by template visual order (from presentation.xml IDs).
    if (Array.isArray(templateSlideOrderIds) && templateSlideOrderIds.length > 0) {
        const count = Math.min(templateSlideOrderIds.length, insertedSlideIds.length);
        for (let i = 0; i < count; i++) {
            const numericTemplateId = String(templateSlideOrderIds[i]);
            const sourceInfo = sourceByNumericId.get(numericTemplateId);
            if (!sourceInfo) continue;

            const targetSlideId = insertedSlideIds[i];
            remapped[targetSlideId] = sourceInfo.sourceSlideData;
            usedInserted.add(targetSlideId);
            mappedSourceKeys.add(sourceInfo.sourceSlideId);
        }
    }

    // Second pass: exact ID matches (when host preserves source IDs).
    const insertedSet = new Set(insertedSlideIds);
    for (const [sourceSlideId, sourceSlideData] of templateEntries) {
        if (mappedSourceKeys.has(sourceSlideId)) continue;
        if (insertedSet.has(sourceSlideId) && !usedInserted.has(sourceSlideId)) {
            remapped[sourceSlideId] = sourceSlideData;
            usedInserted.add(sourceSlideId);
            mappedSourceKeys.add(sourceSlideId);
        }
    }

    // Final fallback: remaining entries by order.
    const remainingEntries = templateEntries.filter(([sourceSlideId]) => !mappedSourceKeys.has(sourceSlideId));
    const remainingInserted = insertedSlideIds.filter(id => !usedInserted.has(id));
    const count = Math.min(remainingEntries.length, remainingInserted.length);

    for (let i = 0; i < count; i++) {
        remapped[remainingInserted[i]] = remainingEntries[i][1];
    }

    return remapped;
}

function buildMergedGameData(templateGameData, remappedTemplateSlideTypeData, currentSlideIds, deletedSlideIds) {
    const currentSet = new Set(currentSlideIds || []);
    const deletedSet = new Set(deletedSlideIds || []);
    const existingSlideTypeData = getSlideTypeData() || {};
    const preservedSlideTypeData = {};

    for (const [slideId, slideData] of Object.entries(existingSlideTypeData)) {
        if (deletedSet.has(slideId)) continue;
        if (!currentSet.has(slideId)) continue;
        if (Object.prototype.hasOwnProperty.call(remappedTemplateSlideTypeData, slideId)) continue;
        preservedSlideTypeData[slideId] = slideData;
    }

    return {
        ...templateGameData,
        slideTypeData: {
            ...preservedSlideTypeData,
            ...remappedTemplateSlideTypeData
        }
    };
}

async function copyTemplateGameDataToPresentation(gameData) {
    if (!gameData || typeof gameData !== 'object') {
        return;
    }

    await PowerPoint.run(async (context) => {
        context.presentation.tags.add('quizngo_game_data', JSON.stringify(gameData));
        await context.sync();
    });
}

async function applyTemplate(template) {
    if (!template || template === 'blank') return;

    const config = TEMPLATE_CONFIG[template];
    if (!config) {
        throw new Error(`Unknown template: ${template}`);
    }

    if (!Office.context.requirements.isSetSupported('PowerPointApi', '1.2')) {
        throw new Error('PowerPointApi 1.2 is required to insert template slides.');
    }

    const base64Content = await fetchTemplateBase64(config.binUrl);
    const templateMetadata = await extractTemplateGameData(base64Content);
    const templateGameData = templateMetadata?.gameData || null;
    const templateSlideOrderIds = templateMetadata?.templateSlideOrderIds || [];

    const cleanupInfo = await deleteEmptySlidesBeforeTemplateInsert();
    await insertTemplateSlides(base64Content, cleanupInfo.targetSlideId);

    if (cleanupInfo.deferredDeleteIds.length > 0) {
        await deleteSlidesByIds(cleanupInfo.deferredDeleteIds);
    }

    if (templateGameData) {
        const templateEntries = Object.entries(templateGameData.slideTypeData || {});
        const expectedInsertedCount = templateSlideOrderIds.length > 0
            ? templateSlideOrderIds.length
            : templateEntries.length;
        const currentSlideIds = await getAllSlideIds();
        const insertedSlideIds = resolveInsertedSlideIds(
            currentSlideIds,
            cleanupInfo.slideIdsBeforeInsert,
            expectedInsertedCount
        );
        const remappedTemplateSlideTypeData = mapTemplateEntriesToInsertedSlides(
            templateEntries,
            insertedSlideIds,
            templateSlideOrderIds
        );
        const mergedGameData = buildMergedGameData(
            templateGameData,
            remappedTemplateSlideTypeData,
            currentSlideIds,
            cleanupInfo.emptySlideIds
        );

        await copyTemplateGameDataToPresentation(mergedGameData);
        await loadGameData();
    }
}

/**
 * Detect the default language from PowerPoint display language or browser locale.
 * Returns a supported language code, or null if not detectable.
 */
function detectDefaultLanguage() {
    // 1. Try Office UI language (e.g. "he-IL", "en-US")
    try {
        const officeLang = Office.context.displayLanguage;
        if (officeLang) {
            const prefix = officeLang.split('-')[0].toLowerCase();
            if (LANGUAGES[prefix]) return prefix;
        }
    } catch (e) { /* ignore */ }

    // 2. Fallback to browser/OS navigator.language
    try {
        const navLang = (navigator.language || '').split('-')[0].toLowerCase();
        if (navLang && LANGUAGES[navLang]) return navLang;
    } catch (e) { /* ignore */ }

    return null;
}

/**
 * Update onboarding language screen labels using the current i18n language.
 */
function updateOnboardingLangText() {
    const label = document.getElementById('onboardingLangLabel');
    const btn = document.getElementById('onboardingLangBtn');
    if (label) label.textContent = t('onboarding.selectLanguage');
    if (btn) btn.textContent = t('onboarding.enter');

    // Mirror direction on the onboarding screen
    const screen = document.getElementById('onboardingLang');
    if (screen) screen.style.direction = LANGUAGES[getLanguage()]?.dir || 'ltr';
}

/**
 * Show the language selection onboarding screen.
 */
async function showOnboardingLang() {
    const detectedLang = detectDefaultLanguage();
    const defaultLang = (detectedLang && detectedLang !== 'he') ? detectedLang : 'en';

    // Populate the language combobox immediately (no async needed â€” reads static LANGUAGES)
    const select = document.getElementById('onboardingLangSelect');
    const languages = getAvailableLanguages();
    select.innerHTML = languages.map(lang =>
        `<option value="${lang.code}" ${lang.code === defaultLang ? 'selected' : ''}>${lang.flag} ${lang.nativeName}</option>`
    ).join('');

    // Set i18n to detected/default language (for button/label translations)
    await setLanguage(defaultLang);

    // Update labels for the initial language
    updateOnboardingLangText();

    // Live update label & button text when language changes
    select.addEventListener('change', async (e) => {
        await setLanguage(e.target.value);
        updateOnboardingLangText();
    });

    // "Enter" â†’ proceed to template screen
    document.getElementById('onboardingLangBtn').addEventListener('click', () => {
        showOnboardingTemplate();
    });

    // Show the screen
    document.getElementById('onboardingLang').classList.remove('hidden');
}

/**
 * Show the template selection onboarding screen.
 */
function showOnboardingTemplate() {
    // Switch screens
    document.getElementById('onboardingLang').classList.add('hidden');
    document.getElementById('onboardingTemplate').classList.remove('hidden');

    // Populate labels with current language
    const titleEl = document.getElementById('onboardingTplTitle');
    const labelBlank = document.getElementById('tplLabelBlank');
    const labelClassic = document.getElementById('tplLabelClassic');
    const applyLabel = document.getElementById('onboardingApplyLabel');
    if (titleEl) titleEl.textContent = t('onboarding.chooseTemplate');
    if (labelBlank) labelBlank.textContent = t('onboarding.blankTemplate');
    if (labelClassic) labelClassic.textContent = t('onboarding.classicBlack');
    if (applyLabel) applyLabel.textContent = t('onboarding.applyTemplate');

    // Mirror direction
    const tplScreen = document.getElementById('onboardingTemplate');
    if (tplScreen) tplScreen.style.direction = LANGUAGES[getLanguage()]?.dir || 'ltr';

    // Card selection logic
    let selectedTemplate = null;
    const applyBtn = document.getElementById('onboardingApplyBtn');

    document.querySelectorAll('.onboarding-tpl__card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.onboarding-tpl__card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedTemplate = card.dataset.template;
            applyBtn.disabled = false;
        });
    });

    applyBtn.addEventListener('click', async () => {
        await finishOnboarding(selectedTemplate || 'blank');
    });
}

/**
 * Complete onboarding: save settings and proceed to the main app UI.
 */
async function finishOnboarding(template) {
    document.getElementById('onboardingLang').classList.add('hidden');
    document.getElementById('onboardingTemplate').classList.add('hidden');

    try {
        await applyTemplate(template);
    } catch (error) {
        console.error('Error applying selected template:', error);
        showError('Failed to apply selected template');
    }

    // Persist language and template choice
    updatePresentationSettings({ language: getLanguage(), template });
    await saveGameData(); // Creates quizngo_game_data so next load skips onboarding

    // Hand off to normal app initialization
    await initializeMainApp();
}

// ============================================================================
// MAIN APP INITIALIZATION (runs whether first-time or returning user)
// ============================================================================

/**
 * Initialize the main application after game data is available.
 */
async function initializeMainApp() {
    // Apply saved language (if returning user, language is already set)
    const settings = getPresentationSettings();
    if (settings?.language && settings.language !== getLanguage()) {
        await setLanguage(settings.language);
    }
    updateAllUI();

    await selectCurrentSlideOnLoad();
    await initializeSlidesList();
}

// Select current slide on load or navigate to first slide
async function selectCurrentSlideOnLoad() {
    try {
        await PowerPoint.run(async (context) => {
            const selection = context.presentation.getSelectedSlides();
            selection.load("items/id");
            
            const slides = context.presentation.slides;
            slides.load("items/id");
            
            await context.sync();
            
            if (selection.items.length > 0) {
                // A slide is selected, use it
                const selectedSlide = selection.items[0];
                setCurrentSlideId(selectedSlide.id);
                
                // Find the slide index
                const slideIndex = slides.items.findIndex(s => s.id === selectedSlide.id);
                setCurrentSlideNumber(slideIndex + 1);
                
                console.log('ðŸ“ Current slide on load:', getCurrentSlideNumber(), getCurrentSlideId());
            } else if (slides.items.length > 0) {
                // No slide selected, go to first slide
                const firstSlide = slides.items[0];
                setCurrentSlideId(firstSlide.id);
                setCurrentSlideNumber(1);
                
                // Navigate to first slide
                await navigateToSlideByIndex(1);
                console.log('ðŸ“ Navigated to first slide:', getCurrentSlideId());
            }
        });
    } catch (error) {
        console.error('Error selecting current slide on load:', error);
        // Fallback: try to go to first slide
        setCurrentSlideNumber(1);
        try {
            await navigateToSlideByIndex(1);
        } catch (e) {
            console.error('Error navigating to first slide:', e);
        }
    }
}

// Initialize the add-in when Office is ready (boot-gated)
Office.onReady(async (info) => {
    console.log('Office.onReady called!', info);
    try {
        if (info.host === Office.HostType.PowerPoint) {
        console.log('PowerPoint detected - initializing add-in...');

        // Initialize i18n with saved language (avoids direction-change flicker on reload)
        await initI18n();

        // Resolve startup route early so boot background already matches target screen.
        const hasGameData = await loadGameData();
        setBootMode(hasGameData ? 'main' : 'onboarding');

        // Set up persistent UI (tabs, buttons, settings) â€” hidden behind onboarding if needed
        setupTabHandlers();
        initLanguageSelector();
        renderActionsTab();
        setupSettingsListeners();
        loadSettingsToTab();
        updateAllUI();

        // Attach persistent button listeners
        document.getElementById('btnStartGame').onclick = async () => {
            if (getGamePIN()) {
                await endGame();
            } else {
                await startPresentationMode();
            }
        };

        // Initialize button state
        updateStartStopButton();

        // Close button for admin connection overlay
        document.getElementById('btnCloseAdminOverlay').onclick = () => {
            hideAdminConnectionScreen();
        };

        // Set up slide change event listener
        setupSlideChangeListener((eventArgs) => onSlideChanged(eventArgs));

        // Route already decided above; continue with selected startup flow.

        if (!hasGameData) {
            // First time: show onboarding flow
            console.log('First time load - showing onboarding');
            await showOnboardingLang();
        } else {
            // Returning user: proceed directly
            console.log('Game data found - skipping onboarding');
            await initializeMainApp();
        }

    } else {
        console.log('Not in PowerPoint');
    }
    } catch (error) {
        console.error('Error during add-in initialization:', error);
        showError('Failed to initialize the add-in');
    } finally {
        markAppReady();
    }
});


// --- Tab 2: Actions ---

function renderActionsTab() {
    const grid = document.getElementById('actionsGrid');
    if (!grid) return;
    
    // Global Actions with translations
    const actions = [
        // Slide Elements
        { label: t('actions.gameId'), icon: 'Game', onclick: insertGameIdButton },
        { label: t('actions.participantsCount'), icon: 'PeopleAdd', onclick: insertParticipantsNumButton },
        { label: t('actions.participantsList'), icon: 'ContactList', onclick: insertParticipantsListButton },
        { label: t('actions.qrCode'), icon: 'QRCode', onclick: insertQrCodeButton },

        // Game Control
        { label: t('actions.questionTime'), icon: 'Clock', onclick: addQuestionTime },
        { label: t('actions.respondersCount'), icon: 'People', onclick: addRespondentsCount },
        
        // Analysis Elements
        { label: t('actions.answersDistribution'), icon: 'BarChart4', onclick: addAnswersDistribution },
        { label: t('actions.leaderboard'), icon: 'Trophy', onclick: addLeaderboardElements }
    ];
    
    grid.innerHTML = '';
    actions.forEach(action => {
        const btn = document.createElement('div');
        btn.className = 'action-card';
        btn.innerHTML = `<i class="ms-Icon ms-Icon--${action.icon}"></i><span>${action.label}</span>`;
        btn.onclick = action.onclick;
        grid.appendChild(btn);
    });
}

/**
 * Update the start/stop game button to reflect current game state.
 * Call this whenever getGamePIN() may have changed.
 */
function updateStartStopButton() {
    const btn = document.getElementById('btnStartGame');
    if (!btn) return;

    const isGameActive = !!getGamePIN();
    const icon = document.getElementById('btnStartGameIcon');
    const label = document.getElementById('btnStartGameLabel');

    if (isGameActive) {
        btn.className = 'btn-stop-game';
        if (icon) icon.className = 'ms-Icon ms-Icon--Stop';
        if (label) label.textContent = t('buttons.stopGame');
    } else {
        btn.className = 'btn-start-game';
        if (icon) icon.className = 'ms-Icon ms-Icon--Play';
        if (label) label.textContent = t('buttons.startGame');
    }
    btn.disabled = false;
}

// Expose for use from actions.js (which runs in a different module scope)
window.updateStartStopButton = updateStartStopButton;

// Expose t function globally for other modules
window.t = t;
window.getLanguage = getLanguage;
window.isRTL = isRTL;
