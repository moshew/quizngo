/**
 * German (Deutsch) translations
 */
export default {
    // Tabs
    tabs: {
        slides: 'Folien',
        actions: 'Elemente',
        settings: 'Einstellungen'
    },

    // Slides list
    slides: {
        loading: 'Folien werden geladen...',
        slide: 'Folie',
        errorLoading: 'Fehler beim Laden der Folienliste'
    },

    // Slide types
    slideTypes: {
        opening: 'Eröffnung',
        transition: 'Übergang',
        question: 'Frage',
        statistics: 'Antwortstatistik',
        leaderboard: 'Rangliste',
        summary: 'Zusammenfassung',
        start: 'Startbildschirm'
    },

    // Context menu
    contextMenu: {
        changeType: 'Folientyp ändern',
        setAnswer: 'Richtige Antwort festlegen'
    },

    // Dialogs
    dialogs: {
        selectSlideType: 'Folientyp auswählen',
        setCorrectAnswer: 'Richtige Antwort festlegen',
        confirm: 'Bestätigen',
        cancel: 'Abbrechen',
        save: 'Speichern',
        answer: 'Antwort',
        red: 'Rot',
        blue: 'Blau',
        yellow: 'Gelb',
        green: 'Grün'
    },

    // Actions grid
    actions: {
        gameId: 'Spiel-ID',
        participantsCount: 'Teilnehmeranzahl',
        participantsList: 'Teilnehmerliste',
        qrCode: 'QR-Code',
        questionTime: 'Fragezeit',
        respondersCount: 'Anzahl Antworten',
        answersDistribution: 'Antwortverteilung',
        leaderboard: 'Bestenliste'
    },

    // Settings
    settings: {
        title: 'Spieleinstellungen',
        language: 'Sprache',
        responseTime: 'Antwortzeit (Sekunden):',
        clockDelay: 'Uhrverzögerung (Sekunden):',
        autoTransitions: 'Automatische Übergänge:',
        goToStatistics: 'Zu Statistiken wechseln',
        goToLeaderboard: 'Zur Rangliste wechseln'
    },

    // Buttons
    buttons: {
        startGame: 'Spiel starten',
        edit: 'Bearbeiten'
    },

    // Status messages
    status: {
        gameActive: 'Spiel aktiv - Spiel-PIN:',
        backToFirstSlide: 'Zurück zur ersten Folie...',
        nextSlide: 'Nächste Folie...',
        simulatingClick: 'Leertaste simulieren...',
        settingsSaved: 'Einstellungen gespeichert'
    },

    // Start screen
    startScreen: {
        title: 'Spiel starten',
        scanQR: 'QR-Code scannen zum Beitreten',
        loadingQR: 'QR-Code wird geladen...',
        scanInstructions: 'Code mit Mobilgerät scannen oder besuchen Sie:',
        loadingUrl: 'URL wird geladen...',
        tip: 'Teilnehmer können per QR-Code oder URL beitreten',
        errorNoGameId: 'Spiel-ID nicht gefunden. Bitte speichern Sie die Präsentation zuerst.',
        errorLoadingQR: 'Fehler beim Laden des QR-Codes'
    },

    // Auto-save status
    autoSave: {
        pending: 'Änderungen warten auf Speicherung...',
        saving: 'Speichern...',
        saved: 'Automatisch gespeichert',
        error: 'Fehler beim Speichern'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': 'Keine aktiven Server verfügbar',
        'Game server is unavailable': 'Spielserver nicht verfügbar',
        'Game PIN not found': 'Spiel-PIN nicht gefunden',
        'Failed to resolve server from LB': 'Verbindung zum Load Balancer fehlgeschlagen',
        'Room not found. Add-in must create room first.': 'Raum nicht gefunden. Bitte zuerst einen Raum erstellen.',
        'Game already started': 'Spiel bereits gestartet',
        'Game session not found': 'Spielsitzung nicht gefunden',
    },
    // Errors
    errors: {
        createRoom: '⚠️ Fehler beim Erstellen des Raums: {{message}}',
        websocket: '⚠️ WebSocket-Verbindungsfehler',
        startGame: 'Fehler beim Starten des Spiels: {{message}}',
        gameClosed: 'Spiel geschlossen: {{reason}}',
        connectionLost: 'Verbindung verloren. Spiel geschlossen.',
        addGameId: 'Fehler beim Hinzufügen der Spiel-ID',
        addQrCode: 'Fehler beim Hinzufügen des QR-Codes',
        addQuestionTime: 'Fehler beim Hinzufügen der Fragezeit',
        addRespondersCount: 'Fehler beim Hinzufügen der Antwortenden-Anzahl',
        addParticipantsCount: 'Fehler beim Hinzufügen der Teilnehmerzahl',
        addParticipantsList: 'Fehler beim Hinzufügen der Teilnehmerliste',
        addAnswersDistribution: 'Fehler beim Hinzufügen der Antwortverteilung',
        addLeaderboard: 'Fehler beim Hinzufügen der Bestenliste',
        selectSlideFirst: 'Bitte wählen Sie zuerst eine Folie aus',
    },

    // Success
    success: {
        roomCreated: '✅ Raum erstellt! PIN: {{pin}} - Warten auf Admin zum Starten',
        gameStarted: '✅ Spiel gestartet! Teilnehmer werden akzeptiert...',
        gameIdAdded: '✅ Spiel-ID zur Folie hinzugefügt!',
        qrCodeAdded: '✅ QR-Code zur Folie hinzugefügt!',
        questionTimeAdded: '✅ Fragezeit zur Folie hinzugefügt!',
        respondersCountAdded: '✅ Antwortenden-Anzahl zur Folie hinzugefügt!',
        participantsCountAdded: '✅ Teilnehmerzahl zur Folie hinzugefügt!',
    },
    // Tooltips
    tooltips: {
        edit: 'Bearbeiten',
        save: 'Speichern',
        cancel: 'Abbrechen'
    }
};
