/**
 * PowerPoint Shapes Module
 * Handles all PowerPoint shape manipulation and updates
 */

/* global PowerPoint, Office */

import { API_BASE } from './api.js';
import { showError, showStatus } from './ui-manager.js';

/**
 * Generate UUID v4
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Get or create unique ID for slide
 */
export async function getSlideUniqueId(slide, context) {
    slide.load('id');
    await context.sync();
    return slide.id;
}

/**
 * Update Game ID in all slides with the tag
 */
export async function updateGameIdInSlides(gamePin) {
    console.log(`🎮 Starting updateGameIdInSlides with PIN: ${gamePin}`);
    
    if (!gamePin) {
        console.error('❌ No game PIN provided to updateGameIdInSlides');
        return;
    }
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log(`🔍 Searching for kahoot-game-id tags in ${slides.items.length} slides...`);
            
            let foundElements = 0;
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                console.log(`📄 Checking slide ${i + 1} with ${shapes.items.length} shapes`);
                
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    let hasGameIdTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        console.log(`  🏷️ Tag: ${tag.key} = ${tag.value}`);
                        
                        // Case-insensitive comparison
                        if (tag.key.toLowerCase() === 'kahoot-game-id' && tag.value === 'true') {
                            hasGameIdTag = true;
                            console.log('  ✅ Found kahoot-game-id tag!');
                            break;
                        }
                    }
                    
                    if (hasGameIdTag) {
                        console.log(`📝 Updating shape in slide ${i + 1}`);
                        shape.load(['textFrame', 'name', 'type']);
                        await context.sync();
                        
                        console.log(`  Shape type: ${shape.type}, name: ${shape.name}`);
                        
                        try {
                            // Format PIN as XXX-XXX
                            const formattedPin = gamePin.slice(0, 3) + '-' + gamePin.slice(3);
                            
                            const textRange = shape.textFrame.textRange;
                            textRange.text = formattedPin;
                            await context.sync();
                            
                            foundElements++;
                            console.log(`✅ Updated game PIN to: ${formattedPin} in slide ${i + 1}`);
                        } catch (textError) {
                            console.error(`❌ Error updating text in slide ${i + 1}:`, textError);
                        }
                    }
                }
            }
            
            console.log(`✅ Total game ID elements updated: ${foundElements}`);
        });
    } catch (error) {
        console.error('❌ Error updating game ID in slides:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

/**
 * Reset participants number in all slides with the tag
 */
export async function resetParticipantsNumInSlides() {
    console.log(`👥 Starting resetParticipantsNumInSlides - resetting to 0`);
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log(`🔍 Searching for kahoot-participants-num tags in ${slides.items.length} slides...`);
            
            let foundElements = 0;
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                console.log(`📄 Checking slide ${i + 1} with ${shapes.items.length} shapes`);
                
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    let hasParticipantsNumTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        console.log(`  🏷️ Tag: ${tag.key} = ${tag.value}`);
                        
                        // Case-insensitive comparison
                        if (tag.key.toLowerCase() === 'kahoot-participants-num' && tag.value === 'true') {
                            hasParticipantsNumTag = true;
                            console.log('  ✅ Found kahoot-participants-num tag!');
                            break;
                        }
                    }
                    
                    if (hasParticipantsNumTag) {
                        console.log(`📝 Resetting participants number in slide ${i + 1}`);
                        shape.load(['textFrame', 'name', 'type']);
                        await context.sync();
                        
                        console.log(`  Shape type: ${shape.type}, name: ${shape.name}`);
                        
                        try {
                            const textRange = shape.textFrame.textRange;
                            textRange.text = '0';
                            await context.sync();
                            
                            foundElements++;
                            console.log(`✅ Reset participants number to 0 in slide ${i + 1}`);
                        } catch (textError) {
                            console.error(`❌ Error updating text in slide ${i + 1}:`, textError);
                        }
                    }
                }
            }
            
            console.log(`✅ Total participants number elements reset: ${foundElements}`);
        });
    } catch (error) {
        console.error('❌ Error resetting participants number in slides:', error);
        console.error('Error details:', error.message, error.stack);
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
            
            console.log(`🔍 Searching for kahoot-participants-num tags in ${slides.items.length} slides...`);
            
            let foundElements = 0;
            
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
                    
                    let hasParticipantsNumTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        // Case-insensitive comparison
                        if (tag.key.toLowerCase() === 'kahoot-participants-num' && tag.value === 'true') {
                            hasParticipantsNumTag = true;
                            break;
                        }
                    }
                    
                    if (hasParticipantsNumTag) {
                        console.log(`📝 Updating participants number in slide ${i + 1} to ${count}`);
                        shape.load(['textFrame', 'name', 'type']);
                        await context.sync();
                        
                        try {
                            const textRange = shape.textFrame.textRange;
                            textRange.text = String(count);
                            await context.sync();
                            
                            foundElements++;
                            console.log(`✅ Updated participants number to ${count} in slide ${i + 1}`);
                        } catch (textError) {
                            console.error(`❌ Error updating text in slide ${i + 1}:`, textError);
                        }
                    }
                }
            }
            
            console.log(`✅ Total participants number elements updated: ${foundElements}`);
        });
    } catch (error) {
        console.error('❌ Error updating participants number in slides:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

/**
 * Update QR Code in slides with image from server
 */
export async function updateQrCodeInSlides(hashId, gamePin) {
    console.log(`📱 Starting updateQrCodeInSlides with hash ID: ${hashId}, game PIN: ${gamePin}`);
    
    if (!gamePin) {
        console.error('❌ No game PIN provided to updateQrCodeInSlides');
        return;
    }
    
    try {
        // Build QR code URL for PLAYERS (port 8080)
        // Remove any dashes from game PIN for URL
        const cleanPin = gamePin.replace(/-/g, '');
        const qrCodeUrl = `${API_BASE}qr-code-player/${cleanPin}`;
        console.log('📸 Player QR Code URL:', qrCodeUrl);
        
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log(`🔍 Searching for kahoot-qr-code tags in ${slides.items.length} slides...`);
            
            // STEP 1: Collect all QR placeholders first (before any deletion)
            const qrPlaceholders = [];
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                console.log(`📄 Checking slide ${i + 1} with ${shapes.items.length} shapes`);
                
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    let hasQrCodeTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        console.log(`  🏷️ Tag: ${tag.key} = ${tag.value}`);
                        
                        // Case-insensitive comparison
                        if (tag.key.toLowerCase() === 'kahoot-qr-code' && tag.value === 'true') {
                            hasQrCodeTag = true;
                            console.log('  ✅ Found kahoot-qr-code tag!');
                            break;
                        }
                    }
                    
                    if (hasQrCodeTag) {
                        // Load placeholder properties and save for later
                        shape.load(['left', 'top', 'width', 'height', 'name']);
                        await context.sync();
                        
                        qrPlaceholders.push({
                            shape: shape,
                            slideIndex: i + 1,
                            left: shape.left,
                            top: shape.top,
                            width: shape.width,
                            height: shape.height
                        });
                        
                        console.log(`📝 Queued QR placeholder in slide ${i + 1} at (${shape.left}, ${shape.top})`);
                    }
                }
            }
            
            console.log(`\n📋 Found ${qrPlaceholders.length} QR placeholder(s) to update\n`);
            
            // STEP 2: Now update all placeholders (after collecting them all)
            let foundElements = 0;
            
            for (const placeholder of qrPlaceholders) {
                const { shape, slideIndex, left, top, width, height } = placeholder;
                
                console.log(`\n📝 Updating QR code ${foundElements + 1}/${qrPlaceholders.length} from slide ${slideIndex}`);
                
                try {
                    // Format game PIN for display
                    const formattedPin = gamePin.includes('-') ? gamePin : `${gamePin.slice(0, 3)}-${gamePin.slice(3)}`;
                    
                    console.log(`   Placeholder position: ${left}, ${top}, Size: ${width}x${height}`);
                            
                            // Download QR code image FIRST (before any deletion)
                            console.log('📥 Downloading QR code image from:', qrCodeUrl);
                            const imageResponse = await fetch(qrCodeUrl);
                            
                            if (!imageResponse.ok) {
                                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
                            }
                            
                            const imageBlob = await imageResponse.blob();
                            console.log(`📦 Image size: ${imageBlob.size} bytes`);
                            
                            // Convert to base64 (WITHOUT the data URL prefix for Office API)
                            const base64Image = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    let result = reader.result;
                                    // Remove the data URL prefix (e.g., "data:image/png;base64,")
                                    if (result.includes(',')) {
                                        result = result.split(',')[1];
                                    }
                                    resolve(result);
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(imageBlob);
                            });
                            
                            console.log('✅ QR image downloaded and ready');
                            console.log('📸 Base64 image length:', base64Image.length);
                            
                            // Delete the placeholder shape
                            console.log('🗑️ Deleting placeholder shape...');
                            shape.delete();
                            await context.sync();
                            console.log('✅ Placeholder deleted');
                            
                            // Insert new QR image at the same position
                            // NOTE: This will insert into slide 1 (current limitation of PowerPoint Desktop API)
                            console.log('🖼️ Inserting new QR image...');
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
                                        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
                                            console.log('✅ Image inserted successfully');
                                            resolve();
                                        } else {
                                            console.error('❌ Image insertion failed:', asyncResult.error.message);
                                            reject(new Error(asyncResult.error.message));
                                        }
                                    }
                                );
                            });
                            
                            // Now find the newly inserted image and tag it as the NEW placeholder
                            console.log('🔍 Looking for the newly inserted image to tag it...');
                            await context.sync();
                            
                            // IMPORTANT: Refresh the slide shapes to get the newly inserted image
                            // The image is always inserted in slide 1 (PowerPoint Desktop limitation)
                            const firstSlide = slides.items[0];
                            const shapesAfter = firstSlide.shapes;
                            shapesAfter.load(['items']);
                            await context.sync();
                            
                            console.log(`   Total shapes in slide 1 after insertion: ${shapesAfter.items.length}`);
                            
                            // Find the MOST RECENTLY ADDED image at the expected position
                            // We search backwards (from the end) to find the newest shape
                            let imageTagged = false;
                            for (let m = shapesAfter.items.length - 1; m >= 0; m--) {
                                const potentialImage = shapesAfter.items[m];
                                potentialImage.load(['type', 'left', 'top', 'tags']);
                                await context.sync();
                                
                                console.log(`   Checking shape ${m}: type=${potentialImage.type}, pos=${potentialImage.left},${potentialImage.top}`);
                                
                                // Check if it's at the same position as our old placeholder
                                // AND doesn't already have the kahoot-qr-code tag (to avoid retagging)
                                if (Math.abs(potentialImage.left - left) < 1 && 
                                    Math.abs(potentialImage.top - top) < 1) {
                                    
                                    // Check if already tagged (to avoid duplicates)
                                    const existingTags = potentialImage.tags;
                                    existingTags.load(['items']);
                                    await context.sync();
                                    
                                    let alreadyTagged = false;
                                    for (let t = 0; t < existingTags.items.length; t++) {
                                        const existingTag = existingTags.items[t];
                                        existingTag.load(['key', 'value']);
                                        await context.sync();
                                        
                                        if (existingTag.key.toLowerCase() === 'kahoot-qr-code' && existingTag.value === 'true') {
                                            alreadyTagged = true;
                                            console.log(`   Shape ${m} already has kahoot-qr-code tag, skipping...`);
                                            break;
                                        }
                                    }
                                    
                                    if (!alreadyTagged) {
                                        // Tag it as the QR code placeholder for next update
                                        console.log(`🏷️ Tagging new QR image (shape ${m}) as placeholder...`);
                                        potentialImage.tags.add('kahoot-qr-code', 'true');
                                        potentialImage.tags.add('kahoot-qr-url', qrCodeUrl);
                                        potentialImage.tags.add('kahoot-qr-gamepin', gamePin);
                                        await context.sync();
                                        console.log('✅ QR image tagged as new placeholder');
                                        imageTagged = true;
                                        break;
                                    }
                                }
                            }
                            
                            if (!imageTagged) {
                                console.warn(`⚠️ Could not find and tag the new QR image - it may not update next time`);
                            }
                            
                            foundElements++;
                            console.log(`✅ QR Code replaced placeholder in slide ${slideIndex}`);
                            console.log(`   Game PIN: ${formattedPin}`);
                            console.log(`   💡 QR image is now the placeholder for next update`);
                            
                        } catch (updateError) {
                            console.error(`❌ Error updating QR code in slide ${slideIndex}:`, updateError);
                            console.error('   Details:', updateError.message);
                        }
            }
            
            console.log(`✅ Total QR Code elements updated: ${foundElements}`);
        });
    } catch (error) {
        console.error('❌ Error updating QR code in slides:', error);
        console.error('Error details:', error.message, error.stack);
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
        containerArea.tags.add('kahoot-participants-area', 'true');
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
                        
                        if (tag.key.toLowerCase() === 'kahoot-participants-area' && tag.value === 'true') {
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
                
                if (tag.key.toLowerCase() === 'kahoot-participant-pill') {
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
 * Insert Game ID button/textbox
 */
export async function insertGameIdButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Default game ID
                const gameId = '123-456';
                
                // Add a text box with game ID and dynamic tag
                const textBox = slide.shapes.addTextBox(gameId, {
                    left: 100,
                    top: 50,
                    width: 300,
                    height: 80
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for dynamic updates
                textBox.tags.add('kahoot-game-id', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                
                textRange.font.size = 32;
                textRange.font.color = '#667eea';
                textRange.font.bold = true;
                
                await context.sync();
                console.log('✅ Dynamic game ID added to slide');
                showError('✅ מזהה משחק נוסף לשקף!');
            }
        });
    } catch (error) {
        console.error('Error adding game ID:', error);
        showError('שגיאה בהוספת מזהה משחק');
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
                textBox.tags.add('kahoot-participants-num', 'true');
                
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
 * Insert QR Code placeholder
 */
export async function insertQrCodeButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length === 0) {
                showError('אנא בחר שקף תחילה');
                return;
            }
            
            const slide = slides.items[0];
            
            // QR code dimensions - standard size
            const qrSize = 200; // 200x200 points
            const qrLeft = 500; // Right side of slide
            const qrTop = 100;  // Top area
            
            // Create a placeholder shape with QR code tag
            const placeholder = slide.shapes.addTextBox('📱 QR Code\n\nיתעדכן בזמן המשחק', {
                left: qrLeft,
                top: qrTop,
                width: qrSize,
                height: qrSize
            });
            
            placeholder.load(['textFrame', 'tags']);
            await context.sync();
            
            // Add tag for dynamic updates
            placeholder.tags.add('kahoot-qr-code', 'true');
            await context.sync();
            
            // Style the text
            const textRange = placeholder.textFrame.textRange;
            textRange.load(['font']);
            await context.sync();
            
            textRange.font.size = 20;
            textRange.font.color = '#9b59b6';
            textRange.font.bold = true;
            
            await context.sync();
            
            // Try to style the placeholder (border and fill) - optional
            try {
                placeholder.load(['fill', 'line']);
                await context.sync();
                
                placeholder.fill.setSolidColor('#f0e6ff'); // Light purple background
                placeholder.line.color = '#9b59b6'; // Purple border
                placeholder.line.weight = 3;
                
                await context.sync();
                console.log('✅ Border and fill applied');
            } catch (styleError) {
                console.log('⚠️ Could not apply border/fill (not critical):', styleError.message);
            }
            
            console.log('✅ QR Code placeholder added to slide');
            console.log(`   Position: ${qrLeft}, ${qrTop}`);
            console.log(`   Size: ${qrSize} x ${qrSize}`);
            showError('✅ QR Code נוסף לשקף!');
        });
    } catch (error) {
        console.error('Error adding QR code placeholder:', error);
        showError('שגיאה בהוספת QR Code');
    }
}

/**
 * Add Question Time textbox
 */
export async function addQuestionTime() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Add a text box with default time value
                const textBox = slide.shapes.addTextBox('30', {
                    left: 600,
                    top: 50,
                    width: 100,
                    height: 60
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for identification
                textBox.tags.add('kahoot-question-time', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font', 'paragraphFormat']);
                await context.sync();
                
                textRange.font.size = 36;
                textRange.font.color = '#667eea';
                textRange.font.bold = true;
                
                // Set alignment - use try/catch in case alignment is not supported
                try {
                    textRange.paragraphFormat.alignment = PowerPoint.ParagraphAlignment.Center;
                } catch (alignError) {
                    console.log('Could not set text alignment:', alignError);
                }
                
                await context.sync();
                console.log('✅ Question time added to slide');
                showError('✅ זמן שאלה נוסף לשקף!');
            }
        });
    } catch (error) {
        console.error('Error adding question time:', error);
        showError('שגיאה בהוספת זמן שאלה');
    }
}

/**
 * Add Respondents Count textbox
 */
export async function addRespondentsCount() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Add a text box with default respondents value
                const textBox = slide.shapes.addTextBox('99', {
                    left: 600,
                    top: 130,
                    width: 100,
                    height: 60
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for identification
                textBox.tags.add('kahoot-respondents-count', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font', 'paragraphFormat']);
                await context.sync();
                
                textRange.font.size = 36;
                textRange.font.color = '#f5576c';
                textRange.font.bold = true;
                
                // Set alignment - use try/catch in case alignment is not supported
                try {
                    textRange.paragraphFormat.alignment = PowerPoint.ParagraphAlignment.Center;
                } catch (alignError) {
                    console.log('Could not set text alignment:', alignError);
                }
                
                await context.sync();
                console.log('✅ Respondents count added to slide');
                showError('✅ מספר עונים נוסף לשקף!');
            }
        });
    } catch (error) {
        console.error('Error adding respondents count:', error);
        showError('שגיאה בהוספת מספר עונים');
    }
}

/**
 * Add Answers Distribution Bar Chart
 * Creates a dynamic bar chart with 4 answer options using shapes and text
 */
export async function addAnswersDistribution() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length === 0) {
                showError('אנא בחר שקף תחילה');
                return;
            }
            
            const slide = slides.items[0];
            
            // Chart configuration
            const slideWidth = 960; // 16:9 Aspect Ratio
            const slideHeight = 540;
            
            // Chart dimensions - Narrower bars, wider spacing
            const barWidth = 50; // Narrower bars
            const barSpacing = 50; // Wider spacing
            const maxBarHeight = slideHeight * 0.50; // 50% of slide height (270)
            
            // Calculate total width to center properly
            const totalChartWidth = (barWidth * 4) + (barSpacing * 3);
            const chartLeft = (slideWidth - totalChartWidth) / 2;
            
            // Position: 15% from bottom (bottom at 85% of slide height)
            const chartBottom = slideHeight * 0.85; 
            const chartTop = chartBottom - maxBarHeight;
            
            // Answer data with default values (Red 8, Blue 12, Yellow 0, Green 2)
            const answers = [
                { number: 1, color: '#C00000', borderColor: '#8C0000', value: 8, label: '1' }, // Very Dark Red
                { number: 2, color: '#205285', borderColor: '#143255', value: 12, label: '2' }, // Very Dark Blue
                { number: 3, color: '#FFD966', borderColor: '#CCAE33', value: 0, label: '3' }, // Dark Goldenrod
                { number: 4, color: '#92D050', borderColor: '#649628', value: 2, label: '4' }  // Dark Green
            ];
            
            // Helper to get color by number
            const getColorByNumber = (num) => {
                const ans = answers.find(a => a.number === num);
                return ans ? ans.color : '#808080';
            };
            
            const getBorderColorByNumber = (num) => {
                const ans = answers.find(a => a.number === num);
                return ans ? ans.borderColor : '#000000';
            };
            
            // Find max value for initial scaling
            const maxValue = Math.max(...answers.map(a => a.value), 1);
            
            // Underline color (Dark Navy/Black)
            const underlineColor = '#0f243e';
            
            // Create bars and labels for each answer
            for (let i = 0; i < answers.length; i++) {
                const answer = answers[i];
                const barLeft = chartLeft + i * (barWidth + barSpacing);
                
                // Calculate initial height based on default values
                const calculatedHeight = (answer.value / maxValue) * maxBarHeight;
                // If value is 0, height is effectively 0 (we'll hide it)
                const barHeight = answer.value === 0 ? 0 : Math.max(calculatedHeight, 2);
                
                // 1. Create bar (rectangle)
                const bar = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle);
                bar.left = barLeft;
                // If height is 0, we position it at the bottom line
                bar.top = chartTop + (maxBarHeight - (barHeight || 1)); 
                bar.width = barWidth;
                bar.height = barHeight || 1; // Need non-zero height for creation
                
                // Load fill and tags first
                bar.load(['fill', 'tags', 'line']); // Load line as well
                await context.sync();
                
                // Set visibility based on value - COMPLETELY HIDE if 0
                if (answer.value === 0) {
                    bar.visible = false;
                    // Also make line invisible just in case
                    if (bar.line) bar.line.visible = false;
                }
                
                // Style the bar fill
                bar.fill.setSolidColor(answer.color);
                
                // Force load line to ensure it exists
                bar.load(['line', 'lineFormat']);
                await context.sync();
                
                // Set border properties - try line or lineFormat
                if (bar.line) {
                    bar.line.visible = true;
                    bar.line.color = answer.borderColor;
                    bar.line.weight = 1.5;
                } else if (bar.lineFormat) {
                    // Fallback for some API versions
                    bar.lineFormat.visible = true;
                    bar.lineFormat.color = answer.borderColor;
                    bar.lineFormat.weight = 1.5;
                } else {
                    console.warn('Line property not found on bar shape (tried line and lineFormat)');
                }
                
                await context.sync();
                
                // Add tags for dynamic updates
                bar.tags.add('kahoot-answer-bar', 'true');
                bar.tags.add('answer-number', answer.number.toString());
                
                await context.sync();
                
                // 2. Create Bottom Underline (Dark line below bar)
                const underlineWidth = barWidth + 20; // Wider than bar
                const underlineLeft = barLeft - 10;   // Centered relative to bar
                
                const underline = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle);
                underline.left = underlineLeft;
                // Move underline up slightly to overlap/hide the bottom border of the bar
                underline.top = chartTop + maxBarHeight - 0.5;
                underline.width = underlineWidth;
                underline.height = 2; // Thin line
                
                // Load properties including line to remove border
                underline.load(['fill', 'line']);
                await context.sync();
                
                underline.fill.setSolidColor(underlineColor);
                
                // Remove border from underline shape to make it crisp
                if (underline.line) {
                    underline.line.visible = false;
                } else if (underline.lineFormat) {
                    underline.lineFormat.visible = false;
                }
                
                await context.sync();
                
                // 3. Create value label on TOP of bar (Thinner font)
                const valueLabel = slide.shapes.addTextBox(answer.value.toString(), {
                    left: barLeft - 10, // Allow some overflow space
                    top: chartTop + (maxBarHeight - barHeight) - 30, // 30px above the bar
                    width: barWidth + 20,
                    height: 30
                });
                
                // Load textFrame
                valueLabel.load(['textFrame', 'tags']);
                await context.sync();
                
                // Set BOTH vertical and horizontal alignment using middleCentered
                try {
                    valueLabel.textFrame.verticalAlignment = PowerPoint.TextVerticalAlignment.middleCentered;
                } catch (e) {
                    console.log('Using string for middleCentered alignment');
                    valueLabel.textFrame.verticalAlignment = 'MiddleCentered';
                }
                
                // Disable auto-sizing to ensure centering works properly
                try {
                    valueLabel.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                } catch (e) {
                    console.log('Could not set autoSizeSetting');
                }
                
                // Style the text
                const valueText = valueLabel.textFrame.textRange;
                valueText.load(['font']);
                await context.sync();
                
                // Set font properties
                valueText.font.size = 16;
                valueText.font.name = "Calibri Light";
                valueText.font.color = '#000000';
                valueText.font.bold = false;
                
                await context.sync();
                
                // Add tags for dynamic updates
                valueLabel.tags.add('kahoot-answer-value', 'true');
                valueLabel.tags.add('answer-number', answer.number.toString());
                
                await context.sync();
                
                // 4. Create answer number label BELOW the underline
                const numberLabel = slide.shapes.addTextBox(answer.label, {
                    left: barLeft,
                    top: chartTop + maxBarHeight + 5, // Just below the underline
                    width: barWidth,
                    height: 30
                });
                
                // Load textFrame
                numberLabel.load(['textFrame']);
                await context.sync();
                
                // Set BOTH vertical and horizontal alignment using middleCentered
                try {
                    numberLabel.textFrame.verticalAlignment = PowerPoint.TextVerticalAlignment.middleCentered;
                } catch (e) {
                    console.log('Using string for middleCentered alignment');
                    numberLabel.textFrame.verticalAlignment = 'MiddleCentered';
                }
                
                // Disable auto-sizing to ensure centering works properly
                try {
                    numberLabel.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                } catch (e) {
                    console.log('Could not set autoSizeSetting');
                }
                
                // Style the text
                const numberText = numberLabel.textFrame.textRange;
                numberText.load(['font']);
                await context.sync();
                
                // Set font properties
                numberText.font.size = 24;
                numberText.font.name = "Arial";
                numberText.font.color = answer.color;
                numberText.font.bold = true;
                
                await context.sync();
                
                await context.sync();
            }
            
            console.log('✅ Answers distribution bar chart added to slide');
            showStatus('פילוג תשובות נוסף לשקף!', 'success');
        });
    } catch (error) {
        console.error('Error adding answers distribution:', error);
        showError('שגיאה בהוספת פילוג תשובות');
    }
}

/**
 * Update Answers Distribution Bar Chart
 * Updates all bar charts across all slides based on answer data
 * @param {Object} answersData - Object with answer counts: { 1: 25, 2: 18, 3: 20, 4: 16 }
 */
export async function updateAnswersDistribution(answersData) {
    console.log('🔄 Updating answers distribution chart:', answersData);
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            // Configuration (Fallback values)
            const slideHeight = 540;
            const maxBarHeight = slideHeight * 0.50; // 270
            const defaultChartBottom = slideHeight * 0.85; // 459
            const defaultChartTop = defaultChartBottom - maxBarHeight; // 135
            
            // Answer colors configuration (must match creation logic)
            const answerColors = {
                1: { fill: '#C00000', border: '#8C0000' },
                2: { fill: '#205285', border: '#143255' },
                3: { fill: '#FFD966', border: '#CCAE33' },
                4: { fill: '#92D050', border: '#649628' }
            };
            
            // Find max value for scaling
            const maxValue = Math.max(...Object.values(answersData), 1);
            
            // Search ALL slides for answer bar elements
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                const baselines = {}; // Store baseline Y for each answer number
                const pendingLabels = []; // Store labels to update after finding baselines
                
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    // Load tags FIRST to identify if we should process this shape
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    // Check if this is an answer bar or value label
                    let isAnswerBar = false;
                    let isAnswerValue = false;
                    let answerNumber = null;
                    
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        // Case insensitive comparison for keys
                        const key = tag.key.toLowerCase();
                        
                        if (key === 'kahoot-answer-bar') {
                            isAnswerBar = true;
                        } else if (key === 'kahoot-answer-value') {
                            isAnswerValue = true;
                        } else if (key === 'answer-number') {
                            answerNumber = parseInt(tag.value);
                        }
                    }
                    
                    // Update bar height
                    if (isAnswerBar && answerNumber && answersData[answerNumber] !== undefined) {
                        // Now safely load properties for the bar shape
                        shape.load(['top', 'height', 'visible', 'line', 'fill']);
                        await context.sync();

                        // Calculate Baseline from CURRENT position
                        // If currently height > 0, baseline = top + height.
                        // If currently height == 0 (hidden), baseline = top.
                        let currentBaseline = shape.top + shape.height;
                        
                        // Store baseline for the label to use
                        baselines[answerNumber] = currentBaseline;
                        
                        const value = answersData[answerNumber];
                        // Recalculate height logic
                        const calculatedHeight = maxValue > 0 ? (value / maxValue) * maxBarHeight : 0;
                        // If value is 0, we want height 0 (hidden). If > 0, min height 2.
                        const finalHeight = value === 0 ? 0 : Math.max(calculatedHeight, 2); 
                        
                        if (value === 0) {
                            // Force hide everything
                            shape.visible = false;
                            
                            // Extra measures to ensure it's hidden
                            if (shape.line) {
                                shape.line.visible = false;
                            }
                            if (shape.fill) {
                                shape.fill.clear();
                            }
                            
                            // Set height to 0 and top to the baseline
                            shape.height = 0;
                            shape.top = currentBaseline; 
                            
                            console.log(`✅ Hiding bar ${answerNumber} (value 0) at baseline ${currentBaseline}`);
                        } else {
                            // Ensure it is visible
                            shape.visible = true;
                            
                            // Restore fill if it was cleared
                            if (shape.fill) {
                                const colors = answerColors[answerNumber];
                                if (colors) {
                                    shape.fill.setSolidColor(colors.fill);
                                }
                            }
                            
                            // Restore border
                            if (shape.line) {
                                shape.line.visible = true;
                                const colors = answerColors[answerNumber];
                                if (colors) {
                                    shape.line.color = colors.border;
                                    shape.line.weight = 1.5;
                                }
                            }
                            
                            // Update bar: grow upwards from baseline
                            shape.height = finalHeight;
                            shape.top = currentBaseline - finalHeight;
                            
                            console.log(`✅ Updating bar ${answerNumber} to height ${finalHeight}, top ${shape.top}`);
                        }
                    }
                    
                    // Collect value label for later update
                    if (isAnswerValue && answerNumber && answersData[answerNumber] !== undefined) {
                        // Load properties needed for label
                        shape.load(['top', 'height', 'textFrame']);
                        await context.sync();

                        pendingLabels.push({
                            shape: shape,
                            answerNumber: answerNumber
                        });
                    }
                }
                
                // Pass 2: Update labels using collected baselines
                for (const item of pendingLabels) {
                    const { shape, answerNumber } = item;
                    const value = answersData[answerNumber];
                    
                    // Calculate height again for label positioning
                    const calculatedHeight = maxValue > 0 ? (value / maxValue) * maxBarHeight : 0;
                    const finalHeight = Math.max(calculatedHeight, 2);
                    const actualBarHeight = value === 0 ? 0 : finalHeight;
                    
                    // Determine baseline - use found one or fallback to default
                    const baseline = baselines[answerNumber] !== undefined 
                        ? baselines[answerNumber] 
                        : (defaultChartTop + maxBarHeight);
                    
                    // Update text
                    const textRange = shape.textFrame.textRange;
                    textRange.text = value.toString();
                    
                    // Update position (above the bar)
                    // baseline - barHeight - offset
                    shape.top = baseline - actualBarHeight - 30;
                    
                    console.log(`✅ Updated value ${answerNumber}: ${value} at top ${shape.top}`);
                }
                
                if (pendingLabels.length > 0) {
                    await context.sync();
                }
            }
            
            console.log('✅ Answers distribution chart updated across all slides');
        });
    } catch (error) {
        console.error('❌ Error updating answers distribution:', error);
        throw error;
    }
}

/**
 * Update all kahoot-question-time elements to initial value (ALL slides)
 * Used for initialization/reset
 * @param {number} timeValue - Initial time value to set
 */
export async function updateAllQuestionTimeElements(timeValue) {
    console.log(`🔄 Resetting ALL question time elements to: ${timeValue}`);
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            let updatedCount = 0;
            
            // Search ALL slides for kahoot-question-time tags
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
                    
                    // Check if this shape has kahoot-question-time tag
                    let hasQuestionTimeTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        if (tag.key.toLowerCase() === 'kahoot-question-time' && tag.value === 'true') {
                            hasQuestionTimeTag = true;
                            break;
                        }
                    }
                    
                    if (hasQuestionTimeTag) {
                        // Update the text
                        shape.load(['textFrame']);
                        await context.sync();
                        
                        const textRange = shape.textFrame.textRange;
                        textRange.text = timeValue.toString();
                        await context.sync();
                        
                        updatedCount++;
                    }
                }
            }
            
            console.log(`✅ Reset ${updatedCount} question time element(s) across all slides to: ${timeValue}`);
        });
    } catch (error) {
        console.error('❌ Error resetting question time elements:', error);
        throw error;
    }
}

/**
 * Update ALL kahoot-respondents-count elements across all slides
 * Similar to updateAllQuestionTimeElements but for respondents count
 * @param {number} count - Number of respondents who answered
 */
export async function updateAllRespondentsCountElements(count) {
    console.log(`🔄 Resetting ALL respondents count elements to: ${count}`);
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            let updatedCount = 0;
            
            // Search ALL slides for kahoot-respondents-count tags
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
                    
                    // Check if this shape has kahoot-respondents-count tag
                    let hasRespondentsTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        if (tag.key.toLowerCase() === 'kahoot-respondents-count' && tag.value === 'true') {
                            hasRespondentsTag = true;
                            break;
                        }
                    }
                    
                    if (hasRespondentsTag) {
                        // Update the text
                        shape.load(['textFrame']);
                        await context.sync();
                        
                        const textRange = shape.textFrame.textRange;
                        textRange.text = count.toString();
                        await context.sync();
                        
                        updatedCount++;
                    }
                }
            }
            
            console.log(`✅ Reset ${updatedCount} respondents count element(s) across all slides to: ${count}`);
        });
    } catch (error) {
        console.error('❌ Error resetting respondents count elements:', error);
        throw error;
    }
}

/**
 * Update kahoot-question-time in CURRENT slide only
 * Used during timer countdown
 * @param {number} timeValue - Time value to display
 * @param {number} [slideNumber] - Optional: specific slide number to update (1-based). If not provided, uses selected slide.
 */
export async function updateCurrentSlideQuestionTime(timeValue, slideNumber = null) {
    try {
        await PowerPoint.run(async (context) => {
            let currentSlide;
            
            if (slideNumber !== null) {
                // Use specific slide number (for presentation mode)
                const presentation = context.presentation;
                const slides = presentation.slides;
                slides.load('items');
                await context.sync();
                
                const slideIndex = slideNumber - 1; // Convert to 0-based index
                if (slideIndex >= 0 && slideIndex < slides.items.length) {
                    currentSlide = slides.items[slideIndex];
                } else {
                    console.error(`❌ Invalid slide number: ${slideNumber}`);
                    return;
                }
            } else {
                // Use selected slide (for edit mode)
                const slides = context.presentation.getSelectedSlides();
                slides.load('items');
                await context.sync();
                
                if (slides.items.length === 0) {
                    console.log('⚠️ No slide selected');
                    return;
                }
                
                currentSlide = slides.items[0];
            }
            
            const shapes = currentSlide.shapes;
            shapes.load(['items']);
            await context.sync();
            
            let updatedCount = 0;
            
            // Search only current slide for kahoot-question-time tags
            for (let j = 0; j < shapes.items.length; j++) {
                const shape = shapes.items[j];
                const tags = shape.tags;
                tags.load(['items']);
                await context.sync();
                
                // Check if this shape has kahoot-question-time tag
                let hasQuestionTimeTag = false;
                for (let k = 0; k < tags.items.length; k++) {
                    const tag = tags.items[k];
                    tag.load(['key', 'value']);
                    await context.sync();
                    
                    if (tag.key.toLowerCase() === 'kahoot-question-time' && tag.value === 'true') {
                        hasQuestionTimeTag = true;
                        break;
                    }
                }
                
                if (hasQuestionTimeTag) {
                    // Update the text
                    shape.load(['textFrame']);
                    await context.sync();
                    
                    const textRange = shape.textFrame.textRange;
                    textRange.text = timeValue.toString();
                    await context.sync();
                    
                    updatedCount++;
                }
            }
        });
    } catch (error) {
        console.error('❌ Error updating current slide timer:', error);
        throw error;
    }
}

/**
 * Update "מספר עונים" (respondents count) in current slide
 * Similar to updateCurrentSlideQuestionTime but for kahoot-respondents-count tag
 * @param {number} count - Number of respondents who answered
 * @param {number} slideNumber - Optional slide number (for presentation mode)
 */
export async function updateCurrentSlideRespondentsCount(count, slideNumber = null) {
    try {
        await PowerPoint.run(async (context) => {
            let currentSlide;
            
            if (slideNumber !== null) {
                // Use specific slide number (for presentation mode)
                const presentation = context.presentation;
                const slides = presentation.slides;
                slides.load('items');
                await context.sync();
                
                const slideIndex = slideNumber - 1; // Convert to 0-based index
                if (slideIndex >= 0 && slideIndex < slides.items.length) {
                    currentSlide = slides.items[slideIndex];
                } else {
                    console.error(`❌ Invalid slide number: ${slideNumber}`);
                    return;
                }
            } else {
                // Use selected slide (for edit mode)
                const slides = context.presentation.getSelectedSlides();
                slides.load('items');
                await context.sync();
                
                if (slides.items.length === 0) {
                    console.log('⚠️ No slide selected');
                    return;
                }
                
                currentSlide = slides.items[0];
            }
            
            const shapes = currentSlide.shapes;
            shapes.load(['items']);
            await context.sync();
            
            let updatedCount = 0;
            
            // Search only current slide for kahoot-respondents-count tags
            for (let j = 0; j < shapes.items.length; j++) {
                const shape = shapes.items[j];
                const tags = shape.tags;
                tags.load(['items']);
                await context.sync();
                
                // Check if this shape has kahoot-respondents-count tag
                let hasRespondentsTag = false;
                for (let k = 0; k < tags.items.length; k++) {
                    const tag = tags.items[k];
                    tag.load(['key', 'value']);
                    await context.sync();
                    
                    if (tag.key.toLowerCase() === 'kahoot-respondents-count' && tag.value === 'true') {
                        hasRespondentsTag = true;
                        break;
                    }
                }
                
                if (hasRespondentsTag) {
                    // Update the text
                    shape.load(['textFrame']);
                    await context.sync();
                    
                    const textRange = shape.textFrame.textRange;
                    textRange.text = count.toString();
                    await context.sync();
                    
                    updatedCount++;
                    console.log(`✅ Updated respondents count to ${count} in current slide`);
                }
            }
        });
    } catch (error) {
        console.error('❌ Error updating respondents count:', error);
        throw error;
    }
}

/**
 * Add Leaderboard Elements
 * Creates 6 textboxes for top 3 players (Name + Score for each)
 */
export async function addLeaderboardElements() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length === 0) {
                showError('אנא בחר שקף תחילה');
                return;
            }
            
            const slide = slides.items[0];
            
            // Configuration
            const startTop = 150;
            const rowHeight = 80;
            const gap = 30;
            
            // Default Data
            const defaultData = [
                { rank: 1, name: "שחקן מקום 1", score: "9999" },
                { rank: 2, name: "שחקן מקום 2", score: "3333" },
                { rank: 3, name: "שחקן מקום 3", score: "0" }
            ];
            
            for (let i = 0; i < defaultData.length; i++) {
                const item = defaultData[i];
                const currentTop = startTop + i * (rowHeight + gap);
                
                // 1. Name Textbox (Right aligned)
                const nameBox = slide.shapes.addTextBox(item.name, {
                    left: 510, // Push to right side (Right edge at 910)
                    top: currentTop,
                    width: 400,
                    height: rowHeight
                });
                
                // 2. Score Textbox (Left side)
                const scoreBox = slide.shapes.addTextBox(item.score, {
                    left: 50, // Push further left (Left edge at 50)
                    top: currentTop,
                    width: 200,
                    height: rowHeight
                });
                
                // Load properties
                nameBox.load(['textFrame', 'tags']);
                scoreBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Remove right margin for name box to ensure it sticks to the edge
                nameBox.textFrame.marginRight = 0;
                
                // Add Tags
                nameBox.tags.add('kahoot-leaderboard-name', 'true');
                nameBox.tags.add('leaderboard-rank', item.rank.toString());
                
                scoreBox.tags.add('kahoot-leaderboard-score', 'true');
                scoreBox.tags.add('leaderboard-rank', item.rank.toString());
                
                await context.sync();
                
                // Style Name
                const nameTextRange = nameBox.textFrame.textRange;
                // IMPORTANT: Load paragraphFormat explicitly on the textRange first
                nameTextRange.load(['font', 'paragraphFormat']);
                await context.sync();
                
                nameTextRange.font.size = 40;
                nameTextRange.font.bold = true;
                nameTextRange.font.color = '#000000';
                
                // Explicitly set alignment on the paragraphFormat property of the textRange
                if (nameTextRange.paragraphFormat) {
                    try {
                        nameTextRange.paragraphFormat.alignment = "Right"; // Use string directly to be safe
                    } catch (e) {
                        console.log('Alignment setting failed:', e);
                    }
                } else {
                    console.warn("Could not access paragraphFormat for nameBox");
                }

                // Disable auto-sizing to ensure alignment works properly
                try {
                    nameBox.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                } catch (e) {
                    console.log('Could not set autoSizeSetting');
                }
                
                // Style Score
                const scoreTextRange = scoreBox.textFrame.textRange;
                scoreTextRange.load(['font', 'paragraphFormat']);
                await context.sync();
                
                scoreTextRange.font.size = 40;
                scoreTextRange.font.bold = true;
                scoreTextRange.font.color = '#0078d4'; // Blue for score
                
                if (scoreTextRange.paragraphFormat) {
                    try {
                        scoreTextRange.paragraphFormat.alignment = "Left"; // Use string directly
                    } catch (e) {
                        console.log('Alignment setting failed:', e);
                    }
                }
                
                await context.sync();
            }
            
            console.log('✅ Leaderboard elements added');
            showStatus('אלמנטים לטבלת מובילים נוספו בהצלחה!', 'success');
        });
    } catch (error) {
        console.error('Error adding leaderboard elements:', error);
        showError('שגיאה בהוספת אלמנטים לטבלת מובילים');
    }
}

/**
 * Update Leaderboard
 * Updates leaderboard elements across all slides
 * @param {Array} leaderboardData - Array of objects { name: "Player1", score: 1200 }
 */
export async function updateLeaderboard(leaderboardData) {
    console.log('🏆 Updating leaderboard with data:', leaderboardData);
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            // We only care about top 3
            const top3 = leaderboardData.slice(0, 3);
            
            // Search ALL slides
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
                    
                    let isLeaderboardName = false;
                    let isLeaderboardScore = false;
                    let rank = null;
                    
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        const key = tag.key.toLowerCase();
                        
                        if (key === 'kahoot-leaderboard-name') {
                            isLeaderboardName = true;
                        } else if (key === 'kahoot-leaderboard-score') {
                            isLeaderboardScore = true;
                        } else if (key === 'leaderboard-rank') {
                            rank = parseInt(tag.value);
                        }
                    }
                    
                    if (rank && (isLeaderboardName || isLeaderboardScore)) {
                        const player = top3[rank - 1]; // rank 1 is index 0
                        
                        shape.load(['textFrame']);
                        await context.sync();
                        
                        const textRange = shape.textFrame.textRange;
                        
                        if (player) {
                            if (isLeaderboardName) {
                                textRange.text = player.name || player.nickname || "Unknown";
                            } else if (isLeaderboardScore) {
                                textRange.text = (player.score || 0).toString();
                            }
                        } else {
                            // Less than 3 players, clear text
                            textRange.text = ""; 
                        }
                        
                        await context.sync();
                    }
                }
            }
            
            console.log('✅ Leaderboard updated across all slides');
        });
    } catch (error) {
        console.error('❌ Error updating leaderboard:', error);
    }
}
