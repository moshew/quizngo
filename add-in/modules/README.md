# Modules Directory

This directory contains refactored modules from the original `taskpane.js` file, organized into logical subdirectories.

## Directory Structure

```
modules/
├── core/                     # Core infrastructure
│   ├── api.js               # API communication
│   ├── websocket.js         # WebSocket & real-time updates
│   └── state.js             # Presentation state management
│
├── ui/                       # User interface
│   ├── manager.js           # UI updates & status messages
│   ├── slides-list.js       # Slides list navigation
│   └── slide-type-editor.js # Inline slide type editing
│
├── game/                     # Game logic
│   ├── actions.js           # Game actions (start, timer)
│   ├── events.js            # Office event handlers
│   ├── navigation.js        # PowerPoint navigation
│   ├── scoring.js           # Answer scoring
│   └── slides.js            # Slide type management
│
└── elements/                 # PowerPoint shape elements
    ├── answers_analysis.js  # Answer distribution & leaderboard
    ├── game_management.js   # Game ID & QR code
    ├── participants_management.js  # Participant list & count
    └── question_timer.js    # Timer & respondents count
```

## Module Details

### Core (`core/`)

#### `api.js` - API Communication
- `API_BASE` - Base URL for API calls
- `makeApiCall()` - Generic API calls
- `makeJsonApiCall()` - API calls returning JSON
- `registerRoom()` - Register WebSocket to room
- `startAcceptingParticipants()` / `stopAcceptingParticipants()` - Control participant flow

#### `websocket.js` - WebSocket & Real-time
- `initializeWebSocket()` - Setup WebSocket with event handlers
- `getSocket()` - Get current socket instance
- `getParticipantsData()` / `getVisibleParticipantsData()` - Get participant info
- `getCurrentQuestionAnswers()` - Get answers for current question
- `resetParticipantsList()` - Clear participants

#### `state.js` - Presentation State
- `getGameHashId()` - Get/create game ID from presentation tags
- `savePresentationData()` / `loadPresentationData()` - Server persistence
- `getSlideType()` / `setSlideType()` / `getSlideData()` - Slide type helpers
- `triggerAutoSave()` - Debounced auto-save
- `hideParticipants()` / `isParticipantHidden()` - Hidden participant management

### UI (`ui/`)

#### `manager.js` - UI Management
- `showStatus()` - Display status messages
- `showError()` - Display error messages
- `updateAutoSaveStatus()` - Update auto-save indicator
- `loadStartScreen()` / `initializeStartScreen()` - Game start screen

#### `slides-list.js` - Slides List
- `initializeSlidesList()` - Setup slides list UI
- `refreshSlideList()` - Refresh the slides list
- `navigateToSlideByIndex()` - Navigate to slide
- `updateListSelection()` - Update visual selection

#### `slide-type-editor.js` - Inline Editing
- `getTypeLabel()` - Get Hebrew label for slide type
- `openInlineEdit()` - Open inline editor for slide
- `confirmInlineSlideTypeChange()` - Save inline changes

### Game (`game/`)

#### `actions.js` - Game Actions
- `startPresentationMode()` - Start the game (show QR screen)
- `startTimer()` / `stopTimer()` - Question timer control

#### `events.js` - Event Handlers
- `setupSlideChangeListener()` - Listen for slide changes
- `onSlideChanged()` - Handle slide change event
- `processSlideChange()` - Process slide change logic
- `resetParticipantAcceptanceState()` - Reset acceptance state

#### `navigation.js` - PowerPoint Navigation
- `goToFirstSlideInPowerPoint()` - Navigate to first slide
- `goToNextSlideInPowerPoint()` - Navigate to next (with game logic)
- `navigateToSlideByIndex()` - Navigate to specific slide
- `simulateClickInPowerPoint()` - Simulate spacebar/click
- `getCurrentSlideNumber()` - Get current position
- `calculateNextSlideLocally()` - Calculate next slide based on game rules

#### `scoring.js` - Answer Scoring
- `calculateScore()` - Calculate score based on answer time
- `processAnswersAndScores()` - Process all answers for a question
- `sendResultsToServer()` - Send results to server

#### `slides.js` - Slide Management
- `saveSlideType()` - Save slide type to state
- `loadSlideType()` - Load slide type for current slide

### Elements (`elements/`)

#### `answers_analysis.js` - Answers & Leaderboard
- `addAnswersDistribution()` - Add answer chart to slide
- `updateAnswersDistribution()` - Update chart values
- `resetAnswersDistribution()` - Reset chart to zeros
- `addLeaderboardElements()` - Add leaderboard to slide
- `updateLeaderboard()` / `resetLeaderboard()` - Update/reset leaderboard

#### `game_management.js` - Game ID & QR
- `updateGameIdInSlides()` - Update game PIN in slides
- `insertGameIdButton()` - Insert game ID placeholder
- `updateQrCodeInSlides()` - Update QR code image
- `insertQrCodeButton()` - Insert QR placeholder

#### `participants_management.js` - Participants
- `updateParticipantsNumInSlides()` - Update participant count
- `insertParticipantsNumButton()` - Insert count placeholder
- `updateParticipantsListInSlides()` - Update participant list
- `insertParticipantsListButton()` - Insert list placeholder
- `resetParticipantsNumInSlides()` - Reset counts to 0

#### `question_timer.js` - Timer & Respondents
- `addQuestionTime()` - Add timer to slide
- `updateCurrentSlideQuestionTime()` - Update timer value
- `updateAllQuestionTimeElements()` - Update all timers
- `addRespondentsCount()` - Add respondents counter
- `updateCurrentSlideRespondentsCount()` - Update respondents count
- `updateAllRespondentsCountElements()` - Update all respondent counts

## Import Examples

```javascript
// Core modules
import { API_BASE, registerRoom } from './modules/core/api.js';
import { initializeWebSocket } from './modules/core/websocket.js';
import { getGameHashId, triggerAutoSave } from './modules/core/state.js';

// UI modules
import { showStatus, showError } from './modules/ui/manager.js';
import { initializeSlidesList, refreshSlideList } from './modules/ui/slides-list.js';

// Game modules
import { startPresentationMode, startTimer } from './modules/game/actions.js';
import { goToNextSlideInPowerPoint } from './modules/game/navigation.js';
import { processAnswersAndScores } from './modules/game/scoring.js';

// Elements modules
import { updateAnswersDistribution } from './modules/elements/answers_analysis.js';
import { updateGameIdInSlides } from './modules/elements/game_management.js';
```

## Benefits of This Structure

1. **Clear Organization** - Each subdirectory has a single responsibility
2. **Easy Navigation** - Find code quickly by category
3. **Reduced Coupling** - Dependencies flow in one direction (core → ui/game → elements)
4. **Scalability** - Easy to add new modules in the appropriate category
5. **Maintainability** - Small, focused files are easier to understand and modify
