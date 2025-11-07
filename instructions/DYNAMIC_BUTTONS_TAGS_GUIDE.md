# 🏷️ Dynamic Buttons with PowerPoint Tags - AI Reference

> **Quick reference for creating runtime-updatable slide elements using PowerPoint Tags API**

---

## What are PowerPoint Tags?

PowerPoint Tags are **invisible key-value pairs** attached to shapes/textboxes:
- Searchable via Office.js API
- Persist with the presentation file
- Used to identify and update elements dynamically

```javascript
// Add tag
shape.tags.add('kahoot-participants-count', 'true');

// Find and update later
if (tag.key === 'kahoot-participants-count' && tag.value === 'true') {
    shape.textFrame.textRange.text = `Participants: ${count}`;
}
```

---

## Complete Working Example: Participants Count

### 1. HTML Button
`add-in/slide-types/opening.html`:
```html
<button class="button" onclick="showParticipantsCount()">
    👥 Participants Count
</button>
```

### 2. Create Function (adds element + tag)
`add-in/taskpane.js`:
```javascript
async function showParticipantsCount() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Create textbox with initial content
                const textBox = slide.shapes.addTextBox(`Participants: ${currentUsers}`, {
                    left: 50, top: 50, width: 200, height: 50
                });
                
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // ⭐ Add unique tag for later identification
                textBox.tags.add('kahoot-participants-count', 'true');
                
                // Style text
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                
                textRange.font.size = 24;
                textRange.font.color = '#0078d4';
                textRange.font.bold = true;
                
                await context.sync();
                console.log('✅ Dynamic participants count added');
            }
        });
    } catch (error) {
        console.error('Error adding participants count:', error);
    }
}
```

### 3. Update Function (finds by tag and updates)
`add-in/taskpane.js`:
```javascript
async function updateLiveParticipantsInSlide() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            // Loop through all slides
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                // Loop through all shapes
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    // Search for our tag
                    let isParticipantsCount = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        if (tag.key === 'kahoot-participants-count' && tag.value === 'true') {
                            isParticipantsCount = true;
                            break;
                        }
                    }
                    
                    // Update if found
                    if (isParticipantsCount) {
                        shape.load(['textFrame']);
                        await context.sync();
                        
                        const countTextRange = shape.textFrame.textRange;
                        countTextRange.text = `Participants: ${participantsList.length}`;
                        
                        await context.sync();
                        console.log(`✅ Updated count to: ${participantsList.length}`);
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating participants:', error);
    }
}
```

### 4. Trigger Update on Events
```javascript
socket.on('quiz:user-joined', (data) => {
    participantsList.push(data.user);
    updateLiveParticipantsInSlide(); // Auto-update all tagged elements
});
```

---

## Template for New Dynamic Button

### Step 1: Add Button
```html
<button class="button" onclick="insertMyDynamicElement()">
    🎨 Button Name
</button>
```

### Step 2: Create Function
```javascript
async function insertMyDynamicElement() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                const element = slide.shapes.addTextBox(`Initial: ${value}`, {
                    left: 100, top: 100, width: 250, height: 60
                });
                
                element.load(['textFrame', 'tags']);
                await context.sync();
                
                // ⭐ Unique tag (use kahoot- prefix)
                element.tags.add('kahoot-my-element', 'true');
                
                // Optional: Additional metadata tags
                element.tags.add('element-type', 'counter');
                element.tags.add('created-at', new Date().toISOString());
                
                // Style
                const textRange = element.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                textRange.font.size = 20;
                textRange.font.color = '#e74c3c';
                textRange.font.bold = true;
                
                await context.sync();
                console.log('✅ Element added with tag: kahoot-my-element');
            }
        });
    } catch (error) {
        console.error('Error:', error);
    }
}
```

### Step 3: Create Update Function
```javascript
async function updateMyDynamicElements() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            slides.load('items');
            await context.sync();
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    let isMyElement = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        if (tag.key === 'kahoot-my-element' && tag.value === 'true') {
                            isMyElement = true;
                            break;
                        }
                    }
                    
                    if (isMyElement) {
                        shape.load(['textFrame']);
                        await context.sync();
                        
                        const textRange = shape.textFrame.textRange;
                        textRange.text = `Updated: ${newValue}`;
                        
                        await context.sync();
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error:', error);
    }
}
```

### Step 4: Connect to Event
```javascript
// WebSocket event
socket.on('some-event', () => updateMyDynamicElements());

// Timer
setInterval(() => updateMyDynamicElements(), 5000);

// Manual
async function manualUpdate() {
    await updateMyDynamicElements();
}
```

---

## Critical Best Practices

### ✅ DO
```javascript
// Use descriptive names with prefix
element.tags.add('kahoot-participants-count', 'true');

// Always check both key AND value
if (tag.key === 'kahoot-my-tag' && tag.value === 'true') { }

// Always await context.sync()
element.tags.add('my-tag', 'true');
await context.sync(); // ⭐ Required!

// Handle errors per element (don't break loop)
try {
    // update element
} catch (err) {
    console.error('Error:', err);
    // continue to next element
}
```

### ❌ DON'T
```javascript
// Don't skip context.sync()
element.tags.add('tag', 'true'); // Missing await context.sync()!

// Don't use tags for large data
element.tags.add('data', JSON.stringify(largeObject)); // BAD

// Don't forget to load tags
const tags = shape.tags;
for (let tag of tags.items) { // tag.key is undefined!
    console.log(tag.key);
}

// Correct way:
tags.load(['items']);
await context.sync();
for (let i = 0; i < tags.items.length; i++) {
    const tag = tags.items[i];
    tag.load(['key', 'value']);
    await context.sync();
    console.log(tag.key); // Works!
}
```

---

## Existing Tags in System

| Tag Key | Description | File |
|---------|-------------|------|
| `kahoot-game-id` | Game ID display | `taskpane.js` |
| `kahoot-participants-num` | Participants number counter | `taskpane.js` |
| `kahoot-participants-count` | Participants counter | `taskpane.js` |
| `kahoot-participants-area` | Live participants area | `taskpane.js` |
| `kahoot-participants-display` | Participants display | `taskpane.js` |
| `kahoot-qr-code` | QR Code for game entry | `taskpane.js` |

---

## Quick Debug Function

```javascript
// Check all tags on current slide
async function debugShapeTags() {
    await PowerPoint.run(async (context) => {
        const slides = context.presentation.getSelectedSlides();
        slides.load('items');
        await context.sync();
        
        if (slides.items.length > 0) {
            const shapes = slides.items[0].shapes;
            shapes.load(['items']);
            await context.sync();
            
            for (let i = 0; i < shapes.items.length; i++) {
                const shape = shapes.items[i];
                shape.load(['name']);
                const tags = shape.tags;
                tags.load(['items']);
                await context.sync();
                
                console.log(`Shape #${i}: ${shape.name}`);
                for (let j = 0; j < tags.items.length; j++) {
                    const tag = tags.items[j];
                    tag.load(['key', 'value']);
                    await context.sync();
                    console.log(`  🏷️ ${tag.key} = ${tag.value}`);
                }
            }
        }
    });
}
```

---

## Example: Statistics Image (Dynamic from Server)

### 1. HTML Button
`add-in/slide-types/statistics.html`:
```html
<button class="button" onclick="addStatisticsImage()" style="background-color: #3498db;">
    📊 הוסף תמונת סטטיסטיקה
</button>
```

### 2. Create Function (adds placeholder with tag)
`add-in/taskpane.js`:
```javascript
async function addStatisticsImage() {
    await PowerPoint.run(async (context) => {
        const slide = context.presentation.getSelectedSlides().items[0];
        
        // Image: 70% width, lower 2/3 of slide
        const imageWidth = 720 * 0.7;  // 504 points
        const imageHeight = 540 * 0.6; // 324 points
        const imageLeft = (720 - imageWidth) / 2;
        const imageTop = 540 / 3;
        
        const placeholder = slide.shapes.addTextBox('📊 תמונת סטטיסטיקה', {
            left: imageLeft, top: imageTop,
            width: imageWidth, height: imageHeight
        });
        
        placeholder.load(['tags']);
        await context.sync();
        
        // ⭐ Tag for dynamic updates
        placeholder.tags.add('kahoot-statistics-image', 'true');
        await context.sync();
    });
}
```

### 3. Update Function (finds by tag and replaces with server image)
```javascript
async function updateStatisticsImages() {
    // Loop through all shapes, find by tag 'kahoot-statistics-image'
    // Then replace with actual image from server
    // (See full example in taskpane.js lines 2765-2821)
}
```

---

## Example: QR Code for Game Entry (Dynamic Image from Server)

### 1. HTML Button
`add-in/slide-types/opening.html`:
```html
<button class="button" onclick="insertQrCodeButton()" style="width: 100%; background-color: #9b59b6;">
    📱 הוסף QR Code
</button>
```

### 2. Create Function (adds placeholder with tag)
`add-in/taskpane.js`:
```javascript
async function insertQrCodeButton() {
    await PowerPoint.run(async (context) => {
        const slide = context.presentation.getSelectedSlides().items[0];
        
        // QR code dimensions - standard size
        const qrSize = 200; // 200x200 points
        const qrLeft = 500; // Right side of slide
        const qrTop = 100;  // Top area
        
        const placeholder = slide.shapes.addTextBox('📱 QR Code\n\nיתעדכן בזמן המשחק', {
            left: qrLeft,
            top: qrTop,
            width: qrSize,
            height: qrSize
        });
        
        placeholder.load(['textFrame', 'tags', 'fill', 'line']);
        await context.sync();
        
        // ⭐ Tag for dynamic updates
        placeholder.tags.add('kahoot-qr-code', 'true');
        
        // Style the placeholder
        placeholder.fill.setSolidColor('#f0e6ff'); // Light purple background
        placeholder.line.color = '#9b59b6'; // Purple border
        placeholder.line.weight = 3;
        placeholder.line.dashStyle = 'Dash';
        
        await context.sync();
    });
}
```

### 3. Update Function (finds by tag and replaces with QR image from server)
`add-in/taskpane.js`:
```javascript
async function updateQrCodeInSlides(hashId) {
    const qrCodeUrl = `${API_BASE}qr-code/${hashId}`;
    
    await PowerPoint.run(async (context) => {
        const slides = context.presentation.slides;
        slides.load('items');
        await context.sync();
        
        for (let i = 0; i < slides.items.length; i++) {
            const slide = slides.items[i];
            const shapes = slide.shapes;
            shapes.load(['items']);
            await context.sync();
            
            for (let j = 0; j < shapes.items.length; j++) {
                const shape = shapes.items[j];
                const tags = shape.tags;
                tags.load(['items']);
                await context.sync();
                
                // Search for QR code tag (case-insensitive)
                let hasQrCodeTag = false;
                for (let k = 0; k < tags.items.length; k++) {
                    const tag = tags.items[k];
                    tag.load(['key', 'value']);
                    await context.sync();
                    
                    if (tag.key.toLowerCase() === 'kahoot-qr-code' && tag.value === 'true') {
                        hasQrCodeTag = true;
                        break;
                    }
                }
                
                if (hasQrCodeTag) {
                    // Save position and size
                    shape.load(['left', 'top', 'width', 'height']);
                    await context.sync();
                    
                    const left = shape.left;
                    const top = shape.top;
                    const width = shape.width;
                    const height = shape.height;
                    
                    // Delete placeholder
                    shape.delete();
                    await context.sync();
                    
                    // Download and convert QR code image to Base64
                    const imageResponse = await fetch(qrCodeUrl);
                    const imageBlob = await imageResponse.blob();
                    const base64Image = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(imageBlob);
                    });
                    
                    // Insert image using Office Common API
                    await new Promise((resolve, reject) => {
                        Office.context.document.setSelectedDataAsync(
                            base64Image,
                            {
                                coercionType: Office.CoercionType.Image,
                                imageLeft: left,
                                imageTop: top,
                                imageWidth: width,
                                imageHeight: height
                            },
                            function(asyncResult) {
                                if (asyncResult.status === Office.AsyncResultStatus.Failed) {
                                    reject(new Error(asyncResult.error.message));
                                } else {
                                    resolve();
                                }
                            }
                        );
                    });
                }
            }
        }
    });
}
```

**Key technique:** Using `Office.context.document.setSelectedDataAsync` with `Office.CoercionType.Image` to insert Base64-encoded images into PowerPoint.

### 4. Trigger Update on Game Registration
```javascript
socket.on('game_pin_registered', (data) => {
    const gamePin = data.gamePin;
    updateGameIdInSlides(gamePin);
    
    // Update QR Code when hash ID is available
    if (window.currentHashId) {
        updateQrCodeInSlides(window.currentHashId);
    }
});
```

**Server endpoint:** `/qr-code/<hash_id>` returns PNG image with QR code pointing to `http://192.168.31.22:3002/{hash_id}` (Admin app)

---

**Pattern:** CREATE (with tag) → EVENT → SEARCH (by tag) → UPDATE → REPEAT

📝 **File:** `instructions/DYNAMIC_BUTTONS_TAGS_GUIDE.md`  
🔗 **Related:** `taskpane.js`, `slide-types/*.html`
