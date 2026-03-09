/**
 * Arabic (العربية) translations - RTL
 */
export default {
    // Tabs
    tabs: {
        slides: 'الشرائح',
        actions: 'العناصر',
        settings: 'الإعدادات'
    },

    // Slides list
    slides: {
        loading: 'جاري تحميل الشرائح...',
        slide: 'شريحة',
        errorLoading: 'خطأ في تحميل قائمة الشرائح'
    },

    // Slide types
    slideTypes: {
        opening: 'افتتاحية',
        transition: 'انتقال',
        question: 'سؤال',
        statistics: 'إحصائيات الإجابات',
        leaderboard: 'المتصدرون',
        summary: 'ملخص',
        start: 'شاشة البداية'
    },

    // Context menu
    contextMenu: {
        changeType: 'تغيير نوع الشريحة',
        setAnswer: 'تعيين الإجابة الصحيحة'
    },

    // Dialogs
    dialogs: {
        selectSlideType: 'اختر نوع الشريحة',
        setCorrectAnswer: 'تعيين الإجابة الصحيحة',
        confirm: 'تأكيد',
        cancel: 'إلغاء',
        save: 'حفظ',
        answer: 'إجابة',
        red: 'أحمر',
        blue: 'أزرق',
        yellow: 'أصفر',
        green: 'أخضر'
    },

    // Actions grid
    actions: {
        gameId: 'معرف اللعبة',
        participantsCount: 'عدد المشاركين',
        participantsList: 'قائمة المشاركين',
        qrCode: 'رمز QR',
        questionTime: 'وقت السؤال',
        respondersCount: 'عدد المجيبين',
        answersDistribution: 'توزيع الإجابات',
        leaderboard: 'لوحة المتصدرين'
    },

    // Settings
    settings: {
        title: 'إعدادات اللعبة',
        language: 'اللغة',
        responseTime: 'وقت الإجابة (ثواني):',
        clockDelay: 'تأخير الساعة (ثواني):',
        autoTransitions: 'الانتقالات التلقائية:',
        goToStatistics: 'الانتقال للإحصائيات',
        goToLeaderboard: 'الانتقال للمتصدرين'
    },

    // Buttons
    buttons: {
        startGame: 'بدء اللعبة',
        stopGame: 'إيقاف اللعبة',
        edit: 'تعديل'
    },

    // Status messages
    status: {
        gameActive: 'اللعبة نشطة - رمز اللعبة:',
        backToFirstSlide: 'العودة للشريحة الأولى...',
        nextSlide: 'الانتقال للشريحة التالية...',
        simulatingClick: 'محاكاة الضغط على مسافة...',
        settingsSaved: 'تم حفظ الإعدادات'
    },

    // Start screen
    startScreen: {
        title: 'بدء اللعبة',
        scanQR: 'امسح رمز QR للانضمام',
        loadingQR: 'جاري تحميل رمز QR...',
        scanInstructions: 'امسح الرمز بجهاز محمول أو اذهب إلى:',
        loadingUrl: 'جاري تحميل الرابط...',
        tip: 'يمكن للمشاركين الانضمام عبر رمز QR أو الرابط',
        errorNoGameId: 'لم يتم العثور على معرف اللعبة. يرجى حفظ العرض أولاً.',
        errorLoadingQR: 'خطأ في تحميل رمز QR'
    },

    // Auto-save status
    autoSave: {
        pending: 'تغييرات بانتظار الحفظ...',
        saving: 'جاري الحفظ...',
        saved: 'تم الحفظ تلقائياً',
        error: 'خطأ في الحفظ'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': 'لا توجد خوادم متاحة',
        'Game server is unavailable': 'خادم اللعبة غير متاح',
        'Game PIN not found': 'لم يتم العثور على رمز اللعبة',
        'Failed to resolve server from LB': 'خطأ في الاتصال بخادم اللعبة',
        'Room not found. Add-in must create room first.': 'الغرفة غير موجودة. يجب إنشاء غرفة أولاً.',
        'Game already started': 'اللعبة بدأت بالفعل',
        'Game session not found': 'جلسة اللعبة غير موجودة',
    },
    // Errors
    errors: {
        createRoom: '⚠️ خطأ في إنشاء الغرفة: {{message}}',
        websocket: 'تعذر الاتصال باللعبة. تحقق من الاتصال وحاول مرة أخرى.',
        startGame: 'خطأ في بدء اللعبة: {{message}}',
        gameClosed: 'تم إغلاق اللعبة: {{reason}}',
        connectionLost: 'فقد الاتصال. تم إغلاق اللعبة.',
        addGameId: 'خطأ في إضافة معرف اللعبة',
        addQrCode: 'خطأ في إضافة رمز QR',
        addQuestionTime: 'خطأ في إضافة وقت السؤال',
        addRespondersCount: 'خطأ في إضافة عدد المجيبين',
        addParticipantsCount: 'خطأ في إضافة عدد المشاركين',
        addParticipantsList: 'خطأ في إضافة قائمة المشاركين',
        addAnswersDistribution: 'خطأ في إضافة توزيع الإجابات',
        addLeaderboard: 'خطأ في إضافة لوحة المتصدرين',
        selectSlideFirst: 'يرجى اختيار شريحة أولاً',
    },

    // Success
    success: {
        roomCreated: '✅ تم إنشاء الغرفة! PIN: {{pin}} - في انتظار المسؤول لبدء اللعبة',
        gameStarted: '✅ بدأت اللعبة! جاري قبول المشاركين...',
        gameIdAdded: '✅ تم إضافة معرف اللعبة إلى الشريحة!',
        qrCodeAdded: '✅ تم إضافة رمز QR إلى الشريحة!',
        questionTimeAdded: '✅ تم إضافة وقت السؤال إلى الشريحة!',
        respondersCountAdded: '✅ تم إضافة عدد المجيبين إلى الشريحة!',
        participantsCountAdded: '✅ تم إضافة عدد المشاركين إلى الشريحة!',
    },
    // Tooltips
    tooltips: {
        edit: 'تعديل',
        save: 'حفظ',
        cancel: 'إلغاء'
    },

    // Onboarding
    onboarding: {
        selectLanguage: 'اختر اللغة',
        enter: 'دخول',
        chooseTemplate: 'اختر قالباً للعبة',
        blankTemplate: 'قالب فارغ',
        classicBlack: 'الكلاسيكي الأسود',
        applyTemplate: 'تطبيق القالب'
    }
};
