/**
 * English translations
 */
export default {
    // Tabs
    tabs: {
        slides: 'Slides',
        actions: 'Elements',
        settings: 'Settings'
    },

    // Slides list
    slides: {
        loading: 'Loading slides...',
        slide: 'Slide',
        errorLoading: 'Error loading slide list'
    },

    // Slide types
    slideTypes: {
        opening: 'Opening',
        transition: 'Transition',
        question: 'Question',
        statistics: 'Answer Statistics',
        leaderboard: 'Leaderboard',
        summary: 'Summary',
        start: 'Start Screen'
    },

    // Context menu
    contextMenu: {
        changeType: 'Change slide type',
        setAnswer: 'Set correct answer'
    },

    // Dialogs
    dialogs: {
        selectSlideType: 'Select slide type',
        setCorrectAnswer: 'Set correct answer',
        confirm: 'Confirm',
        cancel: 'Cancel',
        save: 'Save',
        answer: 'Answer',
        red: 'Red',
        blue: 'Blue',
        yellow: 'Yellow',
        green: 'Green'
    },

    // Actions grid
    actions: {
        gameId: 'Game ID',
        participantsCount: 'Participants Count',
        participantsList: 'Participants List',
        qrCode: 'QR Code',
        questionTime: 'Question Time',
        respondersCount: 'Responders Count',
        answersDistribution: 'Answers Distribution',
        leaderboard: 'Leaderboard'
    },

    // Settings
    settings: {
        title: 'Game Settings',
        language: 'Language',
        responseTime: 'Response time (seconds):',
        clockDelay: 'Clock delay (seconds):',
        autoTransitions: 'Auto transitions:',
        goToStatistics: 'Go to statistics',
        goToLeaderboard: 'Go to leaderboard'
    },

    // Buttons
    buttons: {
        startGame: 'Start Game',
        edit: 'Edit'
    },

    // Status messages
    status: {
        gameActive: 'Game Active - Game PIN:',
        backToFirstSlide: 'Going to first slide...',
        nextSlide: 'Going to next slide...',
        simulatingClick: 'Simulating spacebar...',
        settingsSaved: 'Settings saved'
    },

    // Start screen
    startScreen: {
        title: 'Start Game',
        scanQR: 'Scan QR code to join the game',
        loadingQR: 'Loading QR code...',
        scanInstructions: 'Scan the code with a mobile device or go to:',
        loadingUrl: 'Loading URL...',
        tip: 'Participants can join via QR code or URL',
        errorNoGameId: 'Game ID not found. Please save the presentation first.',
        errorLoadingQR: 'Error loading QR code'
    },

    // Admin connection overlay
    adminConnection: {
        title: 'Connect to Admin',
        subtitle: 'Scan the code or enter the URL',
        scanAdmin: 'Scan the code to open the admin panel',
        orEnterUrl: 'Or go to:',
        waitingForAdmin: 'Waiting for admin to start the game...',
        close: 'Close'
    },

    // Auto-save status
    autoSave: {
        pending: 'Changes pending save...',
        saving: 'Saving...',
        saved: 'Auto-saved',
        error: 'Error saving'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': 'No active servers available',
        'Game server is unavailable': 'Game server is unavailable',
        'Game PIN not found': 'Game PIN not found',
        'Failed to resolve server from LB': 'Failed to resolve server',
        'Room not found. Add-in must create room first.': 'Room not found. Create room first.',
        'Game already started': 'Game already started',
        'Game session not found': 'Game session not found',
    },
    // Errors
    errors: {
        createRoom: '⚠️ Error creating room: {{message}}',
        websocket: '⚠️ WebSocket connection error',
        startGame: 'Error starting game: {{message}}',
        gameClosed: 'Game closed: {{reason}}',
        connectionLost: 'Connection lost. Game closed.',
        addGameId: 'Error adding game ID',
        addQrCode: 'Error adding QR Code',
        addQuestionTime: 'Error adding question time',
        addRespondersCount: 'Error adding responders count',
        addParticipantsCount: 'Error adding participants count',
        addParticipantsList: 'Error adding participants list',
        addAnswersDistribution: 'Error adding answers distribution',
        addLeaderboard: 'Error adding leaderboard elements',
        selectSlideFirst: 'Please select a slide first'
    },

    // Success
    success: {
        roomCreated: '✅ Room created! PIN: {{pin}} - Waiting for Admin to start game',
        gameStarted: '✅ Game started! Accepting participants...',
        gameIdAdded: '✅ Game ID added to slide!',
        qrCodeAdded: '✅ QR Code added to slide!',
        questionTimeAdded: '✅ Question time added to slide!',
        respondersCountAdded: '✅ Responders count added to slide!',
        participantsCountAdded: '✅ Participants count added to slide!',
    },

    // Tooltips
    tooltips: {
        edit: 'Edit',
        save: 'Save',
        cancel: 'Cancel'
    }
};
