/**
 * Korean (한국어) translations
 */
export default {
    // Tabs
    tabs: {
        slides: '슬라이드',
        actions: '요소',
        settings: '설정'
    },

    // Slides list
    slides: {
        loading: '슬라이드 로딩 중...',
        slide: '슬라이드',
        errorLoading: '슬라이드 목록 로딩 오류'
    },

    // Slide types
    slideTypes: {
        opening: '오프닝',
        transition: '전환',
        question: '질문',
        statistics: '응답 통계',
        leaderboard: '리더보드',
        summary: '요약',
        start: '시작 화면'
    },

    // Context menu
    contextMenu: {
        changeType: '슬라이드 유형 변경',
        setAnswer: '정답 설정'
    },

    // Dialogs
    dialogs: {
        selectSlideType: '슬라이드 유형 선택',
        setCorrectAnswer: '정답 설정',
        confirm: '확인',
        cancel: '취소',
        save: '저장',
        answer: '답변',
        red: '빨강',
        blue: '파랑',
        yellow: '노랑',
        green: '초록'
    },

    // Actions grid
    actions: {
        gameId: '게임 ID',
        participantsCount: '참가자 수',
        participantsList: '참가자 목록',
        qrCode: 'QR 코드',
        questionTime: '질문 시간',
        respondersCount: '응답자 수',
        answersDistribution: '응답 분포',
        leaderboard: '리더보드'
    },

    // Settings
    settings: {
        title: '게임 설정',
        language: '언어',
        responseTime: '응답 시간 (초):',
        clockDelay: '시계 지연 (초):',
        autoTransitions: '자동 전환:',
        goToStatistics: '통계로 이동',
        goToLeaderboard: '리더보드로 이동'
    },

    // Buttons
    buttons: {
        startGame: '게임 시작',
        stopGame: '게임 중지',
        edit: '편집'
    },

    // Status messages
    status: {
        gameActive: '게임 진행 중 - 게임 PIN:',
        backToFirstSlide: '첫 번째 슬라이드로 돌아가는 중...',
        nextSlide: '다음 슬라이드...',
        simulatingClick: '스페이스바 시뮬레이션...',
        settingsSaved: '설정 저장됨'
    },

    // Start screen
    startScreen: {
        title: '게임 시작',
        scanQR: 'QR 코드를 스캔하여 참가하세요',
        loadingQR: 'QR 코드 로딩 중...',
        scanInstructions: '모바일 기기로 코드를 스캔하거나 다음 주소로 이동:',
        loadingUrl: 'URL 로딩 중...',
        tip: '참가자는 QR 코드 또는 URL로 참가할 수 있습니다',
        errorNoGameId: '게임 ID를 찾을 수 없습니다. 먼저 프레젠테이션을 저장하세요.',
        errorLoadingQR: 'QR 코드 로딩 오류'
    },

    // Auto-save status
    autoSave: {
        pending: '변경 사항 저장 대기 중...',
        saving: '저장 중...',
        saved: '자동 저장됨',
        error: '저장 오류'
    },

    // Server error message translations
    serverErrors: {
        'No active servers available': '사용 가능한 서버가 없습니다',
        'Game server is unavailable': '게임 서버를 사용할 수 없습니다',
        'Game PIN not found': '게임 PIN을 찾을 수 없습니다',
        'Failed to resolve server from LB': '로드 밸런서 연결 실패',
        'Room not found. Add-in must create room first.': '방을 찾을 수 없습니다. 먼저 방을 만드세요.',
        'Game already started': '게임이 이미 시작되었습니다',
        'Game session not found': '게임 세션을 찾을 수 없습니다',
    },
    // Errors
    errors: {
        createRoom: '⚠️ 방 생성 오류: {{message}}',
        websocket: '⚠️ WebSocket 연결 오류',
        startGame: '게임 시작 오류: {{message}}',
        gameClosed: '게임 종료: {{reason}}',
        connectionLost: '연결이 끊어졌습니다. 게임이 종료되었습니다.',
        addGameId: '게임 ID 추가 오류',
        addQrCode: 'QR 코드 추가 오류',
        addQuestionTime: '질문 시간 추가 오류',
        addRespondersCount: '응답자 수 추가 오류',
        addParticipantsCount: '참가자 수 추가 오류',
        addParticipantsList: '참가자 목록 추가 오류',
        addAnswersDistribution: '응답 분포 추가 오류',
        addLeaderboard: '리더보드 요소 추가 오류',
        selectSlideFirst: '먼저 슬라이드를 선택하세요',
    },

    // Success
    success: {
        roomCreated: '✅ 방 생성 완료! PIN: {{pin}} - 관리자의 시작을 기다리는 중',
        gameStarted: '✅ 게임 시작! 참가자를 받고 있습니다...',
        gameIdAdded: '✅ 게임 ID가 슬라이드에 추가되었습니다!',
        qrCodeAdded: '✅ QR 코드가 슬라이드에 추가되었습니다!',
        questionTimeAdded: '✅ 질문 시간이 슬라이드에 추가되었습니다!',
        respondersCountAdded: '✅ 응답자 수가 슬라이드에 추가되었습니다!',
        participantsCountAdded: '✅ 참가자 수가 슬라이드에 추가되었습니다!',
    },
    // Tooltips
    tooltips: {
        edit: '편집',
        save: '저장',
        cancel: '취소'
    },

    // Onboarding
    onboarding: {
        selectLanguage: '언어 선택',
        enter: '입력',
        chooseTemplate: '게임 템플릿 선택',
        blankTemplate: '빈 템플릿',
        classicBlack: '클래식 블랙',
        applyTemplate: '템플릿 적용'
    }
};
