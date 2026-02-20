/**
 * Russian (Русский) translations
 */
export default {
    // Tabs
    tabs: {
        slides: 'Слайды',
        actions: 'Элементы',
        settings: 'Настройки'
    },

    // Slides list
    slides: {
        loading: 'Загрузка слайдов...',
        slide: 'Слайд',
        errorLoading: 'Ошибка загрузки списка слайдов'
    },

    // Slide types
    slideTypes: {
        opening: 'Открытие',
        transition: 'Переход',
        question: 'Вопрос',
        statistics: 'Статистика ответов',
        leaderboard: 'Таблица лидеров',
        summary: 'Итоги',
        start: 'Стартовый экран'
    },

    // Context menu
    contextMenu: {
        changeType: 'Изменить тип слайда',
        setAnswer: 'Установить правильный ответ'
    },

    // Dialogs
    dialogs: {
        selectSlideType: 'Выберите тип слайда',
        setCorrectAnswer: 'Установить правильный ответ',
        confirm: 'Подтвердить',
        cancel: 'Отмена',
        save: 'Сохранить',
        answer: 'Ответ',
        red: 'Красный',
        blue: 'Синий',
        yellow: 'Жёлтый',
        green: 'Зелёный'
    },

    // Actions grid
    actions: {
        gameId: 'ID игры',
        participantsCount: 'Количество участников',
        participantsList: 'Список участников',
        qrCode: 'QR-код',
        questionTime: 'Время вопроса',
        respondersCount: 'Количество ответов',
        answersDistribution: 'Распределение ответов',
        leaderboard: 'Таблица лидеров'
    },

    // Settings
    settings: {
        title: 'Настройки игры',
        language: 'Язык',
        responseTime: 'Время ответа (секунд):',
        clockDelay: 'Задержка таймера (секунд):',
        autoTransitions: 'Автоматические переходы:',
        goToStatistics: 'Перейти к статистике',
        goToLeaderboard: 'Перейти к лидерам'
    },

    // Buttons
    buttons: {
        startGame: 'Начать игру',
        stopGame: 'Остановить игру',
        edit: 'Редактировать'
    },

    // Status messages
    status: {
        gameActive: 'Игра активна - PIN игры:',
        backToFirstSlide: 'Возврат к первому слайду...',
        nextSlide: 'Следующий слайд...',
        simulatingClick: 'Имитация пробела...',
        settingsSaved: 'Настройки сохранены'
    },

    // Start screen
    startScreen: {
        title: 'Начать игру',
        scanQR: 'Отсканируйте QR-код для входа',
        loadingQR: 'Загрузка QR-кода...',
        scanInstructions: 'Отсканируйте код мобильным устройством или перейдите по адресу:',
        loadingUrl: 'Загрузка URL...',
        tip: 'Участники могут присоединиться через QR-код или URL',
        errorNoGameId: 'ID игры не найден. Сначала сохраните презентацию.',
        errorLoadingQR: 'Ошибка загрузки QR-кода'
    },

    // Auto-save status
    autoSave: {
        pending: 'Изменения ожидают сохранения...',
        saving: 'Сохранение...',
        saved: 'Автосохранено',
        error: 'Ошибка сохранения'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': 'Нет доступных серверов',
        'Game server is unavailable': 'Сервер игры недоступен',
        'Game PIN not found': 'PIN игры не найден',
        'Failed to resolve server from LB': 'Ошибка подключения к балансировщику нагрузки',
        'Room not found. Add-in must create room first.': 'Комната не найдена. Сначала создайте комнату.',
        'Game already started': 'Игра уже началась',
        'Game session not found': 'Сессия игры не найдена',
    },
    // Errors
    errors: {
        createRoom: '⚠️ Ошибка создания комнаты: {{message}}',
        websocket: '⚠️ Ошибка подключения WebSocket',
        startGame: 'Ошибка запуска игры: {{message}}',
        gameClosed: 'Игра закрыта: {{reason}}',
        connectionLost: 'Соединение потеряно. Игра закрыта.',
        addGameId: 'Ошибка добавления ID игры',
        addQrCode: 'Ошибка добавления QR-кода',
        addQuestionTime: 'Ошибка добавления времени вопроса',
        addRespondersCount: 'Ошибка добавления количества ответивших',
        addParticipantsCount: 'Ошибка добавления количества участников',
        addParticipantsList: 'Ошибка добавления списка участников',
        addAnswersDistribution: 'Ошибка добавления распределения ответов',
        addLeaderboard: 'Ошибка добавления элементов таблицы лидеров',
        selectSlideFirst: 'Пожалуйста, сначала выберите слайд',
    },

    // Success
    success: {
        roomCreated: '✅ Комната создана! PIN: {{pin}} - Ожидание запуска админом',
        gameStarted: '✅ Игра началась! Принимаем участников...',
        gameIdAdded: '✅ ID игры добавлен на слайд!',
        qrCodeAdded: '✅ QR-код добавлен на слайд!',
        questionTimeAdded: '✅ Время вопроса добавлено на слайд!',
        respondersCountAdded: '✅ Количество ответивших добавлено на слайд!',
        participantsCountAdded: '✅ Количество участников добавлено на слайд!',
    },
    // Tooltips
    tooltips: {
        edit: 'Редактировать',
        save: 'Сохранить',
        cancel: 'Отмена'
    },

    // Onboarding
    onboarding: {
        selectLanguage: 'Выбрать язык',
        enter: 'Войти',
        chooseTemplate: 'Выбрать шаблон игры',
        blankTemplate: 'Пустой шаблон',
        classicBlack: 'Классический чёрный',
        applyTemplate: 'Применить шаблон'
    }
};
