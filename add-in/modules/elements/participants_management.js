/**
 * Participants Management Shapes Module
 * Handles participant count, area, and list elements in PowerPoint slides
 */

/* global PowerPoint */

import { showError, showStatus } from '../ui/manager.js';
import { getVisibleParticipantsData } from '../core/websocket.js';
import { hideParticipants, getHiddenParticipantIds } from '../core/state.js';

/**
 * Reset all participant-related shapes in slides:
 * - Deletes quizngo-participant-item shapes (icons/names from previous game)
 * - Deletes quizngo-participant-pill shapes (pills from previous game)
 * - Resets quizngo-participants-area text to waiting state
 * - Resets quizngo-content-type=participants-list container text
 * OPTIMIZED: Batch loading with minimal context.sync() calls
 */
export async function resetParticipantShapesInSlides() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();

            // Batch 1: Load all shapes for all slides
            for (const slide of slides.items) {
                slide.shapes.load('items');
            }
            await context.sync();

            // Batch 2: Load all tags for all shapes
            for (const slide of slides.items) {
                for (const shape of slide.shapes.items) {
                    shape.tags.load('items/key, items/value');
                }
            }
            await context.sync();

            // Process: Find shapes to delete or reset
            for (const slide of slides.items) {
                for (const shape of slide.shapes.items) {
                    if (shape.tags && shape.tags.items) {
                        for (const tag of shape.tags.items) {
                            const key = tag.key.toLowerCase();

                            // Delete participant items (icons/names)
                            if (key === 'quizngo-participant-item' && tag.value === 'true') {
                                try { shape.delete(); } catch (e) { /* ignore */ }
                                break;
                            }

                            // Delete participant pills
                            if (key === 'quizngo-participant-pill' && tag.value === 'true') {
                                try { shape.delete(); } catch (e) { /* ignore */ }
                                break;
                            }

                            // Reset participants area text
                            if (key === 'quizngo-participants-area' && tag.value === 'true') {
                                try {
                                    shape.textFrame.textRange.text = 'מחכים למשתתפים...';
                                } catch (e) { /* ignore */ }
                                break;
                            }

                            // Reset participants list container text
                            if (key === 'quizngo-content-type' && tag.value.toLowerCase() === 'participants-list') {
                                try {
                                    shape.textFrame.textRange.text = 'מחכים למשתתפים...';
                                } catch (e) { /* ignore */ }
                                break;
                            }
                        }
                    }
                }
            }

            // Single sync for all updates/deletions
            await context.sync();
        });
    } catch (error) {
        console.error('❌ Error resetting participant shapes in slides:', error);
    }
}

/**
 * Reset participants number in all slides with the tag
 * OPTIMIZED: Batch loading with minimal context.sync() calls
 */
export async function resetParticipantsNumInSlides() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            // Batch 1: Load all shapes for all slides
            for (const slide of slides.items) {
                slide.shapes.load('items');
            }
            await context.sync();
            
            // Batch 2: Load all tags for all shapes
            for (const slide of slides.items) {
                for (const shape of slide.shapes.items) {
                    shape.tags.load('items/key, items/value');
                }
            }
            await context.sync();
            
            // Process: Find shapes with the tag and update them (no sync needed)
            const shapesToUpdate = [];
            for (const slide of slides.items) {
                for (const shape of slide.shapes.items) {
                    if (shape.tags && shape.tags.items) {
                        for (const tag of shape.tags.items) {
                            if (tag.key.toLowerCase() === 'quizngo-participants-num' && tag.value === 'true') {
                                shapesToUpdate.push(shape);
                                break;
                            }
                        }
                    }
                }
            }
            
            // Update all shapes at once
            for (const shape of shapesToUpdate) {
                try {
                    shape.textFrame.textRange.text = '0';
                } catch (e) { /* ignore shapes without textFrame */ }
            }
            
            // Single sync for all updates
            await context.sync();
        });
    } catch (error) {
        console.error('❌ Error resetting participants number in slides:', error);
    }
}

/**
 * Update participants number in all slides with the tag
 */
export async function updateParticipantsNumInSlides(count) {
    console.log(`👥 Starting updateParticipantsNumInSlides with count: ${count}`);
    
    if (count === undefined || count === null) {
        console.error('❌ No count provided to updateParticipantsNumInSlides');
        return;
    }
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log(`🔍 Searching for quizngo-participants-num tags in ${slides.items.length} slides...`);
            
            let foundElements = 0;
            
            // Optimization: Iterate per slide and load data in batches to avoid rate limits/errors
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                
                // Step 1: Load all shapes in the slide
                shapes.load('items');
                await context.sync();
                
                // Step 2: Load tags for all shapes in the slide
                for (let j = 0; j < shapes.items.length; j++) {
                    // Load the items of the tags collection, and specifically key/value of those items
                    shapes.items[j].tags.load('items/key, items/value');
                }
                
                // Sync once for all tags in the slide
                await context.sync();
                
                const shapesToUpdate = [];

                // Step 3: Identify shapes that need updating
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    let hasParticipantsNumTag = false;
                    
                    if (shape.tags && shape.tags.items) {
                        for (let k = 0; k < shape.tags.items.length; k++) {
                            const tag = shape.tags.items[k];
                            // Case-insensitive comparison
                            if (tag.key.toLowerCase() === 'quizngo-participants-num' && tag.value === 'true') {
                                hasParticipantsNumTag = true;
                                break;
                            }
                        }
                    }
                    
                    if (hasParticipantsNumTag) {
                        shapesToUpdate.push(shape);
                    }
                }

                // Step 4: Load textFrame for ONLY the relevant shapes (safer than loading for all)
                if (shapesToUpdate.length > 0) {
                    for (const shape of shapesToUpdate) {
                        shape.textFrame.load('textRange');
                    }
                    
                    // Sync once for all textFrames
                    await context.sync();
                    
                    // Step 5: Update the text
                    for (const shape of shapesToUpdate) {
                        try {
                            shape.textFrame.textRange.text = String(count);
                            foundElements++;
                            console.log(`✅ Updated participants number to ${count} in slide ${i + 1}`);
                        } catch (textError) {
                            console.error(`❌ Error updating text in slide ${i + 1}:`, textError);
                        }
                    }
                }
            }
            
            // No final sync needed as we synced in batches

            
            console.log(`✅ Total participants number elements updated: ${foundElements}`);
        });
    } catch (error) {
        console.error('❌ Error updating participants number in slides:', error);
        console.error('Error details:', error.message, error.stack);
        throw error;
    }
}

/**
 * Insert Participants Number button/textbox
 */
export async function insertParticipantsNumButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Default participants number
                const participantsNum = '99';
                
                // Add a text box with participant count and dynamic tag
                const textBox = slide.shapes.addTextBox(participantsNum, {
                    left: 100,
                    top: 150,
                    width: 250,
                    height: 60
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for dynamic updates
                textBox.tags.add('quizngo-participants-num', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                
                textRange.font.size = 24;
                textRange.font.color = '#0078d4';
                textRange.font.bold = true;
                
                await context.sync();
                console.log('✅ Dynamic participants number added to slide');
                showError('✅ מספר משתתפים נוסף לשקף!');
            }
        });
    } catch (error) {
        console.error('Error adding participants number:', error);
        showError('שגיאה בהוספת מספר המשתתפים');
    }
}

/**
 * Create participant pill shapes in slide
 */
export async function createParticipantPillShapes(context, slide, participants) {
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
            pillBg.tags.add('quizngo-participant-pill', 'true');
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
            pillText.tags.add('quizngo-participant-pill', 'true');
            pillText.tags.add('participant-name', participant);
            
            await context.sync();
            console.log(`✅ נוצר pill עבור: ${participant}`);
        }
        
        console.log('✅ כל ה-pills נוצרו בהצלחה!');
    } catch (error) {
        console.error('❌ שגיאה ביצירת pills:', error);
    }
}

/**
 * Insert live participants area into slide
 */
export async function insertLiveParticipantsArea() {
    await PowerPoint.run(async (context) => {
        // קבל את השקף הנוכחי
        const slides = context.presentation.getSelectedSlides();
        slides.load('items');
        await context.sync();
        
        if (slides.items.length === 0) {
            console.error('אין שקף נבחר');
            throw new Error('אנא בחר שקף תחילה');
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
        containerArea.tags.add('quizngo-participants-area', 'true');
        await context.sync();
        
        // עכשיו צור pills בודדים אם יש משתתפים
        if (panelParticipants.length > 0) {
            await createParticipantPillShapes(context, currentSlide, panelParticipants);
        }
        
        console.log('✅ אזור משתתפים חי נוצר בהצלחה!');
    });
}

/**
 * Update live participants area in slide (called from WebSocket updates)
 */
export async function updateLiveParticipantsInSlide(participantsList) {
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
                shapes.load(['items']);
                await context.sync();
                
                console.log(`📄 Checking slide ${i + 1} with ${shapes.items.length} shapes`);
                
                // Find and update participants area
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    let hasParticipantsTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        if (tag.key.toLowerCase() === 'quizngo-participants-area' && tag.value === 'true') {
                            hasParticipantsTag = true;
                            break;
                        }
                    }
                    
                    if (hasParticipantsTag) {
                        console.log(`✅ Found participants area in slide ${i + 1}`);
                        foundAreas++;
                        
                        // Update content
                        await updateParticipantsAreaContent(context, slide, shape, participantsList);
                    }
                }
            }
            
            console.log(`✅ Updated ${foundAreas} participants areas`);
        });
    } catch (error) {
        console.error('❌ Error updating live participants:', error);
    }
}

/**
 * Update participants area content
 */
async function updateParticipantsAreaContent(context, slide, participantsArea, participantsList) {
    try {
        participantsArea.load(['textFrame']);
        await context.sync();
        
        const textRange = participantsArea.textFrame.textRange;
        
        // Update content
        let content = '👥 משתתפים פעילים\n\n';
        
        if (participantsList.length === 0) {
            content += 'מחכים למשתתפים...';
        } else {
            content += `משתתפים:\n${participantsList.join(' • ')}\n\n`;
            content += `סה"כ: ${participantsList.length}`;
        }
        
        textRange.text = content;
        
        // Update pills
        // First, remove old pills
        const shapes = slide.shapes;
        shapes.load(['items']);
        await context.sync();
        
        for (let i = shapes.items.length - 1; i >= 0; i--) {
            const shape = shapes.items[i];
            const tags = shape.tags;
            tags.load(['items']);
            await context.sync();
            
            for (let j = 0; j < tags.items.length; j++) {
                const tag = tags.items[j];
                tag.load(['key', 'value']);
                await context.sync();
                
                if (tag.key.toLowerCase() === 'quizngo-participant-pill') {
                    shape.delete();
                    await context.sync();
                    break;
                }
            }
        }
        
        // Create new pills
        if (participantsList.length > 0) {
            await createParticipantPillShapes(context, slide, participantsList);
        }
        
        console.log('✅ Participants area content updated');
        
    } catch (error) {
        console.error('❌ Error updating participants area content:', error);
    }
}

/**
 * Insert a button/area to display the participants list
 */
export async function insertParticipantsListButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length === 0) return;
            const slide = slides.items[0];

            // Create a text box that will act as the "participants list area"
            const textBox = slide.shapes.addTextBox('אזור רשימת משתתפים', {
                left: 50,
                top: 200,
                width: 600,
                height: 300
            });
            
            // Add tags so we can find it later
            textBox.tags.add('quizngo-content-type', 'participants-list');
            
            // Load line property before using it
            textBox.load(['line', 'lineFormat', 'fill', 'textFrame']);
            await context.sync();
            
            // Style it
            try {
                textBox.fill.setSolidColor('#F3F2F1');
                
                // Set border - try line first, then lineFormat
                if (textBox.line) {
                    textBox.line.color = '#0078D4';
                    textBox.line.weight = 2;
                } else if (textBox.lineFormat) {
                    textBox.lineFormat.visible = true;
                    textBox.lineFormat.color = '#0078D4';
                    textBox.lineFormat.weight = 2;
                }
                
                textBox.textFrame.textRange.font.color = '#0078D4';
                textBox.textFrame.textRange.paragraphFormat.alignment = 'Center';
                
                if (typeof PowerPoint.TextVerticalAlignment !== 'undefined') {
                    textBox.textFrame.verticalAlignment = PowerPoint.TextVerticalAlignment.middleCentered;
                } else {
                    textBox.textFrame.verticalAlignment = 'MiddleCentered';
                }
            } catch (styleError) {
                console.warn('Could not apply some styling to participants list area:', styleError);
            }
            
            await context.sync();
            console.log('✅ Participants list area inserted');
        });
    } catch (error) {
        showError('שגיאה בהוספת רשימת משתתפים', error);
    }
}

/**
 * Update the participants list in all slides
 * Creates icon + name display for each participant
 * OPTIMIZED: Batch loading with minimal context.sync() calls
 */
export async function updateParticipantsListInSlides() {
    try {
        // Get VISIBLE participants only (excludes hidden ones)
        const visibleParticipantsData = getVisibleParticipantsData();
        
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            // Batch 1: Load all shapes for all slides
            for (const slide of slides.items) {
                slide.shapes.load('items');
            }
            await context.sync();
            
            // Batch 2: Load all tags and properties for all shapes
            for (const slide of slides.items) {
                for (const shape of slide.shapes.items) {
                    shape.tags.load('items/key, items/value');
                    shape.load(['id', 'left', 'top', 'width', 'height']);
                }
            }
            await context.sync();
            
            let foundCount = 0;
            
            for (const slide of slides.items) {
                 // First pass: find container and existing participant shapes
                 let containerShape = null;
                 let containerLeft = 0;
                 let containerTop = 0;
                 let containerHeight = 0; // Track container height for overflow detection
                 let containerWidth = 600;
                 const existingParticipantIds = new Set(); // Track existing participants
                 const existingParticipantShapes = new Map(); // Track shapes by participant ID
                 const allParticipantItems = []; // Track ALL participant items regardless of ID
                 
                 for (const shape of slide.shapes.items) {
                     let isParticipantsList = false;
                     let isParticipantItem = false;
                     let participantId = null;
                     
                     if (shape.tags && shape.tags.items) {
                         for(let t=0; t<shape.tags.items.length; t++) {
                             const tagKey = shape.tags.items[t].key.toLowerCase();
                             const tagValue = shape.tags.items[t].value;
                             if(tagKey === 'quizngo-content-type' && tagValue.toLowerCase() === 'participants-list') {
                                 isParticipantsList = true;
                             }
                             if(tagKey === 'quizngo-participant-item' && tagValue === 'true') {
                                 isParticipantItem = true;
                             }
                             if(tagKey === 'participant-id' && tagValue) {
                                 participantId = tagValue;
                             }
                         }
                     }
                     
                     if (isParticipantsList) {
                         containerShape = shape;
                         containerLeft = shape.left;
                         containerTop = shape.top;
                         containerWidth = shape.width;
                         containerHeight = shape.height; // Track height for overflow detection
                         foundCount++;
                     }
                     
                     if (isParticipantItem) {
                         allParticipantItems.push(shape);
                     }
                     
                     // Track existing participant IDs and their shapes
                     if (participantId) {
                         existingParticipantIds.add(participantId);
                         if (!existingParticipantShapes.has(participantId)) {
                             existingParticipantShapes.set(participantId, []);
                         }
                         existingParticipantShapes.get(participantId).push(shape);
                     }
                 }
                 
                 // 1. Get VISIBLE participants only (excludes permanently hidden ones)
                 const participants = Array.from(visibleParticipantsData.values());

                 // 2. Universal cleanup if no participants (Works even if container is missing)
                 if (participants.length === 0) {
                     try {
                         for (const s of allParticipantItems) s.delete();
                         if (containerShape) containerShape.textFrame.textRange.text = 'מחכים למשתתפים...';
                         await context.sync();
                     } catch(e) { /* ignore cleanup errors */ }
                 }

                 // 3. Render logic (Requires container)
                 if (containerShape && participants.length > 0) {
                     // Clear "Waiting..."
                     try { containerShape.textFrame.textRange.text = ''; } catch(e) {}
                     
                     // Layout settings
                     const itemWidth = 90;   // Width per participant
                     const iconHeight = 72;  // Height for icon (72 points = 1 inch)
                     const nameHeight = 22;  // Height for name (14 font + small padding)
                     const itemHeight = iconHeight + nameHeight; // Total height
                     const gapX = 15;
                     const gapY = 10;
                     const itemsPerRow = Math.floor((containerWidth - 40) / (itemWidth + gapX));
                     const startY = containerTop + 15;
                     const paddingBottom = 15; // Bottom padding inside container
                     
                     // Calculate maximum rows that fit in container
                     const availableHeight = containerHeight - 30; // 15 top + 15 bottom padding
                     const maxRows = Math.floor(availableHeight / (itemHeight + gapY));
                     const maxVisibleParticipants = maxRows * itemsPerRow;
                     
                     // === OVERFLOW HANDLING ===
                     // Check if adding new participants would exceed container bounds
                     // If so, hide the first row permanently
                     let participantsToDisplay = participants;
                     
                     const totalRequiredRows = Math.ceil(participants.length / itemsPerRow);
                     if (totalRequiredRows > maxRows && participants.length > 0) {
                         // Get the first row's participants (they will be hidden permanently)
                         const firstRowParticipants = participants.slice(0, itemsPerRow);
                         const firstRowIds = firstRowParticipants.map(p => p.userId || p.id);
                         
                         // Hide these participants permanently
                         hideParticipants(firstRowIds);
                         
                         // Remove them from display list (they're now hidden)
                         participantsToDisplay = participants.slice(itemsPerRow);
                         
                         // Delete shapes for hidden participants
                         for (const hiddenId of firstRowIds) {
                             if (existingParticipantShapes.has(hiddenId)) {
                                 const shapes = existingParticipantShapes.get(hiddenId);
                                 for (const s of shapes) {
                                     try { s.delete(); } catch(e) {}
                                 }
                                 existingParticipantShapes.delete(hiddenId);
                                 existingParticipantIds.delete(hiddenId);
                             }
                         }
                     }
                     
                     // Find NEW participants only (not already displayed, excluding hidden)
                     const hiddenIds = getHiddenParticipantIds();
                     const newParticipants = participantsToDisplay.filter(p => {
                         const pId = p.userId || p.id;
                         return !existingParticipantIds.has(pId) && !hiddenIds.has(pId);
                     });
                     
                     // Helper to check if row needs rebuild
                     const actualVisualCount = Math.floor(allParticipantItems.length / 2);
                     
                     if (newParticipants.length > 0 || actualVisualCount > 0) {
                         // Smart Update Strategy
                         
                         const totalCount = participantsToDisplay.length;
                         
                         // Determine start index for update logic
                         // Default: Full Refresh (Start at 0) - handles removals, shuffles, re-ordering
                         let firstItemInLastRow = 0;
                         
                         // OPTIMIZATION: If this is purely an ADDITION to the end, we can skip earlier rows
                         // Condition: We have exactly as many visible items as (Total - New), meaning no deletions occurred
                         const purelyAdding = (newParticipants.length > 0) && (actualVisualCount === totalCount - newParticipants.length);
                         
                         if (purelyAdding) {
                             const existingCount = actualVisualCount;
                             const lastRowBeforeNew = existingCount > 0 ? Math.floor((existingCount - 1) / itemsPerRow) : -1;
                             const isLastRowFull = existingCount > 0 && (existingCount % itemsPerRow === 0);
                             
                             firstItemInLastRow = isLastRowFull ? existingCount : (lastRowBeforeNew >= 0 ? lastRowBeforeNew * itemsPerRow : 0);
                         }
                         
                         // Determine visual cleanup zone (Y threshold)
                         const rowOfStartIndex = Math.floor(firstItemInLastRow / itemsPerRow);
                         const yThreshold = startY + rowOfStartIndex * (itemHeight + gapY) - 5; 
                         
                         // Track which shape IDs we are keeping/updating so we don't delete them
                         const keptShapeIds = new Set();
                         
                         // Rebuild/Update from the clean slate point
                         const participantsToProcess = participantsToDisplay.slice(firstItemInLastRow);
                         
                         for (let i = 0; i < participantsToProcess.length; i++) {
                             const participant = participantsToProcess[i];
                             const pId = participant.userId || participant.id;
                             
                             const totalIndex = firstItemInLastRow + i;
                             const row = Math.floor(totalIndex / itemsPerRow);
                             const col = totalIndex % itemsPerRow;
                             
                             const totalItemsInThisRow = Math.min(totalCount - row * itemsPerRow, itemsPerRow);
                             const thisRowWidth = totalItemsInThisRow * itemWidth + (totalItemsInThisRow - 1) * gapX;
                             const rowStartX = containerLeft + (containerWidth - thisRowWidth) / 2;
                             
                             const x = rowStartX + col * (itemWidth + gapX);
                             const y = startY + row * (itemHeight + gapY);
                             
                             // Check if we have existing shapes for this participant
                             let reused = false;
                             if (pId && existingParticipantShapes.has(pId)) {
                                 const shapes = existingParticipantShapes.get(pId);
                                 // We expect roughly 2 shapes (Icon ~70px height, Name ~22px height)
                                 let iconFound = false;
                                 let nameFound = false;
                                 
                                 for (const s of shapes) {
                                     // Simple heuristic by height
                                     if (Math.abs(s.height - iconHeight) < 10) {
                                         // It's the icon
                                         s.left = x;
                                         s.top = y;
                                         keptShapeIds.add(s.id);
                                         iconFound = true;
                                     } else if (Math.abs(s.height - nameHeight) < 10) {
                                         // It's the name
                                         s.left = x;
                                         s.top = y + iconHeight;
                                         keptShapeIds.add(s.id);
                                         nameFound = true;
                                     }
                                 }
                                 
                                 if (iconFound && nameFound) {
                                     reused = true;
                                    //  console.log(`♻️ Reused shapes for ${participant.nickname}`);
                                 }
                             }
                             
                             if (!reused) {
                                 // Create new if not reused
                                 // Icon
                                 const iconBox = slide.shapes.addTextBox(participant.icon || '👤', { left: x, top: y, width: itemWidth, height: iconHeight });
                                 
                                 // Batch Configure Icon (No internal syncs)
                                 iconBox.fill.setSolidColor('#98E37E'); // Light Green Background
                                 iconBox.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                                 iconBox.textFrame.verticalAlignment = PowerPoint.TextVerticalAlignment.middleCentered;
                                 iconBox.textFrame.textRange.font.size = 65; 
                                 
                                 iconBox.tags.add('quizngo-participant-item', 'true');
                                 iconBox.tags.add('participant-id', pId || '');
                                 
                                 // Name
                                 const nameBox = slide.shapes.addTextBox(participant.nickname || '', { left: x, top: y + iconHeight, width: itemWidth, height: nameHeight });
                                 
                                 // Batch Configure Name
                                 nameBox.fill.setSolidColor('#F68038'); // Orange Background
                                 nameBox.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                                 nameBox.textFrame.verticalAlignment = PowerPoint.TextVerticalAlignment.middleCentered;
                                 nameBox.textFrame.textRange.font.size = 14; 
                                 nameBox.textFrame.textRange.font.bold = true;
                                 nameBox.textFrame.textRange.font.color = '#FFFFFF'; // White text
                                 
                                 nameBox.tags.add('quizngo-participant-item', 'true');
                                 nameBox.tags.add('participant-id', pId || '');
                             }
                        }
                        
                        // Delete orphans (shapes in the visual zone that were NOT reused)
                        for (const shape of allParticipantItems) {
                             if (shape.top >= yThreshold) {
                                 if (!keptShapeIds.has(shape.id)) {
                                     try { shape.delete(); } catch(e) {}
                                 }
                             }
                        }
                        
                       // Execute updates, creations, and deletions in ONE atomic batch
                       await context.sync();
                     }
                 }
            }
        });
        
    } catch (error) {
        console.error('❌ Error updating participants list:', error);
    }
}
