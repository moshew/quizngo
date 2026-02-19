/**
 * Spanish (Español) translations
 */
export default {
    // Tabs
    tabs: {
        slides: 'Diapositivas',
        actions: 'Elementos',
        settings: 'Ajustes'
    },

    // Slides list
    slides: {
        loading: 'Cargando diapositivas...',
        slide: 'Diapositiva',
        errorLoading: 'Error al cargar la lista de diapositivas'
    },

    // Slide types
    slideTypes: {
        opening: 'Apertura',
        transition: 'Transición',
        question: 'Pregunta',
        statistics: 'Estadísticas de respuestas',
        leaderboard: 'Clasificación',
        summary: 'Resumen',
        start: 'Pantalla de inicio'
    },

    // Context menu
    contextMenu: {
        changeType: 'Cambiar tipo de diapositiva',
        setAnswer: 'Establecer respuesta correcta'
    },

    // Dialogs
    dialogs: {
        selectSlideType: 'Seleccionar tipo de diapositiva',
        setCorrectAnswer: 'Establecer respuesta correcta',
        confirm: 'Confirmar',
        cancel: 'Cancelar',
        save: 'Guardar',
        answer: 'Respuesta',
        red: 'Rojo',
        blue: 'Azul',
        yellow: 'Amarillo',
        green: 'Verde'
    },

    // Actions grid
    actions: {
        gameId: 'ID del juego',
        participantsCount: 'Número de participantes',
        participantsList: 'Lista de participantes',
        qrCode: 'Código QR',
        questionTime: 'Tiempo de pregunta',
        respondersCount: 'Número de respuestas',
        answersDistribution: 'Distribución de respuestas',
        leaderboard: 'Tabla de líderes'
    },

    // Settings
    settings: {
        title: 'Configuración del juego',
        language: 'Idioma',
        responseTime: 'Tiempo de respuesta (segundos):',
        clockDelay: 'Retraso del reloj (segundos):',
        autoTransitions: 'Transiciones automáticas:',
        goToStatistics: 'Ir a estadísticas',
        goToLeaderboard: 'Ir a clasificación'
    },

    // Buttons
    buttons: {
        startGame: 'Iniciar juego',
        edit: 'Editar'
    },

    // Status messages
    status: {
        gameActive: 'Juego activo - PIN del juego:',
        backToFirstSlide: 'Volviendo a la primera diapositiva...',
        nextSlide: 'Siguiente diapositiva...',
        simulatingClick: 'Simulando barra espaciadora...',
        settingsSaved: 'Configuración guardada'
    },

    // Start screen
    startScreen: {
        title: 'Iniciar juego',
        scanQR: 'Escanea el código QR para unirte',
        loadingQR: 'Cargando código QR...',
        scanInstructions: 'Escanea el código con un dispositivo móvil o ve a:',
        loadingUrl: 'Cargando URL...',
        tip: 'Los participantes pueden unirse mediante código QR o URL',
        errorNoGameId: 'ID del juego no encontrado. Guarda la presentación primero.',
        errorLoadingQR: 'Error al cargar el código QR'
    },

    // Auto-save status
    autoSave: {
        pending: 'Cambios pendientes de guardar...',
        saving: 'Guardando...',
        saved: 'Guardado automáticamente',
        error: 'Error al guardar'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': 'No hay servidores activos disponibles',
        'Game server is unavailable': 'El servidor de juego no está disponible',
        'Game PIN not found': 'PIN del juego no encontrado',
        'Failed to resolve server from LB': 'Error al conectar con el balanceador de carga',
        'Room not found. Add-in must create room first.': 'Sala no encontrada. Primero debe crear una sala.',
        'Game already started': 'El juego ya ha comenzado',
        'Game session not found': 'Sesión de juego no encontrada',
    },
    // Errors
    errors: {
        createRoom: '⚠️ Error al crear la sala: {{message}}',
        websocket: '⚠️ Error de conexión WebSocket',
        startGame: 'Error al iniciar el juego: {{message}}',
        gameClosed: 'Juego cerrado: {{reason}}',
        connectionLost: 'Conexión perdida. Juego cerrado.',
        addGameId: 'Error al agregar ID del juego',
        addQrCode: 'Error al agregar código QR',
        addQuestionTime: 'Error al agregar tiempo de pregunta',
        addRespondersCount: 'Error al agregar cantidad de respondientes',
        addParticipantsCount: 'Error al agregar cantidad de participantes',
        addParticipantsList: 'Error al agregar lista de participantes',
        addAnswersDistribution: 'Error al agregar distribución de respuestas',
        addLeaderboard: 'Error al agregar tabla de líderes',
        selectSlideFirst: 'Por favor seleccione una diapositiva primero',
    },

    // Success
    success: {
        roomCreated: '✅ ¡Sala creada! PIN: {{pin}} - Esperando al Admin para iniciar',
        gameStarted: '✅ ¡Juego iniciado! Aceptando participantes...',
        gameIdAdded: '✅ ¡ID del juego agregado a la diapositiva!',
        qrCodeAdded: '✅ ¡Código QR agregado a la diapositiva!',
        questionTimeAdded: '✅ ¡Tiempo de pregunta agregado a la diapositiva!',
        respondersCountAdded: '✅ ¡Cantidad de respondientes agregada a la diapositiva!',
        participantsCountAdded: '✅ ¡Cantidad de participantes agregada a la diapositiva!',
    },
    // Tooltips
    tooltips: {
        edit: 'Editar',
        save: 'Guardar',
        cancel: 'Cancelar'
    }
};
