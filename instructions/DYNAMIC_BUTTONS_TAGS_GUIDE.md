# 🏷️ Dynamic Buttons with PowerPoint Tags - AI Reference

> **Quick reference for creating runtime-updatable slide elements using PowerPoint Tags API**

---

## What are PowerPoint Tags?

PowerPoint Tags are **invisible key-value pairs** attached to shapes/textboxes:
- Searchable via Office.js API
- Persist with the presentation file
- Used to identify and update elements dynamically **across all slides**

**Key concept:** When you update elements by tag, the system searches **ALL slides** in the presentation and updates **EVERY element** that has the matching tag. This means:
- ✅ Add a QR Code placeholder to slide 5 → it will be updated when the game starts
- ✅ Add participant count to slides 2, 4, and 7 → all three will update simultaneously
- ✅ One tag, one update function → updates everywhere automatically

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

**Important:** This function searches **ALL slides** and updates **ALL elements** with the matching tag, not just the current slide.

```javascript
async function updateLiveParticipantsInSlide() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            // ⭐ Loop through ALL slides in the presentation
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                // ⭐ Loop through all shapes in this slide
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    // ⭐ Search for our tag
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
                    
                    // ⭐ Update if found (this element will be updated regardless of which slide it's on)
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

**Important:** This function searches **ALL slides** and updates **ALL tagged elements**, not just the current slide.

```javascript
async function updateMyDynamicElements() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.slides;
            slides.load('items');
            await context.sync();
            
            // ⭐ Loop through ALL slides
            // ⭐ Loop through ALL slides
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                // ⭐ Check every shape in this slide
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
                    
                    // ⭐ Update wherever found (could be slide 1, 5, 10, etc.)
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
| `kahoot-answer-bar` | Answer distribution bar (with `answer-number`) | `powerpoint-shapes.js` |
| `kahoot-answer-value` | Answer value label (with `answer-number`) | `powerpoint-shapes.js` |

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

## Example: Answers Distribution Bar Chart (Dynamic Shapes)

### 1. HTML Button
`add-in/slide-types/statistics.html`:
```html
<button class="button" onclick="addAnswersDistribution()" style="background-color: #3498db;">
    📊 הוסף פילוג תשובות
</button>
```

### 2. Create Function (adds bar chart with tags)
`add-in/modules/powerpoint-shapes.js`:
```javascript
export async function addAnswersDistribution() {
    await PowerPoint.run(async (context) => {
        const slide = context.presentation.getSelectedSlides().items[0];
        
        // Chart configuration
        const answers = [
            { number: 1, color: '#e74c3c', value: 0, label: '1' },  // Red
            { number: 2, color: '#2c3e50', value: 0, label: '2' },  // Dark Blue
            { number: 3, color: '#f1c40f', value: 0, label: '3' },  // Yellow
            { number: 4, color: '#27ae60', value: 0, label: '4' }   // Green
        ];
        
        // Create bars and labels for each answer
        for (let i = 0; i < answers.length; i++) {
            const answer = answers[i];
            
            // Create bar (rectangle)
            const bar = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle);
            bar.left = barLeft;
            bar.top = chartTop + (maxBarHeight - 50);
            bar.width = barWidth;
            bar.height = 50; // Initial height
            
            bar.load(['fill', 'line', 'tags']);
            await context.sync();
            
            bar.fill.setSolidColor(answer.color);
            bar.line.visible = false;
            
            // ⭐ Add tags for dynamic updates
            bar.tags.add('kahoot-answer-bar', 'true');
            bar.tags.add('answer-number', answer.number.toString());
            await context.sync();
            
            // Create value label on top
            const valueLabel = slide.shapes.addTextBox(answer.value.toString(), {
                left: barLeft, top: chartTop + (maxBarHeight - 80),
                width: barWidth, height: 30
            });
            
            valueLabel.load(['textFrame', 'tags']);
            await context.sync();
            
            // ⭐ Tag value label
            valueLabel.tags.add('kahoot-answer-value', 'true');
            valueLabel.tags.add('answer-number', answer.number.toString());
            await context.sync();
        }
    });
}
```

### 3. Update Function (finds by tags and updates bar heights + values)
```javascript
export async function updateAnswersDistribution(answersData) {
    // answersData format: { 1: 25, 2: 18, 3: 20, 4: 16 }
    
    await PowerPoint.run(async (context) => {
        const slides = context.presentation.slides;
        slides.load('items');
        await context.sync();
        
        const maxValue = Math.max(...Object.values(answersData), 1);
        
        // ⭐ Search ALL slides for answer bars
        for (let i = 0; i < slides.items.length; i++) {
            const shapes = slides.items[i].shapes;
            shapes.load(['items']);
            await context.sync();
            
            for (let j = 0; j < shapes.items.length; j++) {
                const shape = shapes.items[j];
                const tags = shape.tags;
                tags.load(['items']);
                await context.sync();
                
                let isAnswerBar = false;
                let answerNumber = null;
                
                for (let k = 0; k < tags.items.length; k++) {
                    const tag = tags.items[k];
                    tag.load(['key', 'value']);
                    await context.sync();
                    
                    if (tag.key === 'kahoot-answer-bar' && tag.value === 'true') {
                        isAnswerBar = true;
                    } else if (tag.key === 'answer-number') {
                        answerNumber = parseInt(tag.value);
                    }
                }
                
                // ⭐ Update bar height based on value
                if (isAnswerBar && answerNumber && answersData[answerNumber]) {
                    const value = answersData[answerNumber];
                    const barHeight = (value / maxValue) * maxBarHeight;
                    
                    shape.load(['top', 'height']);
                    await context.sync();
                    
                    shape.top = chartTop + (maxBarHeight - barHeight);
                    shape.height = barHeight;
                    await context.sync();
                }
            }
        }
    });
}
```

### 4. Trigger Update on Answer Events
```javascript
// From WebSocket events
socket.on('answer-statistics', (data) => {
    // data format: { 1: 25, 2: 18, 3: 20, 4: 16 }
    updateAnswersDistribution(data);
});

// Manual testing from console
updateAnswersDistribution({ 1: 25, 2: 18, 3: 20, 4: 16 });

// Example with different values
updateAnswersDistribution({ 1: 10, 2: 30, 3: 15, 4: 25 });
```

**Key features:**
- ✅ **Multiple tags per shape**: Each bar has TWO tags (`kahoot-answer-bar` + `answer-number`)
- ✅ **Proportional scaling**: Bars scale based on max value (tallest bar = max value)
- ✅ **Synchronized updates**: Both bar height AND value label update together
- ✅ **Cross-slide updates**: Place bars on any slide(s) - all update simultaneously

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

**Important:** This function searches **ALL slides** and updates **ALL QR placeholders** with the matching tag. If you have QR codes on slides 1, 5, and 10, all three will be replaced with the actual QR image when the game starts.

```javascript
async function updateQrCodeInSlides(hashId) {
    const qrCodeUrl = `${API_BASE}qr-code/${hashId}`;
    
    await PowerPoint.run(async (context) => {
        const slides = context.presentation.slides;
        slides.load('items');
        await context.sync();
        
        // ⭐ Search ALL slides for QR code placeholders
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
                    // ⭐ Found a QR placeholder - replace it with the actual QR image
                    // This happens on whichever slide the placeholder is on
                    
                    // Save position and size
                    shape.load(['left', 'top', 'width', 'height']);
                    await context.sync();
                    
                    const left = shape.left;
                    const top = shape.top;
                    const width = shape.width;
                    const height = shape.height;
                    
                    // Navigate to this slide before inserting the image
                    slide.load('id');
                    await context.sync();
                    context.presentation.goToSlideById(slide.id);
                    await context.sync();
                    
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
                    // ⭐ The image will be inserted into the slide we navigated to above
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
                    
                    // ⭐ Tag the new image so it can be updated again if needed
                    await context.sync();
                    const shapesAfter = slide.shapes;
                    shapesAfter.load(['items']);
                    await context.sync();
                    
                    for (let m = shapesAfter.items.length - 1; m >= 0; m--) {
                        const potentialImage = shapesAfter.items[m];
                        potentialImage.load(['left', 'top', 'tags']);
                        await context.sync();
                        
                        if (Math.abs(potentialImage.left - left) < 1 && 
                            Math.abs(potentialImage.top - top) < 1) {
                            potentialImage.tags.add('kahoot-qr-code', 'true');
                            await context.sync();
                            break;
                        }
                    }
                }
            }
        }
    });
}
```

**Key technique for image placeholders:**
1. **Navigate to the slide** using `presentation.goToSlideById(slide.id)` BEFORE inserting the image
2. This ensures `Office.context.document.setSelectedDataAsync` inserts the image **into that specific slide**, not the currently visible slide
3. **Re-tag the new image** with the same tag so it can be updated again later

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

**Pattern:** CREATE (with tag) → EVENT → SEARCH (by tag in ALL slides) → UPDATE (all matching elements) → REPEAT

**Remember:** 
- ✅ One tag update = all slides updated
- ✅ Add placeholders to any slide - they all update together
- ✅ For images: navigate to the slide first with `presentation.goToSlideById(slide.id)` before using `setSelectedDataAsync`

📝 **File:** `instructions/DYNAMIC_BUTTONS_TAGS_GUIDE.md`  
🔗 **Related:** `taskpane.js`, `slide-types/*.html`
