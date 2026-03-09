/**
 * Hindi (हिन्दी) translations
 */
export default {
    // Tabs
    tabs: {
        slides: 'स्लाइड',
        actions: 'तत्व',
        settings: 'सेटिंग्स'
    },

    // Slides list
    slides: {
        loading: 'स्लाइड लोड हो रही हैं...',
        slide: 'स्लाइड',
        errorLoading: 'स्लाइड सूची लोड करने में त्रुटि'
    },

    // Slide types
    slideTypes: {
        opening: 'ओपनिंग',
        transition: 'ट्रांज़िशन',
        question: 'प्रश्न',
        statistics: 'उत्तर आंकड़े',
        leaderboard: 'लीडरबोर्ड',
        summary: 'सारांश',
        start: 'स्टार्ट स्क्रीन'
    },

    // Context menu
    contextMenu: {
        changeType: 'स्लाइड प्रकार बदलें',
        setAnswer: 'सही उत्तर सेट करें'
    },

    // Dialogs
    dialogs: {
        selectSlideType: 'स्लाइड प्रकार चुनें',
        setCorrectAnswer: 'सही उत्तर सेट करें',
        confirm: 'पुष्टि करें',
        cancel: 'रद्द करें',
        save: 'सहेजें',
        answer: 'उत्तर',
        red: 'लाल',
        blue: 'नीला',
        yellow: 'पीला',
        green: 'हरा'
    },

    // Actions grid
    actions: {
        gameId: 'गेम ID',
        participantsCount: 'प्रतिभागी संख्या',
        participantsList: 'प्रतिभागी सूची',
        qrCode: 'QR कोड',
        questionTime: 'प्रश्न समय',
        respondersCount: 'जवाब देने वालों की संख्या',
        answersDistribution: 'उत्तर वितरण',
        leaderboard: 'लीडरबोर्ड'
    },

    // Settings
    settings: {
        title: 'गेम सेटिंग्स',
        language: 'भाषा',
        responseTime: 'जवाब का समय (सेकंड):',
        clockDelay: 'घड़ी विलंब (सेकंड):',
        autoTransitions: 'स्वचालित ट्रांज़िशन:',
        goToStatistics: 'आंकड़ों पर जाएं',
        goToLeaderboard: 'लीडरबोर्ड पर जाएं'
    },

    // Buttons
    buttons: {
        startGame: 'गेम शुरू करें',
        stopGame: 'गेम बंद करें',
        edit: 'संपादित करें'
    },

    // Status messages
    status: {
        gameActive: 'गेम सक्रिय - गेम PIN:',
        backToFirstSlide: 'पहली स्लाइड पर वापस जा रहे हैं...',
        nextSlide: 'अगली स्लाइड...',
        simulatingClick: 'स्पेसबार सिमुलेट कर रहे हैं...',
        settingsSaved: 'सेटिंग्स सहेजी गईं'
    },

    // Start screen
    startScreen: {
        title: 'गेम शुरू करें',
        scanQR: 'जुड़ने के लिए QR कोड स्कैन करें',
        loadingQR: 'QR कोड लोड हो रहा है...',
        scanInstructions: 'मोबाइल डिवाइस से कोड स्कैन करें या यहाँ जाएं:',
        loadingUrl: 'URL लोड हो रहा है...',
        tip: 'प्रतिभागी QR कोड या URL से जुड़ सकते हैं',
        errorNoGameId: 'गेम ID नहीं मिली। पहले प्रेजेंटेशन सहेजें।',
        errorLoadingQR: 'QR कोड लोड करने में त्रुटि'
    },

    // Auto-save status
    autoSave: {
        pending: 'परिवर्तन सहेजने के लिए प्रतीक्षारत...',
        saving: 'सहेज रहे हैं...',
        saved: 'स्वचालित रूप से सहेजा गया',
        error: 'सहेजने में त्रुटि'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': 'कोई सक्रिय सर्वर उपलब्ध नहीं',
        'Game server is unavailable': 'गेम सर्वर अनुपलब्ध है',
        'Game PIN not found': 'गेम कोड नहीं मिला',
        'Failed to resolve server from LB': 'गेम सर्वर से कनेक्ट करते समय त्रुटि',
        'Room not found. Add-in must create room first.': 'कमरा नहीं मिला। पहले कमरा बनाएं।',
        'Game already started': 'गेम पहले से शुरू हो चुका है',
        'Game session not found': 'गेम सेशन नहीं मिला',
    },
    // Errors
    errors: {
        createRoom: '⚠️ कमरा बनाने में त्रुटि: {{message}}',
        websocket: 'गेम से कनेक्ट नहीं हो पाया। कृपया अपना कनेक्शन जांचें और फिर से प्रयास करें।',
        startGame: 'गेम शुरू करने में त्रुटि: {{message}}',
        gameClosed: 'गेम बंद: {{reason}}',
        connectionLost: 'कनेक्शन खो गया। गेम बंद।',
        addGameId: 'गेम ID जोड़ने में त्रुटि',
        addQrCode: 'QR कोड जोड़ने में त्रुटि',
        addQuestionTime: 'प्रश्न समय जोड़ने में त्रुटि',
        addRespondersCount: 'उत्तरदाताओं की संख्या जोड़ने में त्रुटि',
        addParticipantsCount: 'प्रतिभागियों की संख्या जोड़ने में त्रुटि',
        addParticipantsList: 'प्रतिभागियों की सूची जोड़ने में त्रुटि',
        addAnswersDistribution: 'उत्तर वितरण जोड़ने में त्रुटि',
        addLeaderboard: 'लीडरबोर्ड जोड़ने में त्रुटि',
        selectSlideFirst: 'कृपया पहले एक स्लाइड चुनें',
    },

    // Success
    success: {
        roomCreated: '✅ कमरा बनाया गया! PIN: {{pin}} - Admin के शुरू करने की प्रतीक्षा',
        gameStarted: '✅ गेम शुरू! प्रतिभागियों को स्वीकार कर रहे हैं...',
        gameIdAdded: '✅ गेम ID स्लाइड में जोड़ी गई!',
        qrCodeAdded: '✅ QR कोड स्लाइड में जोड़ा गया!',
        questionTimeAdded: '✅ प्रश्न समय स्लाइड में जोड़ा गया!',
        respondersCountAdded: '✅ उत्तरदाताओं की संख्या स्लाइड में जोड़ी गई!',
        participantsCountAdded: '✅ प्रतिभागियों की संख्या स्लाइड में जोड़ी गई!',
    },
    // Tooltips
    tooltips: {
        edit: 'संपादित करें',
        save: 'सहेजें',
        cancel: 'रद्द करें'
    },

    // Onboarding
    onboarding: {
        selectLanguage: 'भाषा चुनें',
        enter: 'प्रवेश',
        chooseTemplate: 'खेल टेम्पलेट चुनें',
        blankTemplate: 'रिक्त टेम्पलेट',
        classicBlack: 'क्लासिक ब्लैक',
        applyTemplate: 'टेम्पलेट लागू करें'
    }
};
