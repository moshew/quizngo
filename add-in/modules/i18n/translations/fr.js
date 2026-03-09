/**
 * French (Français) translations
 */
export default {
    // Tabs
    tabs: {
        slides: 'Diapositives',
        actions: 'Éléments',
        settings: 'Paramètres'
    },

    // Slides list
    slides: {
        loading: 'Chargement des diapositives...',
        slide: 'Diapositive',
        errorLoading: 'Erreur lors du chargement de la liste des diapositives'
    },

    // Slide types
    slideTypes: {
        opening: 'Ouverture',
        transition: 'Transition',
        question: 'Question',
        statistics: 'Statistiques des réponses',
        leaderboard: 'Classement',
        summary: 'Résumé',
        start: 'Écran de démarrage'
    },

    // Context menu
    contextMenu: {
        changeType: 'Changer le type de diapositive',
        setAnswer: 'Définir la bonne réponse'
    },

    // Dialogs
    dialogs: {
        selectSlideType: 'Sélectionner le type de diapositive',
        setCorrectAnswer: 'Définir la bonne réponse',
        confirm: 'Confirmer',
        cancel: 'Annuler',
        save: 'Enregistrer',
        answer: 'Réponse',
        red: 'Rouge',
        blue: 'Bleu',
        yellow: 'Jaune',
        green: 'Vert'
    },

    // Actions grid
    actions: {
        gameId: 'ID du jeu',
        participantsCount: 'Nombre de participants',
        participantsList: 'Liste des participants',
        qrCode: 'Code QR',
        questionTime: 'Temps de question',
        respondersCount: 'Nombre de réponses',
        answersDistribution: 'Distribution des réponses',
        leaderboard: 'Tableau des leaders'
    },

    // Settings
    settings: {
        title: 'Paramètres du jeu',
        language: 'Langue',
        responseTime: 'Temps de réponse (secondes) :',
        clockDelay: 'Délai de l\'horloge (secondes) :',
        autoTransitions: 'Transitions automatiques :',
        goToStatistics: 'Aller aux statistiques',
        goToLeaderboard: 'Aller au classement'
    },

    // Buttons
    buttons: {
        startGame: 'Démarrer le jeu',
        stopGame: 'Arrêter le jeu',
        edit: 'Modifier'
    },

    // Status messages
    status: {
        gameActive: 'Jeu actif - Code PIN :',
        backToFirstSlide: 'Retour à la première diapositive...',
        nextSlide: 'Diapositive suivante...',
        simulatingClick: 'Simulation de la barre d\'espace...',
        settingsSaved: 'Paramètres enregistrés'
    },

    // Start screen
    startScreen: {
        title: 'Démarrer le jeu',
        scanQR: 'Scannez le code QR pour rejoindre',
        loadingQR: 'Chargement du code QR...',
        scanInstructions: 'Scannez le code avec un appareil mobile ou allez à :',
        loadingUrl: 'Chargement de l\'URL...',
        tip: 'Les participants peuvent rejoindre via le code QR ou l\'URL',
        errorNoGameId: 'ID du jeu non trouvé. Veuillez d\'abord enregistrer la présentation.',
        errorLoadingQR: 'Erreur lors du chargement du code QR'
    },

    // Auto-save status
    autoSave: {
        pending: 'Modifications en attente d\'enregistrement...',
        saving: 'Enregistrement...',
        saved: 'Enregistré automatiquement',
        error: 'Erreur d\'enregistrement'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': 'Aucun serveur actif disponible',
        'Game server is unavailable': 'Le serveur de jeu est indisponible',
        'Game PIN not found': 'Code du jeu introuvable',
        'Failed to resolve server from LB': 'Erreur lors de la communication avec le serveur de jeu',
        'Room not found. Add-in must create room first.': 'Salle introuvable. Veuillez créer une salle d\'abord.',
        'Game already started': 'Le jeu a déjà commencé',
        'Game session not found': 'Session de jeu introuvable',
    },
    // Errors
    errors: {
        createRoom: '⚠️ Erreur lors de la création de la salle : {{message}}',
        websocket: 'Impossible de se connecter au jeu. Vérifiez votre connexion et réessayez.',
        startGame: 'Erreur lors du démarrage du jeu : {{message}}',
        gameClosed: 'Jeu fermé : {{reason}}',
        connectionLost: 'Connexion perdue. Jeu fermé.',
        addGameId: 'Erreur lors de l\'ajout de l\'ID du jeu',
        addQrCode: 'Erreur lors de l\'ajout du code QR',
        addQuestionTime: 'Erreur lors de l\'ajout du temps de question',
        addRespondersCount: 'Erreur lors de l\'ajout du nombre de répondants',
        addParticipantsCount: 'Erreur lors de l\'ajout du nombre de participants',
        addParticipantsList: 'Erreur lors de l\'ajout de la liste des participants',
        addAnswersDistribution: 'Erreur lors de l\'ajout de la distribution des réponses',
        addLeaderboard: 'Erreur lors de l\'ajout du classement',
        selectSlideFirst: 'Veuillez d\'abord sélectionner une diapositive',
    },

    // Success
    success: {
        roomCreated: '✅ Salle créée ! PIN : {{pin}} - En attente du démarrage par l\'Admin',
        gameStarted: '✅ Jeu lancé ! Acceptation des participants...',
        gameIdAdded: '✅ ID du jeu ajouté à la diapositive !',
        qrCodeAdded: '✅ Code QR ajouté à la diapositive !',
        questionTimeAdded: '✅ Temps de question ajouté à la diapositive !',
        respondersCountAdded: '✅ Nombre de répondants ajouté à la diapositive !',
        participantsCountAdded: '✅ Nombre de participants ajouté à la diapositive !',
    },
    // Tooltips
    tooltips: {
        edit: 'Modifier',
        save: 'Enregistrer',
        cancel: 'Annuler'
    },

    // Onboarding
    onboarding: {
        selectLanguage: 'Sélectionner la langue',
        enter: 'Entrer',
        chooseTemplate: 'Choisir un modèle de jeu',
        blankTemplate: 'Modèle vierge',
        classicBlack: 'Noir classique',
        applyTemplate: 'Appliquer le modèle'
    }
};
