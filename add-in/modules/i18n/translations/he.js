/**
 * Hebrew (עברית) translations
 */
export default {
    // Tabs
    tabs: {
        slides: 'שקפים',
        actions: 'רכיבים',
        settings: 'הגדרות'
    },

    // Slides list
    slides: {
        loading: 'טוען שקפים...',
        slide: 'שקף',
        errorLoading: 'שגיאה בטעינת רשימת השקפים'
    },

    // Slide types
    slideTypes: {
        opening: 'פתיחה',
        transition: 'מעבר',
        question: 'שאלה',
        statistics: 'סטטיסטיקת מענה',
        leaderboard: 'מובילים',
        summary: 'סיכום',
        start: 'מסך פתיחה'
    },

    // Context menu
    contextMenu: {
        changeType: 'שנה סוג שקף',
        setAnswer: 'הגדר תשובה נכונה'
    },

    // Dialogs
    dialogs: {
        selectSlideType: 'בחר סוג שקף',
        setCorrectAnswer: 'הגדר תשובה נכונה',
        confirm: 'אישור',
        cancel: 'ביטול',
        save: 'שמור',
        answer: 'תשובה',
        red: 'אדום',
        blue: 'כחול',
        yellow: 'צהוב',
        green: 'ירוק'
    },

    // Actions grid
    actions: {
        gameId: 'מזהה משחק',
        participantsCount: 'מספר משתתפים',
        participantsList: 'רשימת משתתפים',
        qrCode: 'QR Code',
        questionTime: 'זמן שאלה',
        respondersCount: 'מספר עונים',
        answersDistribution: 'פילוג תשובות',
        leaderboard: 'טבלת מובילים'
    },

    // Settings
    settings: {
        title: 'הגדרות משחק',
        language: 'שפה',
        responseTime: 'זמן למענה (שניות):',
        clockDelay: 'השהיית שעון (שניות):',
        autoTransitions: 'מעברים אוטומטיים:',
        goToStatistics: 'עבור לסטטיסטיקה',
        goToLeaderboard: 'עבור למובילים'
    },

    // Buttons
    buttons: {
        startGame: 'הפעל משחק',
        stopGame: 'עצור משחק',
        edit: 'עריכה'
    },

    // Status messages
    status: {
        gameActive: 'משחק פעיל - Game PIN:',
        backToFirstSlide: 'חזרה לשקף הראשון...',
        nextSlide: 'מעבר לשקף הבא...',
        simulatingClick: 'מדמה לחיצה על רווח...',
        settingsSaved: 'הגדרות נשמרו'
    },

    // Start screen
    startScreen: {
        title: 'התחל משחק',
        scanQR: 'סרוק קוד QR לכניסה למשחק',
        loadingQR: 'טוען קוד QR...',
        scanInstructions: 'סרוק את הקוד עם מכשיר נייד או היכנס לכתובת:',
        loadingUrl: 'טוען כתובת...',
        tip: 'המשתתפים יכולים להיכנס דרך הקוד או הכתובת',
        errorNoGameId: 'לא נמצא מזהה משחק. אנא שמור את המצגת תחילה.',
        errorLoadingQR: 'שגיאה בטעינת QR code'
    },

    // Admin connection overlay
    adminConnection: {
        title: 'חיבור לממשק ניהול',
        subtitle: 'סרוק את הקוד או היכנס לכתובת',
        scanAdmin: 'סרוק את הקוד כדי לפתוח את ממשק הניהול',
        orEnterUrl: 'או היכנס לכתובת:',
        waitingForAdmin: 'ממתין למנהל להתחיל את המשחק...',
        close: 'סגור'
    },

    // Auto-save status
    autoSave: {
        pending: 'שינויים ממתינים לשמירה...',
        saving: 'שומר...',
        saved: 'נשמר אוטומטית',
        error: 'שגיאה בשמירה'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': 'אין שרתים זמינים',
        'Game server is unavailable': 'שרת המשחק אינו זמין',
        'Game PIN not found': 'קוד משחק לא נמצא',
        'Failed to resolve server from LB': 'שגיאה בפנייה לשרת המשחק',
        'Room not found. Add-in must create room first.': 'חדר לא נמצא. יש ליצור חדר תחילה.',
        'Game already started': 'המשחק כבר התחיל',
        'Game session not found': 'משחק לא נמצא',
    },
    // Errors
    errors: {
        createRoom: '⚠️ שגיאה ביצירת חדר: {{message}}',
        websocket: 'לא הצלחנו להתחבר למשחק. בדקו את החיבור ונסו שוב.',
        startGame: 'שגיאה בהפעלת המשחק: {{message}}',
        gameClosed: 'המשחק נסגר: {{reason}}',
        connectionLost: 'החיבור אבד. המשחק נסגר.',
        addGameId: 'שגיאה בהוספת מזהה משחק',
        addQrCode: 'שגיאה בהוספת QR Code',
        addQuestionTime: 'שגיאה בהוספת זמן שאלה',
        addRespondersCount: 'שגיאה בהוספת מספר עונים',
        addParticipantsCount: 'שגיאה בהוספת מספר המשתתפים',
        addParticipantsList: 'שגיאה בהוספת רשימת משתתפים',
        addAnswersDistribution: 'שגיאה בהוספת פילוג תשובות',
        addLeaderboard: 'שגיאה בהוספת טבלת מובילים',
        selectSlideFirst: 'אנא בחר שקף תחילה'
    },

    // Success
    success: {
        roomCreated: '✅ חדר נוצר! PIN: {{pin}} - ממתין ל-Admin להתחיל משחק',
        gameStarted: '✅ המשחק התחיל! מקבל משתתפים...',
        gameIdAdded: '✅ מזהה משחק נוסף לשקף!',
        qrCodeAdded: '✅ QR Code נוסף לשקף!',
        questionTimeAdded: '✅ זמן שאלה נוסף לשקף!',
        respondersCountAdded: '✅ מספר עונים נוסף לשקף!',
        participantsCountAdded: '✅ מספר משתתפים נוסף לשקף!',
    },

    // Tooltips
    tooltips: {
        edit: 'עריכה',
        save: 'שמור',
        cancel: 'ביטול'
    },

    // Onboarding
    onboarding: {
        selectLanguage: 'בחר שפה',
        enter: 'כניסה',
        chooseTemplate: 'בחר תבנית למשחק',
        blankTemplate: 'תבנית ריקה',
        classicBlack: 'שחור קלאסי',
        applyTemplate: 'החל תבנית'
    }
};
