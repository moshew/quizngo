/* global Office */

console.log('📄 taskpane.js loaded!');

let isInitialized = false;
let autoUpdateInterval = null;
let slideCheckInterval = null;
let currentUsers = 0;
let currentTime = '';
let currentSlideNumber = 1;
let slideTypeData = {}; // Store slide type for each slide number

// Make variables globally accessible for commands
window.currentUsers = currentUsers;
window.currentTime = currentTime;
window.currentSlideNumber = currentSlideNumber;
let socket = null;
let timerActive = false;
let localTimerInterval = null;
let localTimerRemaining = 0;

// Clear any cached data
localStorage.clear();
sessionStorage.clear();

// Initialize the add-in when Office is ready
Office.onReady((info) => {
    console.log('🚀 Office.onReady called!', info);
    if (info.host === Office.HostType.PowerPoint) {
        console.log('✅ PowerPoint detected - initializing add-in...');
        document.getElementById('initButton').onclick = initializeQuiz;
        document.getElementById('startTimerButton').onclick = startTimer;
        document.getElementById('stopTimerButton').onclick = stopTimer;
        document.getElementById('saveButton').onclick = savePresentationData;
        
        
        // Set up slide type selection event handler
        document.getElementById('slideType').onchange = handleSlideTypeChange;
        
        // Set up slide change event listener
        setupSlideChangeListener();
        
        // Initialize WebSocket connection
        initializeWebSocket();
        
        // Note: Slide monitoring removed - relying only on event listener
        
        // Get initial slide number and load slide type - with proper initialization
        setTimeout(async () => {
            console.log('🔄 Starting initial slide detection...');
            try {
                // Step 1: Get the actual current slide position
                await getCurrentSlideNumber();
                console.log('📍 Current slide detected:', currentSlideNumber);
                
                
                // Step 3: Load saved presentation data (slide types only)
                try {
                    await loadPresentationData();
                } catch (error) {
                    console.log('No existing presentation data found or error loading:', error);
                }
                
                // Step 4: Load slide type for current slide (after data is loaded)
                loadSlideType();
                console.log('🎯 Loaded slide type for current slide:', currentSlideNumber);
                
                console.log('✅ Initial setup completed - current slide:', currentSlideNumber);
            } catch (error) {
                console.error('Error in initial setup:', error);
            }
        }, 1000); // Wait 1 second for PowerPoint to be fully ready
        
        console.log('🎯 Kahoot Quiz Manager Add-in initialized - VERSION 3.0 (FORCE RELOAD!)');
        console.log('🔗 All event handlers attached');
        console.log('📡 Starting slide monitoring and event listeners...');
        
         // Version loaded - logged to console only
         console.log('🔄 Add-in loaded - VERSION 3.0');
    } else {
        console.log('❌ Not in PowerPoint - host:', info.host);
    }
});

// API Base URL
const API_BASE = 'http://localhost:5000/';
const WEBSOCKET_URL = 'http://localhost:5000';

// Utility function to make API calls
async function makeApiCall(endpoint, method = 'GET') {
    try {
        const response = await fetch(API_BASE + endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.text();
        return data;
    } catch (error) {
        console.error('API call failed:', error);
        showError(`שגיאה בקריאה ל-API: ${error.message}`);
        throw error;
    }
}

// Utility function to make JSON API calls
async function makeJsonApiCall(endpoint, method = 'GET') {
    try {
        const response = await fetch(API_BASE + endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('JSON API call failed:', error);
        showError(`שגיאה בקריאה ל-API: ${error.message}`);
        throw error;
    }
}

// Initialize the quiz
async function initializeQuiz() {
    try {
        showStatus('מאתחל משחק...', 'connecting');
        
        const response = await makeJsonApiCall('?init');
        
        // Display game ID
        document.getElementById('gameId').textContent = response.game_id;
        
        // Also update the opening section game ID if it exists
        const gameIdOpening = document.getElementById('gameIdOpening');
        if (gameIdOpening) {
            gameIdOpening.textContent = response.game_id;
        }
        
         console.log('המשחק אותחל בהצלחה!');
        isInitialized = true;
        
    } catch (error) {
        showError('שגיאה באתחול המשחק: ' + error.message);
    }
}

// Show status message (only for warnings and errors)
function showStatus(message, type = 'info') {
    console.log(`Status (${type}): ${message}`);
    
    // Only show in UI for warnings and errors
    if (type === 'warning' || type === 'error') {
        const detectedInfo = document.getElementById('detectedInfo');
        if (detectedInfo) {
            const color = type === 'warning' ? '#856404' : '#721c24';
            const background = type === 'warning' ? '#fff3cd' : '#f8d7da';
            
            detectedInfo.innerHTML = `⚠️ ${message}`;
            detectedInfo.style.display = 'block';
            detectedInfo.style.background = background;
            detectedInfo.style.color = color;
            
            // Hide after 5 seconds
            setTimeout(() => {
                if (detectedInfo.innerHTML.includes('⚠️')) {
                    detectedInfo.style.display = 'none';
                }
            }, 5000);
        }
    }
}

// Show error message
function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
    
    console.error('Error:', message);
}

// Basic functions to prevent errors
async function startTimer() { console.log('startTimer called'); }
async function stopTimer() { console.log('stopTimer called'); }
async function getCurrentSlideNumber() {
    try {
        await PowerPoint.run(async (context) => {
            console.log('🔍 Getting current slide...');
            
            // Get selected slide (simple approach)
            const selectedSlides = context.presentation.getSelectedSlides();
            selectedSlides.load('items');
            await context.sync();
            
            console.log('🔍 Selected slides count:', selectedSlides.items?.length || 0);
            
            if (selectedSlides.items && selectedSlides.items.length > 0) {
                // Get all slides to find the index
                const allSlides = context.presentation.slides;
                allSlides.load('items');
                const selectedSlide = selectedSlides.items[0];
                selectedSlide.load('id');
                await context.sync();
                
                console.log('🔍 Total slides:', allSlides.items.length);
                console.log('🔍 Selected slide ID:', selectedSlide.id);
                
                // Load IDs for all slides
                for (let i = 0; i < allSlides.items.length; i++) {
                    allSlides.items[i].load('id');
                }
                await context.sync();
                
                // Find matching slide
                for (let i = 0; i < allSlides.items.length; i++) {
                    if (allSlides.items[i].id === selectedSlide.id) {
                        currentSlideNumber = i + 1;
                        console.log(`✅ Found slide at position ${i + 1}`);
                        break;
                    }
                }
            } else {
                console.log('⚠️ No selected slides found, using fallback');
                currentSlideNumber = 1; // Fallback
            }
            
            // Update UI
            window.currentSlideNumber = currentSlideNumber;
            const slideElement = document.getElementById('currentSlide');
            if (slideElement) {
                slideElement.textContent = currentSlideNumber;
            }
            const slideDisplayElement = document.getElementById('currentSlideDisplay');
            if (slideDisplayElement) {
                slideDisplayElement.textContent = currentSlideNumber;
            }
            
            console.log(`📄 Final current slide number: ${currentSlideNumber}`);
        });
    } catch (error) {
        console.error('Error getting current slide number:', error);
        // Fallback
        if (currentSlideNumber === 0) {
            currentSlideNumber = 1;
        }
        window.currentSlideNumber = currentSlideNumber;
        const slideElement = document.getElementById('currentSlide');
        if (slideElement) {
            slideElement.textContent = currentSlideNumber;
        }
        const slideDisplayElement = document.getElementById('currentSlideDisplay');
        if (slideDisplayElement) {
            slideDisplayElement.textContent = currentSlideNumber;
        }
        console.log(`📄 Fallback current slide number: ${currentSlideNumber}`);
    }
    // Note: loadSlideType should be called separately, not here
}
function setupSlideChangeListener() {
    console.log('Setting up slide change listener...');
    try {
        
        // הוספת מאזין לאירוע שינוי בחירה במסמך
        Office.context.document.addHandlerAsync(
            Office.EventType.DocumentSelectionChanged,
            onSlideChanged,
            function(result) {
                if (result.status === Office.AsyncResultStatus.Succeeded) {
                    console.log('✅ Slide change listener added successfully');
                    console.log('🔍 Event type used:', Office.EventType.DocumentSelectionChanged);
                } else {
                    console.log('❌ Failed to add slide change listener:', result.error);
                }
            }
        );
        
        
    } catch (error) {
        console.error('Error setting up slide change listener:', error);
    }
}

// פונקציה לטיפול בשינוי שקף
async function onSlideChanged(eventArgs) {
    console.log('🔄 EVENT TRIGGERED: שקף השתנה!', eventArgs);
    console.log('🔍 Current slide before check:', currentSlideNumber);
    
    try {
        // קבל את השקף הנוכחי
        await PowerPoint.run(async (context) => {
            const selectedSlides = context.presentation.getSelectedSlides();
            selectedSlides.load('items');
            await context.sync();
            
            if (selectedSlides.items && selectedSlides.items.length > 0) {
                const currentSlide = selectedSlides.items[0];
                currentSlide.load('id');
                await context.sync();
                
                // Get all slides to find the index
                const allSlides = context.presentation.slides;
                allSlides.load('items');
                await context.sync();
                
                // Load IDs for all slides
                for (let i = 0; i < allSlides.items.length; i++) {
                    allSlides.items[i].load('id');
                }
                await context.sync();
                
                // Find the slide number
                let newSlideNumber = 1;
                for (let i = 0; i < allSlides.items.length; i++) {
                    if (allSlides.items[i].id === currentSlide.id) {
                        newSlideNumber = i + 1;
                        break;
                    }
                }
                
                console.log(`🔍 Detected slide number: ${newSlideNumber}, Current: ${currentSlideNumber}`);
                
                // Only update if slide actually changed
                if (newSlideNumber !== currentSlideNumber) {
                    const oldSlideNumber = currentSlideNumber;
                    currentSlideNumber = newSlideNumber;
                    window.currentSlideNumber = currentSlideNumber;
                    
                    // Update UI
                    const slideElement = document.getElementById('currentSlide');
                    if (slideElement) {
                        slideElement.textContent = currentSlideNumber;
                    }
                    const slideDisplayElement = document.getElementById('currentSlideDisplay');
                    if (slideDisplayElement) {
                        slideDisplayElement.textContent = currentSlideNumber;
                    }
                    
                     console.log(`✅ SLIDE CHANGED: ${oldSlideNumber} → ${currentSlideNumber}`);
                    
                    // Load slide type for new slide
                    loadSlideType();
                    
                    // No auto-save - only save when user changes slide type manually
                } else {
                    console.log('🔍 No slide change detected');
                }
            }
        });
    } catch (error) {
        console.error('Error handling slide change:', error);
        // Fallback to simple detection
        await getCurrentSlideNumber();
    }
}


// Participants management
let participantsList = [];
let participantsPositions = new Map(); // nickname -> position index

function initializeWebSocket() {
    try {
        console.log('🔌 Initializing WebSocket connection to:', WEBSOCKET_URL);
        
        if (typeof io === 'undefined') {
            console.error('Socket.io not loaded');
            showError('Socket.io לא נטען');
            return;
        }
        
        socket = io(WEBSOCKET_URL, {
            transports: ['websocket', 'polling'],
            forceNew: true,
            timeout: 5000
        });
        
        socket.on('connect', () => {
            console.log('✅ WebSocket connected successfully');
        });
        
        socket.on('disconnect', () => {
            console.log('❌ WebSocket disconnected');
            timerActive = false;
        });
        
        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            showError('שגיאה בחיבור WebSocket: ' + error.message);
        });
        
        socket.on('error', (error) => {
            console.error('WebSocket error:', error);
            showError('שגיאת WebSocket: ' + error.message);
        });
        
        // Handle user updates
        socket.on('user_update', (data) => {
            console.log('👥 User update received:', data);
            currentUsers = data.users || data.total || 0;
            window.currentUsers = currentUsers;
            
            // Update UI
            const userCountElement = document.getElementById('userCount');
            if (userCountElement) {
                userCountElement.textContent = currentUsers;
            }
        });
        
        // Handle participant updates (new message type)
        socket.on('participant_update', (data) => {
            console.log('🆕 Participant update received:', data);
            handleParticipantUpdate(data);
        });
        
        // Handle status updates
        socket.on('status_update', (data) => {
            console.log('📊 Status update received:', data);
            currentUsers = data.users || 0;
            window.currentUsers = currentUsers;
            
            // Update UI
            const userCountElement = document.getElementById('userCount');
            if (userCountElement) {
                userCountElement.textContent = currentUsers;
            }
            
            if (data.status === 'running') {
                timerActive = true;
            } else {
                timerActive = false;
            }
        });
        
        console.log('🎯 WebSocket event handlers set up successfully');
        
    } catch (error) {
        console.error('WebSocket initialization failed:', error);
        showError('שגיאה בחיבור WebSocket: ' + error.message);
    }
}

// Handle participant updates from WebSocket
function handleParticipantUpdate(data) {
    // Expected data format:
    // { nick: "username", type: "add"/"remove", total: 5 }
    
    const { nick, type, total } = data;
    
    if (!nick || !type) {
        console.error('Invalid participant update data:', data);
        return;
    }
    
    console.log(`🔄 Processing ${type} for participant: ${nick}`);
    
    if (type === 'add') {
        addParticipant(nick);
    } else if (type === 'remove') {
        removeParticipant(nick);
    }
    
    // Update total count
    if (total !== undefined) {
        currentUsers = total;
        window.currentUsers = currentUsers;
        
        // Update total count display
        const totalCountElement = document.getElementById('totalParticipantsCount');
        if (totalCountElement) {
            totalCountElement.textContent = total;
        }
        
        // Update main user count
        const userCountElement = document.getElementById('userCount');
        if (userCountElement) {
            userCountElement.textContent = total;
        }
    }
    
    // Update any live participants areas in slides
    updateLiveParticipantsInSlide();
}

// Add participant with smart positioning
function addParticipant(nickname) {
    // Check if participant already exists
    if (participantsList.includes(nickname)) {
        console.log(`Participant ${nickname} already exists`);
        return;
    }
    
    console.log(`➕ Adding participant: ${nickname}`);
    
    // Add to participants list
    participantsList.push(nickname);
    
    // Calculate position using smart positioning logic
    const position = calculateNewParticipantPosition();
    participantsPositions.set(nickname, position);
    
    // Create and insert participant element
    createParticipantElement(nickname, position);
    
    // Hide "no participants" message if it's the first participant
    if (participantsList.length === 1) {
        const noParticipants = document.getElementById('noParticipants');
        if (noParticipants) {
            noParticipants.style.display = 'none';
        }
    }
    
    console.log(`✅ Participant ${nickname} added at position ${position}`);
    
    // Update live participants areas in slides
    updateLiveParticipantsInSlide();
}

// Remove participant and reposition others
function removeParticipant(nickname) {
    const index = participantsList.indexOf(nickname);
    if (index === -1) {
        console.log(`Participant ${nickname} not found`);
        return;
    }
    
    console.log(`➖ Removing participant: ${nickname}`);
    
    // Get the element and animate removal
    const participantElement = document.querySelector(`[data-participant="${nickname}"]`);
    if (participantElement) {
        participantElement.classList.add('removing');
        
        // Remove after animation
        setTimeout(() => {
            participantElement.remove();
            
            // Remove from data structures
            participantsList.splice(index, 1);
            participantsPositions.delete(nickname);
            
            // Reposition remaining participants
            repositionAllParticipants();
            
            // Show "no participants" message if list is empty
            if (participantsList.length === 0) {
                const noParticipants = document.getElementById('noParticipants');
                if (noParticipants) {
                    noParticipants.style.display = 'block';
                }
            }
            
            console.log(`✅ Participant ${nickname} removed`);
            
            // Update live participants areas in slides
            updateLiveParticipantsInSlide();
        }, 300); // Wait for animation
    }
}

// Calculate position for new participant
function calculateNewParticipantPosition() {
    const count = participantsList.length;
    
    if (count === 0) {
        return 0; // Center position
    }
    
    // Smart positioning: center first, then alternate left/right
    // Position 0 = center
    // Position 1 = right of center
    // Position 2 = left of center  
    // Position 3 = right of position 1
    // Position 4 = left of position 2
    // etc.
    
    return count;
}

// Create participant DOM element
function createParticipantElement(nickname, position) {
    const container = document.getElementById('participantsContainer');
    if (!container) return;
    
    const participantDiv = document.createElement('div');
    participantDiv.className = 'participant-item';
    participantDiv.setAttribute('data-participant', nickname);
    participantDiv.setAttribute('data-position', position);
    participantDiv.textContent = nickname;
    
    // Insert in the right position
    insertParticipantAtPosition(participantDiv, position);
}

// Insert participant at correct visual position
function insertParticipantAtPosition(element, position) {
    const container = document.getElementById('participantsContainer');
    if (!container) return;
    
    // Get all current participant elements (excluding noParticipants)
    const existingParticipants = Array.from(container.children).filter(
        child => child.classList.contains('participant-item')
    );
    
    // Simple append for now - visual positioning handled by CSS flexbox with center justify
    container.appendChild(element);
}

// Reposition all participants after removal
function repositionAllParticipants() {
    // Clear current positions
    participantsPositions.clear();
    
    // Recalculate positions for all remaining participants
    participantsList.forEach((nickname, index) => {
        participantsPositions.set(nickname, index);
        
        // Update data-position attribute
        const element = document.querySelector(`[data-participant="${nickname}"]`);
        if (element) {
            element.setAttribute('data-position', index);
        }
    });
    
    console.log('🔄 Repositioned all participants');
}

// Insert live participants area into slide (copy panel content directly)
async function insertLiveParticipantsArea() {
    await PowerPoint.run(async (context) => {
        // קבל את השקף הנוכחי
        const slides = context.presentation.getSelectedSlides();
        slides.load('items');
        await context.sync();
        
        if (slides.items.length === 0) {
            console.error('אין שקף נבחר');
            showError('אנא בחר שקף תחילה');
            return;
        }
        
        const currentSlide = slides.items[0];
        
        console.log('🔄 יוצר אזור משתתפים חי שמחקה את הפאנל...');
        
        // קבל את המשתתפים הנוכחיים מהפאנל
        const panelParticipants = Array.from(document.querySelectorAll('#participantsContainer .participant-item'))
            .map(item => item.textContent.trim());
        
        console.log('📋 משתתפים בפאנל:', panelParticipants);
        
        // צור את הקונטיינר הראשי שנראה כמו הפאנל
        const containerArea = currentSlide.shapes.addTextBox('', {
            left: 50,
            top: 300,
            width: 400,
            height: 250
        });
        
        containerArea.load(['tags', 'fill', 'line', 'textFrame']);
        await context.sync();
        
        // סטייל כמו הפאנל
        try {
            containerArea.fill.setSolidColor('#f3f2f1'); // רקע אפור בהיר כמו בפאנל
            containerArea.line.color = '#0078d4'; // גבול כחול כמו בפאנל
            containerArea.line.weight = 2;
        } catch (styleError) {
            console.log('לא הצלחתי לסטייל את הקונטיינר:', styleError);
        }
        
        // הוסף כותרת וטקסט
        const textRange = containerArea.textFrame.textRange;
        let content = '👥 משתתפים פעילים\n\n';
        
        if (panelParticipants.length === 0) {
            content += 'מחכים למשתתפים...';
        } else {
            content += `משתתפים:\n${panelParticipants.join(' • ')}\n\n`;
            content += `סה"כ: ${panelParticipants.length}`;
        }
        
        textRange.text = content;
        
        // סטייל הטקסט
        textRange.load(['font', 'paragraphFormat']);
        await context.sync();
        textRange.font.name = 'Segoe UI';
        textRange.font.size = 12;
        textRange.font.color = '#0078d4';
        textRange.font.bold = true;
        
        // הוסף תג לעדכונים דינמיים
        containerArea.tags.add('kahoot-participants-area', 'true');
        await context.sync();
        
        // עכשיו צור pills בודדים אם יש משתתפים
        if (panelParticipants.length > 0) {
            await createParticipantPillShapes(context, currentSlide, panelParticipants);
        }
        
        console.log('✅ אזור משתתפים חי נוצר בהצלחה!');
        showError('✅ אזור משתתפים חי נוסף לשקף! יתעדכן אוטומטית עם הפאנל.');
    });
}

// Create participant pills as shapes in the slide (like the panel)
async function createParticipantPillShapes(context, slide, participants) {
    try {
        console.log('🔵 יוצר pills כחולים למשתתפים...');
        
        const startX = 70;
        const startY = 400; // מתחת לקונטיינר הטקסט
        const pillWidth = 80;
        const pillHeight = 30;
        const gapX = 10;
        const gapY = 10;
        const pillsPerRow = 4;
        
        for (let i = 0; i < participants.length; i++) {
            const participant = participants[i];
            const row = Math.floor(i / pillsPerRow);
            const col = i % pillsPerRow;
            
            const x = startX + col * (pillWidth + gapX);
            const y = startY + row * (pillHeight + gapY);
            
            // צור רקע כחול (רקע מעוגל)
            const pillBg = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle, {
                left: x,
                top: y,
                width: pillWidth,
                height: pillHeight
            });
            
            pillBg.load(['fill', 'line', 'tags']);
            await context.sync();
            
            // סטייל הרקע כמו בפאנל
            try {
                pillBg.fill.setSolidColor('#0078d4'); // כחול כמו בפאנל
                pillBg.line.color = '#0078d4';
                pillBg.line.weight = 1;
            } catch (bgStyleError) {
                console.log('לא הצלחתי לסטייל רקע pill:', bgStyleError);
            }
            
            // תג לזיהוי
            pillBg.tags.add('kahoot-participant-pill', 'true');
            pillBg.tags.add('participant-name', participant);
            
            // צור טקסט לבן על הרקע
            const pillText = slide.shapes.addTextBox(participant, {
                left: x + 2,
                top: y + 2,
                width: pillWidth - 4,
                height: pillHeight - 4
            });
            
            pillText.load(['textFrame', 'tags']);
            await context.sync();
            
            // סטייל הטקסט
            const nameRange = pillText.textFrame.textRange;
            nameRange.load(['font', 'paragraphFormat']);
            await context.sync();
            
            nameRange.font.size = 10;
            nameRange.font.color = '#ffffff'; // לבן כמו בפאנל
            nameRange.font.bold = true;
            nameRange.font.name = 'Segoe UI';
            
            try {
                nameRange.paragraphFormat.alignment = PowerPoint.ParagraphAlignment.center;
            } catch (alignError) {
                console.log('לא הצלחתי למרכז טקסט:', alignError);
            }
            
            // תג לטקסט
            pillText.tags.add('kahoot-participant-pill', 'true');
            pillText.tags.add('participant-name', participant);
            
            await context.sync();
            console.log(`✅ נוצר pill עבור: ${participant}`);
        }
        
        console.log('✅ כל ה-pills נוצרו בהצלחה!');
    } catch (error) {
        console.error('❌ שגיאה ביצירת pills:', error);
    }
}

// Update synchronized area content to mirror the panel
async function updateSyncAreaContent(context, syncArea) {
    try {
        syncArea.load(['textFrame']);
        await context.sync();
        
        const textRange = syncArea.textFrame.textRange;
        textRange.load(['text']);
        await context.sync();
        
        // Mirror the panel's current state exactly
        let content = '👥 משתתפים פעילים\n\n';
        
        if (participantsList.length === 0) {
            content += 'מחכים למשתתפים...';
        } else {
            // Display participants as pills-like text (since we can't do real pills in text box)
            const participantsText = participantsList.map(p => `[${p}]`).join(' ');
            content += participantsText + '\n\n';
            content += `סה"כ: ${participantsList.length} משתתפים`;
        }
        
        textRange.text = content;
        
        // Style the text to match panel
        textRange.load(['font', 'paragraphFormat']);
        await context.sync();
        textRange.font.name = 'Segoe UI';
        textRange.font.size = 12;
        textRange.font.color = '#0078d4';
        
        await context.sync();
    } catch (error) {
        console.error('Error updating sync area content:', error);
    }
}

// Update live participants area in slide (called from WebSocket updates)
async function updateLiveParticipantsInSlide() {
    console.log('🔍 Starting updateLiveParticipantsInSlide with participants:', participantsList);
    
    try {
        await PowerPoint.run(async (context) => {
            // Find slides with participants area
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log(`📊 Found ${slides.items.length} slides to check`);
            
            let foundAreas = 0;
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load('items');
                await context.sync();
                
                console.log(`📄 Slide ${i + 1} has ${shapes.items.length} shapes`);
                
                // Look for shapes with participants area tag
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    shape.load(['tags']);
                    await context.sync();
                    
                    // Check if this shape has the participants area tag
                    const tags = shape.tags;
                    tags.load('items');
                    await context.sync();
                    
                    console.log(`🏷️ Shape ${j + 1} has ${tags.items.length} tags`);
                    
                    let isParticipantsArea = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        console.log(`   Tag: ${tag.key} = ${tag.value}`);
                        
                        if (tag.key === 'kahoot-participants-area' && tag.value === 'true') {
                            isParticipantsArea = true;
                            console.log('✅ Found participants area!');
                            break;
                        } else if (tag.key === 'KAHOOT-PARTICIPANTS-AREA' && tag.value === 'true') {
                            // PowerPoint might uppercase the tag key
                            isParticipantsArea = true;
                            console.log('✅ Found participants area (uppercase)!');
                            break;
                        } else if (tag.key === 'kahoot-participants-web-area' && tag.value === 'true') {
                            isParticipantsArea = true;
                            console.log('✅ Found participants web area!');
                            break;
                        } else if (tag.key === 'KAHOOT-PARTICIPANTS-WEB-AREA' && tag.value === 'true') {
                            // PowerPoint might uppercase the tag key
                            isParticipantsArea = true;
                            console.log('✅ Found participants web area (uppercase)!');
                            break;
                        } else if (tag.key === 'kahoot-participants-sync-area' && tag.value === 'true') {
                            isParticipantsArea = true;
                            console.log('✅ Found participants sync area!');
                            break;
                        } else if (tag.key === 'KAHOOT-PARTICIPANTS-SYNC-AREA' && tag.value === 'true') {
                            // PowerPoint might uppercase the tag key
                            isParticipantsArea = true;
                            console.log('✅ Found participants sync area (uppercase)!');
                            break;
                        }
                    }
                    
                    if (isParticipantsArea) {
                        foundAreas++;
                        console.log('🔄 Updating participants area content...');
                        try {
                            // Update this participants area
                            await updateParticipantsAreaContent(context, slide, shape);
                            console.log('✅ Successfully updated participants area');
                        } catch (updateError) {
                            console.error('❌ Error updating participants area:', updateError);
                        }
                    }
                    
                    // Also check for participants count text boxes
                    let isParticipantsCount = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        if ((tag.key === 'kahoot-participants-count' || tag.key === 'KAHOOT-PARTICIPANTS-COUNT') && tag.value === 'true') {
                            isParticipantsCount = true;
                            console.log('✅ Found participants count text box!');
                            break;
                        }
                    }
                    
                    if (isParticipantsCount) {
                        console.log('🔄 Updating participants count text...');
                        try {
                            // Update the participants count text
                            shape.load(['textFrame']);
                            await context.sync();
                            
                            const countTextRange = shape.textFrame.textRange;
                            countTextRange.load(['text']);
                            await context.sync();
                            
                            const newCountText = `משתתפים: ${participantsList.length}`;
                            countTextRange.text = newCountText;
                            
                            await context.sync();
                            console.log(`✅ Updated participants count to: ${participantsList.length}`);
                        } catch (countError) {
                            console.error('❌ Error updating participants count:', countError);
                        }
                    }
                }
            }
            
            console.log(`📋 Total participants areas found and updated: ${foundAreas}`);
        });
    } catch (error) {
        console.error('Error updating live participants in slide:', error);
    }
}

// Update content of a specific participants area (web object or text fallback)
async function updateParticipantsAreaContent(context, slide, participantsArea) {
    try {
        console.log('🔄 Updating participants area with current list:', participantsList);
        
        // Check what type of area this is by looking at tags
        participantsArea.load(['tags']);
        await context.sync();
        
        const tags = participantsArea.tags;
        tags.load('items');
        await context.sync();
        
        let areaType = 'text'; // default
        for (let i = 0; i < tags.items.length; i++) {
            const tag = tags.items[i];
            tag.load(['key', 'value']);
            await context.sync();
            
            if ((tag.key === 'kahoot-participants-web-area' || tag.key === 'KAHOOT-PARTICIPANTS-WEB-AREA') && tag.value === 'true') {
                areaType = 'web';
                break;
            } else if ((tag.key === 'kahoot-participants-sync-area' || tag.key === 'KAHOOT-PARTICIPANTS-SYNC-AREA') && tag.value === 'true') {
                areaType = 'sync';
                break;
            }
        }
        
        if (areaType === 'web') {
            // For web objects, the HTML widget handles its own updates via WebSocket
            console.log('🌐 Web object found - content updates automatically via WebSocket');
            // No need to manually update - the widget HTML has its own Socket.IO connection
        } else if (areaType === 'sync') {
            // Update synchronized area to mirror the panel exactly
            console.log('🔗 Updating synchronized area to mirror panel...');
            await updateSyncAreaContent(context, participantsArea);
        } else {
            // Update text area (fallback)
            console.log('📝 Updating text area content...');
            participantsArea.load(['textFrame']);
            await context.sync();
            
            const textRange = participantsArea.textFrame.textRange;
            textRange.load(['text']);
            await context.sync();
            
            let content = '🔄 אזור משתתפים פעילים\n\n';
            
            if (participantsList.length === 0) {
                content += '👥 מחכים למשתתפים...';
            } else {
                content += `👥 משתתפים פעילים (${participantsList.length}):\n\n`;
                participantsList.forEach(participant => {
                    content += `• ${participant}\n`;
                });
            }
            
            textRange.text = content;
            await context.sync();
        }
        
        console.log('✅ Updated participants area content');
        
    } catch (error) {
        console.error('❌ Error updating participants area content:', error);
    }
}

// Load presentation data function
async function loadPresentationData() {
    try {
        // Get document URL using getFilePropertiesAsync
        const url = await new Promise((resolve, reject) => {
            Office.context.document.getFilePropertiesAsync((result) => {
                if (result.status === Office.AsyncResultStatus.Succeeded) {
                    resolve(result.value.url);
                } else {
                    resolve(null);
                }
            });
        });
        
        // If no URL or temporary file - skip loading
        if (!url || url.includes('\\Temp\\') || url.includes('/Temp/') || url.includes('AppData\\Local\\Temp')) {
            console.log('📋 No valid URL for loading - skipping');
            return;
        }
        
        console.log('📂 Loading data for:', url);
        
        // Generate file ID and load
        const fileId = generateFileId(url);
        
        const response = await fetch(API_BASE + 'load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: fileId })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.status === 'success' && result.data.gameState) {
                const gameState = result.data.gameState;
                
                // Restore slide type data
                if (gameState.slideTypeData) {
                    slideTypeData = gameState.slideTypeData;
                    console.log('✅ Data loaded - slides:', Object.keys(slideTypeData).length);
                }
            } else {
                console.log('ℹ️ No saved data found');
            }
        } else {
            console.log('ℹ️ No saved data found');
        }
    } catch (error) {
        console.log('Loading error:', error.message);
    }
}

// Log document info to console only
function logDocumentInfo() {
    try {
        let url = Office.context.document.url;
        console.log('Document URL status:', url ? 'Available' : 'Not available');
        
        if (url) {
            const urlParts = url.split(/[/\\]/);
            const filename = urlParts[urlParts.length - 1].split('?')[0] || 'presentation.pptx';
            const fileId = generateFileId(url);
            
            console.log('📄 Document info - File:', filename, 'ID:', fileId);
        } else {
            console.log('📄 Document info - No URL available (unsaved presentation)');
        }
    } catch (error) {
        console.log('Could not get document info:', error.message);
    }
}


// Slide type management functions
function handleSlideTypeChange() {
    const slideType = document.getElementById('slideType').value;
    console.log(`🔄 Slide type changed to: ${slideType} for slide ${currentSlideNumber}`);
    saveSlideType(slideType);
    updateUIForSlideType(slideType);
}

function saveSlideType(slideType) {
    slideTypeData[currentSlideNumber] = slideType;
    console.log('💾 Slide type set:', slideType, 'for slide:', currentSlideNumber);
    console.log('📋 Current slideTypeData:', slideTypeData);
     // Note: Data is stored in memory. Use "💾 שמור נתונים" button to save to server
     console.log(`סוג שקף עודכן: ${slideType}`);
}

function loadSlideType() {
    // Load slide type for current slide
    const slideType = slideTypeData[currentSlideNumber] || 'מעבר'; // Default to מעבר
    document.getElementById('slideType').value = slideType;
    console.log(`Loaded slide type: ${slideType} for slide ${currentSlideNumber}`);
    updateUIForSlideType(slideType);
}

// Update UI based on slide type
function updateUIForSlideType(slideType) {
    const defaultStatusSection = document.getElementById('defaultStatusSection');
    const openingStatusSection = document.getElementById('openingStatusSection');
    const defaultControlSections = document.getElementById('defaultControlSections');
    const dynamicParticipantsArea = document.getElementById('dynamicParticipantsArea');
    
    if (slideType === 'פתיחה') {
        // Show opening-specific UI
        defaultStatusSection.style.display = 'none';
        openingStatusSection.style.display = 'block';
        defaultControlSections.style.display = 'none';
        dynamicParticipantsArea.style.display = 'block';
        
        // Sync game ID between sections
        const gameId = document.getElementById('gameId').textContent;
        document.getElementById('gameIdOpening').textContent = gameId;
    } else {
        // Show default UI
        defaultStatusSection.style.display = 'block';
        openingStatusSection.style.display = 'none';
        defaultControlSections.style.display = 'block';
        dynamicParticipantsArea.style.display = 'none';
    }
}

// Show participants count in slide (dynamic)
async function showParticipantsCount() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Add a text box with participant count and dynamic tag
                const textBox = slide.shapes.addTextBox(`משתתפים: ${currentUsers}`, {
                    left: 50,
                    top: 50,
                    width: 200,
                    height: 50
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for dynamic updates
                textBox.tags.add('kahoot-participants-count', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                
                textRange.font.size = 24;
                textRange.font.color = '#0078d4';
                textRange.font.bold = true;
                
                await context.sync();
                console.log('✅ Dynamic participants count added to slide');
            }
        });
    } catch (error) {
        console.error('Error adding participants count:', error);
        showError('שגיאה בהוספת מספר המשתתפים');
    }
}

// Insert participants display into slide
async function insertParticipantsDisplay() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Add Game PIN
                const gameId = document.getElementById('gameId').textContent || 
                              document.getElementById('gameIdOpening').textContent || 
                              '528 8478';
                
                const gamePinBox = slide.shapes.addTextBox(`Game PIN: ${gameId}`, {
                    left: 100,
                    top: 50,
                    width: 400,
                    height: 80
                });
                
                // Load text properties and sync before accessing
                gamePinBox.load(['textFrame']);
                await context.sync();
                
                const gamePinText = gamePinBox.textFrame.textRange;
                gamePinText.load(['font', 'paragraphFormat']);
                await context.sync();
                
                gamePinText.font.size = 32;
                gamePinText.font.bold = true;
                
                // Add participants title
                const titleBox = slide.shapes.addTextBox('משתתפים פעילים', {
                    left: 100,
                    top: 150,
                    width: 400,
                    height: 50
                });
                
                titleBox.load(['textFrame']);
                await context.sync();
                
                const titleText = titleBox.textFrame.textRange;
                titleText.load(['font', 'paragraphFormat']);
                await context.sync();
                
                titleText.font.size = 24;
                titleText.font.bold = true;
                
                // Add participant names in a grid-like layout
                const participants = ['Joe', 'Ttt', 'moshe', 'Sarah', 'David', 'Lisa', 'Alex'];
                const participantBoxes = [];
                
                for (let i = 0; i < participants.length; i++) {
                    const name = participants[i];
                    const row = Math.floor(i / 3);
                    const col = i % 3;
                    const x = 50 + (col * 200);
                    const y = 220 + (row * 80);
                    
                    const participantBox = slide.shapes.addTextBox(`👤 ${name}`, {
                        left: x,
                        top: y,
                        width: 180,
                        height: 60
                    });
                    
                    participantBoxes.push(participantBox);
                }
                
                // Load all participant boxes
                participantBoxes.forEach(box => {
                    box.load(['textFrame']);
                });
                await context.sync();
                
                // Set text formatting for all participant boxes
                participantBoxes.forEach(box => {
                    const textRange = box.textFrame.textRange;
                    textRange.load(['font']);
                    textRange.font.size = 18;
                });
                
                await context.sync();
                console.log('✅ Participants display added to slide');
            }
        });
    } catch (error) {
        console.error('Error inserting participants display:', error);
        showError('שגיאה בהכנסת תצוגת המשתתפים');
    }
}


// Generate a consistent hash-based file ID from URL
function generateFileId(url) {
    console.log('Generating hash for URL:', url);
    
    // Simple but consistent hash function
    let hash = 0;
    const str = url.toLowerCase();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    const fileId = Math.abs(hash).toString();
    console.log('Generated file ID:', fileId);
    return fileId;
}

// Save presentation data function
async function savePresentationData() {
    try {
        console.log('🚀 Starting save process - checking document URL...');
        
        await PowerPoint.run(async (context) => {
            // Function to get fresh URL using getFilePropertiesAsync
            const getFreshUrl = async () => {
                console.log('🔄 Trying getFilePropertiesAsync method...');
                
                // Method 1: Try getFilePropertiesAsync
                try {
                    const freshUrl = await new Promise((resolve, reject) => {
                        Office.context.document.getFilePropertiesAsync((result) => {
                            if (result.status === Office.AsyncResultStatus.Succeeded) {
                                const url = result.value.url;
                                console.log('✅ Fresh URL from getFilePropertiesAsync:', url);
                                resolve(url);
                            } else {
                                console.log('❌ getFilePropertiesAsync failed:', result.error);
                                reject(result.error);
                            }
                        });
                    });
                    
                    if (freshUrl) {
                        console.log('🎯 Using fresh URL from properties:', freshUrl);
                        return freshUrl;
                    }
                } catch (e) {
                    console.log('getFilePropertiesAsync method failed:', e.message);
                }
                
                // Method 2: Fallback to standard Office URL
                const fallbackUrl = Office.context.document.url;
                console.log('📋 Fallback to standard URL:', fallbackUrl);
                
                // Method 3: Try with fresh PowerPoint context as last resort
                try {
                    await PowerPoint.run(async (freshContext) => {
                        console.log('🆕 Trying fresh PowerPoint context...');
                        
                        const freshProperties = freshContext.document.properties;
                        freshProperties.load(['title']);
                        await freshContext.sync();
                        
                        console.log('Fresh context title:', freshProperties.title);
                    });
                } catch (e) {
                    console.log('Fresh PowerPoint context failed:', e.message);
                }
                
                return fallbackUrl;
            };
            
            // Function to check if URL is valid (not empty and not temporary)
            const isValidUrl = (url) => {
                if (!url || url.trim() === '') {
                    return false;
                }
                if (url.includes('\\Temp\\') || url.includes('/Temp/') || url.includes('AppData\\Local\\Temp') || url.includes('synthetic') || url.includes('unsaved')) {
                    return false;
                }
                return true;
            };
            
            // Single URL check
            const url = await getFreshUrl();
            console.log(`📋 Current URL: ${url}`);
            
            if (!isValidUrl(url)) {
                console.log('🚫 Document has not been saved to disk or URL is temporary');
                showError('יש לשמור את המצגת לדיסק תחילה לפני שמירת נתוני JSON');
                return;
            }
            
            console.log('✅ URL is valid - proceeding with save');
            
            // Generate file ID from URL hash
            const fileId = generateFileId(url);
            
            // Extract filename from URL for display
            const urlParts = url.split(/[/\\]/);
            const filename = urlParts[urlParts.length - 1].split('?')[0] || 'presentation.pptx';
            console.log('📄 Extracted filename:', filename);
            
            const gameState = {
                initialized: isInitialized,
                currentUsers: currentUsers,
                currentTime: currentTime,
                timerActive: timerActive,
                localTimerRemaining: localTimerRemaining,
                slideTypeData: slideTypeData
            };
            
            const dataToSave = {
                id: fileId,
                data: {
                    filename: decodeURIComponent(filename),
                    url: url,
                    fileId: fileId,
                    savedAt: new Date().toISOString(),
                    gameState: gameState
                }
            };
            
            const response = await fetch(API_BASE + 'save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSave)
            });
            
             if (response.ok) {
                 console.log('✅ Presentation data saved successfully');
            } else {
                console.error('Failed to save presentation data');
                showError('שגיאה בשמירת נתונים');
            }
        });
    } catch (error) {
        console.error('Error saving presentation data:', error);
        showError('שגיאה בשמירת נתונים: ' + error.message);
    }
}

