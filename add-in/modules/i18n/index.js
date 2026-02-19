/**
 * Internationalization (i18n) Module
 * Handles multi-language support with RTL/LTR direction switching
 */

// Available languages configuration
export const LANGUAGES = {
    he: { name: 'עברית', nativeName: 'עברית', dir: 'rtl', flag: '🇮🇱' },
    en: { name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇺🇸' },
    ar: { name: 'العربية', nativeName: 'العربية', dir: 'rtl', flag: '🇸🇦' },
    zh: { name: 'Chinese', nativeName: '中文', dir: 'ltr', flag: '🇨🇳' },
    es: { name: 'Spanish', nativeName: 'Español', dir: 'ltr', flag: '🇪🇸' },
    fr: { name: 'French', nativeName: 'Français', dir: 'ltr', flag: '🇫🇷' },
    de: { name: 'German', nativeName: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
    pt: { name: 'Portuguese', nativeName: 'Português', dir: 'ltr', flag: '🇧🇷' },
    ru: { name: 'Russian', nativeName: 'Русский', dir: 'ltr', flag: '🇷🇺' },
    ja: { name: 'Japanese', nativeName: '日本語', dir: 'ltr', flag: '🇯🇵' },
    hi: { name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', flag: '🇮🇳' },
    ko: { name: 'Korean', nativeName: '한국어', dir: 'ltr', flag: '🇰🇷' }
};

// Default language
const DEFAULT_LANGUAGE = 'he';

// Current language state
let currentLanguage = DEFAULT_LANGUAGE;
let translations = {};
let loadedLanguages = new Set();

// Translation cache
const translationCache = {};

/**
 * Load translations for a language
 */
async function loadTranslations(lang) {
    if (loadedLanguages.has(lang)) {
        return translationCache[lang];
    }

    try {
        const module = await import(`./translations/${lang}.js`);
        translationCache[lang] = module.default;
        loadedLanguages.add(lang);
        console.log(`✅ Loaded translations for: ${lang}`);
        return translationCache[lang];
    } catch (error) {
        console.error(`❌ Failed to load translations for ${lang}:`, error);
        // Fallback to Hebrew if language not found
        if (lang !== DEFAULT_LANGUAGE) {
            console.log(`⚠️ Falling back to ${DEFAULT_LANGUAGE}`);
            return loadTranslations(DEFAULT_LANGUAGE);
        }
        return {};
    }
}

/**
 * Initialize the i18n system
 * @param {string} lang - Initial language code
 */
export async function initI18n(lang = null) {
    // Try to load saved language preference
    const savedLang = lang || getSavedLanguage() || DEFAULT_LANGUAGE;
    await setLanguage(savedLang);
    console.log(`🌐 i18n initialized with language: ${currentLanguage}`);
}

/**
 * Get saved language from localStorage
 */
function getSavedLanguage() {
    try {
        return localStorage.getItem('quizngo_language');
    } catch {
        return null;
    }
}

/**
 * Save language preference to localStorage
 */
function saveLanguage(lang) {
    try {
        localStorage.setItem('quizngo_language', lang);
    } catch (error) {
        console.warn('Could not save language preference:', error);
    }
}

/**
 * Set the current language
 * @param {string} lang - Language code (e.g., 'en', 'he', 'ar')
 */
export async function setLanguage(lang) {
    if (!LANGUAGES[lang]) {
        console.warn(`Language ${lang} not supported, using ${DEFAULT_LANGUAGE}`);
        lang = DEFAULT_LANGUAGE;
    }

    translations = await loadTranslations(lang);
    currentLanguage = lang;
    saveLanguage(lang);

    // Update document direction
    updateDirection();
    
    // Emit language change event
    window.dispatchEvent(new CustomEvent('languageChanged', { 
        detail: { language: lang, direction: getDirection() }
    }));

    console.log(`🌐 Language set to: ${lang} (${LANGUAGES[lang].nativeName})`);
}

/**
 * Get the current language code
 */
export function getLanguage() {
    return currentLanguage;
}

/**
 * Get the direction for current language
 */
export function getDirection() {
    return LANGUAGES[currentLanguage]?.dir || 'ltr';
}

/**
 * Check if current language is RTL
 */
export function isRTL() {
    return getDirection() === 'rtl';
}

/**
 * Update document direction based on current language
 */
function updateDirection() {
    const dir = getDirection();
    document.documentElement.dir = dir;
    document.body.dir = dir;
    document.body.style.direction = dir;
    
    // Update CSS custom property for dynamic styles
    document.documentElement.style.setProperty('--direction', dir);
    document.documentElement.style.setProperty('--text-align', dir === 'rtl' ? 'right' : 'left');
    document.documentElement.style.setProperty('--text-align-opposite', dir === 'rtl' ? 'left' : 'right');
    
    // Add/remove RTL class for targeted styling
    if (dir === 'rtl') {
        document.body.classList.add('rtl');
        document.body.classList.remove('ltr');
    } else {
        document.body.classList.add('ltr');
        document.body.classList.remove('rtl');
    }
}

/**
 * Translate a key
 * @param {string} key - Translation key (e.g., 'tabs.slides', 'settings.title')
 * @param {Object} params - Optional parameters for interpolation
 * @returns {string} - Translated string or key if not found
 */
export function t(key, params = {}) {
    // Navigate nested keys (e.g., 'tabs.slides' -> translations.tabs.slides)
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            console.warn(`Translation missing for key: ${key} in language: ${currentLanguage}`);
            return key; // Return key as fallback
        }
    }

    // If value is not a string, return key
    if (typeof value !== 'string') {
        return key;
    }

    // Interpolate parameters (e.g., "Hello {{name}}" with {name: "World"} -> "Hello World")
    return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
    });
}

/**
 * Get all available languages
 */
export function getAvailableLanguages() {
    return Object.entries(LANGUAGES).map(([code, config]) => ({
        code,
        ...config
    }));
}

/**
 * Update all translatable elements in the DOM
 * Elements with data-i18n attribute will be updated
 */
export function updateDOM() {
    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : {};
        el.textContent = t(key, params);
    });

    // Update elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Update elements with data-i18n-title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    // Update elements with data-i18n-html attribute (for HTML content)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : {};
        el.innerHTML = t(key, params);
    });
}

/**
 * Create a language selector dropdown HTML
 */
export function createLanguageSelector(currentLang = null) {
    const lang = currentLang || currentLanguage;
    const languages = getAvailableLanguages();
    
    let options = languages.map(l => 
        `<option value="${l.code}" ${l.code === lang ? 'selected' : ''}>${l.flag} ${l.nativeName}</option>`
    ).join('');

    return `
        <select id="languageSelect" class="language-select" onchange="window.changeLanguage(this.value)">
            ${options}
        </select>
    `;
}

const SERVER_CODE_TRANSLATIONS = {
    INTERNAL_SERVER_ERROR: {
        he: 'שגיאת שרת פנימית',
        en: 'Internal server error'
    },
    WEBSOCKET_CONNECTION_ERROR: {
        he: '⚠️ שגיאה בחיבור WebSocket',
        en: '⚠️ WebSocket connection error'
    },
    WEBSOCKET_ERROR: {
        he: '⚠️ שגיאת WebSocket',
        en: '⚠️ WebSocket error'
    },
    MISSING_GAME_PIN: {
        he: 'חסר קוד משחק',
        en: 'Missing game PIN'
    },
    GAME_PIN_MUST_BE_6_DIGITS: {
        he: 'קוד משחק חייב להכיל 6 ספרות',
        en: 'Game PIN must be 6 digits'
    },
    INVALID_GAME_PIN: {
        he: 'קוד משחק לא תקין',
        en: 'Invalid game PIN'
    },
    INVALID_GAME_PIN_LENGTH: {
        he: 'אורך קוד המשחק אינו תקין',
        en: 'Invalid game PIN length'
    },
    ROOM_NOT_FOUND_ADD_IN_MUST_CREATE_ROOM_FIRST: {
        he: 'חדר לא נמצא. יש ליצור חדר תחילה.',
        en: 'Room not found. Create room first.'
    },
    GAME_ALREADY_STARTED: {
        he: 'המשחק כבר התחיל',
        en: 'Game already started'
    },
    GAME_SESSION_NOT_FOUND: {
        he: 'סשן משחק לא נמצא',
        en: 'Game session not found'
    },
    GAME_PIN_NOT_FOUND: {
        he: 'קוד משחק לא נמצא',
        en: 'Game PIN not found'
    },
    GAME_SERVER_IS_UNAVAILABLE: {
        he: 'שרת המשחק אינו זמין',
        en: 'Game server is unavailable'
    },
    NO_ACTIVE_SERVERS_AVAILABLE: {
        he: 'אין שרתים זמינים',
        en: 'No active servers available'
    },
    FAILED_TO_RESOLVE_SERVER_FROM_LB: {
        he: 'שגיאה בפנייה למאזן העומסים',
        en: 'Failed to resolve server from LB'
    },
    NO_ACTIVE_GAME_FOUND_WITH_PIN: {
        he: 'לא נמצא משחק פעיל עם הקוד {{gamePin}}',
        en: 'No active game found with PIN {{gamePin}}'
    },
    NAME_ALREADY_IN_USE: {
        he: 'השם "{{name}}" כבר בשימוש',
        en: 'The name "{{name}}" is already in use'
    },
    GAME_CLOSED: {
        he: 'המשחק נסגר',
        en: 'Game closed'
    },
    MANUAL: {
        he: 'על ידי המארח',
        en: 'by the host'
    },
    TIMEOUT: {
        he: 'עקב פסק זמן',
        en: 'due to timeout'
    },
    ADDIN_CLOSED: {
        he: 'עקב סגירת התוסף',
        en: 'because the add-in was closed'
    },
    NEW_SESSION: {
        he: 'עקב פתיחת משחק חדש',
        en: 'because a new session started'
    }
};

const SERVER_CODE_TO_LEGACY_MESSAGE = {
    NO_ACTIVE_SERVERS_AVAILABLE: 'No active servers available',
    GAME_SERVER_IS_UNAVAILABLE: 'Game server is unavailable',
    GAME_PIN_NOT_FOUND: 'Game PIN not found',
    ROOM_NOT_FOUND_ADD_IN_MUST_CREATE_ROOM_FIRST: 'Room not found. Add-in must create room first.',
    GAME_ALREADY_STARTED: 'Game already started',
    GAME_SESSION_NOT_FOUND: 'Game session not found'
};

function interpolateTemplate(template, params = {}) {
    if (typeof template !== 'string') {
        return '';
    }
    return template.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
    });
}

function translateServerCode(code, params = {}) {
    if (!code || typeof code !== 'string') {
        return null;
    }

    const normalizedCode = code.trim().toUpperCase();
    const localizedMap = SERVER_CODE_TRANSLATIONS[normalizedCode];

    if (!localizedMap) {
        return null;
    }

    const template = localizedMap[currentLanguage] || localizedMap.en || localizedMap.he;
    return interpolateTemplate(template, params);
}

/**
 * Translate a server error message using the serverErrors map.
 * Falls back to the original message if no translation is found.
 */
export function tServerError(message) {
    const serverErrors = translations?.serverErrors || {};

    if (message && typeof message === 'object') {
        const code = message.code || message.errorCode || message.reasonCode;
        const params = message.params || {};

        if (typeof code === 'string') {
            const legacyMessage = SERVER_CODE_TO_LEGACY_MESSAGE[code.toUpperCase()];
            if (legacyMessage && legacyMessage in serverErrors) {
                return interpolateTemplate(serverErrors[legacyMessage], params);
            }

            if (legacyMessage) {
                return interpolateTemplate(legacyMessage, params);
            }

            const byCode = translateServerCode(code, params);
            if (byCode) {
                return byCode;
            }
        }

        if (typeof message.message === 'string') {
            return tServerError(message.message);
        }

        return translateServerCode('INTERNAL_SERVER_ERROR') || 'Server error';
    }

    if (typeof message === 'string') {
        if (message in serverErrors) {
            return serverErrors[message];
        }

        const byCode = translateServerCode(message);
        if (byCode) {
            return byCode;
        }

        return message;
    }

    return translateServerCode('INTERNAL_SERVER_ERROR') || 'Server error';
}

// Expose to window for easy access
window.i18n = {
    t,
    setLanguage,
    getLanguage,
    getDirection,
    isRTL,
    updateDOM,
    getAvailableLanguages,
    LANGUAGES
};

// Export for module usage
export default {
    initI18n,
    setLanguage,
    getLanguage,
    getDirection,
    isRTL,
    t,
    updateDOM,
    getAvailableLanguages,
    createLanguageSelector,
    LANGUAGES
};
