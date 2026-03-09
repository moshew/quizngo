/**
 * Portuguese (Português) translations
 */
export default {
    // Tabs
    tabs: {
        slides: 'Slides',
        actions: 'Elementos',
        settings: 'Configurações'
    },

    // Slides list
    slides: {
        loading: 'Carregando slides...',
        slide: 'Slide',
        errorLoading: 'Erro ao carregar lista de slides'
    },

    // Slide types
    slideTypes: {
        opening: 'Abertura',
        transition: 'Transição',
        question: 'Pergunta',
        statistics: 'Estatísticas de respostas',
        leaderboard: 'Classificação',
        summary: 'Resumo',
        start: 'Tela inicial'
    },

    // Context menu
    contextMenu: {
        changeType: 'Alterar tipo de slide',
        setAnswer: 'Definir resposta correta'
    },

    // Dialogs
    dialogs: {
        selectSlideType: 'Selecionar tipo de slide',
        setCorrectAnswer: 'Definir resposta correta',
        confirm: 'Confirmar',
        cancel: 'Cancelar',
        save: 'Salvar',
        answer: 'Resposta',
        red: 'Vermelho',
        blue: 'Azul',
        yellow: 'Amarelo',
        green: 'Verde'
    },

    // Actions grid
    actions: {
        gameId: 'ID do jogo',
        participantsCount: 'Número de participantes',
        participantsList: 'Lista de participantes',
        qrCode: 'Código QR',
        questionTime: 'Tempo de pergunta',
        respondersCount: 'Número de respostas',
        answersDistribution: 'Distribuição de respostas',
        leaderboard: 'Tabela de líderes'
    },

    // Settings
    settings: {
        title: 'Configurações do jogo',
        language: 'Idioma',
        responseTime: 'Tempo de resposta (segundos):',
        clockDelay: 'Atraso do relógio (segundos):',
        autoTransitions: 'Transições automáticas:',
        goToStatistics: 'Ir para estatísticas',
        goToLeaderboard: 'Ir para classificação'
    },

    // Buttons
    buttons: {
        startGame: 'Iniciar jogo',
        stopGame: 'Parar jogo',
        edit: 'Editar'
    },

    // Status messages
    status: {
        gameActive: 'Jogo ativo - PIN do jogo:',
        backToFirstSlide: 'Voltando ao primeiro slide...',
        nextSlide: 'Próximo slide...',
        simulatingClick: 'Simulando barra de espaço...',
        settingsSaved: 'Configurações salvas'
    },

    // Start screen
    startScreen: {
        title: 'Iniciar jogo',
        scanQR: 'Escaneie o código QR para entrar',
        loadingQR: 'Carregando código QR...',
        scanInstructions: 'Escaneie o código com um dispositivo móvel ou acesse:',
        loadingUrl: 'Carregando URL...',
        tip: 'Participantes podem entrar via código QR ou URL',
        errorNoGameId: 'ID do jogo não encontrado. Salve a apresentação primeiro.',
        errorLoadingQR: 'Erro ao carregar código QR'
    },

    // Auto-save status
    autoSave: {
        pending: 'Alterações aguardando salvamento...',
        saving: 'Salvando...',
        saved: 'Salvo automaticamente',
        error: 'Erro ao salvar'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': 'Nenhum servidor ativo disponível',
        'Game server is unavailable': 'Servidor de jogo indisponível',
        'Game PIN not found': 'Código do jogo não encontrado',
        'Failed to resolve server from LB': 'Erro ao conectar com o servidor do jogo',
        'Room not found. Add-in must create room first.': 'Sala não encontrada. Crie uma sala primeiro.',
        'Game already started': 'O jogo já começou',
        'Game session not found': 'Sessão de jogo não encontrada',
    },
    // Errors
    errors: {
        createRoom: '⚠️ Erro ao criar sala: {{message}}',
        websocket: 'Não foi possível conectar ao jogo. Verifique sua conexão e tente novamente.',
        startGame: 'Erro ao iniciar o jogo: {{message}}',
        gameClosed: 'Jogo encerrado: {{reason}}',
        connectionLost: 'Conexão perdida. Jogo encerrado.',
        addGameId: 'Erro ao adicionar ID do jogo',
        addQrCode: 'Erro ao adicionar código QR',
        addQuestionTime: 'Erro ao adicionar tempo de pergunta',
        addRespondersCount: 'Erro ao adicionar contagem de respondentes',
        addParticipantsCount: 'Erro ao adicionar contagem de participantes',
        addParticipantsList: 'Erro ao adicionar lista de participantes',
        addAnswersDistribution: 'Erro ao adicionar distribuição de respostas',
        addLeaderboard: 'Erro ao adicionar placar',
        selectSlideFirst: 'Por favor, selecione um slide primeiro',
    },

    // Success
    success: {
        roomCreated: '✅ Sala criada! PIN: {{pin}} - Aguardando Admin iniciar o jogo',
        gameStarted: '✅ Jogo iniciado! Aceitando participantes...',
        gameIdAdded: '✅ ID do jogo adicionado ao slide!',
        qrCodeAdded: '✅ Código QR adicionado ao slide!',
        questionTimeAdded: '✅ Tempo de pergunta adicionado ao slide!',
        respondersCountAdded: '✅ Contagem de respondentes adicionada ao slide!',
        participantsCountAdded: '✅ Contagem de participantes adicionada ao slide!',
    },
    // Tooltips
    tooltips: {
        edit: 'Editar',
        save: 'Salvar',
        cancel: 'Cancelar'
    },

    // Onboarding
    onboarding: {
        selectLanguage: 'Selecionar idioma',
        enter: 'Entrar',
        chooseTemplate: 'Escolher modelo de jogo',
        blankTemplate: 'Modelo em branco',
        classicBlack: 'Preto clássico',
        applyTemplate: 'Aplicar modelo'
    }
};
