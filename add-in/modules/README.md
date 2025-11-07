# Modules Directory

This directory contains refactored modules from the original `taskpane.js` file.

## Architecture Overview

The original `taskpane.js` file was **4,173 lines** and contained all functionality in a single file. It has been refactored into a modular architecture:

### Main File
- **taskpane.js** (~600 lines) - Main entry point, coordinates modules and handles Office.js initialization

### Modules

#### 1. **api.js** - API Communication
- `makeApiCall()` - Generic API calls returning text
- `makeJsonApiCall()` - API calls returning JSON
- `initializeQuiz()` - Initialize quiz session
- **Exports**: `API_BASE`, `makeApiCall`, `makeJsonApiCall`, `initializeQuiz`

#### 2. **websocket.js** - WebSocket & Real-time Communication
- `initializeWebSocket()` - Setup WebSocket connection with event handlers
- `getSocket()` - Get current socket instance
- `emitSocketEvent()` - Send events through socket
- `getParticipantsList()` - Get current participants
- Participant management (add/remove/position)
- **Exports**: `WEBSOCKET_URL`, `initializeWebSocket`, `getSocket`, `emitSocketEvent`, `getParticipantsList`

#### 3. **navigation.js** - PowerPoint Navigation
- `goToFirstSlideInPowerPoint()` - Navigate to first slide
- `goToNextSlideInPowerPoint()` - Navigate to next slide (with game logic)
- `navigateToSlideByIndex()` - Navigate to specific slide
- `simulateClickInPowerPoint()` - Simulate spacebar/click
- `getCurrentSlideNumber()` - Get current slide position
- `getAllSlideIds()` - Get all slide IDs in order
- `calculateNextSlideLocally()` - Calculate next slide based on game logic
- `resetAnimationState()` - Reset animation tracking
- **Exports**: All navigation functions

#### 4. **storage.js** - Data Persistence
- `savePresentationData()` - Save presentation data to server
- `loadPresentationData()` - Load presentation data from server
- `getPresentationFileInfo()` - Get presentation file path and name
- `isPresentationSaved()` - Check if presentation is saved
- `getGameHashId()` - Generate/get game hash ID
- `createHashFromPath()` - Create hash from file path
- `getSlideType()`, `setSlideType()`, `getSlideData()` - Slide type helpers
- **Exports**: All storage and file management functions

#### 5. **powerpoint-shapes.js** - PowerPoint Shape Manipulation
- `updateGameIdInSlides()` - Update game PIN in tagged shapes
- `updateQrCodeInSlides()` - Update QR code images in slides
- `insertLiveParticipantsArea()` - Insert participants display area
- `updateLiveParticipantsInSlide()` - Update participants in existing areas
- `createParticipantPillShapes()` - Create participant UI elements
- `generateUUID()` - Generate unique IDs
- **Exports**: All shape manipulation functions

#### 6. **ui-manager.js** - UI Management
- `showStatus()` - Display status messages
- `showError()` - Display error messages
- `updateDisplayedValues()` - Update UI values
- `updateAutoSaveStatus()` - Update auto-save indicator
- `preloadAllHtmlFiles()` - Pre-cache HTML files
- `updateUIForSlideType()` - Load UI for specific slide type
- **Exports**: All UI management functions

## Benefits of Refactoring

### 1. **Maintainability**
- **Before**: 4,173 lines in one file - difficult to navigate and maintain
- **After**: Organized into 6 focused modules + main file (~600 lines each)

### 2. **Code Organization**
- Clear separation of concerns
- Each module has a single responsibility
- Easy to locate specific functionality

### 3. **Reusability**
- Modules can be used independently
- Functions can be imported only when needed
- Reduces coupling between components

### 4. **Testing**
- Each module can be tested in isolation
- Easier to write unit tests
- Clearer dependencies

### 5. **Performance**
- ES6 modules support tree-shaking
- Browser can cache modules separately
- Faster reload during development

### 6. **Collaboration**
- Multiple developers can work on different modules
- Reduced merge conflicts
- Clear module boundaries

## Usage Example

```javascript
// Import only what you need
import { makeApiCall } from './modules/api.js';
import { goToNextSlideInPowerPoint } from './modules/navigation.js';
import { savePresentationData } from './modules/storage.js';

// Use the functions
await makeApiCall('game-info/12345');
await goToNextSlideInPowerPoint();
await savePresentationData();
```

## Migration Notes

The original `taskpane.js` has been backed up as `taskpane-old.js`.

### Breaking Changes
- None! The external API remains the same
- All functions are still globally accessible via `window` object
- HTML files can still call functions via `onclick="functionName()"`

### Global Functions
Functions are exposed globally for HTML onclick handlers:
```javascript
window.initializeQuiz = initializeQuiz;
window.startPresentationMode = startPresentationMode;
window.goToNextSlideInPowerPoint = goToNextSlideInPowerPoint;
// ... etc
```

## File Size Comparison

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| taskpane.js | 181 KB (4,173 lines) | 21 KB (~600 lines) | **88% reduction** |

**Total modular code**: ~2,500 lines across 6 modules + 600 lines main = ~3,100 lines
- Better organization
- Improved readability  
- **25% reduction in total code** (removed duplication and refactored)

## Version History

- **v4.5.2** - Original monolithic file
- **v5.0.0** - Refactored to modular architecture

## Future Improvements

1. **TypeScript Migration** - Add type safety
2. **Unit Tests** - Test each module independently
3. **Documentation** - JSDoc comments for all functions
4. **Error Handling** - Centralized error handling module
5. **State Management** - Dedicated state management module

