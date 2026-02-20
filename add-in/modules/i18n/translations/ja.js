/**
 * Japanese (日本語) translations
 */
export default {
    // Tabs
    tabs: {
        slides: 'スライド',
        actions: '要素',
        settings: '設定'
    },

    // Slides list
    slides: {
        loading: 'スライドを読み込んでいます...',
        slide: 'スライド',
        errorLoading: 'スライド一覧の読み込みエラー'
    },

    // Slide types
    slideTypes: {
        opening: 'オープニング',
        transition: 'トランジション',
        question: '質問',
        statistics: '回答統計',
        leaderboard: 'リーダーボード',
        summary: 'まとめ',
        start: 'スタート画面'
    },

    // Context menu
    contextMenu: {
        changeType: 'スライドタイプを変更',
        setAnswer: '正解を設定'
    },

    // Dialogs
    dialogs: {
        selectSlideType: 'スライドタイプを選択',
        setCorrectAnswer: '正解を設定',
        confirm: '確認',
        cancel: 'キャンセル',
        save: '保存',
        answer: '回答',
        red: '赤',
        blue: '青',
        yellow: '黄色',
        green: '緑'
    },

    // Actions grid
    actions: {
        gameId: 'ゲームID',
        participantsCount: '参加者数',
        participantsList: '参加者リスト',
        qrCode: 'QRコード',
        questionTime: '質問時間',
        respondersCount: '回答者数',
        answersDistribution: '回答分布',
        leaderboard: 'リーダーボード'
    },

    // Settings
    settings: {
        title: 'ゲーム設定',
        language: '言語',
        responseTime: '回答時間（秒）：',
        clockDelay: '時計遅延（秒）：',
        autoTransitions: '自動遷移：',
        goToStatistics: '統計へ移動',
        goToLeaderboard: 'リーダーボードへ移動'
    },

    // Buttons
    buttons: {
        startGame: 'ゲーム開始',
        stopGame: 'ゲーム終了',
        edit: '編集'
    },

    // Status messages
    status: {
        gameActive: 'ゲーム進行中 - ゲームPIN：',
        backToFirstSlide: '最初のスライドに戻ります...',
        nextSlide: '次のスライドへ...',
        simulatingClick: 'スペースキーをシミュレート...',
        settingsSaved: '設定を保存しました'
    },

    // Start screen
    startScreen: {
        title: 'ゲーム開始',
        scanQR: 'QRコードをスキャンして参加',
        loadingQR: 'QRコードを読み込んでいます...',
        scanInstructions: 'モバイルデバイスでコードをスキャンするか、以下にアクセス：',
        loadingUrl: 'URLを読み込んでいます...',
        tip: '参加者はQRコードまたはURLから参加できます',
        errorNoGameId: 'ゲームIDが見つかりません。先にプレゼンテーションを保存してください。',
        errorLoadingQR: 'QRコードの読み込みエラー'
    },

    // Auto-save status
    autoSave: {
        pending: '変更は保存待ち...',
        saving: '保存中...',
        saved: '自動保存されました',
        error: '保存エラー'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': '利用可能なサーバーがありません',
        'Game server is unavailable': 'ゲームサーバーが利用できません',
        'Game PIN not found': 'ゲームPINが見つかりません',
        'Failed to resolve server from LB': 'ロードバランサーへの接続に失敗しました',
        'Room not found. Add-in must create room first.': 'ルームが見つかりません。先にルームを作成してください。',
        'Game already started': 'ゲームは既に開始されています',
        'Game session not found': 'ゲームセッションが見つかりません',
    },
    // Errors
    errors: {
        createRoom: '⚠️ ルーム作成エラー: {{message}}',
        websocket: '⚠️ WebSocket接続エラー',
        startGame: 'ゲーム開始エラー: {{message}}',
        gameClosed: 'ゲームが閉じられました: {{reason}}',
        connectionLost: '接続が切断されました。ゲームが閉じられました。',
        addGameId: 'ゲームID追加エラー',
        addQrCode: 'QRコード追加エラー',
        addQuestionTime: '質問時間追加エラー',
        addRespondersCount: '回答者数追加エラー',
        addParticipantsCount: '参加者数追加エラー',
        addParticipantsList: '参加者リスト追加エラー',
        addAnswersDistribution: '回答分布追加エラー',
        addLeaderboard: 'リーダーボード要素追加エラー',
        selectSlideFirst: '先にスライドを選択してください',
    },

    // Success
    success: {
        roomCreated: '✅ ルーム作成完了！PIN: {{pin}} - Adminの開始を待っています',
        gameStarted: '✅ ゲーム開始！参加者を受け付けています...',
        gameIdAdded: '✅ ゲームIDをスライドに追加しました！',
        qrCodeAdded: '✅ QRコードをスライドに追加しました！',
        questionTimeAdded: '✅ 質問時間をスライドに追加しました！',
        respondersCountAdded: '✅ 回答者数をスライドに追加しました！',
        participantsCountAdded: '✅ 参加者数をスライドに追加しました！',
    },
    // Tooltips
    tooltips: {
        edit: '編集',
        save: '保存',
        cancel: 'キャンセル'
    },

    // Onboarding
    onboarding: {
        selectLanguage: '言語を選択',
        enter: '入る',
        chooseTemplate: 'ゲームテンプレートを選択',
        blankTemplate: '空白テンプレート',
        classicBlack: 'クラシックブラック',
        applyTemplate: 'テンプレートを適用'
    }
};
