/**
 * Chinese (中文) translations
 */
export default {
    // Tabs
    tabs: {
        slides: '幻灯片',
        actions: '元素',
        settings: '设置'
    },

    // Slides list
    slides: {
        loading: '正在加载幻灯片...',
        slide: '幻灯片',
        errorLoading: '加载幻灯片列表时出错'
    },

    // Slide types
    slideTypes: {
        opening: '开场',
        transition: '过渡',
        question: '问题',
        statistics: '答题统计',
        leaderboard: '排行榜',
        summary: '总结',
        start: '开始画面'
    },

    // Context menu
    contextMenu: {
        changeType: '更改幻灯片类型',
        setAnswer: '设置正确答案'
    },

    // Dialogs
    dialogs: {
        selectSlideType: '选择幻灯片类型',
        setCorrectAnswer: '设置正确答案',
        confirm: '确认',
        cancel: '取消',
        save: '保存',
        answer: '答案',
        red: '红色',
        blue: '蓝色',
        yellow: '黄色',
        green: '绿色'
    },

    // Actions grid
    actions: {
        gameId: '游戏ID',
        participantsCount: '参与人数',
        participantsList: '参与者列表',
        qrCode: '二维码',
        questionTime: '答题时间',
        respondersCount: '回答人数',
        answersDistribution: '答案分布',
        leaderboard: '排行榜'
    },

    // Settings
    settings: {
        title: '游戏设置',
        language: '语言',
        responseTime: '答题时间（秒）：',
        clockDelay: '倒计时延迟（秒）：',
        autoTransitions: '自动切换：',
        goToStatistics: '跳转到统计',
        goToLeaderboard: '跳转到排行榜'
    },

    // Buttons
    buttons: {
        startGame: '开始游戏',
        stopGame: '停止游戏',
        edit: '编辑'
    },

    // Status messages
    status: {
        gameActive: '游戏进行中 - 游戏PIN：',
        backToFirstSlide: '返回第一张幻灯片...',
        nextSlide: '跳转到下一张幻灯片...',
        simulatingClick: '模拟空格键...',
        settingsSaved: '设置已保存'
    },

    // Start screen
    startScreen: {
        title: '开始游戏',
        scanQR: '扫描二维码加入游戏',
        loadingQR: '正在加载二维码...',
        scanInstructions: '用手机扫描二维码或访问：',
        loadingUrl: '正在加载网址...',
        tip: '参与者可以通过二维码或网址加入',
        errorNoGameId: '未找到游戏ID。请先保存演示文稿。',
        errorLoadingQR: '加载二维码时出错'
    },

    // Auto-save status
    autoSave: {
        pending: '更改等待保存...',
        saving: '正在保存...',
        saved: '已自动保存',
        error: '保存出错'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': '没有可用的服务器',
        'Game server is unavailable': '游戏服务器不可用',
        'Game PIN not found': '未找到游戏代码',
        'Failed to resolve server from LB': '连接游戏服务器时出错',
        'Room not found. Add-in must create room first.': '未找到房间。请先创建房间。',
        'Game already started': '游戏已经开始',
        'Game session not found': '未找到游戏会话',
    },
    // Errors
    errors: {
        createRoom: '⚠️ 创建房间错误：{{message}}',
        websocket: '无法连接到游戏。请检查网络连接后重试。',
        startGame: '启动游戏错误：{{message}}',
        gameClosed: '游戏已关闭：{{reason}}',
        connectionLost: '连接丢失。游戏已关闭。',
        addGameId: '添加游戏ID错误',
        addQrCode: '添加二维码错误',
        addQuestionTime: '添加问题时间错误',
        addRespondersCount: '添加回答者数量错误',
        addParticipantsCount: '添加参与者数量错误',
        addParticipantsList: '添加参与者列表错误',
        addAnswersDistribution: '添加答案分布错误',
        addLeaderboard: '添加排行榜错误',
        selectSlideFirst: '请先选择一张幻灯片',
    },

    // Success
    success: {
        roomCreated: '✅ 房间已创建！PIN：{{pin}} - 等待管理员启动游戏',
        gameStarted: '✅ 游戏开始！正在接受参与者...',
        gameIdAdded: '✅ 游戏ID已添加到幻灯片！',
        qrCodeAdded: '✅ 二维码已添加到幻灯片！',
        questionTimeAdded: '✅ 问题时间已添加到幻灯片！',
        respondersCountAdded: '✅ 回答者数量已添加到幻灯片！',
        participantsCountAdded: '✅ 参与者数量已添加到幻灯片！',
    },
    // Tooltips
    tooltips: {
        edit: '编辑',
        save: '保存',
        cancel: '取消'
    },

    // Onboarding
    onboarding: {
        selectLanguage: '选择语言',
        enter: '进入',
        chooseTemplate: '选择游戏模板',
        blankTemplate: '空白模板',
        classicBlack: '经典黑色',
        applyTemplate: '应用模板'
    }
};
